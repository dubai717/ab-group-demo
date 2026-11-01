// Does not create a Supabase project/bucket/user or run migrations.
// Actual cloud checks require separate approval and an existing synthetic-only project.
import { Pool } from "pg";
import { z } from "zod";
import { supabase } from "../src/core.js";
const phases: string[] = [];
let pool: Pool | undefined,
  token: string | undefined,
  provider: ReturnType<typeof supabase> | undefined;
async function main() {
  if (process.env.AB_LIVE_CHECK_APPROVED !== "yes") {
    console.log(
      JSON.stringify({
        status: "NOT_RUN",
        reason:
          "Separate approval and existing synthetic project required; no network attempted",
      }),
    );
    process.exitCode = 2;
    return;
  }
  const e = z
    .object({
      APP_ENV: z.literal("staging"),
      AB_SYNTHETIC_PROJECT: z.literal("yes"),
      AB_EXPECTED_PROJECT_REF: z.string().regex(/^[a-z0-9]{20}$/),
      AB_EXPECTED_DATABASE_HOST: z.string().min(1),
      SUPABASE_URL: z.url(),
      SUPABASE_ANON_KEY: z.string().min(1),
      DATABASE_URL: z.string().min(1),
      LIVE_TEST_USERNAME: z.string().min(3),
      LIVE_TEST_PASSWORD: z.string().min(1),
      LIVE_TEST_AUTH_ID: z.uuid(),
    })
    .parse(process.env);
  const expected = "https://" + e.AB_EXPECTED_PROJECT_REF + ".supabase.co";
  if (e.SUPABASE_URL !== expected) throw Error("unapproved destination");
  const db = new URL(e.DATABASE_URL);
  if (
    db.hostname !== e.AB_EXPECTED_DATABASE_HOST ||
    !/(^|\.)supabase\.co$|(^|\.)pooler\.supabase\.com$/.test(db.hostname)
  )
    throw Error("unapproved database destination");
  if (db.protocol !== "postgres:" && db.protocol !== "postgresql:")
    throw Error("invalid database URL");
  if (
    db.searchParams.has("sslmode") &&
    db.searchParams.get("sslmode") !== "verify-full"
  )
    throw Error("verified database TLS required");
  if (
    db.username !== "ab_runtime" &&
    db.username !== "ab_runtime." + e.AB_EXPECTED_PROJECT_REF
  )
    throw Error("restricted database identity required");
  // Network policy/TCP grant and operator-confirmed DB destination must be reviewed first.
  pool = new Pool({
    connectionString: e.DATABASE_URL,
    ssl: { rejectUnauthorized: true },
    max: 1,
    connectionTimeoutMillis: 8000,
    statement_timeout: 10000,
  });
  const role = (
    await pool.query(
      "select current_user name,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb,exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relowner=r.oid) owns_tables from pg_roles r where rolname=current_user",
    )
  ).rows[0];
  if (
    role.name !== "ab_runtime" ||
    role.rolsuper ||
    role.rolbypassrls ||
    role.rolcreaterole ||
    role.rolcreatedb ||
    role.owns_tables
  )
    throw Error("unsafe role");
  phases.push("database TLS and restricted role");
  if ((await pool.query("select id from ab.companies limit 1")).rowCount !== 0)
    throw Error("unscoped RLS leak");
  phases.push("unscoped RLS denial");
  const email = (
    await pool.query("select ab.login_identity($1) email", [
      e.LIVE_TEST_USERNAME,
    ])
  ).rows[0]?.email;
  if (!email) throw Error("synthetic account mapping absent");
  provider = supabase(expected, e.SUPABASE_ANON_KEY, "", "unused");
  const login = await provider.auth.login(email, e.LIVE_TEST_PASSWORD);
  token = login.token;
  if (
    login.id !== e.LIVE_TEST_AUTH_ID ||
    (await provider.auth.verify(token)) !== e.LIVE_TEST_AUTH_ID
  )
    throw Error("unexpected subject");
  phases.push("actual Auth password login and token verification");
  const principal = (
    await pool.query("select * from ab.principal($1)", [login.id])
  ).rows[0];
  if (!principal) throw Error("subject unmapped");
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    await c.query(
      "select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",
      [principal.tenant_id, principal.id],
    );
    const own = (
      await c.query("select id from ab.users where id=$1", [principal.id])
    ).rows[0];
    if (!own) throw Error("missing own profile");
    await c.query("select id from ab.companies limit 1");
    await c.query("select id from ab.bank_accounts limit 1");
    phases.push("mapped tenant profile/company/bank SQL reads");
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
  await provider.auth.logout(token);
  token = undefined;
  phases.push("provider logout");
  console.log(
    JSON.stringify({
      status: "PASS",
      phases,
      limits:
        "Read-only DB and actual Auth only; not ERP cookie/CRUD, Storage, scanner, recovery delivery or cloud restore proof",
    }),
  );
}
try {
  await main();
} catch {
  console.log(
    JSON.stringify({
      status: "FAIL",
      completed: phases,
      reason:
        "Preflight failed; inspect configuration/provider privately. Secret values and provider responses intentionally omitted.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (token && provider) {
    try {
      await provider.auth.logout(token);
    } catch {
      console.log(
        JSON.stringify({
          status: "WARN",
          reason: "Provider logout failed; revoke synthetic sessions manually",
        }),
      );
      process.exitCode = 1;
    }
  }
  if (pool) await pool.end();
}
