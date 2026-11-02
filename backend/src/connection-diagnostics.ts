// Only predetermined labels may reach Actions logs; never provider messages.
export const diagnosticCodes = [
  "CHECK_FAILED",
  "CONFIG_INVALID",
  "PROJECT_URL_INVALID",
  "DATABASE_URL_INVALID",
  "DATABASE_TARGET_MISMATCH",
  "DATABASE_DNS",
  "DATABASE_UNREACHABLE",
  "DATABASE_TIMEOUT",
  "DATABASE_CREDENTIALS",
  "POOLER_TENANT_NOT_FOUND",
  "DATABASE_PASSWORD_REJECTED",
  "DATABASE_AUTH_REJECTED",
  "DATABASE_URL_FORMAT",
  "TLS_CERTIFICATE",
  "DATABASE_PERMISSION_DENIED",
  "DATABASE_CATALOG_UNAVAILABLE",
  "STORAGE_POLICY_REVIEW",
  "BUCKET_ACCESS_DENIED",
  "BUCKET_UNAVAILABLE",
  "BUCKET_NOT_PRIVATE",
  "PUBLISHABLE_KEY_REJECTED",
  "AUTH_UNAVAILABLE",
] as const;
export function connectionDiagnostic(error: unknown): string {
  const e = error as { code?: unknown; message?: unknown };
  if (
    [
      "SELF_SIGNED_CERT_IN_CHAIN",
      "DEPTH_ZERO_SELF_SIGNED_CERT",
      "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
      "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
      "CERT_HAS_EXPIRED",
      "ERR_TLS_CERT_ALTNAME_INVALID",
    ].includes(String(e?.code))
  )
    return "TLS_CERTIFICATE";
  if (e?.code === "ENOTFOUND" || e?.code === "EAI_AGAIN") return "DATABASE_DNS";
  if (
    e?.code === "ECONNREFUSED" ||
    e?.code === "ENETUNREACH" ||
    e?.code === "EHOSTUNREACH"
  )
    return "DATABASE_UNREACHABLE";
  if (
    e?.code === "ETIMEDOUT" ||
    e?.message === "Connection terminated due to connection timeout"
  )
    return "DATABASE_TIMEOUT";
  if (
    typeof e?.message === "string" &&
    /^Tenant or user not found\.?$/i.test(e.message)
  )
    return "POOLER_TENANT_NOT_FOUND";
  if (e?.code === "42501")return "DATABASE_PERMISSION_DENIED";
  if (["42P01","42703"].includes(String(e?.code)))return "DATABASE_CATALOG_UNAVAILABLE";
  if (e?.code === "28P01") return "DATABASE_PASSWORD_REJECTED";
  if (e?.code === "28000") return "DATABASE_AUTH_REJECTED";
  const messages: Record<string, string> = {
    "Unverified database TLS connection":"TLS_CERTIFICATE",
    conflictingSupabaseKeys: "CONFIG_INVALID",
    invalidPublishableKey: "CONFIG_INVALID",
    invalidSecretKey: "CONFIG_INVALID",
    "Synthetic project only": "CONFIG_INVALID",
    "Invalid project endpoint": "PROJECT_URL_INVALID",
    "Project-matched direct/session admin connection required":
      "DATABASE_TARGET_MISMATCH",
    "Storage client policies require review; not modified":
      "STORAGE_POLICY_REVIEW",
    "Expected bucket missing/private setting incorrect": "BUCKET_NOT_PRIVATE",
    "Invalid PostgreSQL connection URL; value withheld": "DATABASE_URL_INVALID",
  };
  return typeof e?.message === "string" && Object.hasOwn(messages, e.message)
    ? messages[e.message]
    : "CHECK_FAILED";
}
