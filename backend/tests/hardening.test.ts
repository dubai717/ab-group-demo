import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./fixture.js";
import { build } from "../src/app.js";
import { transaction } from "../src/core.js";
test("security: CSRF, private routes, owner DB invariants, idempotency, quarantine and scanner separation", async () => {
  const f = await fixture();
  const app = await build({
    pool: f.runtime,
    key: f.secret.key,
    origin: "https://staging.example.test",
    secureCookies: true,
    auth: f.auth,
    objects: f.objects,
  });
  await app.ready();
  try {
    const headers: any = {
      origin: "https://staging.example.test",
      "x-ab-request": "1",
    };
    let r = await app.inject({
      method: "POST",
      url: "/api/login",
      payload: { username: f.username, password: f.password },
      headers,
    });
    assert.equal(r.statusCode, 200);
    assert(String(r.headers["set-cookie"]).includes("Secure"));
    assert(String(r.headers["set-cookie"]).includes("SameSite=Strict"));
    headers.cookie = String(r.headers["set-cookie"]).split(";")[0];
    r = await app.inject({ method: "GET", url: "/api/bootstrap", headers });
    const boot = r.json();
    headers["x-csrf-token"] = boot.csrfToken;
    for (const url of [
      "/backend/.env",
      "/.git/HEAD",
      "/supabase/migrations/202611010001_foundation.sql",
      "/node_modules/pg/package.json",
    ])
      assert.equal((await app.inject({ url, headers })).statusCode, 404);
    const data = {
      arabicName: "شركة أمان",
      englishName: "Safety Test",
      tradeLicenseNumber: "SAFE",
      status: "Active",
    };
    const missing = { ...headers };
    delete missing["x-csrf-token"];
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/companies",
          payload: data,
          headers: missing,
        })
      ).statusCode,
      403,
    );
    const key = randomUUID(),
      head = { ...headers, "idempotency-key": key };
    const first = await app.inject({
        method: "POST",
        url: "/api/companies",
        payload: data,
        headers: head,
      }),
      second = await app.inject({
        method: "POST",
        url: "/api/companies",
        payload: data,
        headers: head,
      });
    assert.equal(first.statusCode, 200, first.body);
    assert.equal(second.json().id, first.json().id);
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/companies",
          payload: { ...data, englishName: "different" },
          headers: head,
        })
      ).statusCode,
      409,
    );
    const companyId = first.json().id,
      body = {
        companyId,
        category: "tradeLicense",
        title: "Original title",
        description: "Original description",
        date: "2026-01-01",
        mime: "application/pdf",
        name: "test.pdf",
        base64: Buffer.from("%PDF-1.4 quarantine").toString("base64"),
      };
    let doc = (
      await app.inject({
        method: "POST",
        url: "/api/documents",
        payload: body,
        headers,
      })
    ).json();
    assert.equal(doc.scanStatus, "pending");
    assert.equal(
      (
        await app.inject({
          url: "/api/documents/" + doc.versionId + "/file",
          headers,
        })
      ).statusCode,
      423,
    );
    await assert.rejects(() =>
      transaction(f.runtime, f.org.tenant, f.org.user, (c) =>
        c.query("select ab.record_scan($1,$2)", [doc.versionId, "clean"]),
      ),
    );
    await f.admin.query("SET ROLE ab_scanner");
    await f.admin.query("select ab.record_scan($1,$2)", [
      doc.versionId,
      "clean",
    ]);
    await f.admin.query("RESET ROLE");
    assert.equal(
      (
        await app.inject({
          url: "/api/documents/" + doc.versionId + "/file",
          headers,
        })
      ).statusCode,
      200,
    );
    const next = await app.inject({
      method: "POST",
      url: "/api/documents",
      payload: {
        ...body,
        title: "Version two title",
        description: "Version two description",
        date: "2026-02-02",
        relation: "version",
        parentId: doc.id,
        parentVersionId: doc.versionId,
      },
      headers,
    });
    assert.equal(next.statusCode, 200, next.body);
    const list = (
      await app.inject({
        url: "/api/documents?companyId=" + companyId,
        headers,
      })
    ).json();
    assert.equal(list.length, 2);
    assert.equal(list[0].title, "Original title");
    assert.equal(list[1].title, "Version two title");
    assert.equal(list[1].parentVersionId, doc.versionId);
    await assert.rejects(() =>
      transaction(f.runtime, f.org.tenant, f.org.user, (c) =>
        c.query("update ab.users set status='Disabled' where id=$1", [
          f.org.user,
        ]),
      ),
    );
    await assert.rejects(() =>
      transaction(f.runtime, f.org.tenant, f.org.user, (c) =>
        c.query("update ab.users set manager_id=$1 where id=$1", [f.org.user]),
      ),
    );
    const audit = (await app.inject({ url: "/api/audit", headers })).json();
    assert(audit.some((a: any) => a.action === "scanned"));
  } finally {
    await app.close();
    await f.app.close();
    await f.runtime.end();
    await f.admin.end();
  }
});
