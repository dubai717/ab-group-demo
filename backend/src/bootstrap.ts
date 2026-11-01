import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { transaction } from "./core.js";
const require = createRequire(import.meta.url),
  seed = require("../../data/uae-areas.js"),
  area = require("../../area-reference.js");
// Admin-only provisioning for a NEW synthetic organization, never a browser import.
export async function initializeOrganization(
  pool: Pool,
  owner: {
    authId: string;
    email: string;
    username: string;
    name: string;
    tenantId?: string;
    userId?: string;
  },
) {
  const tenant = owner.tenantId || randomUUID(),
    user = owner.userId || randomUUID();
  await transaction(pool, tenant, user, async (c) => {
    await c.query("insert into ab.organizations(id,name)values($1,$2)", [
      tenant,
      "AB Group — synthetic test environment",
    ]);
    await c.query(
      "insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status,data)values($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        user,
        tenant,
        owner.authId,
        owner.email,
        owner.username,
        "owner",
        "Active",
        {
          fullName: owner.name,
          nameEn: owner.name,
          nameAr: "مالك الاختبار",
          email: owner.email,
          phone: "",
          jobTitle: "",
          hireDate: "",
        },
      ],
    );
    for (const e of seed.emirates)
      await c.query(
        "insert into ab.emirates values($1,$2) on conflict do nothing",
        [e.id, e],
      );
    for (const a of seed.areas) {
      await c.query(
        "insert into ab.areas(tenant_id,id,emirate_id,data)values($1,$2,$3,$4)",
        [tenant, a.id, a.emirateId, a],
      );
      for (const key of new Set(
        [a.ar, a.en, ...(a.aliases || [])].map(area.normalize).filter(Boolean),
      )) {
        await c.query(
          "insert into ab.area_aliases values($1,$2,$3,$4) on conflict do nothing",
          [tenant, a.emirateId, key, a.id],
        );
      }
    }
    const references = [
      [
        "bank",
        "demo-bank",
        {
          ar: "بنك تجريبي — بيانات اختبار فقط",
          en: "Demo bank — test data only",
        },
      ],
      ...["operations", "payroll", "savings", "investment", "other"].map(
        (id) => [
          "purpose",
          id,
          {
            ar: {
              operations: "تشغيلي",
              payroll: "رواتب",
              savings: "ادخار",
              investment: "استثمار",
              other: "أخرى",
            }[id as "operations"],
            en: id,
          },
        ],
      ),
    ];
    for (const [kind, id, data] of references)
      await c.query("insert into ab.bank_references values($1,$2,$3,$4)", [
        tenant,
        id,
        kind,
        data,
      ]);
  });
  return { tenant, user };
}
