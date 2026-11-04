// Existing ab_runtime password only: no new roles, grants, flags or RLS changes.
import { Pool, Client } from "pg";
import {connectionDiagnostic} from "../src/connection-diagnostics.js";
import { readFile } from "node:fs/promises";
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import { databaseOptions, assertVerifiedDatabaseTls } from "../src/database.js";
export const runtimeBranch =
  "refs/heads/verify/supabase-test-runtime-approved-20261102";
export function approvedRuntimeContext(e: NodeJS.ProcessEnv) {
  return (
    e.GITHUB_ACTIONS === "true" &&
    e.GITHUB_REPOSITORY === "dubai717/ab-group-demo" &&
    e.GITHUB_EVENT_NAME === "push" &&
    e.RUNNER_ENVIRONMENT === "github-hosted" &&
    e.GITHUB_REF === runtimeBranch &&
    e.GITHUB_WORKFLOW_REF ===
      `dubai717/ab-group-demo/.github/workflows/supabase-runtime.yml@${runtimeBranch}`
  );
}
export function runtimeConfiguration(e: NodeJS.ProcessEnv) {
  if (!e.DATABASE_URL || !e.MIGRATION_DATABASE_URL || !e.SUPABASE_URL)
    throw Error("protected runtime configuration required");
  const endpoint = new URL(e.SUPABASE_URL);
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(endpoint.href))
    throw Error("invalid test project");
  const ref = endpoint.hostname.split(".")[0],
    admin = new URL(e.MIGRATION_DATABASE_URL),
    runtime = new URL(e.DATABASE_URL);
  for (const url of [admin, runtime]) {
    if (
      !["postgres:", "postgresql:"].includes(url.protocol) ||
      !url.hostname.endsWith(".pooler.supabase.com") ||
      (url.port || "5432") !== "5432" ||
      url.pathname !== "/postgres"
    )
      throw Error("session pooler target required");
    if (
      [
        "user",
        "password",
        "host",
        "port",
        "database",
        "options",
        "sslpassword",
      ].some((k) => url.searchParams.has(k))
    )
      throw Error("connection override rejected");
    databaseOptions(url.href);
  }
  if (
    admin.hostname !== runtime.hostname ||
    decodeURIComponent(admin.username) !== "postgres." + ref ||
    decodeURIComponent(runtime.username) !== "ab_runtime." + ref
  )
    throw Error("project/role mismatch");
  const password = decodeURIComponent(runtime.password),
    adminPassword = decodeURIComponent(admin.password);
  if (
    !/^[\x21-\x7e]{32,128}$/.test(password) ||
    new Set(password).size < 8 ||
    password === adminPassword ||
    /^sb_(publishable|secret)_/.test(password)
  )
    throw Error("strong independent ASCII runtime password required");
  const parsed=(new Client({...databaseOptions(runtime.href)}) as any).connectionParameters;
  if(parsed.password!==password||parsed.user!=='ab_runtime.'+ref)throw Error('runtime driver URL interpretation mismatch');
  return { administratorUri: admin.href, runtimeUri: runtime.href, password };
}
// The plaintext never occurs in an ALTER ROLE statement; use a standard SCRAM verifier.
export function scramVerifier(
  password: string,
  salt = randomBytes(32),
  // Shared Supavisor compatibility, including older fixed-4096 challenges.
  iterations = 4096,
) {
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const client = createHmac("sha256", salted).update("Client Key").digest();
  const stored = createHash("sha256").update(client).digest("base64");
  const server = createHmac("sha256", salted)
    .update("Server Key")
    .digest("base64");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${stored}:${server}`;
}
async function permissionSnapshot(c: any) {
  const role = (
    await c.query(
      "select oid,rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolconnlimit,rolvaliduntil,rolbypassrls,rolconfig from pg_roles where rolname='ab_runtime'",
    )
  ).rows[0];
  if (
    !role ||
    !role.rolcanlogin ||
    role.rolsuper ||
    role.rolbypassrls ||
    role.rolcreatedb ||
    role.rolcreaterole ||
    role.rolreplication
  )
    throw Error("existing role missing/unsafe");
  const memberships = (
    await c.query(
      "select roleid,member,grantor,admin_option from pg_auth_members where roleid=$1 or member=$1 order by roleid,member,grantor",
      [role.oid],
    )
  ).rows;
  const privileges = (
    await c.query(
      "select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relowner,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind in('r','p') order by c.relname",
    )
  ).rows;
  const policies = (
    await c.query(
      "select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='ab' order by tablename,policyname",
    )
  ).rows;
  if (
    privileges.length < 23 ||
    privileges.some((r: any) => String(r.relowner) === String(role.oid)) ||
    memberships.some((r: any) => String(r.member) === String(role.oid))
  )
    throw Error("runtime ownership or inherited rights unsafe");
  if (
    privileges.some(
      (r: any) =>
        !["roles", "permissions", "role_permissions", "emirates"].includes(
          r.relname,
        ) && !r.relrowsecurity,
    )
  )
    throw Error("RLS not enabled");
  return JSON.stringify({ role, memberships, privileges, policies });
}
export async function provisionRuntimePassword(admin: Pool, password: string, samePasswordOnly=false) {
  const c = await admin.connect();
  try {
    await c.query("BEGIN");
    const approved = JSON.parse(
      await readFile(
        new URL("./approved-migrations.json", import.meta.url),
        "utf8",
      ),
    );
    const ledger = (
      await c.query("select name,sha256 from public.ab_schema_migrations")
    ).rows;
    if (
      ledger.length !== 8 ||
      approved.migrations.some(
        (m: any) =>
          !ledger.some((r) => r.name === m.name && r.sha256 === m.sha256),
      )
    )
      throw Error("approved schema not ready");
    const before = await permissionSnapshot(c);
    if(samePasswordOnly){
      const current=(await c.query("select rolpassword from pg_authid where rolname='ab_runtime'")).rows[0]?.rolpassword;
      const match=/^SCRAM-SHA-256\$(\d+):([A-Za-z0-9+/]+=*)\$/.exec(current||'');
      const cost=Number(match?.[1]);
      if(!match||cost<4096||cost>1000000||scramVerifier(password,Buffer.from(match[2],'base64'),cost)!==current)throw Error('current password does not match; rehash refused');
      // A retry must not rotate the verifier again after the approved correction.
      if(cost===4096){await c.query('COMMIT');return;}
      if(cost!==65536)throw Error('unexpected existing SCRAM cost; rehash refused');
    }
    const verifier = scramVerifier(password);
    // Verifier alphabet cannot contain SQL quotes. Neither plaintext nor verifier is logged.
    if (
      !/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/.test(
        verifier,
      )
    )
      throw Error("invalid verifier");
    await c.query("ALTER ROLE ab_runtime PASSWORD '" + verifier + "'");
    if ((await permissionSnapshot(c)) !== before)
      throw Error("unexpected privilege/role change");
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export async function verifyRuntimeAccess(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN READ ONLY");
    const identity = (
      await c.query("select current_user actor,session_user authenticated_role")
    ).rows[0];
    if (
      identity.actor !== "ab_runtime" ||
      identity.authenticated_role !== "ab_runtime"
    )
      throw Error("not independently authenticated runtime role");
    const r = (
      await c.query(
        "select rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname=current_user",
      )
    ).rows[0];
    if (Object.values(r).some(Boolean)) throw Error("unsafe runtime role");
    await c.query("select set_config('ab.tenant','',true)");
    if (
      (await c.query("select id from ab.companies limit 1")).rowCount ||
      (await c.query("select id from ab.bank_accounts limit 1")).rowCount
    )
      throw Error("unscoped RLS leak");
    for (const table of ["documents", "document_versions", "audit_events"])
      if (
        (
          await c.query(
            "select has_table_privilege(current_user,$1,$2) allowed",
            ["ab." + table, "UPDATE,DELETE,TRUNCATE"],
          )
        ).rows[0].allowed
      )
        throw Error("mutable protected data");
    for (const name of ["ab.companies", "ab.bank_accounts"])
      if (
        (
          await c.query(
            "select has_table_privilege(current_user,$1,$2) allowed",
            [name, "DELETE,TRUNCATE"],
          )
        ).rows[0].allowed
      )
        throw Error("runtime delete privilege");
  } finally {
    await c.query("ROLLBACK");
    c.release();
  }
}
// Read-only comparison in runner memory. Never return or print the stored verifier.
export async function diagnoseStoredPassword(pool: Pool,password:string){
 const c=await pool.connect();
 try{
  await c.query('BEGIN READ ONLY');
  assertVerifiedDatabaseTls(c);
  const flags=(await c.query("select rolvaliduntil is not null and rolvaliduntil < now() expired,rolcanlogin from pg_roles where rolname='ab_runtime'")).rows[0];
  console.log(flags?.expired?'DIAGNOSTIC: runtime role password expiration reached':'DIAGNOSTIC: runtime role password not expired');
  const row=(await c.query("select rolpassword from pg_authid where rolname='ab_runtime'")).rows[0];
  const match=/^SCRAM-SHA-256\$(\d+):([A-Za-z0-9+/]+=*)\$/.exec(row?.rolpassword||'');
  if(!match){console.log('DIAGNOSTIC: runtime stored SCRAM verifier unavailable or unsupported');return;}
  const iterations=Number(match[1]);
  if(iterations<4096||iterations>1000000)throw Error('unsupported verifier parameters');
  const expected=scramVerifier(password,Buffer.from(match[2],'base64'),iterations);
  console.log(expected===row.rolpassword?'DIAGNOSTIC: stored runtime verifier matches DATABASE_URL password':'DIAGNOSTIC: stored runtime verifier does not match DATABASE_URL password');
 }catch(error){
  console.log((error as any)?.code==='42501'?'DIAGNOSTIC: stored verifier inspection denied; no privileges requested':'DIAGNOSTIC: stored verifier inspection unavailable; details withheld');
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
}
async function diagnoseDirectRuntime(uri:string,endpoint:string){
 const direct=new URL(uri);direct.hostname='db.'+new URL(endpoint).hostname;direct.username='ab_runtime';
 const client=new Client(databaseOptions(direct.href));
 client.on('error',()=>{});
 try{
  await client.connect();assertVerifiedDatabaseTls(client);
  const identity=(await client.query('select current_user actor,session_user authenticated_role')).rows[0];
  if(identity.actor!=='ab_runtime'||identity.authenticated_role!=='ab_runtime')throw Error('unexpected role');
  console.log('DIAGNOSTIC: direct runtime authentication succeeds; pooler route alone rejects authentication');
 }catch(error){console.log('DIAGNOSTIC: direct runtime authentication probe='+connectionDiagnostic(error));}
 finally{await client.end().catch(()=>{});}
}
export async function run() {
  let admin: Pool | undefined,
    runtime: Pool | undefined,
    phase = "trusted runner";
  try {
    if (
      !approvedRuntimeContext(process.env) ||
      process.env.AB_SYNTHETIC_PROJECT !== "yes"
    )
      throw Error("unapproved context");
    phase = "protected DATABASE_URL configuration";
    const cfg = runtimeConfiguration(process.env);
    if(!process.argv.includes('--verify-only')){
    admin = new Pool({ ...databaseOptions(cfg.administratorUri), max: 1 });
    admin.on("error", () => {
      process.exitCode = 1;
      console.log("STOP: administrative connection lost; details withheld");
    });
    const a = await admin.connect();
    try {
      assertVerifiedDatabaseTls(a);
    } finally {
      a.release();
    }
    phase = "existing runtime role password assignment";
    await provisionRuntimePassword(admin, cfg.password,process.argv.includes('--rehash-current-password'));
    console.log(
      "PASS: existing ab_runtime password configured; role attributes, memberships and RLS/table privileges unchanged",
    );
    await admin.end();
    admin = undefined;
    }else {
     console.log('PASS: verify-only mode; existing runtime password is not reassigned');
     admin=new Pool({...databaseOptions(cfg.administratorUri),max:1});
     admin.on('error',()=>{process.exitCode=1;console.log('STOP: diagnostic connection lost; details withheld');});
     await diagnoseStoredPassword(admin,cfg.password);
     await admin.end();admin=undefined;
     await diagnoseDirectRuntime(cfg.runtimeUri,process.env.SUPABASE_URL!);
    }
    phase = "independent runtime authentication";
    runtime = new Pool({ ...databaseOptions(cfg.runtimeUri), max: 1 });
    runtime.on("error", () => {
      process.exitCode = 1;
      console.log("STOP: runtime connection lost; details withheld");
    });
    const c = await runtime.connect();
    try {
      assertVerifiedDatabaseTls(c);
    } finally {
      c.release();
    }
    await verifyRuntimeAccess(runtime);
    console.log(
      "PASS: independently authenticated ab_runtime with verified TLS; actual unscoped RLS denial and protected-table permissions confirmed",
    );
  } catch(error) {
    const own:Record<string,string>={"project/role mismatch":"RUNTIME_TARGET_MISMATCH","runtime driver URL interpretation mismatch":"RUNTIME_URL_INTERPRETATION","strong independent ASCII runtime password required":"RUNTIME_PASSWORD_FORMAT","session pooler target required":"RUNTIME_POOLER_FORMAT","connection override rejected":"RUNTIME_URL_OVERRIDE","existing role missing/unsafe":"RUNTIME_ROLE_UNSAFE","runtime ownership or inherited rights unsafe":"RUNTIME_ROLE_UNSAFE","approved schema not ready":"SCHEMA_NOT_READY"};
    const message=(error as any)?.message;
    const code=typeof message==='string'&&Object.hasOwn(own,message)?own[message]:connectionDiagnostic(error);
    console.log(
      "STOP: " +
        phase +
        "; diagnostic="+code+"; no credentials/provider details logged; no automatic privilege expansion",
    );
    process.exitCode = 1;
  } finally {
    if (admin) await admin.end().catch(()=>{process.exitCode=1;console.log("STOP: administrative connection close failed; details withheld");});
    if (runtime) await runtime.end().catch(()=>{process.exitCode=1;console.log("STOP: runtime connection close failed; details withheld");});
  }
}
if (
  process.argv[1]?.endsWith("/runtime-setup.ts") ||
  process.argv[1]?.endsWith("/runtime-setup.js")
)
  await run();
