import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { supabase } from "../src/core.js";
test("Supabase REST adapter contract: credentials stay server-side, access-token verification, no-upsert encrypted objects", async () => {
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
      "anon-test-key",
      "admin-test-key",
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
      "admin-test-key",
    );
    assert.equal(
      seen.find((r) => r.url.startsWith("/storage") && r.upsert).upsert,
      "false",
    );
  } finally {
    await provider.close();
  }
});
