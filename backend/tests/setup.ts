import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../src/migrate.js";
export const localTestPort=Number(process.env.AB_LOCAL_DB_PORT||'5441');
export const localTestContainer=process.env.AB_LOCAL_DB_CONTAINER||'ab-postgres-foundation';
if(!Number.isInteger(localTestPort)||localTestPort<1024||localTestPort>65535||!/^ab-[a-z0-9-]+$/.test(localTestContainer))throw Error('Invalid isolated DB target');
export async function setupDatabase(database = "ab_test") {
  const port=localTestPort;
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
      connectionString: `postgres://postgres:${secret.admin}@127.0.0.1:${port}/ab_test`,
    });
    await root.query("CREATE DATABASE " + database);
    await root.end();
  }
  const adminUrl = `postgres://postgres:${secret.admin}@127.0.0.1:${port}/${database}`;
  const admin = new Pool({ connectionString: adminUrl });
  await migrate(admin);
  await admin.query("ALTER ROLE ab_runtime PASSWORD '" + secret.runtime + "'");
  const runtime = new Pool({
    connectionString: `postgres://ab_runtime:${secret.runtime}@127.0.0.1:${port}/${database}`,
  });
  return { secret, admin, runtime, adminUrl, sourceDatabase: database };
}
