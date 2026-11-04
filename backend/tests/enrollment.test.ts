import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./fixture.js";
test("a create+attachments delegate can upload initial user files without receiving edit power", async () => {
  const f = await fixture();
  let cookie = "",
    csrf = "";
  const req = async (method: any, url: string, body?: any) =>
    f.app.inject({
      method,
      url,
      payload: body,
      headers: {
        origin: "http://127.0.0.1:3100",
        "x-ab-request": "1",
        "x-csrf-token": csrf,
        cookie,
      },
    });
  const login = async (username: string, password: string) => {
    const r = await req("POST", "/api/login", { username, password });
    assert.equal(r.statusCode, 200, r.body);
    cookie = String(r.headers["set-cookie"]).split(";")[0];
    csrf = (await req("GET", "/api/bootstrap")).json().csrfToken;
  };
  const user = () => ({
    nameAr: "مستخدم اختبار",
    nameEn: "Synthetic Delegate",
    username: "u_" + randomUUID().slice(0, 8),
    email: randomUUID() + "@example.test",
    phone: "",
    status: "Pending",
    managerId: "",
    companyIds: [],
    departmentIds: [],
    jobTitle: "",
    hireDate: "",
    password: "Synthetic-Delegate@2026",
  });
  try {
    await login(f.username, f.password);
    const creator = user(),
      a = await req("POST", "/api/users", { ...creator, status: "Active" });
    assert.equal(a.statusCode, 200, a.body);
    const creatorId = a.json().id;
    for (const action of ["create", "attachments"]) {
      const r = await req("POST", "/api/users/" + creatorId + "/grants", {
        action,
        scope: { type: "group", id: "" },
        delegable: false,
      });
      assert.equal(r.statusCode, 200, r.body);
    }
    await req("POST", "/api/logout", {});
    await login(creator.username, creator.password);
    const child = await req("POST", "/api/users", user());
    assert.equal(child.statusCode, 200, child.body);
    const { id, enrollmentUploadToken } = child.json();
    assert(enrollmentUploadToken);
    const file = {
      userId: id,
      category: "passport",
      title: "Passport test",
      description: "",
      date: "2026-01-01",
      name: "dummy.pdf",
      mime: "application/pdf",
      base64: Buffer.from("%PDF-1.4 fictional").toString("base64"),
    };
    assert.equal((await req("POST", "/api/documents", file)).statusCode, 403);
    const added = await req("POST", "/api/documents", {
      ...file,
      enrollmentToken: enrollmentUploadToken,
    });
    assert.equal(added.statusCode, 200, added.body);
    assert.equal(
      (
        await req("POST", "/api/documents", {
          ...file,
          enrollmentToken: enrollmentUploadToken,
        })
      ).statusCode,
      403,
    );
    const boot = (await req("GET", "/api/bootstrap")).json(),
      row = boot.users.find((u: any) => u.id === id);
    assert.equal(
      (
        await req("PATCH", "/api/users/" + id, {
          revision: row.revision,
          phone: "denied",
        })
      ).statusCode,
      403,
    );
  } finally {
    await f.app.close();
    await f.runtime.end();
    await f.admin.end();
  }
});
