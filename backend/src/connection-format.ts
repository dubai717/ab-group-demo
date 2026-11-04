import { Client } from "pg";
export const formatCheckNames = [
  "SESSION_POOLER_ENDPOINT",
  "PROJECT_USERNAME",
  "SESSION_PORT_5432",
  "DATABASE_POSTGRES",
  "PASSWORD_PRESENT",
  "PASSWORD_PERCENT_ENCODING",
  "DRIVER_DECODES_ONCE",
  "PASSWORD_NOT_PLACEHOLDER",
  "PASSWORD_NOT_API_KEY",
] as const;
export const formatWarningNames = ["POSSIBLE_DOUBLE_ENCODING"] as const;
// Return only fixed labels/booleans. Never return URL parts, hashes or lengths.
export function inspectSessionUrl(uri: string, projectRef: string) {
  const checks = formatCheckNames.map((id) => ({ id, pass: false }));
  const warnings: string[] = [];
  const set = (id: (typeof formatCheckNames)[number], pass: boolean) => {
    checks.find((x) => x.id === id)!.pass = pass;
  };
  try {
    const u = new URL(uri);
    set(
      "SESSION_POOLER_ENDPOINT",
      ["postgres:", "postgresql:"].includes(u.protocol) &&
        /^[a-z0-9-]+\.pooler\.supabase\.com$/.test(u.hostname),
    );
    let username = "";
    try {
      username = decodeURIComponent(u.username);
    } catch {}
    set("PROJECT_USERNAME", username === "postgres." + projectRef);
    set("SESSION_PORT_5432", (u.port || "5432") === "5432");
    set("DATABASE_POSTGRES", u.pathname === "/postgres");
    set("PASSWORD_PRESENT", !!u.password);
    let decoded: string | undefined;
    try {
      decoded = decodeURIComponent(u.password);
      set("PASSWORD_PERCENT_ENCODING", true);
    } catch {}
    if (/%25[0-9a-f]{2}/i.test(u.password))
      warnings.push("POSSIBLE_DOUBLE_ENCODING");
    if (decoded !== undefined) {
      set(
        "PASSWORD_NOT_PLACEHOLDER",
        !/^\[?(?:YOUR[-_ ](?:DATABASE[-_ ])?PASSWORD|PASSWORD)\]?$/i.test(
          decoded,
        ),
      );
      set(
        "PASSWORD_NOT_API_KEY",
        !/^sb_(?:publishable|secret)_/.test(decoded) &&
          !/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(decoded),
      );
      const params = (new Client({ connectionString: u.href }) as any)
        .connectionParameters;
      set(
        "DRIVER_DECODES_ONCE",
        params.password === decoded &&
          params.user === username &&
          params.host === u.hostname &&
          Number(params.port) === 5432 &&
          params.database === "postgres",
      );
    }
  } catch {}
  return { checks, warnings, valid: checks.every((x) => x.pass) };
}
