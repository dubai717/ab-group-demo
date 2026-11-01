import { Pool } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sha } from "./core.js";
export async function migrate(pool: Pool) {
  const c = await pool.connect();
  try {
    await c.query("select pg_advisory_lock(hashtext('ab-schema-migrations'))");
    await c.query(
      "CREATE TABLE IF NOT EXISTS public.ab_schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    const dir = fileURLToPath(
      new URL("../../supabase/migrations/", import.meta.url),
    );
    for (const file of (await readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(dir + file, "utf8"),
        hash = sha(sql),
        done = await c.query(
          "SELECT sha256 FROM public.ab_schema_migrations WHERE name=$1",
          [file],
        );
      if (done.rowCount) {
        if (done.rows[0].sha256 !== hash)
          throw Error("Applied migration changed: " + file);
        continue;
      }
      await c.query("BEGIN");
      try {
        await c.query(sql);
        await c.query(
          "INSERT INTO public.ab_schema_migrations(name,sha256)VALUES($1,$2)",
          [file, hash],
        );
        await c.query("COMMIT");
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await c.query(
      "select pg_advisory_unlock(hashtext('ab-schema-migrations'))",
    );
    c.release();
  }
}
if (process.argv[1] && /migrate\.(ts|js)$/.test(process.argv[1])) {
  if (!process.env.MIGRATION_DATABASE_URL)
    throw Error("MIGRATION_DATABASE_URL required");
  const pool = new Pool({
    connectionString: process.env.MIGRATION_DATABASE_URL,
  });
  await migrate(pool);
  await pool.end();
  console.log("Migrations applied without resetting data.");
}
