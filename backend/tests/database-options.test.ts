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

test("invalid PostgreSQL URL never appears in CLI output", async () => {
  const {spawnSync}=await import('node:child_process');
  const marker='SYNTHETIC_SECRET_CANARY_83a2';
  const run=spawnSync(process.execPath,['--import','tsx','backend/src/migrate.ts'],{
    cwd:process.cwd(),encoding:'utf8',env:{PATH:process.env.PATH,MIGRATION_DATABASE_URL:'invalid connection '+marker,APP_ENV:'local'}
  });
  assert.notEqual(run.status,0);
  const output=run.stdout+run.stderr;
  assert(output.includes('value withheld'));
  assert(!output.includes(marker));
});
