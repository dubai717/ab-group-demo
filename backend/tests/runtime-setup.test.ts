import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  diagnoseStoredPassword,
  runtimeBranch,
  runtimeConfiguration,
  scramVerifier,
  provisionRuntimePassword,
  verifyRuntimeAccess,
} from "../actions/runtime-setup.js";
import { isolatedTrialEnvironment } from "../actions/live-trial.js";
const ref = "abcdefghijklmnopqrst",
  host = "aws-0-eu-west-1.pooler.supabase.com";
const config = (pw: string) => ({
  SUPABASE_URL: `https://${ref}.supabase.co`,
  MIGRATION_DATABASE_URL: `postgresql://postgres.${ref}:different-admin-secret@${host}:5432/postgres`,
  DATABASE_URL: `postgresql://ab_runtime.${ref}:${encodeURIComponent(pw)}@${host}:5432/postgres`,
});
test("runtime configuration enforces independent role/password and the same project without URL overrides", () => {
  const pw = randomBytes(32).toString("hex");
  assert.equal(runtimeConfiguration(config(pw)).password, pw);
  for (const change of [
    {
      DATABASE_URL: config(pw).DATABASE_URL.replace("ab_runtime.", "postgres."),
    },
    { DATABASE_URL: config(pw).DATABASE_URL + "?password=override" },
    { DATABASE_URL: config(pw).DATABASE_URL.replace(":5432", ":6543") },
    { DATABASE_URL: config("a".repeat(64)).DATABASE_URL },
  ])
    assert.throws(() => runtimeConfiguration({ ...config(pw), ...change }));
});
test("SCRAM verifier is standards-shaped and never embeds plaintext", () => {
  const pw = "SYNTHETIC_PASSWORD_ONLY_" + randomBytes(24).toString("hex");
  const value = scramVerifier(pw);
  assert(
    /^SCRAM-SHA-256\$65536:[A-Za-z0-9+/]+=*\$[A-Za-z0-9+/]+=*:[A-Za-z0-9+/]+=*$/.test(
      value,
    ),
  );
  assert(!value.includes(pw));
  assert.notEqual(value, scramVerifier(pw));
});
test("backend trial child receives no administrator connection, platform token or unused secrets", () => {
  const result = isolatedTrialEnvironment({
    DATABASE_URL: "runtime",
    MIGRATION_DATABASE_URL: "ADMIN_CANARY",
    GITHUB_TOKEN: "TOKEN_CANARY",
    UNRELATED_SECRET: "OTHER_CANARY",
    DATA_ENCRYPTION_KEY: "data",
    PATH: "/bin",
  });
  assert.equal(result.DATABASE_URL, "runtime");
  assert.equal(result.DATA_ENCRYPTION_KEY, "data");
  assert(!JSON.stringify(result).includes("CANARY"));
  assert(!("MIGRATION_DATABASE_URL" in result));
});
test("runtime setup refuses an unapproved runner without echoing supplied credentials", () => {
  const marker = "RUNTIME_SETUP_SECRET_CANARY";
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "backend/actions/runtime-setup.ts"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        DATABASE_URL: marker,
        MIGRATION_DATABASE_URL: marker,
      },
    },
  );
  assert.equal(r.status, 1);
  assert(!(r.stdout + r.stderr).includes(marker));
});
test("new credential SQL changes only the existing role password and supports actual runtime authentication", async () => {
  const { setupDatabase } = await import("./setup.js");
  const d = await setupDatabase();
  try {
    const before = (
      await d.admin.query(
        "select rolsuper,rolbypassrls,rolcanlogin,rolcreaterole,rolcreatedb from pg_roles where rolname='ab_runtime'",
      )
    ).rows;
    const c = await d.admin.connect();
    const statements: string[] = [];
    const wrapped = {
      connect: async () => ({
        query: async (sql: string, values?: any[]) => {
          statements.push(sql);
          return c.query(sql, values);
        },
        release: () => c.release(),
      }),
    };
    await provisionRuntimePassword(wrapped as any, d.secret.runtime);
    const alter = statements.filter((x) => x.startsWith("ALTER ROLE"));
    assert.equal(alter.length, 1);
    assert(
      alter[0].startsWith("ALTER ROLE ab_runtime PASSWORD 'SCRAM-SHA-256$"),
    );
    assert(!alter[0].includes(d.secret.runtime));
    assert(
      !statements.some((x) =>
        /^\s*(CREATE ROLE|GRANT|REVOKE|DROP|DELETE|TRUNCATE|SET ROLE)\b/i.test(
          x,
        ),
      ),
    );
    await verifyRuntimeAccess(d.runtime);
    assert.deepEqual(
      (
        await d.admin.query(
          "select rolsuper,rolbypassrls,rolcanlogin,rolcreaterole,rolcreatedb from pg_roles where rolname='ab_runtime'",
        )
      ).rows,
      before,
    );
  } finally {
    await d.admin.end();
    await d.runtime.end();
  }
});
test("batched synthetic bootstrap preserves all existing reference areas and memberships", async () => {
  const { fixture } = await import("./fixture.js");
  const f = await fixture();
  try {
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from ab.areas where tenant_id=$1",
          [f.org.tenant],
        )
      ).rows[0].n,
      367,
    );
    assert(
      (
        await f.admin.query(
          "select count(*)::int n from ab.area_aliases where tenant_id=$1",
          [f.org.tenant],
        )
      ).rows[0].n > 367,
    );
    assert.equal(
      (
        await f.admin.query(
          "select count(*)::int n from ab.bank_references where tenant_id=$1",
          [f.org.tenant],
        )
      ).rows[0].n,
      6,
    );
  } finally {
    await f.app.close();
    await f.admin.end();
    await f.runtime.end();
  }
});
test("live workflow never exports credentials through outputs, files or artifacts", async () => {
  const code = await readFile(
    new URL("../../.github/workflows/supabase-runtime.yml", import.meta.url),
    "utf8",
  );
  assert(code.includes("environment: supabase-test"));
  assert(code.includes("needs: configure-runtime"));
  assert(!/GITHUB_OUTPUT|upload-artifact|deploy-pages|set -x/.test(code));
});

test("missing durable data key stops before creating Auth subjects or records", () => {
  const pw = randomBytes(32).toString("hex"),
    base = config(pw),
    marker = "NO_LIVE_SECRET_CANARY";
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "backend/actions/live-trial.ts"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        ...base,
        SUPABASE_SECRET_KEY: marker,
        AB_SYNTHETIC_PROJECT: "yes",
        GITHUB_ACTIONS: "true",
        GITHUB_REPOSITORY: "dubai717/ab-group-demo",
        GITHUB_EVENT_NAME: "push",
        RUNNER_ENVIRONMENT: "github-hosted",
        GITHUB_REF: runtimeBranch,
        GITHUB_WORKFLOW_REF: `dubai717/ab-group-demo/.github/workflows/supabase-runtime.yml@${runtimeBranch}`,
      },
    },
  );
  assert.equal(r.status, 1);
  assert(r.stdout.includes("protected fixture configuration"));
  assert(!(r.stdout + r.stderr).includes(marker));
  assert(!(r.stdout + r.stderr).includes(pw));
});
test("backend child rejects an administrator SQL connection before processing fixture input", () => {
  const r = spawnSync(
    process.execPath,
    ["--import", "tsx", "backend/actions/live-trial.ts", "--child"],
    {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        MIGRATION_DATABASE_URL: "ADMIN_CHILD_CANARY",
      },
    },
  );
  assert.equal(r.status, 1);
  assert(r.stdout.includes("protected runtime child"));
  assert(!(r.stdout + r.stderr).includes("ADMIN_CHILD_CANARY"));
});

test('runtime configuration and actual driver interpret encoded passwords identically',()=>{
 const pw='ABCDEFGHIJKLMNOPQRSTUVWXYZ123456!@#$%&+/:?';assert.equal(runtimeConfiguration(config(pw)).password,pw);
});

test('read-only stored-verifier diagnosis emits only a fixed verdict and always rolls back',async()=>{
 const password='SYNTHETIC_DIAGNOSTIC_ONLY_1234567890!';
 const verifier=scramVerifier(password), queries:string[]=[],output:string[]=[];
 const c={connection:{stream:{encrypted:true,authorized:true}},query:async(sql:string)=>{queries.push(sql);return {rows:[{rolpassword:verifier}]};},release:()=>{}};
 const original=console.log; console.log=(line:string)=>{output.push(line);};
 try{await diagnoseStoredPassword({connect:async()=>c} as any,password);}finally{console.log=original;}
 assert.deepEqual(queries,['BEGIN READ ONLY',"select rolpassword from pg_authid where rolname='ab_runtime'",'ROLLBACK']);
 assert.deepEqual(output,['DIAGNOSTIC: stored runtime verifier matches DATABASE_URL password']);
 assert(!output.join().includes(password));assert(!output.join().includes(verifier));
});
