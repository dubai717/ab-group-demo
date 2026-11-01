// Explicit test doubles for provider contracts. Never imported by the production entrypoint.
import { randomUUID } from "node:crypto";
import { ApiError, AuthProvider, ObjectStore } from "../src/core.js";
import { initializeOrganization } from "../src/bootstrap.js";
import { build } from "../src/app.js";
import { setupDatabase } from "./setup.js";
export class TestAuth implements AuthProvider {
  accounts = new Map<string, { id: string; password: string }>();
  tokens = new Map<string, string>();
  async create(email: string, password: string) {
    if (this.accounts.has(email)) throw new ApiError(409, "duplicate");
    const id = randomUUID();
    this.accounts.set(email, { id, password });
    return id;
  }
  async login(email: string, password: string) {
    const a = this.accounts.get(email);
    if (!a || a.password !== password) throw new ApiError(401, "loginFailed");
    const token = randomUUID();
    this.tokens.set(token, a.id);
    return { id: a.id, token, expiresIn: 3600 };
  }
  async verify(token: string) {
    const id = this.tokens.get(token);
    if (!id) throw new ApiError(401, "loginRequired");
    return id;
  }
  async logout(token: string) {
    this.tokens.delete(token);
  }
}
export class TestObjects implements ObjectStore {
  rows = new Map<string, Buffer>();
  async put(key: string, bytes: Buffer) {
    if (this.rows.has(key)) throw Error("overwrite denied");
    this.rows.set(key, bytes);
  }
  async get(key: string) {
    const b = this.rows.get(key);
    if (!b) throw Error("missing");
    return b;
  }
}
export async function fixture(database?: string) {
  const d = await setupDatabase(database),
    auth = new TestAuth(),
    objects = new TestObjects(),
    suffix = randomUUID().slice(0, 8),
    password = "Synthetic-Test@2026",
    email = `owner-${suffix}@example.test`,
    username = "owner_" + suffix;
  const authId = await auth.create(email, password);
  const org = await initializeOrganization(d.admin, {
    authId,
    email,
    username,
    name: "Synthetic Owner",
  });
  const app = await build({
    pool: d.runtime,
    key: d.secret.key,
    origin: "http://127.0.0.1:3100",
    secureCookies: false,
    auth,
    objects,
    scan: async () => "clean",
  });
  await app.ready();
  return { ...d, auth, objects, org, app, password, username };
}
