import type { PoolConfig } from "pg";
// Apply the same verified TLS rules to runtime, administrative tools and workers.
export function databaseOptions(
  connectionString: string,
  allowLoopbackPlaintext = false,
): PoolConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Node's ERR_INVALID_URL retains the original input (possibly credentials).
    // Replace it entirely, without cause/input, before any CLI can log it.
    throw Error("Invalid PostgreSQL connection URL; value withheld");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw Error("PostgreSQL URL required");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  const mode = url.searchParams.get("sslmode");
  if (
    url.searchParams.has("ssl") ||
    url.searchParams.has("uselibpqcompat") ||
    (mode && mode !== "verify-full")
  )
    throw Error("Verified database TLS required; unsafe URL override rejected");
  return {
    connectionString,
    ssl:
      local && allowLoopbackPlaintext && !mode
        ? false
        : { rejectUnauthorized: true },
    connectionTimeoutMillis: 8000,
    statement_timeout: 15000,
  };
}
