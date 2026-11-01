import { Pool } from "pg";
import { build } from "./app.js";
import { supabase } from "./core.js";
const required = [
  "DATABASE_URL",
  "DATA_ENCRYPTION_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "PUBLIC_ORIGIN",
] as const;
for (const key of required)
  if (!process.env[key]) throw Error(key + " required");
if (process.env.APP_ENV !== "staging" && process.env.APP_ENV !== "local")
  throw Error(
    "This phase allows synthetic local/staging only; production activation requires a separate review.",
  );
const origin = process.env.PUBLIC_ORIGIN!;
const local = process.env.APP_ENV === "local";
if (!local && !origin.startsWith("https://")) throw Error("HTTPS required");
if (local && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error("Local cookie mode is loopback-only");
const dbUrl = new URL(process.env.DATABASE_URL!);
if (
  !local &&
  dbUrl.searchParams.has("sslmode") &&
  dbUrl.searchParams.get("sslmode") !== "verify-full"
)
  throw Error("Use verified TLS for the database");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    local && ["localhost", "127.0.0.1"].includes(dbUrl.hostname)
      ? false
      : { rejectUnauthorized: true },
  max: 10,
  connectionTimeoutMillis: 5000,
  statement_timeout: 15000,
});
const role = (
  await pool.query(
    "select current_user name,rolsuper,rolbypassrls,rolcreaterole,exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relowner=r.oid) owns_tables from pg_roles r where rolname=current_user",
  )
).rows[0];
if (
  role.name !== "ab_runtime" ||
  role.rolsuper ||
  role.rolbypassrls ||
  role.rolcreaterole ||
  role.owns_tables
)
  throw Error("Web process cannot use owner/superuser/bypass-RLS credentials");
const { auth, objects } = supabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  process.env.SUPABASE_BUCKET || "ab-private-test",
);
const app = await build({
  pool,
  key: process.env.DATA_ENCRYPTION_KEY!,
  origin,
  secureCookies: !local,
  auth,
  objects,
});
await app.listen({
  host: local ? "127.0.0.1" : "0.0.0.0",
  port: Number(process.env.PORT || 3100),
});
const stop = async () => {
  await app.close();
  await pool.end();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
