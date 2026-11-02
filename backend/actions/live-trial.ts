// Real test providers, new fictional records only. No deployment, cleanup or deletes.
import { Pool } from "pg";
import { randomBytes, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { appendFile } from "node:fs/promises";
import {
  approvedRuntimeContext,
  runtimeConfiguration,
  verifyRuntimeAccess,
} from "./runtime-setup.js";
import { databaseOptions, assertVerifiedDatabaseTls } from "../src/database.js";
import { security, supabase, supabaseKeys } from "../src/core.js";
import { initializeOrganization } from "../src/bootstrap.js";
export const trialStages = [
  "RUNTIME_AUTHENTICATED",
  "AUTH_REJECTION",
  "AUTH_LOGIN",
  "COMPANY_CENTRAL_PERSISTENCE",
  "MULTIPLE_BANKS",
  "BANK_MANAGER_PERSISTENCE",
  "USER_LOGIN",
  "RLS_SCOPE_DENIAL",
  "APP_BANK_ACCESS_DENIED",
  "ENCRYPTED_PRIVATE_UPLOAD",
  "ANONYMOUS_STORAGE_DENIED",
  "AUTHENTICATED_STORAGE_DENIED",
  "QUARANTINE_ENFORCED",
  "LOGOUT",
] as const;
export function isolatedTrialEnvironment(e: NodeJS.ProcessEnv) {
  const names = [
    "PATH",
    "NODE_EXTRA_CA_CERTS",
    "GITHUB_ACTIONS",
    "GITHUB_REPOSITORY",
    "GITHUB_EVENT_NAME",
    "RUNNER_ENVIRONMENT",
    "GITHUB_REF",
    "GITHUB_WORKFLOW_REF",
    "DATABASE_URL",
    "DATA_ENCRYPTION_KEY",
    "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_BUCKET",
  ];
  return Object.fromEntries(
    names.flatMap((k) => (e[k] !== undefined ? [[k, e[k]!]] : [])),
  );
}
function must(ok: unknown) {
  if (!ok) throw Error("trial assertion failed");
}
async function fixtureInput() {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk;
    if (data.length > 8192) throw Error("fixture too large");
  }
  return JSON.parse(data);
}
export async function childTrial() {
  let pool: Pool | undefined,
    app: any,
    phase: string = "protected runtime child";
  const completed: string[] = [];
  try {
    must(
      approvedRuntimeContext(process.env) &&
        !process.env.MIGRATION_DATABASE_URL,
    );
    const f = await fixtureInput(),
      key = process.env.DATA_ENCRYPTION_KEY!;
    security(key);
    const { publishable, secret } = supabaseKeys(),
      provider = supabase(
        process.env.SUPABASE_URL!,
        publishable,
        secret,
        process.env.SUPABASE_BUCKET || "ab-private-test",
      );
    pool = new Pool({ ...databaseOptions(process.env.DATABASE_URL!), max: 2 });
    pool.on("error", () => {
      process.exitCode = 1;
    });
    const c = await pool.connect();
    try {
      assertVerifiedDatabaseTls(c);
    } finally {
      c.release();
    }
    await verifyRuntimeAccess(pool);
    completed.push("RUNTIME_AUTHENTICATED");
    const { build } = await import("../src/app.js");
    const origin = "http://127.0.0.1:3100";
    const options = {
      pool,
      key,
      origin,
      secureCookies: false,
      auth: provider.auth,
      objects: provider.objects,
      serveFrontend: false,
    };
    app = await build(options);
    await app.ready();
    let cookie = "",
      csrf = "";
    const req = async (
      method: any,
      url: string,
      payload?: any,
      expected = 200,
    ) => {
      const r = await app.inject({
        method,
        url,
        payload,
        headers: { origin, "x-ab-request": "1", "x-csrf-token": csrf, cookie },
      });
      must(r.statusCode === expected);
      return r;
    };
    const login = async (username: string, password: string) => {
      const r = await req("POST", "/api/login", { username, password });
      cookie = String(r.headers["set-cookie"]).split(";")[0];
      must(String(r.headers["set-cookie"]).includes("HttpOnly"));
      csrf = (await req("GET", "/api/bootstrap")).json().csrfToken;
    };
    phase = "AUTH_REJECTION";
    await req(
      "POST",
      "/api/login",
      { username: f.username, password: "Incorrect-Synthetic@2026" },
      401,
    );
    completed.push("AUTH_REJECTION");
    phase = "AUTH_LOGIN";
    await login(f.username, f.password);
    completed.push("AUTH_LOGIN");
    phase = "COMPANY_CENTRAL_PERSISTENCE";
    const id = (
      await req("POST", "/api/companies", {
        arabicName: "شركة اختبار آلي وهمية",
        englishName: "Fictional CI company",
        companyCode: "CI-" + randomUUID().slice(0, 8),
        tradeLicenseNumber: "CI-" + randomUUID(),
        status: "Active",
        salikAccountNumber: "000456",
        trafficCode: "000123",
      })
    ).json().id;
    must(id);
    await app.close();
    app = await build(options);
    await app.ready();
    const company = (await req("GET", "/api/companies/" + id)).json();
    must(
      company.salikAccountNumber === "000456" &&
        company.trafficCode === "000123",
    );
    completed.push("COMPANY_CENTRAL_PERSISTENCE");
    phase = "MULTIPLE_BANKS";
    const bankData = {
      companyId: id,
      licenseId: company.licenseId,
      bankId: "demo-bank",
      branch: "Fictional branch",
      accountName: "Fictional CI account",
      accountNumber: "000123",
      iban: "AE070331234567890123456",
      swift: "BOMLAEAD",
      openedAt: "2026-01-01",
      closedAt: "",
      status: "Active",
      purposeId: "operations",
      openingBalance: "1000.125",
      currency: "AED",
      relationshipManagerName: "Fictional manager",
      relationshipManagerPhone: "+971500000001",
      relationshipManagerEmail: "fictional-manager@example.test",
    };
    const bank = (await req("POST", "/api/bank-accounts", bankData)).json().id;
    must(bank);
    const second = (
      await req("POST", "/api/bank-accounts", {
        ...bankData,
        accountNumber: "000456",
        iban: "GB82WEST12345698765432",
      })
    ).json().id;
    must(second && second !== bank);
    completed.push("MULTIPLE_BANKS");
    phase = "BANK_MANAGER_PERSISTENCE";
    await app.close();
    app = await build(options);
    await app.ready();
    const saved = (await req("GET", "/api/bank-accounts/" + bank)).json();
    must(
      saved.relationshipManagerEmail === bankData.relationshipManagerEmail &&
        saved.openingBalance === "1000.125",
    );
    completed.push("BANK_MANAGER_PERSISTENCE");
    phase = "ENCRYPTED_PRIVATE_UPLOAD";
    const plain = Buffer.from(
      "%PDF-1.4\nAB Group fictional test document only",
    );
    const doc = (
      await req("POST", "/api/documents", {
        bankAccountId: bank,
        category: "original",
        title: "Fictional CI document",
        description: "Synthetic test only",
        date: "2026-01-01",
        mime: "application/pdf",
        name: "fictional-ci.pdf",
        base64: plain.toString("base64"),
      })
    ).json();
    must(doc.id && doc.versionId && doc.scanStatus === "pending");
    const { transaction } = await import("../src/core.js");
    const stored = await transaction(pool, f.tenant, f.user, async (client) => {
      const v = (
        await client.query(
          "select storage_key from ab.document_versions where id=$1",
          [doc.versionId],
        )
      ).rows[0];
      const account = (
        await client.query(
          "select payload_cipher from ab.bank_accounts where id=$1",
          [bank],
        )
      ).rows[0];
      must(security(key).open(account.payload_cipher).iban === bankData.iban);
      return v;
    });
    const encrypted = await provider.objects.get(stored.storage_key);
    must(!encrypted.equals(plain));
    must(
      Buffer.from(
        security(key).open(encrypted.toString()).bytes,
        "base64",
      ).equals(plain),
    );
    completed.push("ENCRYPTED_PRIVATE_UPLOAD");
    phase = "QUARANTINE_ENFORCED";
    await req(
      "GET",
      "/api/documents/" + doc.versionId + "/file",
      undefined,
      423,
    );
    completed.push("QUARANTINE_ENFORCED");
    phase = "USER_LOGIN";
    const suffix = randomUUID().replaceAll("-", ""),
      userPassword = "Ci-Employee@" + randomBytes(24).toString("hex") + "9";
    const username = "ci_" + suffix.slice(0, 12),
      email = "ci-" + suffix + "@example.test";
    const employee = (
      await req("POST", "/api/users", {
        nameAr: "موظف وهمي للاختبار",
        nameEn: "Fictional CI employee",
        username,
        email,
        phone: "",
        status: "Active",
        jobTitle: "Test only",
        hireDate: "2026-01-01",
        managerId: f.user,
        companyIds: [id],
        departmentIds: [],
        password: userPassword,
      })
    ).json().id;
    must(employee);
    const ownerCookie = cookie,
      ownerCsrf = csrf;
    await login(username, userPassword);
    completed.push("USER_LOGIN");
    phase = "APP_BANK_ACCESS_DENIED";
    await req("GET", "/api/bank-accounts/" + bank, undefined, 403);
    completed.push("APP_BANK_ACCESS_DENIED");
    phase = "RLS_SCOPE_DENIAL";
    must(
      (await pool.query("select id from ab.companies where id=$1", [id]))
        .rowCount === 0,
    );
    must(
      (await pool.query("select id from ab.bank_accounts where id=$1", [bank]))
        .rowCount === 0,
    );
    completed.push("RLS_SCOPE_DENIAL");
    const path =
      "/storage/v1/object/" +
      encodeURIComponent(process.env.SUPABASE_BUCKET || "ab-private-test") +
      "/" +
      stored.storage_key.split("/").map(encodeURIComponent).join("/");
    phase = "ANONYMOUS_STORAGE_DENIED";
    const anonymous = await fetch(process.env.SUPABASE_URL! + path, {
      headers: { apikey: publishable },
      signal: AbortSignal.timeout(15000),
    });
    must([400, 401, 403, 404].includes(anonymous.status));
    completed.push("ANONYMOUS_STORAGE_DENIED");
    phase = "AUTHENTICATED_STORAGE_DENIED";
    const token = await provider.auth.login(email, userPassword);
    must((await provider.auth.verify(token.token)) === token.id);
    const denied = await fetch(process.env.SUPABASE_URL! + path, {
      headers: { apikey: publishable, Authorization: "Bearer " + token.token },
      signal: AbortSignal.timeout(15000),
    });
    must([400, 401, 403, 404].includes(denied.status));
    completed.push("AUTHENTICATED_STORAGE_DENIED");
    phase = "LOGOUT";
    await req("POST", "/api/logout", {});
    cookie = ownerCookie;
    csrf = ownerCsrf;
    await req("POST", "/api/logout", {});
    completed.push("LOGOUT");
    console.log(JSON.stringify({ status: "PASS", completed }));
  } catch {
    console.log(JSON.stringify({ status: "STOP", phase, completed }));
    process.exitCode = 1;
  } finally {
    if (app) await app.close();
    if (pool) await pool.end();
  }
}
export async function run() {
  let admin: Pool | undefined,
    phase = "protected fixture configuration";
  try {
    must(
      approvedRuntimeContext(process.env) &&
        process.env.AB_SYNTHETIC_PROJECT === "yes",
    );
    const cfg = runtimeConfiguration(process.env);
    const dataKey = process.env.DATA_ENCRYPTION_KEY || "";
    security(dataKey);
    must(Buffer.from(dataKey, "base64").toString("base64") === dataKey);
    const { publishable, secret } = supabaseKeys();
    must(secret);
    const provider = supabase(
      process.env.SUPABASE_URL!,
      publishable,
      secret,
      process.env.SUPABASE_BUCKET || "ab-private-test",
    );
    admin = new Pool({ ...databaseOptions(cfg.administratorUri), max: 1 });
    admin.on("error", () => {
      process.exitCode = 1;
    });
    const c = await admin.connect();
    try {
      assertVerifiedDatabaseTls(c);
    } finally {
      c.release();
    }
    const suffix = randomUUID().replaceAll("-", ""),
      password = "Ci-Owner@" + randomBytes(24).toString("hex") + "9",
      username = "ci_owner_" + suffix.slice(0, 12),
      email = "ci-owner-" + suffix + "@example.test";
    phase = "new fictional Auth subject";
    const authId = await provider.auth.create(email, password);
    must(/^[a-f0-9-]{36}$/i.test(authId));
    phase = "new fictional group fixture";
    const owner = await initializeOrganization(admin, {
      authId,
      email,
      username,
      name: "Fictional automated trial owner",
    });
    await admin.end();
    admin = undefined;
    phase = "runtime-only child trial";
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "backend/actions/live-trial.ts", "--child"],
      {
        cwd: process.cwd(),
        env: isolatedTrialEnvironment(process.env),
        encoding: "utf8",
        input: JSON.stringify({
          username,
          password,
          tenant: owner.tenant,
          user: owner.user,
        }),
        timeout: 600000,
        maxBuffer: 65536,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    const records = (result.stdout || "").split("\n").flatMap((line) => {
      try {
        return [JSON.parse(line)];
      } catch {
        return [];
      }
    });
    const report =
      records.find((x) => x.status === "PASS") ||
      records.find((x) => x.status === "STOP");
    const completed = trialStages.filter((x) => report?.completed?.includes(x));
    for (const stage of completed) console.log("PASS: " + stage);
    if (
      result.status !== 0 ||
      report?.status !== "PASS" ||
      completed.length !== trialStages.length
    ) {
      if (trialStages.includes(report?.phase))
        console.log("STOP: " + report.phase);
      throw Error("live trial incomplete");
    }
    console.log(
      "PASS: real Auth/SQL/private storage trial completed; no deletions or deployment; synthetic records retained",
    );
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        "## Real synthetic ERP trial\n\n" +
          completed.map((x) => "- PASS: " + x).join("\n") +
          "\n\nUses real Supabase Auth, PostgreSQL and private storage. Only new fictional fixtures were created and retained. Backend child never receives the administrative SQL connection. Files remain quarantined without a real scanner. No interactive site deployment or cloud backup claim.\n",
      );
  } catch {
    console.log(
      "STOP: " +
        phase +
        "; details and secrets withheld. Existing records retained, no automatic cleanup or privilege expansion.",
    );
    process.exitCode = 1;
  } finally {
    if (admin) await admin.end().catch(()=>{process.exitCode=1;console.log("STOP: administrative connection close failed; details withheld");});
  }
}
if (
  process.argv[1]?.endsWith("/live-trial.ts") ||
  process.argv[1]?.endsWith("/live-trial.js")
) {
  if (process.argv.includes("--child")) await childTrial();
  else await run();
}
