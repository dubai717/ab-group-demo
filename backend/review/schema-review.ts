// Verification only: synthetic isolated database, all direct SQL probes rolled back.
// Non-zero exit means review findings exist, not that they were silently fixed.
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fixture } from "../tests/fixture.js";
import { migrate } from "../src/migrate.js";
const results: {
  id: string;
  status: string;
  expected: string;
  observed: string;
}[] = [];
const f = await fixture("ab_backup_" + randomUUID().replaceAll("-", ""));
const record = (id: string, ok: boolean, expected: string, observed: string) =>
  results.push({ id, status: ok ? "PASS" : "FAIL", expected, observed });
async function probe(sql: string, values: any[] = []) {
  const c = await f.runtime.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",
      [f.org.tenant, f.org.user],
    );
    const r = await c.query(sql, values);
    return { accepted: true, code: "accepted", rows: r.rows };
  } catch (e: any) {
    return { accepted: false, code: String(e.code), rows: [] };
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}
async function rejects(id: string, sql: string, values: any[], code: string) {
  const r = await probe(sql, values);
  record(id, !r.accepted && r.code === code, code, r.code);
}
const headers: any = { origin: "http://127.0.0.1:3100", "x-ab-request": "1" };
async function request(method: any, url: string, payload?: any) {
  return f.app.inject({ method, url, payload, headers });
}
try {
  const before = (
    await f.admin.query(
      "select name,sha256 from public.ab_schema_migrations order by name",
    )
  ).rows;
  await migrate(f.admin);
  const after = (
    await f.admin.query(
      "select name,sha256 from public.ab_schema_migrations order by name",
    )
  ).rows;
  record(
    "M01",
    before.length === 8 && JSON.stringify(before) === JSON.stringify(after),
    "8 unchanged migration checksums",
    "count=" + after.length,
  );
  const tables = (
    await f.admin.query(
      "select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind='r'",
    )
  ).rows;
  const shared = ["roles", "permissions", "role_permissions", "emirates"];
  record(
    "M02",
    tables.every((r) => shared.includes(r.relname) || r.relrowsecurity),
    "RLS on every tenant table",
    tables
      .filter((r) => !shared.includes(r.relname) && !r.relrowsecurity)
      .map((r) => r.relname)
      .join(",") || "all enabled",
  );
  const roleRows=(await f.admin.query('select id,data from ab.roles order by id')).rows;
  const catalog=JSON.parse(await readFile(new URL('../fixtures/roles.json',import.meta.url),'utf8'));
  const sqlGrants=(await f.admin.query('select role_id,permission_id from ab.role_permissions order by role_id,permission_id')).rows;
  const rolesMatch=roleRows.every(r=>JSON.stringify(r.data)===JSON.stringify(catalog.find((x:any)=>x.id===r.id)));
  const permissionsMatch=roleRows.every(r=>JSON.stringify([...r.data.permissions].sort())===JSON.stringify(sqlGrants.filter(g=>g.role_id===r.id).map(g=>g.permission_id).sort()));
  record('M06',roleRows.length===catalog.length&&rolesMatch&&permissionsMatch,'existing role catalogs and relational permission rows agree','roles='+roleRows.length+'; values match='+rolesMatch+'; permissions match='+permissionsMatch);
  const publicExecute = (
    await f.admin.query(
      "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where n.nspname='ab' and x.grantee=0 and x.privilege_type='EXECUTE'",
    )
  ).rows;
  record(
    "M03",
    publicExecute.length === 0,
    "no PUBLIC execute on ab functions",
    publicExecute.map((r) => r.proname).join(",") || "none",
  );
  const role = (
    await f.runtime.query(
      "select rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname=current_user",
    )
  ).rows[0];
  record(
    "M04",
    Object.values(role).every((v) => v === false),
    "restricted SQL role",
    JSON.stringify(role),
  );
  const login = await request("POST", "/api/login", {
    username: f.username,
    password: f.password,
  });
  headers.cookie = String(login.headers["set-cookie"]).split(";")[0];
  const boot = (await request("GET", "/api/bootstrap")).json();
  headers["x-csrf-token"] = boot.csrfToken;
  const co = (
    await request("POST", "/api/companies", {
      arabicName: "شركة مراجعة",
      englishName: "Review synthetic",
      tradeLicenseNumber: "REVIEW",
      status: "Active",
    })
  ).json();
  const co2 = (
    await request("POST", "/api/companies", {
      arabicName: "شركة أخرى",
      englishName: "Second synthetic",
      tradeLicenseNumber: "REVIEW2",
      status: "Active",
    })
  ).json();
  if (!co.id || !co2.id) throw Error("Synthetic fixture creation failed");
  const body = {
    companyId: co.id,
    category: "tradeLicense",
    title: "Review",
    description: "",
    date: "2026-01-01",
    name: "review.pdf",
    mime: "application/pdf",
    base64: Buffer.from("%PDF-1.4 review").toString("base64"),
  };
  const doc = (await request("POST", "/api/documents", body)).json();
  const other = (
    await request("POST", "/api/documents", { ...body, companyId: co2.id })
  ).json();
  if (!doc.id || !doc.versionId || !other.versionId)
    throw Error("Synthetic document creation failed");
  await rejects(
    "R01",
    "update ab.companies set created_by=$2 where id=$1",
    [co.id, randomUUID()],
    "23503",
  );
  await rejects(
    "R02",
    "insert into ab.company_licenses(id,tenant_id,company_id,number) values($1,$2,$3,$4)",
    [randomUUID(), f.org.tenant, randomUUID(), "MISSING"],
    "23503",
  );
  const area = boot.areas[0];
  // Select the alternate emirate from SQL to avoid assumptions about reference IDs.
  const differentId = (
    await f.admin.query("select id from ab.emirates where id<>$1 limit 1", [
      area.emirateId,
    ])
  ).rows[0].id;
  await rejects(
    "R03",
    "update ab.companies set emirate_id=$2,area_id=$3 where id=$1",
    [co.id, differentId, area.id],
    "23503",
  );
  await rejects(
    "F01",
    "update ab.companies set emirate_id=null,area_id=$2 where id=$1",
    [co.id, area.id],
    "23514",
  );
  await rejects(
    "F02",
    "insert into ab.area_aliases(tenant_id,emirate_id,normalized_name,area_id)values($1,$2,$3,$4)",
    [f.org.tenant, differentId, "review-mismatched-alias", area.id],
    "23503",
  );
  const bank = (
    await request("POST", "/api/bank-accounts", {
      companyId: co.id,
      bankId: "demo-bank",
      branch: "Main",
      accountName: "Review account",
      accountNumber: "REVIEW123",
      iban: "AE070331234567890123456",
      openedAt: "2026-01-01",
      closedAt: "",
      status: "Active",
      purposeId: "operations",
      openingBalance: "0",
      currency: "AED",
    })
  ).json();
  if (!bank.id) throw Error("Synthetic bank creation failed");
  await rejects(
    "R04",
    "update ab.bank_accounts set company_id=$2 where id=$1",
    [bank.id, randomUUID()],
    "23503",
  );
  await rejects(
    "R05",
    "update ab.bank_accounts set status='Closed',closed_on='2025-01-01' where id=$1",
    [bank.id],
    "23514",
  );
  await rejects(
    "F03",
    "update ab.bank_accounts set status='Closed',closed_on=null where id=$1",
    [bank.id],
    "23514",
  );
  const versionInsert = `insert into ab.document_versions(id,tenant_id,document_id,version,storage_key,original_name,mime,size,sha256,scan_status,created_by,title,description,document_date,category,parent_version_id)values($1,$2,$3,2,$4,'review.pdf','application/pdf',1,'review','pending',$5,'Review','','2026-01-01','tradeLicense',$6)`;
  // 'related' documents may point to another document, but must retain the same owner.
  await rejects(
    "F04",
    "insert into ab.documents(id,tenant_id,company_id,category,title,document_date,related_id,created_by) values($1,$2,$3,'annex','Review','2026-01-01',$4,$5)",
    [randomUUID(), f.org.tenant, co.id, other.id, f.org.user],
    "23514",
  );
  await rejects(
    "F05",
    versionInsert,
    [
      randomUUID(),
      f.org.tenant,
      doc.id,
      randomUUID(),
      f.org.user,
      other.versionId,
    ],
    "23514",
  );
  await rejects(
    "R06",
    "update ab.users set status='Disabled' where id=$1",
    [f.org.user],
    "23514",
  );
  await rejects(
    "R07",
    "update ab.users set role_id='employee' where id=$1",
    [f.org.user],
    "23514",
  );
  const self = randomUUID();
  await rejects(
    "F06",
    "insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status,manager_id)values($1,$2,$3,'review@example.test',$4,'employee','Active',$1)",
    [self, f.org.tenant, randomUUID(), "self_" + self],
    "23514",
  );
  for (const [id, sql] of [
    ["A01", "update ab.audit_events set action=action"],
    ["A02", "delete from ab.audit_events"],
    ["A03", "truncate ab.audit_events"],
    ["D01", "delete from ab.documents"],
    ["D02", "update ab.document_versions set original_name=original_name"],
  ])
    await rejects(id, sql, [], "42501");
  const audit = (
    await f.admin.query("select * from ab.audit_events where tenant_id=$1", [
      f.org.tenant,
    ])
  ).rows;
  record(
    "A04",
    audit.some((r) => r.action === "created" && r.entity_type === "company") &&
      audit.some((r) => r.action === "login"),
    "creation and login audit",
    "events=" + audit.length,
  );
  record(
    "A05",
    !JSON.stringify(audit).includes(f.password) &&
      !JSON.stringify(audit).includes(body.base64),
    "no password/file bytes in audit",
    "no payloads observed",
  );
  const rejectedParent = await request("POST", "/api/documents", {
    ...body,
    parentId: other.id,
    relation: "version",
  });
  record(
    "API01",
    rejectedParent.statusCode === 422,
    "API rejects cross-owner parent with 422",
    String(rejectedParent.statusCode),
  );
  const rejectedClosed = await request(
    "PATCH",
    "/api/bank-accounts/" + bank.id,
    { revision: 1, status: "Closed", closedAt: "" },
  );
  record(
    "API02",
    rejectedClosed.statusCode === 422,
    "API rejects missing close date with 422",
    String(rejectedClosed.statusCode),
  );
  const rollbackId = randomUUID();
  const rollback = await probe(
    "with inserted as (insert into ab.companies(id,tenant_id,data,created_by)values($1,$2,'{}',$3)) insert into ab.audit_events(id,tenant_id,actor_id,action,entity_type,request_id)values($4,$5,$3,'created','company',$6)",
    [
      rollbackId,
      f.org.tenant,
      f.org.user,
      randomUUID(),
      randomUUID(),
      randomUUID(),
    ],
  );
  const exists = (
    await f.admin.query("select id from ab.companies where id=$1", [rollbackId])
  ).rowCount;
  record(
    "A06",
    !rollback.accepted && exists === 0,
    "data rolls back if audit insertion fails",
    rollback.code + "; company count=" + exists,
  );
  const counts = (
    await f.admin.query(
      "select (select count(*) from ab.companies) companies,(select count(*) from ab.documents) documents",
    )
  ).rows[0];
  await f.admin.query(
    "update public.ab_schema_migrations set sha256='review-intentionally-invalid' where name=(select min(name) from public.ab_schema_migrations)",
  );
  let refused = false;
  try {
    await migrate(f.admin);
  } catch (e: any) {
    refused = e.message.startsWith("Applied migration changed:");
  }
  const countsAfter = (
    await f.admin.query(
      "select (select count(*) from ab.companies) companies,(select count(*) from ab.documents) documents",
    )
  ).rows[0];
  record(
    "M05",
    refused && JSON.stringify(counts) === JSON.stringify(countsAfter),
    "checksum drift refuses migration and preserves records",
    refused ? "refused, counts preserved" : "not refused",
  );
  const out = {
    date: "2026-11-02",
    timezone: "Asia/Dubai",
    baseline: "c3418ad + forward migration 008",
    scope:
      "local isolated synthetic PostgreSQL; SQL probes roll back; no cloud",
    results,
    passed: results.filter((r) => r.status === "PASS").length,
    failed: results.filter((r) => r.status === "FAIL").length,
  };
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/schema-review-results.json",
    JSON.stringify(out, null, 2),
  );
  for (const r of results)
    console.log(
      `${r.status} ${r.id}: expected ${r.expected}; observed ${r.observed}`,
    );
  console.log(`SUMMARY ${out.passed} passed; ${out.failed} failed`);
  process.exitCode = out.failed ? 1 : 0;
} finally {
  await f.app.close();
  await f.runtime.end();
  await f.admin.end();
}
