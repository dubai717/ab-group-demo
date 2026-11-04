import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../src/migrate.js";
export async function setupDatabase(database = "ab_test") {
  const secret = JSON.parse(
    await readFile(
      new URL("../../work/db-test-secrets.json", import.meta.url),
      "utf8",
    ),
  );
  if (!/^ab_(test|backup_[a-f0-9]+)$/.test(database))
    throw Error("Test database name refused");
  if (database !== "ab_test") {
    const root = new Pool({
      connectionString: `postgres://postgres:${secret.admin}@127.0.0.1:5441/ab_test`,
    });
    await root.query("CREATE DATABASE " + database);
    await root.end();
  }
  const adminUrl = `postgres://postgres:${secret.admin}@127.0.0.1:5441/${database}`;
  const admin = new Pool({ connectionString: adminUrl });
  await migrate(admin);
  await admin.query("ALTER ROLE ab_runtime PASSWORD '" + secret.runtime + "'");
  const runtime = new Pool({
    connectionString: `postgres://ab_runtime:${secret.runtime}@127.0.0.1:5441/${database}`,
  });
  return { secret, admin, runtime, adminUrl, sourceDatabase: database };
}
