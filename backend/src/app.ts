import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool, PoolClient } from "pg";
import { z } from "zod";
import {
  ApiError,
  requireOk,
  security,
  sha,
  transaction,
  AuthProvider,
  ObjectStore,
} from "./core.js";
import {
  model,
  audit,
  has,
  loadAreas,
  Areas,
  CompanyPolicy,
  BankPolicy,
  persistBank,
  persistCompany,
  assertRevision,
  bounded,
} from "./data.js";
export interface Options {
  pool: Pool;
  key: string;
  origin: string;
  secureCookies: boolean;
  auth: AuthProvider;
  objects: ObjectStore;
  scan?: (
    file: Buffer,
    mime: string,
  ) => Promise<"clean" | "pending" | "rejected">;
  serveFrontend?: boolean;
}
export async function build(options: Options) {
  const { pool, auth, objects } = options,
    cipher = security(options.key),
    app = Fastify({
      logger: false,
      bodyLimit: 15 * 1024 * 1024,
      trustProxy: false,
    });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  const sidName = options.secureCookies
    ? "__Host-ab_session"
    : "ab_local_session";
  app.addHook("onSend", async (req, reply, payload) => {
    reply
      .header(
        "Content-Security-Policy",
        req.url.startsWith("/api/documents/") && req.url.endsWith("/file")
          ? "sandbox; default-src 'none'"
          : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      )
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin");
    if (req.url.startsWith("/api/")) reply.header("Cache-Control", "no-store");
    return payload;
  });
  app.addHook("onRequest", async (req) => {
    if (req.url.startsWith("/api/") && !["GET", "HEAD"].includes(req.method)) {
      requireOk(req.headers.origin === options.origin, 403, "invalidOrigin");
      requireOk(req.headers["x-ab-request"] === "1", 403, "csrfRequired");
    }
  });
  app.setErrorHandler((e: any, req, reply) => {
    let status = e.status || e.statusCode || 422,
      code = e.code || e.message;
    if (code === "duplicate") {
      status = 409;
    } else if (["denied", "ownerProtected"].includes(code)) {
      status = 403;
    } else if (e.code === "23505") {
      status = 409;
      code = "duplicate";
    } else if (e.code === "23503" || e.code === "23514" || e.code === "22P02") {
      status = 422;
      code = "invalidReference";
    } else if (e.code === "42501") {
      status = 403;
      code = "denied";
    } else if (
      !(e instanceof ApiError) &&
      ![
        "denied",
        "required",
        "invalid",
        "duplicate",
        "closedTerminal",
        "invalidIban",
        "invalidSwift",
        "invalidDates",
        "invalidBalance",
        "invalidFields",
        "invalidMetadata",
        "invalidDate",
        "invalidSelection",
        "invalidEmirate",
        "cycle",
        "departmentCompany",
        "ownerProtected",
        "invalidId",
        "invalidReference",
      ].includes(code)
    ) {
      code = status >= 500 ? "unavailable" : "invalid";
    }
    if (status < 400 || status > 599) status = 422;
    reply.code(status).send({ error: code });
  });
  const uuid = (v: any) => z.uuid().parse(v);
  const session = async (req: any) => {
    const sid = req.cookies[sidName];
    requireOk(
      typeof sid === "string" && /^[A-Za-z0-9_-]{43}$/.test(sid),
      401,
      "loginRequired",
    );
    const r = await pool.query("select * from ab.read_session($1)", [sha(sid)]);
    requireOk(r.rowCount === 1, 401, "loginRequired");
    const s = r.rows[0];
    let identity;
    try {
      identity = await auth.verify(cipher.open(s.token_cipher).token);
    } catch {
      throw new ApiError(401, "loginRequired");
    }
    const p = await pool.query("select * from ab.principal($1)", [
      uuid(identity),
    ]);
    requireOk(
      p.rows[0]?.id === s.user_id && p.rows[0]?.tenant_id === s.tenant_id,
      401,
      "loginRequired",
    );
    if (!["GET", "HEAD"].includes(req.method)) {
      const expected = cipher.digest("csrf:" + sid),
        actual = String(req.headers["x-csrf-token"] || "");
      requireOk(
        actual.length === expected.length &&
          timingSafeEqual(Buffer.from(actual), Buffer.from(expected)),
        403,
        "csrfRequired",
      );
    }
    return { ...s, sid };
  };
  const call =
    (handler: (c: PoolClient, m: any, s: any, req: any) => Promise<any>) =>
    async (req: any) => {
      const s = await session(req);
      return transaction(pool, s.tenant_id, s.user_id, async (c) => {
        const key = req.headers["idempotency-key"];
        const fingerprint = cipher.digest(
          req.method + req.url + JSON.stringify(req.body || null),
        );
        if (key) {
          uuid(key);
          const cached = (
            await c.query(
              "select fingerprint,response from ab.request_dedup where actor_id=$1 and key=$2",
              [s.user_id, key],
            )
          ).rows[0];
          if (cached) {
            requireOk(
              cached.fingerprint === fingerprint,
              409,
              "idempotencyConflict",
            );
            return cached.response;
          }
        }
        const result = await handler(
          c,
          await model(c, s.user_id, cipher),
          s,
          req,
        );
        if (key)
          await c.query("insert into ab.request_dedup values($1,$2,$3,$4,$5)", [
            s.tenant_id,
            s.user_id,
            key,
            fingerprint,
            JSON.stringify(result),
          ]);
        return result;
      });
    };
  app.get("/api/health", async () => {
    await pool.query("select 1");
    return {
      mode: "central",
      database: "reachable",
      provider: "configured-not-probed",
    };
  });
  app.post(
    "/api/login",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (req, reply) => {
      const data = z
        .object({
          username: z.string().trim().min(3).max(64),
          password: z.string().min(1).max(128),
        })
        .parse(req.body);
      try {
        const r = await pool.query("select ab.login_identity($1) email", [
          data.username,
        ]);
        const email = r.rows[0]?.email; // Nonexistent names still exercise the provider path.
        const user = await auth.login(
          email || "nonexistent-test-account@invalid.invalid",
          data.password,
        );
        requireOk(email, 401, "loginFailed");
        const actual = await auth.verify(user.token);
        requireOk(actual === user.id, 401, "loginFailed");
        const p = (
          await pool.query("select * from ab.principal($1)", [uuid(user.id)])
        ).rows[0];
        requireOk(p, 401, "loginFailed");
        const sid = randomBytes(32).toString("base64url");
        await transaction(pool, p.tenant_id, p.id, async (c) => {
          await c.query("insert into ab.sessions values($1,$2,$3,$4,$5)", [
            sha(sid),
            p.tenant_id,
            p.id,
            cipher.seal({ token: user.token }),
            new Date(Date.now() + Math.min(user.expiresIn, 3600) * 1000),
          ]);
          await audit(c, p.tenant_id, p.id, "login", "session", null);
        });
        reply.setCookie(sidName, sid, {
          httpOnly: true,
          secure: options.secureCookies,
          sameSite: "strict",
          path: "/",
          maxAge: Math.min(user.expiresIn, 3600),
        });
        return { ok: true };
      } catch {
        throw new ApiError(401, "loginFailed");
      }
    },
  );
  app.post("/api/logout", async (req, reply) => {
    const s = await session(req);
    await transaction(pool, s.tenant_id, s.user_id, async (c) => {
      await c.query(
        "update ab.sessions set expires_at=now() where id_hash=$1",
        [sha(s.sid)],
      );
      await audit(c, s.tenant_id, s.user_id, "logout", "session", null);
    });
    try {
      await auth.logout(cipher.open(s.token_cipher).token);
    } catch {}
    reply.clearCookie(sidName, { path: "/" });
    return { ok: true };
  });
  app.get(
    "/api/bootstrap",
    call(async (c, m, s) => {
      const areas = await loadAreas(c);
      const visibleUsers = m.policy.list(s.user_id);
      const users = [];
      for (const u of visibleUsers) {
        if (!(u.id === s.user_id || m.policy.can(s.user_id, "edit", u))) {
          delete u.emiratesId;
          delete u.nationality;
        }
        if (u.id === s.user_id || m.policy.can(s.user_id, "edit", u)) {
          const p = await c.query(
            "select private_cipher from ab.users where id=$1",
            [u.id],
          );
          if (p.rows[0].private_cipher)
            Object.assign(u, cipher.open(p.rows[0].private_cipher));
        }
        users.push(u);
      }
      const canCompany = m.company.canRead();
      const companies = canCompany
        ? m.state.companies
        : m.state.companies.map((co: any) => ({
            id: co.id,
            englishName: co.englishName,
            arabicName: co.arabicName,
            licenseId: co.licenseId,
          }));
      const ownAudit = (
        await c.query(
          "select * from ab.audit_events where ($1::boolean or actor_id=$2) order by created_at desc limit 500",
          [m.actor.roleId === "owner", s.user_id],
        )
      ).rows.map((r) => ({
        id: r.id,
        at: r.created_at.toISOString(),
        actorId: r.actor_id,
        targetId: r.entity_id,
        action: r.action,
        fields: r.fields,
      }));
      const bankRows = m.bank.list();
      const bankAccountAudit = (
        await c.query(
          "select * from ab.audit_events where entity_type='bank' and entity_id=any($1::text[]) order by created_at",
          [bankRows.map((r: any) => r.id)],
        )
      ).rows.map((r) => ({
        id: r.id,
        at: r.created_at.toISOString(),
        actorId: r.actor_id,
        accountId: r.entity_id,
        action: r.action,
        fields: r.fields,
      }));
      const grants = m.initialGrants.filter((g: any) =>
        visibleUsers.some((u: any) => u.id === g.userId),
      );
      const settings = (await c.query("select key,value from ab.settings"))
        .rows;
      return {
        actor: m.actor,
        audit: ownAudit,
        summary: m.policy.summary(),
        bankAccountAudit,
        csrfToken: cipher.digest("csrf:" + s.sid),
        users,
        roles: m.state.roles,
        companies,
        departments: m.state.departments,
        bankAccounts: m.bank.list(),
        bankReference: m.state.bankReference,
        bankAccountPurposes: m.state.bankAccountPurposes,
        areas,
        grants,
        companyDocumentAlertDays: settings.find(
          (r) => r.key === "companyDocumentAlertDays",
        )?.value || [60, 30, 7],
      };
    }),
  );
  app.post(
    "/api/departments",
    call(async (c, m, s, req) => {
      requireOk(m.actor.roleId === "owner");
      const d = z
        .object({
          companyId: z.uuid(),
          name: z.string().trim().min(1).max(160),
          managerId: z.uuid().optional(),
        })
        .strict()
        .parse(req.body);
      requireOk(
        m.state.companies.some((co: any) => co.id === d.companyId),
        422,
        "invalidReference",
      );
      if (d.managerId)
        requireOk(
          m.state.users.some(
            (u: any) =>
              u.id === d.managerId && u.companyIds.includes(d.companyId),
          ),
          422,
          "invalidReference",
        );
      const id = randomUUID();
      await c.query(
        "insert into ab.departments(id,tenant_id,company_id,name,manager_id)values($1,$2,$3,$4,$5)",
        [id, s.tenant_id, d.companyId, d.name, d.managerId || null],
      );
      await audit(c, s.tenant_id, s.user_id, "created", "department", id, [
        "name",
        "companyId",
        "managerId",
      ]);
      return { id };
    }),
  );
  app.post(
    "/api/companies",
    call(async (c, m, s, req) => ({
      id: await persistCompany(c, m, s.tenant_id, req.body),
    })),
  );
  app.patch(
    "/api/companies/:id",
    call(async (c, m, s, req) => ({
      id: await persistCompany(
        c,
        m,
        s.tenant_id,
        req.body,
        uuid(req.params.id),
      ),
    })),
  );
  app.get(
    "/api/companies/:id",
    call(async (c, m, s, req) => m.company.get(uuid(req.params.id))),
  );
  app.post(
    "/api/bank-accounts",
    call(async (c, m, s, req) => ({
      id: await persistBank(c, m, cipher, s.tenant_id, req.body),
    })),
  );
  app.patch(
    "/api/bank-accounts/:id",
    call(async (c, m, s, req) => ({
      id: await persistBank(
        c,
        m,
        cipher,
        s.tenant_id,
        req.body,
        uuid(req.params.id),
      ),
    })),
  );
  app.get(
    "/api/bank-accounts/:id",
    call(async (c, m, s, req) => m.bank.get(uuid(req.params.id))),
  );
  app.post(
    "/api/references/:kind",
    call(async (c, m, s, req) => {
      requireOk(["bank", "purpose"].includes(req.params.kind), 422, "invalid");
      const row = m.bank.addReference(req.params.kind, bounded(req.body));
      await c.query(
        "insert into ab.bank_references values($1,$2,$3,$4) on conflict do nothing",
        [s.tenant_id, row.id, req.params.kind, row],
      );
      await audit(c, s.tenant_id, s.user_id, "created", "reference", row.id);
      return row;
    }),
  );
  app.post(
    "/api/areas",
    call(async (c, m, s, req) => {
      requireOk(
        has(m.actor, "create_company") ||
          has(m.actor, "edit_company") ||
          has(m.actor, "manage_area_reference"),
      );
      const data = z
        .object({
          emirateId: z.string(),
          ar: z.string().max(160),
          en: z.string().max(160),
        })
        .parse(req.body);
      requireOk(data.ar.trim() || data.en.trim(), 422, "required");
      requireOk(
        Areas.emirates.some((e: any) => e.id === data.emirateId),
        422,
        "invalidEmirate",
      );
      const names = [data.ar, data.en].map(Areas.normalize).filter(Boolean);
      const existing = await c.query(
        "select area_id from ab.area_aliases where emirate_id=$1 and normalized_name=any($2)",
        [data.emirateId, names],
      );
      const ids = [...new Set(existing.rows.map((r) => r.area_id))];
      requireOk(ids.length <= 1, 409, "ambiguousArea");
      if (ids[0]) return { id: ids[0], existing: true };
      const id = randomUUID(),
        row = {
          ar: data.ar.trim(),
          en: data.en.trim(),
          aliases: [],
          sourceId: "central-user",
        };
      await c.query(
        "insert into ab.areas(tenant_id,id,emirate_id,data,created_by)values($1,$2,$3,$4,$5)",
        [s.tenant_id, id, data.emirateId, row, s.user_id],
      );
      for (const name of new Set(names))
        await c.query("insert into ab.area_aliases values($1,$2,$3,$4)", [
          s.tenant_id,
          data.emirateId,
          name,
          id,
        ]);
      await audit(c, s.tenant_id, s.user_id, "created", "area", id);
      return { id };
    }),
  );
  app.patch(
    "/api/settings/alerts",
    call(async (c, m, s, req) => {
      requireOk(m.company.canConfigure());
      const days = CompanyPolicy.alertDays((req.body as any).days);
      await c.query(
        "insert into ab.settings values($1,'companyDocumentAlertDays',$2) on conflict(tenant_id,key)do update set value=excluded.value",
        [s.tenant_id, JSON.stringify(days)],
      );
      await audit(
        c,
        s.tenant_id,
        s.user_id,
        "updated",
        "settings",
        "companyDocumentAlertDays",
        ["days"],
      );
      return { ok: true };
    }),
  );
  // User creation uses the shared scope/owner/escalation checks before any provider enrollment.
  const userSave = async (c: PoolClient, m: any, s: any, req: any) => {
    let input = bounded(req.body);
    const id = req.params.id ? uuid(req.params.id) : undefined;
    let previous: any;
    if (id) {
      previous = m.policy.actor(id);
      requireOk(previous, 404, "notFound");
      assertRevision(previous.revision, input.revision);
      input = { ...previous, ...input };
      const privateRow = (
        await c.query("select private_cipher from ab.users where id=$1", [id])
      ).rows[0];
      if (privateRow?.private_cipher) {
        const privateData = cipher.open(privateRow.private_cipher);
        for (const k of ["emiratesId", "nationality"])
          if (!Object.hasOwn(input, k)) input[k] = privateData[k] || "";
      }
    }
    const saved = m.policy.update(s.user_id, id || null, input, [], {
      roleId: input.baseRole || "employee",
    });
    let authId: string | undefined;
    if (!id) {
      const password = z.string().min(12).max(128).parse(input.password);
      requireOk(
        /[A-Z]/.test(password) &&
          /[a-z]/.test(password) &&
          /\d/.test(password) &&
          /[^a-zA-Z0-9\s]/.test(password) &&
          !/\s/.test(password),
        422,
        "weak",
      );
      authId = await auth.create(saved.email, password);
      uuid(authId);
    }
    const realId = id || randomUUID();
    const {
      emiratesId,
      nationality,
      id: drop,
      roleId,
      status,
      username,
      managerId,
      companyIds,
      departmentIds,
      companyId,
      departmentId,
      revision,
      ...payload
    } = saved;
    if (!id)
      await c.query(
        "insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status,manager_id,data,private_cipher)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          realId,
          s.tenant_id,
          authId,
          saved.email,
          username,
          roleId,
          status,
          managerId || null,
          payload,
          cipher.seal({
            emiratesId: emiratesId || "",
            nationality: nationality || "",
          }),
        ],
      );
    else
      await c.query(
        "update ab.users set username=$2,status=$3,manager_id=$4,data=$5,private_cipher=$6,revision=revision+1,updated_at=now() where id=$1",
        [
          realId,
          username,
          status,
          managerId || null,
          payload,
          cipher.seal({
            emiratesId: emiratesId || "",
            nationality: nationality || "",
          }),
        ],
      );
    // Preserve membership history: UPDATE/INSERT only; inactive rows are retained by a later migration.
    await c.query("select ab.replace_memberships($1,$2,$3,$4)", [
      realId,
      s.tenant_id,
      companyIds,
      departmentIds,
    ]);
    if (status !== "Active") {
      await c.query(
        "update ab.sessions set expires_at=now() where user_id=$1",
        [realId],
      );
      await c.query(
        "with recursive issuers(id) as (select $1::uuid union select g.user_id from ab.permission_grants g join issuers i on g.issuer_id=i.id where g.revoked_at is null) update ab.permission_grants set revoked_at=now() where issuer_id in(select id from issuers)",
        [realId],
      );
    }
    await audit(
      c,
      s.tenant_id,
      s.user_id,
      id ? "updated" : "created",
      "user",
      realId,
      Object.keys(saved).filter(
        (k) =>
          !["id", "revision"].includes(k) &&
          JSON.stringify(saved[k]) !== JSON.stringify(previous?.[k]),
      ),
    );
    return {
      id: realId,
      ...(!id && m.policy.can(s.user_id, "attachments", saved)
        ? {
            enrollmentUploadToken: cipher.seal({
              kind: "initial-user-files",
              tenant: s.tenant_id,
              actor: s.user_id,
              user: realId,
              session: sha(s.sid),
              expiresAt: Date.now() + 5 * 60 * 1000,
            }),
          }
        : {}),
    };
  };
  app.post("/api/users", call(userSave));
  app.patch("/api/users/:id", call(userSave));
  app.post(
    "/api/users/:id/grants",
    call(async (c, m, s, req) => {
      const target = uuid(req.params.id);
      m.policy.grant(s.user_id, target, bounded(req.body));
      const next = m.getNextGrants() || [];
      for (const row of next) {
        if (!z.uuid().safeParse(row.entry.id).success) {
          const g = row.entry,
            id = randomUUID(),
            scope = g.scope;
          await c.query(
            "insert into ab.permission_grants(id,tenant_id,user_id,issuer_id,permission_id,scope_type,company_id,department_id,manager_id,delegable)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
            [
              id,
              s.tenant_id,
              row.userId,
              g.issuer,
              g.action,
              scope.type,
              scope.type === "company" ? scope.id : null,
              scope.type === "department" ? scope.id : null,
              scope.type === "reports" ? scope.id : null,
              g.delegable,
            ],
          );
          await audit(c, s.tenant_id, s.user_id, "granted", "user", target, [
            g.action,
            scope.type,
          ]);
        }
      }
      return { ok: true };
    }),
  );
  app.post(
    "/api/users/:id/revoke",
    call(async (c, m, s, req) => {
      const target = uuid(req.params.id);
      m.policy.revoke(s.user_id, target, uuid((req.body as any).grantId));
      const remaining = (m.getNextGrants() || []).map((g: any) => g.entry.id);
      await c.query(
        "update ab.permission_grants set revoked_at=now() where revoked_at is null and not(id=any($1::uuid[]))",
        [remaining],
      );
      await audit(c, s.tenant_id, s.user_id, "revoked", "user", target, [
        "grants",
      ]);
      return { ok: true };
    }),
  );
  app.get(
    "/api/audit",
    call(async (c, m, s, req) => {
      requireOk(m.actor.roleId === "owner");
      return (
        await c.query(
          "select id,actor_id,actor_type,action,entity_type,entity_id,fields,created_at from ab.audit_events order by created_at desc limit 500",
        )
      ).rows;
    }),
  );
  // Explicit ownership FKs; no generic ownerId that can point outside the tenant/account.
  const documentRight = (
    m: any,
    owner: any,
    write: boolean,
    initialEnrollment = false,
  ) => {
    if (owner.bank_account_id) {
      const row = m.state.bankAccounts.find(
        (b: any) => b.id === owner.bank_account_id,
      );
      requireOk(row, 404, "notFound");
      requireOk(
        m.bank.can(
          write ? "manage_documents" : "view_documents",
          row.companyId,
        ),
      );
    } else if (owner.company_id) {
      requireOk(
        m.state.companies.some((co: any) => co.id === owner.company_id),
        404,
        "notFound",
      );
      requireOk(write ? m.company.canEdit() : m.company.canFiles());
    } else {
      const user = m.policy.actor(owner.user_id);
      requireOk(user, 404, "notFound");
      requireOk(
        m.policy.can(m.actor.id, "attachments", user) &&
          (!write ||
            m.policy.can(m.actor.id, "edit", user) ||
            (initialEnrollment && m.policy.can(m.actor.id, "create", user))),
      );
    }
  };
  app.get(
    "/api/documents",
    call(async (c, m, s, req) => {
      const q = req.query as any,
        owner = {
          company_id: q.companyId ? uuid(q.companyId) : null,
          bank_account_id: q.bankAccountId ? uuid(q.bankAccountId) : null,
          user_id: q.userId ? uuid(q.userId) : null,
        };
      requireOk(
        Object.values(owner).filter(Boolean).length === 1,
        422,
        "invalid",
      );
      documentRight(m, owner, false);
      return (
        await c.query(
          `select d.*,v.id version_id,v.version,v.original_name,v.mime,v.size,v.scan_status,v.title version_title,v.description version_description,v.document_date version_date,v.category version_category,v.parent_version_id from ab.documents d join ab.document_versions v on v.document_id=d.id where d.company_id=$1 or d.bank_account_id=$2 or d.user_id=$3 order by d.created_at,v.version`,
          Object.values(owner),
        )
      ).rows.map((r) => ({
        id: r.id,
        versionId: r.version_id,
        version: r.version,
        title: r.version_title,
        description: r.version_description,
        category: r.version_category,
        date: r.version_date,
        parentVersionId: r.parent_version_id,
        relatedId: r.related_id,
        name: r.original_name,
        mime: r.mime,
        size: r.size,
        scanStatus: r.scan_status,
        createdBy: r.created_by,
        createdAt: r.created_at,
      }));
    }),
  );
  app.post(
    "/api/documents",
    call(async (c, m, s, req) => {
      const d = z
        .object({
          companyId: z.uuid().optional(),
          bankAccountId: z.uuid().optional(),
          userId: z.uuid().optional(),
          category: z.enum([
            "original",
            "annex",
            "amendment",
            "correspondence",
            "other",
            "tradeLicense",
            "establishmentCard",
            "labourCard",
            "photo",
            "idFront",
            "idBack",
            "passport",
            "contract",
            "driving",
          ]),
          title: z.string().trim().min(1).max(200),
          description: z.string().max(4000).default(""),
          date: z.string(),
          parentId: z.uuid().nullable().optional(),
          parentVersionId: z.uuid().nullable().optional(),
          relation: z.enum(["related", "version"]).default("related"),
          enrollmentToken: z.string().max(4096).optional(),
          name: z.string().min(1).max(200),
          mime: z.string(),
          base64: z.string().min(4).max(13981016),
        })
        .strict()
        .parse(req.body);
      const owner = {
        company_id: d.companyId || null,
        bank_account_id: d.bankAccountId || null,
        user_id: d.userId || null,
      };
      requireOk(
        Object.values(owner).filter(Boolean).length === 1,
        422,
        "invalid",
      );
      let initialEnrollment = false;
      if (
        owner.user_id &&
        d.enrollmentToken &&
        [
          "photo",
          "idFront",
          "idBack",
          "passport",
          "contract",
          "driving",
        ].includes(d.category)
      ) {
        try {
          const cap = cipher.open(d.enrollmentToken);
          initialEnrollment =
            cap.kind === "initial-user-files" &&
            cap.tenant === s.tenant_id &&
            cap.actor === s.user_id &&
            cap.user === owner.user_id &&
            cap.session === sha(s.sid) &&
            cap.expiresAt > Date.now();
          if (initialEnrollment) {
            const old = await c.query(
              "select id from ab.documents where user_id=$1 and category=$2",
              [owner.user_id, d.category],
            );
            initialEnrollment = !old.rowCount && !d.parentId;
          }
        } catch {
          initialEnrollment = false;
        }
      }
      documentRight(m, owner, true, initialEnrollment);
      requireOk(BankPolicy.validDate(d.date), 422, "invalidDate");
      const file = Buffer.from(d.base64, "base64");
      const used = Number(
        (
          await c.query(
            "select coalesce(sum(size),0) bytes from ab.document_versions",
          )
        ).rows[0].bytes,
      );
      requireOk(
        used + file.length <= 100 * 1024 * 1024,
        413,
        "storageQuotaReached",
      );
      requireOk(
        file.length > 0 && file.length <= 10 * 1024 * 1024,
        422,
        "invalidFile",
      );
      const allowed = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/webp",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ];
      requireOk(allowed.includes(d.mime), 422, "invalidFile");
      if (owner.user_id) {
        requireOk(
          [
            "photo",
            "idFront",
            "idBack",
            "passport",
            "contract",
            "driving",
          ].includes(d.category) &&
            file.length <= 5 * 1024 * 1024 &&
            ["application/pdf", "image/png", "image/jpeg"].includes(d.mime),
          422,
          "invalidFile",
        );
        if (d.category === "photo")
          requireOk(
            ["image/png", "image/jpeg"].includes(d.mime),
            422,
            "invalidFile",
          );
      } else if (owner.bank_account_id)
        requireOk(
          [
            "original",
            "annex",
            "amendment",
            "correspondence",
            "other",
          ].includes(d.category),
          422,
          "invalidDocument",
        );
      const signature =
        d.mime === "application/pdf"
          ? file.subarray(0, 5).toString() === "%PDF-"
          : d.mime === "image/png"
            ? file.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
            : d.mime === "image/jpeg"
              ? file[0] === 255 && file[1] === 216
              : d.mime === "image/webp"
                ? file.subarray(0, 4).toString() === "RIFF" &&
                  file.subarray(8, 12).toString() === "WEBP"
                : file[0] === 80 && file[1] === 75;
      requireOk(signature, 422, "invalidFile");
      let parent: any;
      if (d.parentId) {
        parent = (
          await c.query("select * from ab.documents where id=$1", [d.parentId])
        ).rows[0];
        requireOk(
          parent &&
            parent.company_id === owner.company_id &&
            parent.bank_account_id === owner.bank_account_id &&
            parent.user_id === owner.user_id,
          422,
          "invalidParent",
        );
      }
      let parentVersion: any;
      if (parent) {
        parentVersion = d.parentVersionId
          ? (
              await c.query(
                "select id,document_id from ab.document_versions where id=$1",
                [d.parentVersionId],
              )
            ).rows[0]
          : (
              await c.query(
                "select id,document_id from ab.document_versions where document_id=$1 order by version desc limit 1",
                [parent.id],
              )
            ).rows[0];
        requireOk(
          parentVersion && parentVersion.document_id === parent.id,
          422,
          "invalidParent",
        );
      } else requireOk(!d.parentVersionId, 422, "invalidParent");
      if (d.relation === "version") requireOk(parent, 422, "invalidParent");
      const documentId = d.relation === "version" ? parent.id : randomUUID(),
        versionId = randomUUID();
      let version = 1;
      if (d.relation === "version")
        version =
          Number(
            (
              await c.query(
                "select max(version) n from ab.document_versions where document_id=$1",
                [documentId],
              )
            ).rows[0].n,
          ) + 1;
      const scan = options.scan ? await options.scan(file, d.mime) : "pending";
      requireOk(scan !== "rejected", 422, "fileRejected");
      const key = `${s.tenant_id}/${documentId}/${versionId}`;
      await objects.put(
        key,
        Buffer.from(cipher.seal({ bytes: file.toString("base64") })),
      );
      if (d.relation !== "version")
        await c.query(
          "insert into ab.documents(id,tenant_id,company_id,bank_account_id,user_id,category,title,description,document_date,related_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
          [
            documentId,
            s.tenant_id,
            owner.company_id,
            owner.bank_account_id,
            owner.user_id,
            d.category,
            d.title,
            d.description,
            d.date,
            parent?.id || null,
            s.user_id,
          ],
        );
      await c.query(
        "insert into ab.document_versions(id,tenant_id,document_id,version,storage_key,original_name,mime,size,sha256,scan_status,created_by,title,description,document_date,category,parent_version_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)",
        [
          versionId,
          s.tenant_id,
          documentId,
          version,
          key,
          d.name,
          d.mime,
          file.length,
          sha(file),
          scan,
          s.user_id,
          d.title,
          d.description,
          d.date,
          d.category,
          parentVersion?.id || null,
        ],
      );
      await audit(
        c,
        s.tenant_id,
        s.user_id,
        "uploaded",
        "document",
        documentId,
        ["version", String(version), d.category],
      );
      return { id: documentId, versionId, version, scanStatus: scan };
    }),
  );
  app.get("/api/documents/:versionId/file", async (req, reply) => {
    const s = await session(req);
    const result = await transaction(
      pool,
      s.tenant_id,
      s.user_id,
      async (c) => {
        const m = await model(c, s.user_id, cipher),
          row = (
            await c.query(
              "select d.*,v.storage_key,v.original_name,v.mime,v.sha256,v.scan_status from ab.document_versions v join ab.documents d on d.id=v.document_id where v.id=$1",
              [uuid((req.params as any).versionId)],
            )
          ).rows[0];
        requireOk(row, 404, "notFound");
        documentRight(m, row, false);
        requireOk(row.scan_status === "clean", 423, "fileQuarantined");
        const encrypted = await objects.get(row.storage_key),
          bytes = Buffer.from(
            cipher.open(encrypted.toString()).bytes,
            "base64",
          );
        requireOk(sha(bytes) === row.sha256, 502, "integrityFailed");
        await audit(
          c,
          s.tenant_id,
          s.user_id,
          "downloaded",
          "document",
          row.id,
        );
        return { bytes, row };
      },
    );
    reply
      .header("Content-Security-Policy", "sandbox; default-src 'none'")
      .header("Content-Type", result.row.mime)
      .header(
        "Content-Disposition",
        "attachment; filename*=UTF-8''" +
          encodeURIComponent(result.row.original_name),
      )
      .send(result.bytes);
  });
  if (options.serveFrontend !== false) {
    const root = fileURLToPath(new URL("../../", import.meta.url));
    app.get("/runtime-config.js", async (_, reply) =>
      reply
        .type("application/javascript")
        .header("Cache-Control", "no-store")
        .send("window.AB_CONFIG={central:true};"),
    );
    // Explicit public allowlist: never serve backend/, migrations, .env, .git or node_modules.
    const publicFiles = [
      "index.html",
      "app.js",
      "styles.css",
      "area-reference.js",
      "company-documents.js",
      "bank-accounts.js",
      "user-management.js",
      "demo-credentials.js",
      "auth-flows.js",
      "central-client.js",
      "data/uae-areas.js",
      "assets/Untitled.png",
      "assets/logo.svg",
    ];
    const send = async (file: string, reply: any) => {
      const types: Record<string, string> = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      return reply
        .type(types[extname(file)] || "application/octet-stream")
        .send(await readFile(join(root, file)));
    };
    app.get("/", async (_, reply) => send("index.html", reply));
    for (const file of publicFiles)
      app.get("/" + file, async (_, reply) => send(file, reply));
  }
  return app;
}
