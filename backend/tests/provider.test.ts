import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { supabase, supabaseKeys } from "../src/core.js";
for (const [name, publicKey, secretKey] of [
  ["legacy", "anon-test-key", "admin-test-key"],
  ["modern", "sb_publishable_synthetic-only", "sb_secret_synthetic-only"],
])
  test(`Supabase ${name} REST contract: API keys separate from user tokens; encrypted objects never overwrite`, async () => {
    const provider = Fastify(),
      seen: any[] = [];
    provider.addContentTypeParser(
      "application/octet-stream",
      { parseAs: "buffer" },
      (_, b, done) => done(null, b),
    );
    provider.addHook("onRequest", async (req) => {
      seen.push({
        url: req.url,
        apiKey: req.headers.apikey,
        authorization: req.headers.authorization,
        upsert: req.headers["x-upsert"],
      });
    });
    provider.post("/auth/v1/token", async (req: any) => {
      assert.equal(req.body.email, "synthetic@example.test");
      assert.equal(req.body.password, "Synthetic-Password@2026");
      return {
        access_token: "test-only-access-token",
        expires_in: 3600,
        user: { id: "11111111-1111-4111-8111-111111111111" },
      };
    });
    provider.get("/auth/v1/user", async () => ({
      id: "11111111-1111-4111-8111-111111111111",
    }));
    provider.post("/auth/v1/admin/users", async () => ({
      id: "22222222-2222-4222-8222-222222222222",
    }));
    provider.post("/auth/v1/logout", async () => ({}));
    provider.post("/storage/v1/object/test-bucket/a/b", async () => ({}));
    provider.get("/storage/v1/object/test-bucket/a/b", async (_, reply) =>
      reply
        .type("application/octet-stream")
        .send(Buffer.from("encrypted-object")),
    );
    await provider.listen({ host: "127.0.0.1", port: 0 });
    try {
      const address = provider.server.address() as any;
      const { auth, objects } = supabase(
        "http://127.0.0.1:" + address.port,
        publicKey,
        secretKey,
        "test-bucket",
      );
      const result = await auth.login(
        "synthetic@example.test",
        "Synthetic-Password@2026",
      );
      assert.equal(await auth.verify(result.token), result.id);
      await auth.create("new@example.test", "Synthetic-Password@2026");
      await objects.put("a/b", Buffer.from("encrypted-object"));
      assert.equal((await objects.get("a/b")).toString(), "encrypted-object");
      await auth.logout(result.token);
      assert.equal(
        seen.find((r) => r.url === "/auth/v1/user").authorization,
        "Bearer test-only-access-token",
      );
      assert.equal(
        seen.find((r) => r.url === "/auth/v1/admin/users").apiKey,
        secretKey,
      );
      assert.equal(
        seen.find((r) => r.url.startsWith("/auth/v1/token")).apiKey,
        publicKey,
      );
      assert.equal(
        seen.find((r) => r.url.startsWith("/auth/v1/token")).authorization,
        name === "modern" ? undefined : "Bearer " + publicKey,
      );
      for (const r of seen.filter(
        (r) => r.url.startsWith("/storage") || r.url === "/auth/v1/admin/users",
      )) {
        assert.equal(r.apiKey, secretKey);
        assert.equal(
          r.authorization,
          name === "modern" ? undefined : "Bearer " + secretKey,
        );
      }
      assert.equal(
        seen.find((r) => r.url === "/auth/v1/logout").authorization,
        "Bearer test-only-access-token",
      );
      const count = seen.length;
      await assert.rejects(() => auth.verify("sb_secret_not-a-user-token"));
      await assert.rejects(() =>
        auth.logout("sb_publishable_not-a-user-token"),
      );
      assert.equal(seen.length, count);
      assert.equal(
        seen.find((r) => r.url.startsWith("/storage") && r.upsert).upsert,
        "false",
      );
    } finally {
      await provider.close();
    }
  });

test("Supabase key aliases reject wrong privilege placement and conflicting configuration", () => {
  assert.deepEqual(
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    }),
    { publishable: "sb_publishable_test", secret: "sb_secret_test" },
  );
  assert.deepEqual(
    supabaseKeys({
      SUPABASE_ANON_KEY: "legacy-anon",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
    }),
    { publishable: "legacy-anon", secret: "legacy-service" },
  );
  assert.throws(() =>
    supabaseKeys({ SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong" }),
  );
  assert.throws(() =>
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_publishable_wrong",
    }),
  );
  assert.throws(() =>
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_one",
      SUPABASE_ANON_KEY: "different",
    }),
  );
  assert.throws(() =>
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_one",
      SUPABASE_SERVICE_ROLE_KEY: "different",
    }),
  );
  assert.throws(() =>
    supabase("http://127.0.0.1:1", "sb_secret_wrong", "sb_secret_test", "test"),
  );
});
