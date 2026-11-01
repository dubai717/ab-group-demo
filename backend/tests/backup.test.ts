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
