// Read-only check of the already-created synthetic Supabase project. No resources,
// bucket policies, SQL roles, users or migrations are created by this command.
import { Pool } from "pg";
import { supabaseKeys } from "../src/core.js";
import { databaseOptions } from "../src/database.js";
let pool: Pool | undefined;
const completed: string[] = [];
try {
  const needed = ["SUPABASE_URL", "MIGRATION_DATABASE_URL"];
  if (
    needed.some((k) => !process.env[k]) ||
    !(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY) ||
    !(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    console.log(
      JSON.stringify({
        status: "NOT_RUN",
        reason:
          "Enter the four connection values in the protected file; no network attempted",
      }),
    );
    process.exitCode = 2;
  } else {
    if (process.env.AB_SYNTHETIC_PROJECT !== "yes")
      throw Error("Synthetic project only");
    const { publishable, secret } = supabaseKeys();
    const endpoint = new URL(process.env.SUPABASE_URL!);
    if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(endpoint.href))
      throw Error("Invalid project endpoint");
    const ref = endpoint.hostname.split(".")[0];
    const db = new URL(process.env.MIGRATION_DATABASE_URL!);
    const direct =
      db.hostname === "db." + ref + ".supabase.co" &&
      db.username === "postgres";
    const session =
      db.hostname.endsWith(".pooler.supabase.com") &&
      db.username === "postgres." + ref;
    if (
      (!direct && !session) ||
      (db.port && db.port !== "5432") ||
      db.pathname !== "/postgres"
    )
      throw Error("Project-matched direct/session admin connection required");
    pool = new Pool({ ...databaseOptions(db.href), max: 1 });
    await pool.query("BEGIN READ ONLY");
    await pool.query("select current_database()");
    if (
      (
        await pool.query(
          "select ssl from pg_stat_ssl where pid=pg_backend_pid()",
        )
      ).rows[0]?.ssl !== true
    )
      throw Error("Database TLS not active");
    completed.push("verified TLS SQL connection");
    const rules = await pool.query(
      "select policyname from pg_policies where schemaname='storage' and tablename='objects' and roles && ARRAY['public','anon','authenticated']::name[]",
    );
    if (rules.rowCount)
      throw Error("Storage client policies require review; not modified");
    completed.push("no direct public/ordinary-user storage policies");
    await pool.query("ROLLBACK");
    const bucket = process.env.SUPABASE_BUCKET || "ab-private-test";
    const headers = (key: string) => ({
      apikey: key,
      ...(/^sb_(publishable|secret)_/.test(key)
        ? {}
        : { Authorization: "Bearer " + key }),
    });
    const response = await fetch(
      endpoint.origin + "/storage/v1/bucket/" + encodeURIComponent(bucket),
      { headers: headers(secret), signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw Error("Private bucket check failed");
    const metadata = (await response.json()) as any;
    if (metadata.id !== bucket || metadata.public !== false)
      throw Error("Expected bucket missing/private setting incorrect");
    completed.push("actual secret key and existing private bucket");
    const auth = await fetch(endpoint.origin + "/auth/v1/settings", {
      headers: headers(publishable),
      signal: AbortSignal.timeout(15000),
    });
    if (!auth.ok) throw Error("Publishable/Auth endpoint check failed");
    completed.push("actual publishable key and Auth endpoint");
    console.log(
      JSON.stringify({
        status: "PASS",
        completed,
        limits:
          "Connection/settings only; not migrated ERP CRUD, login or cloud restore proof",
      }),
    );
  }
} catch {
  console.log(
    JSON.stringify({
      status: "FAIL",
      completed,
      reason:
        "Connection/settings check failed; inspect configuration privately. No credentials or provider errors printed.",
    }),
  );
  process.exitCode = 1;
} finally {
  if (pool) await pool.end();
}
