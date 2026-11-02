import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import {
  approvedActionsContext,
  checkSchema,
  inspectSchema,
} from "../actions/supabase-check.js";
import { fixture } from "./fixture.js";
const trusted = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "dubai717/ab-group-demo",
  GITHUB_EVENT_NAME: "push",
  RUNNER_ENVIRONMENT: "github-hosted",
  GITHUB_REF: "refs/heads/verify/supabase-test-approved",
  GITHUB_WORKFLOW_REF:
    "dubai717/ab-group-demo/.github/workflows/supabase-test.yml@refs/heads/verify/supabase-test-approved",
};
test("Actions cloud checks refuse forks, PRs, wrong refs and self-hosted runners", () => {
  assert(approvedActionsContext(trusted));
  for (const override of [
    { GITHUB_REPOSITORY: "other/fork" },
    { GITHUB_EVENT_NAME: "pull_request" },
    { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_REF: "refs/heads/main" },
    { GITHUB_WORKFLOW_REF: "other/workflow" },
    { RUNNER_ENVIRONMENT: "self-hosted" },
  ])
    assert(!approvedActionsContext({ ...trusted, ...override }));
});
test("Actions gate never echoes synthetic secret canaries, even on invalid inputs", () => {
  for (const context of [{}, trusted]) {
    const marker = "CANARY_ACTIONS_SECRET_68af";
    const r = spawnSync(
      process.execPath,
      ["--import", "tsx", "backend/actions/supabase-check.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          PATH: process.env.PATH,
          ...context,
          AB_SYNTHETIC_PROJECT: "yes",
          SUPABASE_URL: "invalid-" + marker,
          SUPABASE_PUBLISHABLE_KEY: "sb_publishable_" + marker,
          SUPABASE_SECRET_KEY: "sb_secret_" + marker,
          MIGRATION_DATABASE_URL: "invalid-" + marker,
        },
      },
    );
    assert.equal(r.status, 1);
    assert(r.stdout.includes("FAIL:"));
    assert(!(r.stdout + r.stderr).includes(marker));
  }
});
test("Workflow has pinned actions, isolated secrets, read-only token and no publication or PR trigger", async () => {
  const yaml = await readFile(
    new URL("../../.github/workflows/supabase-test.yml", import.meta.url),
    "utf8",
  );
  assert(yaml.includes("- 'verify/supabase-test-*'"));
  assert(
    !/^\s*(pull_request|pull_request_target|workflow_run|schedule):/m.test(
      yaml,
    ),
  );
  assert(yaml.includes("contents: read"));
  assert(!/: write\s*$/m.test(yaml));
  for (const [, ref] of yaml.matchAll(/uses:\s*([^\s#]+)/g))
    assert(/@[a-f0-9]{40}$/.test(ref));
  assert(yaml.includes("persist-credentials: false"));
  assert(yaml.includes("environment: supabase-test"));
  const [local, remote] = yaml.split("  supabase-read-only:");
  assert(!local.includes("${{ secrets."));
  assert(
    remote.indexOf("npm ci --ignore-scripts") < remote.indexOf("${{ secrets."),
  );
  assert(
    !/upload-artifact|upload-pages|deploy-pages|actions\/cache|set -x/.test(
      yaml,
    ),
  );
});
test("Actions schema checks succeed on actual local migrations without changing records", async () => {
  const f = await fixture();
  try {
    const before = (await f.admin.query("select count(*)::int n from ab.users"))
      .rows[0].n;
    await checkSchema(f.admin);
    assert.equal(
      (await f.admin.query("select count(*)::int n from ab.users")).rows[0].n,
      before,
    );
  } finally {
    await f.app.close();
    await f.runtime.end();
    await f.admin.end();
  }
});

test("Read-only inspector leaves absent schema untouched", async () => {
  const queries: string[] = [];
  const client = {
    query: async (q: string) => {
      queries.push(q);
      return { rows: [{ ledger: null, app_schema: null }] };
    },
    release: () => {},
  };
  assert.equal(
    await inspectSchema({ connect: async () => client } as any),
    "NOT_APPLIED",
  );
  assert.deepEqual(queries, [
    "BEGIN READ ONLY",
    "select to_regclass('public.ab_schema_migrations') ledger,to_regnamespace('ab') app_schema",
    "ROLLBACK",
  ]);
  const source = await readFile(
    new URL("../actions/supabase-check.ts", import.meta.url),
    "utf8",
  );
  assert(!source.includes("await migrate("));
  assert(!source.includes('from "../src/migrate.js"'));
});

test("Read-only diagnostics never include raw provider messages or unknown codes", async () => {
  const { connectionDiagnostic } = await import(
    "../src/connection-diagnostics.js"
  );
  assert.equal(
    connectionDiagnostic({
      code: "SELF_SIGNED_CERT_IN_CHAIN",
      message: "CANARY_SECRET",
    }),
    "TLS_CERTIFICATE",
  );
  assert.equal(
    connectionDiagnostic({ code: "28P01", message: "CANARY_SECRET" }),
    "DATABASE_PASSWORD_REJECTED",
  );
  assert.equal(
    connectionDiagnostic({ code: "CANARY_SECRET", message: "CANARY_SECRET" }),
    "CHECK_FAILED",
  );
});

test("Read-only TLS trusts only the reviewed Supabase public CA without disabling verification", async () => {
  const { X509Certificate } = await import("node:crypto");
  const ca = new X509Certificate(
    await readFile(
      new URL("../certificates/supabase-prod-ca-2021.crt", import.meta.url),
    ),
  );
  assert.equal(
    ca.fingerprint256,
    "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
  );
  assert(ca.ca);
  assert(ca.verify(ca.publicKey));
  assert(new Date(ca.validTo) > new Date());
  const workflow = await readFile(
    new URL("../../.github/workflows/supabase-test.yml", import.meta.url),
    "utf8",
  );
  assert(workflow.includes("NODE_EXTRA_CA_CERTS:"));
  assert(!workflow.includes("NODE_TLS_REJECT_UNAUTHORIZED"));
});
