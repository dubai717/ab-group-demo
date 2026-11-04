import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import { Pool, PoolClient } from "pg";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function requireOk(
  ok: unknown,
  status = 403,
  code = "denied",
): asserts ok {
  if (!ok) throw new ApiError(status, code);
}
export function security(key: string) {
  const k = Buffer.from(key, "base64");
  requireOk(k.length === 32, 500, "invalidEncryptionKey");
  return {
    seal(value: unknown) {
      const iv = randomBytes(12),
        c = createCipheriv("aes-256-gcm", k, iv);
      const b = Buffer.concat([c.update(JSON.stringify(value)), c.final()]);
      return Buffer.concat([iv, c.getAuthTag(), b]).toString("base64");
    },
    open(value: string) {
      const b = Buffer.from(value, "base64"),
        d = createDecipheriv("aes-256-gcm", k, b.subarray(0, 12));
      d.setAuthTag(b.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([d.update(b.subarray(28)), d.final()]).toString(),
      );
    },
    digest(value: string) {
      return createHmac("sha256", k).update(value).digest("hex");
    },
  };
}
export const sha = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export async function transaction<T>(
  pool: Pool,
  tenant: string,
  actor: string,
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      "select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",
      [tenant, actor],
    );
    await c.query("select pg_advisory_xact_lock(hashtext($1))", [tenant]);
    const value = await fn(c);
    await c.query("COMMIT");
    return value;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
export interface AuthProvider {
  login(
    email: string,
    password: string,
  ): Promise<{ id: string; token: string; expiresIn: number }>;
  verify(token: string): Promise<string>;
  create(email: string, password: string): Promise<string>;
  logout(token: string): Promise<void>;
}
export interface ObjectStore {
  put(key: string, bytes: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
}
// Modern keys identify the application via apikey; they are not user JWTs.
// Keep legacy variable names as aliases without accepting conflicting values.
export function supabaseKeys(
  env: Record<string, string | undefined> = process.env,
) {
  const select = (modern: string, legacy: string) => {
    const a = env[modern]?.trim(),
      b = env[legacy]?.trim();
    requireOk(!a || !b || a === b, 500, "conflictingSupabaseKeys");
    return a || b || "";
  };
  const publishable = select("SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY");
  const secret = select("SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY");
  requireOk(
    publishable && !publishable.startsWith("sb_secret_"),
    500,
    "invalidPublishableKey",
  );
  requireOk(!secret.startsWith("sb_publishable_"), 500, "invalidSecretKey");
  return { publishable, secret };
}
export function supabase(
  url: string,
  key: string,
  adminKey: string,
  bucket: string,
): { auth: AuthProvider; objects: ObjectStore } {
  requireOk(
    url.startsWith("https://") || url.startsWith("http://127.0.0.1:"),
    500,
    "invalidSupabaseUrl",
  );
  requireOk(
    key &&
      !key.startsWith("sb_secret_") &&
      !adminKey.startsWith("sb_publishable_"),
    500,
    "invalidSupabaseKeyRole",
  );
  const call = async (
    path: string,
    token: string,
    options: RequestInit = {},
    apiKey = key,
  ) => {
    const r = await fetch(url + path, {
      ...options,
      signal: AbortSignal.timeout(15000),
      headers: {
        apikey: apiKey,
        // Opaque sb_* API keys must not be treated as user access JWTs.
        ...(!/^sb_(publishable|secret)_/.test(token)
          ? { Authorization: "Bearer " + token }
          : {}),
        ...options.headers,
      },
    });
    if (!r.ok)
      throw new ApiError(
        r.status === 400 || r.status === 401 ? 401 : 502,
        "providerUnavailable",
      );
    return r;
  };
  const auth: AuthProvider = {
    async login(email, password) {
      const r = await call("/auth/v1/token?grant_type=password", key, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const d = (await r.json()) as any;
      requireOk(
        d.user?.id && d.access_token && Number.isFinite(d.expires_in),
        502,
        "providerUnavailable",
      );
      return { id: d.user.id, token: d.access_token, expiresIn: d.expires_in };
    },
    async verify(token) {
      requireOk(token && !token.startsWith("sb_"), 401, "loginRequired");
      const r = await call("/auth/v1/user", token);
      const d = (await r.json()) as any;
      requireOk(d.id, 401, "loginRequired");
      return d.id;
    },
    async create(email, password) {
      requireOk(adminKey, 503, "enrollmentNotConfigured");
      const r = await call(
        "/auth/v1/admin/users",
        adminKey,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password, email_confirm: true }),
        },
        adminKey,
      );
      const d = (await r.json()) as any;
      return d.id;
    },
    async logout(token) {
      requireOk(token && !token.startsWith("sb_"), 401, "loginRequired");
      await call("/auth/v1/logout", token, { method: "POST" });
    },
  };
  const objectPath = (name: string) =>
    "/storage/v1/object/" +
    encodeURIComponent(bucket) +
    "/" +
    name.split("/").map(encodeURIComponent).join("/");
  const objects: ObjectStore = {
    async put(name, bytes) {
      requireOk(adminKey, 503, "storageNotConfigured");
      await call(
        objectPath(name),
        adminKey,
        {
          method: "POST",
          headers: {
            "content-type": "application/octet-stream",
            "x-upsert": "false",
          },
          body: new Uint8Array(bytes),
        },
        adminKey,
      );
    },
    async get(name) {
      requireOk(adminKey, 503, "storageNotConfigured");
      const r = await call(objectPath(name), adminKey, {}, adminKey);
      return Buffer.from(await r.arrayBuffer());
    },
  };
  return { auth, objects };
}
