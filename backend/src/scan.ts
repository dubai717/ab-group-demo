import { Pool } from "pg";
import { databaseOptions } from "./database.js";
import { security, sha, supabase, supabaseKeys } from "./core.js";
// Explicit worker, separate DB identity. No scanner URL => files remain quarantined.
for (const key of [
  "SCANNER_DATABASE_URL",
  "SCANNER_URL",
  "SCANNER_TOKEN",
  "DATA_ENCRYPTION_KEY",
  "SUPABASE_URL",
])
  if (!process.env[key]) throw Error(key + " required");
const endpoint = new URL(process.env.SCANNER_URL!);
if (
  endpoint.protocol !== "https:" &&
  !(process.env.APP_ENV === "local" && endpoint.hostname === "127.0.0.1")
)
  throw Error("Scanner requires HTTPS");
const pool = new Pool({
    ...databaseOptions(
      process.env.SCANNER_DATABASE_URL!,
      process.env.APP_ENV === "local",
    ),
  }),
  cipher = security(process.env.DATA_ENCRYPTION_KEY!);
const keys = supabaseKeys();
if (!keys.secret) throw Error("SUPABASE_SECRET_KEY required");
const { objects } = supabase(
  process.env.SUPABASE_URL!,
  keys.publishable,
  keys.secret,
  process.env.SUPABASE_BUCKET || "ab-private-test",
);
try {
  for (const row of (await pool.query("select * from ab.pending_documents()"))
    .rows) {
    const encrypted = await objects.get(row.storage_key),
      bytes = Buffer.from(cipher.open(encrypted.toString()).bytes, "base64");
    if (sha(bytes) !== row.sha256) {
      await pool.query("select ab.record_scan($1,$2)", [row.id, "rejected"]);
      continue;
    }
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.SCANNER_TOKEN,
        "Content-Type": row.mime,
      },
      body: new Uint8Array(bytes),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw Error("Scanner unavailable; document remains quarantined");
    const result = (await r.json()) as any;
    if (!["clean", "rejected"].includes(result.status))
      throw Error("Scanner returned invalid result");
    await pool.query("select ab.record_scan($1,$2)", [row.id, result.status]);
  }
} finally {
  await pool.end();
}
