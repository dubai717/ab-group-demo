import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";
import { setupDatabase } from "./setup.js";
import { migrate } from "../src/migrate.js";
import { sha } from "../src/core.js";

test("migration 008: preserves valid v7 data and atomically refuses inconsistent legacy data", async () => {
  const root = await setupDatabase();
  let admin: Pool | undefined;
  try {
    const name = "ab_backup_" + randomUUID().replaceAll("-", "");
    await root.admin.query("CREATE DATABASE " + name);
    const url = new URL(root.adminUrl);
    url.pathname = "/" + name;
    admin = new Pool({ connectionString: url.toString() });
    const dir = new URL("../../supabase/migrations/", import.meta.url);
    const files = (await readdir(dir)).filter((x) => x.endsWith(".sql")).sort();
    assert.equal(files.length, 8);
    await admin.query(
      "CREATE TABLE public.ab_schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of files.slice(0, 7)) {
      const sql = await readFile(new URL(name, dir), "utf8");
      await admin.query(sql);
      await admin.query(
        "insert into public.ab_schema_migrations(name,sha256)values($1,$2)",
        [name, sha(sql)],
      );
    }
    const tenant = randomUUID(),
      owner = randomUUID(),
      company = randomUUID();
    await admin.query(
      "insert into ab.organizations(id,name)values($1,'Synthetic migration test')",
      [tenant],
    );
    await admin.query(
      "insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status)values($1,$2,$3,'migration@example.test',$4,'owner','Active')",
      [owner, tenant, randomUUID(), "migration_" + owner],
    );
    await admin.query("insert into ab.emirates values('test-dubai','{}')");
    await admin.query(
      "insert into ab.areas(tenant_id,id,emirate_id,data)values($1,'test-area','test-dubai','{}')",
      [tenant],
    );
    // This invalid row is created solely here to rehearse safe refusal of an old DB.
    await admin.query(
      "insert into ab.companies(id,tenant_id,data,area_id,created_by)values($1,$2,'{\"notes\":\"retain exactly\"}','test-area',$3)",
      [company, tenant, owner],
    );
    const before = (
      await admin.query("select * from ab.companies where id=$1", [company])
    ).rows;
    await assert.rejects(
      () => migrate(admin!),
      (e: any) => e.code === "23514",
    );
    assert.deepEqual(
      (await admin.query("select * from ab.companies where id=$1", [company]))
        .rows,
      before,
    );
    assert.equal(
      (
        await admin.query(
          "select count(*)::int n from public.ab_schema_migrations",
        )
      ).rows[0].n,
      7,
    );
    assert.equal(
      (
        await admin.query(
          "select count(*)::int n from pg_constraint where conname='company_area_requires_emirate'",
        )
      ).rows[0].n,
      0,
    );
    // Explicit correction of our newly-created synthetic test fixture, never source data.
    await admin.query(
      "update ab.companies set emirate_id='test-dubai' where id=$1",
      [company],
    );
    const valid = (
      await admin.query("select * from ab.companies where id=$1", [company])
    ).rows;
    await migrate(admin);
    assert.deepEqual(
      (await admin.query("select * from ab.companies where id=$1", [company]))
        .rows,
      valid,
    );
    assert.equal(
      (
        await admin.query(
          "select count(*)::int n from public.ab_schema_migrations",
        )
      ).rows[0].n,
      8,
    );
    await migrate(admin);
    assert.deepEqual(
      (await admin.query("select * from ab.companies where id=$1", [company]))
        .rows,
      valid,
    );
  } finally {
    if (admin) await admin.end();
    await root.admin.end();
    await root.runtime.end();
  }
});
