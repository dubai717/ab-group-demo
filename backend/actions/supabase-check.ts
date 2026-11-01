// Only the final protected Actions step receives cloud credentials. This script
// never emits provider errors, environment values, SQL rows or file contents.
import { spawnSync } from "node:child_process";
import { appendFile, readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { databaseOptions } from "../src/database.js";
import {diagnosticCodes} from "../src/connection-diagnostics.js";
import { sha } from "../src/core.js";

export function approvedActionsContext(e: NodeJS.ProcessEnv) {
  return (
    e.GITHUB_ACTIONS === "true" &&
    e.GITHUB_REPOSITORY === "dubai717/ab-group-demo" &&
    e.GITHUB_EVENT_NAME === "push" &&
    e.RUNNER_ENVIRONMENT === "github-hosted" &&
    /^refs\/heads\/verify\/supabase-test-[A-Za-z0-9_-]+$/.test(
      e.GITHUB_REF || "",
    ) &&
    e.GITHUB_WORKFLOW_REF ===
      `dubai717/ab-group-demo/.github/workflows/supabase-test.yml@${e.GITHUB_REF}`
  );
}
export async function inspectSchema(pool: Pool) {
  const c=await pool.connect();
  let present=false;
  try {
    await c.query('BEGIN READ ONLY');
    const r=(await c.query("select to_regclass('public.ab_schema_migrations') ledger,to_regnamespace('ab') app_schema")).rows[0];
    if(!r.ledger&&!r.app_schema)return 'NOT_APPLIED' as const;
    if(!r.ledger||!r.app_schema)throw Error('partial schema');
    present=true;
  } finally {await c.query('ROLLBACK');c.release();}
  if(present)await checkSchema(pool);
  return 'VERIFIED' as const;
}
export async function checkSchema(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    const dir=new URL('../../supabase/migrations/',import.meta.url);
    const files=(await readdir(dir)).filter(x=>x.endsWith('.sql')).sort();
    const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations')).rows;
    if(ledger.length!==files.length)throw Error('migration count');
    for(const file of files){const checksum=sha(await readFile(new URL(file,dir),'utf8'));if(!ledger.some(r=>r.name===file&&r.sha256===checksum))throw Error('migration checksum mismatch');}
    const missingRls = (
      await c.query(
        "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind='r' and c.relname not in('roles','permissions','role_permissions','emirates') and not c.relrowsecurity",
      )
    ).rowCount;
    if (missingRls) throw Error("RLS incomplete");
    const role = (
      await c.query(
        "select rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname='ab_runtime'",
      )
    ).rows[0];
    if (!role || Object.values(role).some(Boolean))
      throw Error("unsafe runtime role");
    for (const table of ["documents", "document_versions", "audit_events"]) {
      if (
        (
          await c.query("select has_table_privilege($1,$2,$3) allowed", [
            "ab_runtime",
            "ab." + table,
            "UPDATE,DELETE,TRUNCATE",
          ])
        ).rows[0].allowed
      )
        throw Error("mutable protected table");
    }
    for (const role of ["anon", "authenticated"]) {
      const exists = (
        await c.query("select 1 from pg_roles where rolname=$1", [role])
      ).rowCount;
      if (
        exists &&
        (
          await c.query("select has_schema_privilege($1,$2,$3) allowed", [
            role,
            "ab",
            "USAGE",
          ])
        ).rows[0].allowed
      )
        throw Error("direct browser schema access");
    }
    const executable = (
      await c.query(
        "select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where n.nspname='ab' and x.grantee=0 and x.privilege_type='EXECUTE'",
      )
    ).rowCount;
    if (executable) throw Error("public definer access");
    const guards = (
      await c.query(
        "select count(*)::int n from pg_constraint where connamespace='ab'::regnamespace and conname in('company_area_requires_emirate','alias_matches_area_emirate','closed_account_requires_date','user_cannot_manage_self') and convalidated",
      )
    ).rows[0].n;
    if (guards !== 4) throw Error("integrity constraints missing");
    const triggers = (
      await c.query(
        "select count(*)::int n from pg_trigger where tgname in('document_owner_links','version_parent_owner','protect_user_invariants') and tgenabled in ('O','A')",
      )
    ).rows[0].n;
    if (triggers !== 3) throw Error("integrity triggers missing");
    await c.query("SET LOCAL ROLE ab_runtime");
    await c.query("select set_config('ab.tenant','',true)");
    if (
      (await c.query("select id from ab.companies limit 1")).rowCount ||
      (await c.query("select id from ab.bank_accounts limit 1")).rowCount
    )
      throw Error("unscoped data visible");
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}
export async function run() {
  let phase = "trusted runner",
    pool: Pool | undefined;
  const passed: string[] = [];
  let connectionFailed = false;
  try {
    if (!approvedActionsContext(process.env)) throw Error("untrusted context");
    phase = "protected configuration";
    if (
      [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SECRET_KEY",
        "MIGRATION_DATABASE_URL",
      ].some((k) => !process.env[k])
    )
      throw Error("missing protected secrets");
    // Only fixed-format child status is used; never forward raw stdout/stderr.
    phase = "actual database, API keys and private bucket";
    const check = spawnSync(
      process.execPath,
      ["--import", "tsx", "backend/review/connection-check.ts"],
      {
        encoding: "utf8",
        timeout: 90000,
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 65536,
      },
    );
    if (check.status !== 0) {
      let code='CHECK_FAILED';
      for(const line of (check.stdout||'').split('\n')){try{const record=JSON.parse(line);if(record.status==='FAIL'&&diagnosticCodes.includes(record.diagnostic))code=record.diagnostic;}catch{}}
      console.log('Connection diagnostic: '+code);
      throw Error('connection verification failed');
    }
    passed.push(
      "Actual TLS PostgreSQL/API connectivity and existing private bucket",
    );
    pool = new Pool({
      ...databaseOptions(process.env.MIGRATION_DATABASE_URL!),
      max: 1,
    });
    pool.on("error", () => {
      connectionFailed = true;
      process.exitCode = 1;
      console.log("FAIL: database connection lost; details withheld.");
    });
    phase = 'read-only migration status and RLS';
    const schema=await inspectSchema(pool);
    if(schema==='NOT_APPLIED')passed.push('Migration files ready; cloud schema NOT_APPLIED; RLS cannot yet be verified; no writes performed');
    else passed.push('Existing migration checksums, RLS, runtime privileges and integrity verified read-only');
    if (connectionFailed) throw Error("database connection lost");
    console.log("PASS: " + passed.join("; "));
    if (process.env.GITHUB_STEP_SUMMARY)
      await appendFile(
        process.env.GITHUB_STEP_SUMMARY,
        "## Supabase read-only check\n\n" +
          passed.map((x) => "- PASS: " + x).join("\n") +
          "\n\nNo database/schema modifications, deployment or public secret exposure. Missing migrations were NOT applied. Auth password login, ERP CRUD with real identities, real malware scanning and cloud disaster recovery are not proved by this job.\n",
      );
  } catch {
    console.log(
      "FAIL: " + phase + ". No provider responses or credential values logged.",
    );
    process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
  }
}
if (
  process.argv[1]?.endsWith("/supabase-check.ts") ||
  process.argv[1]?.endsWith("/supabase-check.js")
)
  await run();
