import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectSessionUrl } from "../src/connection-format.js";
import { connectionDiagnostic } from "../src/connection-diagnostics.js";
const ref = "abcdefghijklmnopqrst";
const url = (password: string) =>
  `postgresql://postgres.${ref}:${password}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
test("URL diagnosis verifies the actual driver decodes once without exposing values", () => {
  const marker = "CANARY_SECRET_%@/#:+";
  const result = inspectSessionUrl(url(encodeURIComponent(marker)), ref);
  assert(result.valid);
  assert(!JSON.stringify(result).includes(marker));
  assert.deepEqual(result.warnings, []);
  const doubled = inspectSessionUrl(
    url(encodeURIComponent(encodeURIComponent(marker))),
    ref,
  );
  assert(doubled.valid);
  assert.deepEqual(doubled.warnings, ["POSSIBLE_DOUBLE_ENCODING"]); // Warning, not proof of a wrong password.
  for (const [uri, expected] of [
    [url("bad%GG"), "PASSWORD_PERCENT_ENCODING"],
    [url("[YOUR-PASSWORD]"), "PASSWORD_NOT_PLACEHOLDER"],
    [url("sb_secret_CANARY"), "PASSWORD_NOT_API_KEY"],
    [url("ok").replace(":5432", ":6543"), "SESSION_PORT_5432"],
    [
      url("ok").replace("postgres." + ref, "postgres.other"),
      "PROJECT_USERNAME",
    ],
  ])
    assert(
      inspectSessionUrl(uri, ref).checks.some(
        (x) => x.id === expected && !x.pass,
      ),
    );
});
test("Server diagnosis separates tenant routing from password rejection without raw messages", () => {
  assert.equal(
    connectionDiagnostic({
      code: "XX000",
      message: "Tenant or user not found",
    }),
    "POOLER_TENANT_NOT_FOUND",
  );
  assert.equal(
    connectionDiagnostic({
      code: "28000",
      message: "Tenant or user not found",
    }),
    "POOLER_TENANT_NOT_FOUND",
  );
  assert.equal(
    connectionDiagnostic({ code: "28P01", message: "CANARY_SECRET" }),
    "DATABASE_PASSWORD_REJECTED",
  );
  assert.equal(
    connectionDiagnostic({ code: "28000", message: "CANARY_SECRET" }),
    "DATABASE_AUTH_REJECTED",
  );
  assert.equal(
    connectionDiagnostic({ code: "CANARY_SECRET", message: "CANARY_SECRET" }),
    "CHECK_FAILED",
  );
});
