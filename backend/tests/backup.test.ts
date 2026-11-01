import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { archive, restoreArchive } from "../src/backup.js";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import { fixture, TestObjects } from "./fixture.js";
import { build } from "../src/app.js";
import { security, transaction } from "../src/core.js";
test("backup/restore: new database, encrypted file objects, IDs, links, policies and fresh sessions", async () => {
  const f = await fixture("ab_backup_" + randomUUID().replaceAll("-", ""));
  let restore: Pool | undefined, restoredApp: any;
  try {
    const request = async (
      app: any,
      method: string,
      url: string,
      body?: any,
      cookie = "",
      csrf = "",
    ) =>
      app.inject({
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
    const login = await request(f.app, "POST", "/api/login", {
      username: f.username,
      password: f.password,
    });
    const cookie = String(login.headers["set-cookie"]).split(";")[0],
      csrf = (
        await request(f.app, "GET", "/api/bootstrap", undefined, cookie)
      ).json().csrfToken;
    const company = (
      await request(
        f.app,
        "POST",
        "/api/companies",
        {
          arabicName: "شركة استعادة",
          englishName: "Restore Test",
          tradeLicenseNumber: "RESTORE-ONLY",
          status: "Active",
        },
        cookie,
        csrf,
      )
    ).json();
    assert(company.id);
    const file = (
      await request(
        f.app,
        "POST",
        "/api/documents",
        {
          companyId: company.id,
          title: "Retained contract",
          description: "",
          category: "tradeLicense",
          date: "2026-01-01",
          name: "restore.pdf",
          mime: "application/pdf",
          base64: Buffer.from("%PDF-1.4 restore proof").toString("base64"),
        },
        cookie,
        csrf,
      )
    ).json();
    assert(file.versionId);
    // Broaden recovery proof to bank fields, users, memberships, grants and version history.
    const banks = [];
    for (const [accountNumber, iban] of [
      ["000123", "AE070331234567890123456"],
      [
        "000124",
        "AE" +
          String(
            98 - Number(BigInt("0331234567890123457" + "101400") % 97n),
          ).padStart(2, "0") +
          "0331234567890123457",
      ],
    ]) {
      const response = await request(
        f.app,
        "POST",
        "/api/bank-accounts",
        {
          companyId: company.id,
          bankId: "demo-bank",
          branch: "Restore branch",
          accountName: "Restore account",
          accountNumber,
          iban,
          openedAt: "2026-01-01",
          closedAt: "",
          status: "Active",
          purposeId: "operations",
          openingBalance: "123456789012345678.125",
          currency: "AED",
          relationshipManagerName: "Synthetic manager",
          relationshipManagerPhone: "+971500000001",
          relationshipManagerEmail: "manager@example.test",
        },
        cookie,
        csrf,
      );
      assert.equal(response.statusCode, 200, response.body);
      banks.push(response.json().id);
    }
    const userResponse = await request(
      f.app,
      "POST",
      "/api/users",
      {
        nameAr: "موظف استعادة",
        nameEn: "Restore employee",
        username: "restore_" + randomUUID().slice(0, 8),
        email: randomUUID() + "@example.test",
        phone: "",
        status: "Active",
        managerId: f.org.user,
        companyIds: [company.id],
        departmentIds: [],
        jobTitle: "",
        hireDate: "",
        emiratesId: "784-2000-1234567-1",
        nationality: "SYNTHETIC",
        password: "Synthetic-Restore@2026",
      },
      cookie,
      csrf,
    );
    assert.equal(userResponse.statusCode, 200, userResponse.body);
    const restoredUser = userResponse.json().id;
    const grantResponse = await request(
      f.app,
      "POST",
      "/api/users/" + restoredUser + "/grants",
      {
        action: "bank_view",
        scope: { type: "company", id: company.id },
        delegable: false,
      },
      cookie,
      csrf,
    );
    assert.equal(grantResponse.statusCode, 200, grantResponse.body);
    const secondFile = await request(
      f.app,
      "POST",
      "/api/documents",
      {
        companyId: company.id,
        parentId: file.id,
        parentVersionId: file.versionId,
        relation: "version",
        title: "Retained second version",
        description: "Version proof",
        category: "tradeLicense",
        date: "2026-02-01",
        name: "restore-v2.pdf",
        mime: "application/pdf",
        base64: Buffer.from("%PDF-1.4 version two proof").toString("base64"),
      },
      cookie,
      csrf,
    );
    assert.equal(secondFile.statusCode, 200, secondFile.body);
    const snapshot = async (pool: Pool) => {
      const tables = (
        await pool.query(
          "select tablename from pg_tables where schemaname='ab' and tablename<>'sessions' order by tablename",
        )
      ).rows;
      const fingerprints: Record<string, string> = {};
      for (const { tablename } of tables) {
        assert(/^[a-z_]+$/.test(tablename));
        fingerprints[tablename] = (
          await pool.query(
            `select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) fingerprint from ab.${tablename} t`,
          )
        ).rows[0].fingerprint;
      }
      return fingerprints;
    };
    const sourceSnapshot = await snapshot(f.admin);
    const objectSnapshot = new Map(
      [...f.objects.rows].map(([k, v]) => [k, Buffer.from(v)]),
    );
    const db = "ab_restore_" + randomUUID().replaceAll("-", ""),
      dump = "/tmp/" + db + ".dump";
    execFileSync(
      "docker",
      [
        "exec",
        "ab-postgres-foundation",
        "pg_dump",
        "-U",
        "postgres",
        "-d",
        f.sourceDatabase,
        "-Fc",
        "--no-owner",
        "-f",
        dump,
      ],
      { stdio: "pipe" },
    );
    const dumpBytes = execFileSync("docker", [
      "exec",
      "ab-postgres-foundation",
      "cat",
      dump,
    ]);
    const backupKey = randomBytes(32).toString("base64"),
      sealed = archive(dumpBytes, objectSnapshot, backupKey);
    assert(!sealed.includes(Buffer.from("PGDMP")));
    assert.throws(() =>
      restoreArchive(sealed, randomBytes(32).toString("base64")),
    );
    const corrupt = Buffer.from(sealed);
    corrupt[corrupt.length - 8] ^= 1;
    assert.throws(() => restoreArchive(corrupt, backupKey));
    const restoredArchive = restoreArchive(sealed, backupKey);
    execFileSync(
      "docker",
      ["exec", "ab-postgres-foundation", "createdb", "-U", "postgres", db],
      { stdio: "pipe" },
    );
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "ab-postgres-foundation",
        "pg_restore",
        "-U",
        "postgres",
        "-d",
        db,
        "--no-owner",
      ],
      { stdio: "pipe", input: restoredArchive.database },
    );
    const restoreAdmin = new Pool({
      connectionString: `postgres://postgres:${f.secret.admin}@127.0.0.1:5441/${db}`,
    });
    assert.deepEqual(
      await snapshot(restoreAdmin),
      sourceSnapshot,
      "All non-session table rows/IDs/metadata exactly match the source before any restored API activity",
    );
    await restoreAdmin.query("update ab.sessions set expires_at=now()");
    await restoreAdmin.end();
    restore = new Pool({
      connectionString: `postgres://ab_runtime:${f.secret.runtime}@127.0.0.1:5441/${db}`,
    });
    const restoredObjects = new TestObjects();
    restoredObjects.rows = restoredArchive.objects;
    restoredApp = await build({
      pool: restore,
      key: f.secret.key,
      origin: "http://127.0.0.1:3100",
      secureCookies: false,
      auth: f.auth,
      objects: restoredObjects,
      serveFrontend: false,
    });
    await restoredApp.ready();
    assert.equal(
      (await request(restoredApp, "GET", "/api/bootstrap", undefined, cookie))
        .statusCode,
      401,
    );
    const fresh = await request(restoredApp, "POST", "/api/login", {
        username: f.username,
        password: f.password,
      }),
      freshCookie = String(fresh.headers["set-cookie"]).split(";")[0];
    const co = await request(
      restoredApp,
      "GET",
      "/api/companies/" + company.id,
      undefined,
      freshCookie,
    );
    assert.equal(co.json().englishName, "Restore Test");
    const retrieved = await request(
      restoredApp,
      "GET",
      "/api/documents/" + file.versionId + "/file",
      undefined,
      freshCookie,
    );
    assert.equal(retrieved.statusCode, 200);
    assert.equal(retrieved.body, "%PDF-1.4 restore proof");
    for (const id of banks) {
      const bank = await request(
        restoredApp,
        "GET",
        "/api/bank-accounts/" + id,
        undefined,
        freshCookie,
      );
      assert.equal(bank.statusCode, 200, bank.body);
      assert.equal(
        bank.json().relationshipManagerEmail,
        "manager@example.test",
      );
      assert.equal(bank.json().openingBalance, "123456789012345678.125");
    }
    const v2 = await request(
      restoredApp,
      "GET",
      "/api/documents/" + secondFile.json().versionId + "/file",
      undefined,
      freshCookie,
    );
    assert.equal(v2.statusCode, 200);
    assert.equal(v2.body, "%PDF-1.4 version two proof");
    const savedObject = restoredObjects.rows.get(
      [...restoredObjects.rows.keys()][0],
    )!;
    restoredObjects.rows.set(
      [...restoredObjects.rows.keys()][0],
      Buffer.from("tampered object"),
    );
    const tampered = await request(
      restoredApp,
      "GET",
      "/api/documents/" + file.versionId + "/file",
      undefined,
      freshCookie,
    );
    assert.notEqual(tampered.statusCode, 200);
    restoredObjects.rows.set([...restoredObjects.rows.keys()][0], savedObject);
    const denied = await restore.query("select * from ab.companies");
    assert.equal(denied.rows.length, 0);
    await assert.rejects(() =>
      transaction(restore!, f.org.tenant, f.org.user, (c) =>
        c.query("delete from ab.documents"),
      ),
    );
    const cipher = security(f.secret.key),
      encrypted = [...objectSnapshot.values()][0].toString();
    assert(cipher.open(encrypted));
    assert.throws(() =>
      security(Buffer.alloc(32, 1).toString("base64")).open(encrypted),
    );
    console.log(
      "Restored into " +
        db +
        " without modifying the source database; encrypted object copy restored separately.",
    );
  } finally {
    if (restoredApp) await restoredApp.close();
    if (restore) await restore.end();
    await f.app.close();
    await f.runtime.end();
    await f.admin.end();
  }
});
