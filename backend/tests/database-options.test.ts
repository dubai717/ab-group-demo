import { test } from "node:test";
import assert from "node:assert/strict";
import { databaseOptions } from "../src/database.js";
test("every PostgreSQL entrypoint requires verified TLS for remote connections", () => {
  assert.equal(
    databaseOptions("postgres://user:synthetic@127.0.0.1/test", true).ssl,
    false,
  );
  assert.deepEqual(
    databaseOptions("postgres://user:synthetic@127.0.0.1/test").ssl,
    { rejectUnauthorized: true },
  );
  assert.deepEqual(
    databaseOptions("postgres://user:synthetic@db.example.test/test").ssl,
    { rejectUnauthorized: true },
  );
  assert.deepEqual(
    databaseOptions(
      "postgres://user:synthetic@db.example.test/test?sslmode=verify-full",
    ).ssl,
    { rejectUnauthorized: true },
  );
  for (const mode of ["require", "disable", "no-verify", "verify-ca", "prefer"])
    assert.throws(() =>
      databaseOptions(
        "postgres://user:synthetic@db.example.test/test?sslmode=" + mode,
      ),
    );
  assert.throws(() =>
    databaseOptions(
      "postgres://user:synthetic@db.example.test/test?ssl=no-verify",
    ),
  );
  assert.throws(() =>
    databaseOptions(
      "postgres://user:synthetic@db.example.test/test?uselibpqcompat=true",
    ),
  );
});
