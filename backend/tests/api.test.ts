import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./fixture.js";
import { initializeOrganization } from "../src/bootstrap.js";
import { transaction } from "../src/core.js";
import { migrate } from "../src/migrate.js";
test("PostgreSQL + API: authenticated CRUD, exact fields, scope, concurrency, files, encryption and audit", async () => {
  const f = await fixture();
  let cookie = "",
    csrf = "";
  const request = async (
    method: any,
    url: string,
    payload?: any,
    expect = 200,
  ) => {
    const r = await f.app.inject({
      method,
      url,
      payload,
      headers: {
        origin: "http://127.0.0.1:3100",
        "x-ab-request": "1",
        "x-csrf-token": csrf,
        cookie,
      },
    });
    assert.equal(r.statusCode, expect, `${method} ${url}: ${r.body}`);
    return r;
  };
  try {
    await request("GET", "/api/bootstrap", undefined, 401);
    await request(
      "POST",
      "/api/login",
      { username: f.username, password: "incorrect" },
      401,
    );
    let r = await request("POST", "/api/login", {
      username: f.username,
      password: f.password,
    });
    cookie = String(r.headers["set-cookie"]).split(";")[0];
    assert(String(r.headers["set-cookie"]).includes("HttpOnly"));
    let boot = (await request("GET", "/api/bootstrap")).json();
    csrf = boot.csrfToken;
    assert.equal(boot.actor.roleId, "owner");
    assert.equal(boot.areas.length, 367);
    assert(!JSON.stringify(boot).includes(f.password));
    const forbidden = await f.app.inject({
      method: "POST",
      url: "/api/companies",
      payload: {},
      headers: { cookie, origin: "http://evil.test", "x-ab-request": "1" },
    });
    assert.equal(forbidden.statusCode, 403);
    const company = {
      companyCode: "SYNTH",
      arabicName: "شركة اختبار",
      englishName: "Synthetic Company",
      tradeLicenseNumber: "SYN-123",
      status: "Active",
      emirate: "Dubai",
      areaId: "",
      trafficCode: "000123",
      salikAccountNumber: "000456",
      expiryDate: "2027-01-01",
      establishmentCardExpiryDate: "2027-02-01",
      labourCardExpiryDate: "",
      phone: "+971500000000",
      notes: "preserve",
    };
    const companyId = (await request("POST", "/api/companies", company)).json()
      .id;
    const co = (await request("GET", "/api/companies/" + companyId)).json();
    assert.equal(co.salikAccountNumber, "000456");
    assert.equal(co.expiryDate, "2027-01-01");
    await request("PATCH", "/api/companies/" + companyId, {
      revision: co.revision,
      notes: "changed",
    });
    await request(
      "PATCH",
      "/api/companies/" + companyId,
      { revision: co.revision, notes: "stale" },
      409,
    );
    const bank = {
      companyId,
      licenseId: co.licenseId,
      bankId: "demo-bank",
      branch: "Main",
      accountName: "Synthetic account",
      accountNumber: "000123",
      iban: "AE070331234567890123456",
      swift: "BOMLAEAD",
      openedAt: "2026-01-01",
      closedAt: "",
      status: "Active",
      purposeId: "operations",
      openingBalance: "123456789012345678.125",
      currency: "AED",
      notes: "Bank note",
      relationshipManagerName: "Manager",
      relationshipManagerPhone: "+971500000001",
      relationshipManagerEmail: "manager@example.test",
    };
    const bankId = (await request("POST", "/api/bank-accounts", bank)).json()
      .id;
    const bank2 = (
      await request("POST", "/api/bank-accounts", {
        ...bank,
        accountNumber: "000456",
        iban: "GB82WEST12345698765432",
      })
    ).json().id;
    assert.notEqual(bankId, bank2);
    await request("POST", "/api/bank-accounts", bank, 409);
    let saved = (await request("GET", "/api/bank-accounts/" + bankId)).json();
    assert.equal(saved.openingBalance, bank.openingBalance);
    assert.equal(saved.relationshipManagerEmail, bank.relationshipManagerEmail);
    await request("PATCH", "/api/bank-accounts/" + bankId, {
      revision: saved.revision,
      relationshipManagerName: "New manager",
    });
    saved = (await request("GET", "/api/bank-accounts/" + bankId)).json();
    assert.equal(saved.accountNumber, "000123");
    assert.equal(saved.licenseId, co.licenseId);
    assert.equal(saved.relationshipManagerName, "New manager");
    const baseDoc = {
      bankAccountId: bankId,
      category: "original",
      title: "Original",
      description: "Test PDF",
      date: "2026-01-01",
      mime: "application/pdf",
      name: "test.pdf",
      base64: Buffer.from("%PDF-1.4\nSynthetic file").toString("base64"),
    };
    const original = (await request("POST", "/api/documents", baseDoc)).json();
    await request("POST", "/api/documents", {
      ...baseDoc,
      title: "Annex",
      category: "annex",
      parentId: original.id,
    });
    const version = (
      await request("POST", "/api/documents", {
        ...baseDoc,
        parentId: original.id,
        relation: "version",
      })
    ).json();
    assert.equal(version.version, 2);
    let docs = (
      await request("GET", "/api/documents?bankAccountId=" + bankId)
    ).json();
    assert.equal(docs.length, 3);
    const bytes = await request(
      "GET",
      "/api/documents/" + original.versionId + "/file",
    );
    assert.equal(bytes.body, "%PDF-1.4\nSynthetic file");
    await request(
      "POST",
      "/api/documents",
      { ...baseDoc, bankAccountId: bank2, parentId: original.id },
      422,
    );
    assert.equal(f.objects.rows.size, 3);
    assert(
      ![...f.objects.rows.values()].some((v) => v.toString().includes("%PDF")),
    );
    await request("PATCH", "/api/bank-accounts/" + bankId, {
      revision: saved.revision,
      status: "Closed",
      closedAt: "2026-10-01",
    });
    docs = (
      await request("GET", "/api/documents?bankAccountId=" + bankId)
    ).json();
    assert.equal(docs.length, 3);
    const privateBank = await transaction(
      f.runtime,
      f.org.tenant,
      f.org.user,
      async (c) =>
        (
          await c.query(
            "select payload_cipher from ab.bank_accounts where id=$1",
            [bankId],
          )
        ).rows[0],
    );
    assert(!privateBank.payload_cipher.includes(bank.iban));
    const userForm = {
      nameAr: "موظف اختبار",
      nameEn: "Synthetic Employee",
      username: "staff_" + randomUUID().slice(0, 8),
      email: "staff-" + randomUUID() + "@example.test",
      phone: "+971500000009",
      status: "Active",
      jobTitle: "Analyst",
      hireDate: "2026-01-01",
      emiratesId: "784-2000-1234567-1",
      nationality: "PRIVATE",
      managerId: f.org.user,
      companyIds: [companyId],
      departmentIds: [],
      password: "Synthetic-Staff@2026",
    };
    const userId = (await request("POST", "/api/users", userForm)).json().id;
    for (const action of ["bank_view", "bank_edit", "bank_view_documents"])
      await request("POST", "/api/users/" + userId + "/grants", {
        action,
        scope: { type: "company", id: companyId },
        delegable: false,
      });
    const otherAuthId = await f.auth.create(
      "other-" + randomUUID() + "@example.test",
      "Synthetic-Other@2026",
    );
    const other = await initializeOrganization(f.admin, {
      authId: otherAuthId,
      email: "other@test.test",
      username: "other_" + randomUUID().slice(0, 8),
      name: "Other Tenant",
    });
    const outside = await transaction(
      f.runtime,
      other.tenant,
      other.user,
      async (c) =>
        (await c.query("select * from ab.companies where id=$1", [companyId]))
          .rows,
    );
    assert.equal(outside.length, 0);
    await assert.rejects(() =>
      transaction(f.runtime, other.tenant, other.user, async (c) =>
        c.query("insert into ab.user_companies values($1,$2,$3,true)", [
          other.tenant,
          other.user,
          companyId,
        ]),
      ),
    );
    const audits = (await request("GET", "/api/audit")).json();
    assert(audits.some((a: any) => a.action === "uploaded"));
    assert(!JSON.stringify(audits).includes(userForm.password));
    assert(!JSON.stringify(audits).includes("784-2000"));
    await request("POST", "/api/logout", {});
    await request("GET", "/api/bootstrap", undefined, 401);
    r = await request("POST", "/api/login", {
      username: userForm.username,
      password: userForm.password,
    });
    cookie = String(r.headers["set-cookie"]).split(";")[0];
    boot = (await request("GET", "/api/bootstrap")).json();
    csrf = boot.csrfToken;
    assert.equal(boot.actor.roleId, "employee");
    assert.equal(boot.users.length, 1);
    await request("POST", "/api/companies", company, 403);
    await request(
      "POST",
      "/api/users/" + f.org.user + "/grants",
      { action: "edit", scope: { type: "group", id: "" } },
      403,
    );
    await request("GET", "/api/documents/" + original.versionId + "/file");
    saved = (await request("GET", "/api/bank-accounts/" + bank2)).json();
    await request("PATCH", "/api/bank-accounts/" + bank2, {
      revision: saved.revision,
      notes: "scoped edit",
    });
    await request(
      "PATCH",
      "/api/bank-accounts/" + bank2,
      {
        revision: saved.revision + 1,
        status: "Closed",
        closedAt: "2026-10-01",
      },
      403,
    );
    await assert.rejects(() =>
      transaction(f.runtime, f.org.tenant, userId, async (c) =>
        c.query("delete from ab.audit_events"),
      ),
    );
    const before = (await f.admin.query("select count(*) n from ab.users"))
      .rows[0].n;
    await migrate(f.admin);
    assert.equal(
      (await f.admin.query("select count(*) n from ab.users")).rows[0].n,
      before,
    );
    console.log(
      "Provider in this test is an explicit contract double; PostgreSQL, transactions, RLS and API are real local implementations.",
    );
  } finally {
    await f.app.close();
    await f.runtime.end();
    await f.admin.end();
  }
});
