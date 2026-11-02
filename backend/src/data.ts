import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ApiError, requireOk, security } from "./core.js";
const require = createRequire(import.meta.url);
export const UserPolicy = require("../../user-management.js");
export const BankPolicy = require("../../bank-accounts.js");
export const CompanyPolicy = require("../../company-documents.js");
export const Areas = require("../../area-reference.js");
export const AreaSeed = require("../../data/uae-areas.js");
export type Cipher = ReturnType<typeof security>;
export async function audit(
  c: PoolClient,
  tenant: string,
  actor: string,
  action: string,
  kind: string,
  id: string | null,
  fields: string[] = [],
) {
  await c.query(
    "INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
    [randomUUID(), tenant, actor, action, kind, id, fields, randomUUID()],
  );
}
export async function model(c: PoolClient, actorId: string, cipher: Cipher) {
  const roles = (await c.query("select data from ab.roles")).rows.map(
    (r) => r.data,
  );
  const companies = (
    await c.query(
      `select c.*,l.id license_id,l.number,l.authority,l.issued_on::text,l.expires_on::text from ab.companies c left join ab.company_licenses l on l.company_id=c.id and l.is_primary`,
    )
  ).rows.map((r) => ({
    ...r.data,
    id: r.id,
    licenseId: r.license_id,
    tradeLicenseNumber: r.number || "",
    issuingAuthority: r.authority || "",
    issueDate: r.issued_on || "",
    expiryDate: r.expires_on || "",
    revision: r.revision,
    createdAt: r.created_at.toISOString(),
  }));
  const users = (
    await c.query(
      `select u.*,coalesce((select jsonb_agg(company_id) from ab.user_companies m where m.user_id=u.id and m.active),'[]') company_ids,coalesce((select jsonb_agg(department_id) from ab.user_departments m where m.user_id=u.id and m.active),'[]') department_ids from ab.users u`,
    )
  ).rows.map((r) => ({
    ...r.data,
    ...(r.private_cipher ? cipher.open(r.private_cipher) : {}),
    id: r.id,
    username: r.username,
    roleId: r.role_id,
    status: r.status,
    managerId: r.manager_id || "",
    companyIds: r.company_ids,
    departmentIds: r.department_ids,
    companyId: r.company_ids[0] || "",
    departmentId: r.department_ids[0] || "",
    revision: r.revision,
  }));
  const departments = (await c.query("select * from ab.departments")).rows.map(
    (r) => ({
      id: r.id,
      name: r.name,
      companyId: r.company_id,
      managerId: r.manager_id,
    }),
  );
  const grants = (
    await c.query("select * from ab.permission_grants where revoked_at is null")
  ).rows;
  let nextGrants: any[] | undefined;
  const initialGrants = grants.map((r) => ({
    userId: r.user_id,
    entry: {
      id: r.id,
      action: r.permission_id,
      scope: {
        type: r.scope_type,
        id: r.company_id || r.department_id || r.manager_id || "",
      },
      delegable: r.delegable,
      issuer: r.issuer_id,
    },
  }));
  const state: any = {
    users,
    roles,
    companies,
    departments,
    bankAccounts: [],
    bankReference: [],
    bankAccountPurposes: [],
  };
  const policy = UserPolicy.createService(state, undefined, {
    initialGrants,
    grantsChanged: (rows: any[]) => {
      nextGrants = rows;
    },
  });
  const user = policy.actor(actorId);
  requireOk(user?.status === "Active", 401, "loginRequired");
  const actor = {
    ...user,
    permissions:
      roles.find((r: any) => r.id === user.roleId)?.permissions || [],
    companyBankPermissions: companies.map((co: any) => ({
      companyId: co.id,
      permissions: policy.bankPermissions(user.id, co.id),
    })),
  };
  const references = (await c.query("select * from ab.bank_references")).rows;
  state.bankReference = references
    .filter((r) => r.kind === "bank")
    .map((r) => ({ ...r.data, id: r.id }));
  state.bankAccountPurposes = references
    .filter((r) => r.kind === "purpose")
    .map((r) => ({ ...r.data, id: r.id }));
  state.bankAccounts = (
    await c.query("select * from ab.bank_accounts")
  ).rows.map((r) => ({
    ...cipher.open(r.payload_cipher),
    id: r.id,
    companyId: r.company_id,
    revision: r.revision,
    licenseId: r.license_id,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  }));
  const bank = BankPolicy.createService({
    state: () => state,
    actor: () => actor,
    persist: () => true,
    id: () => randomUUID(),
  });
  const company = CompanyPolicy.createService({
    state: () => state,
    actor: () => actor,
    persist: () => true,
    validateLocation: (data: any) => location(state, data),
  });
  return {
    state,
    actor,
    policy,
    bank,
    company,
    grants,
    initialGrants,
    getNextGrants: () => nextGrants,
  };
}
export function has(actor: any, right: string) {
  return (
    actor?.status === "Active" &&
    (actor.roleId === "owner" || actor.permissions.includes(right))
  );
}
export function location(state: any, data: any) {
  if (!data.emirate && !data.emirateId && !data.areaId) return {};
  const e = AreaSeed.emirates.find(
    (e: any) => e.legacy === data.emirate || e.id === data.emirateId,
  );
  requireOk(e, 422, "invalidEmirate");
  const a = state.areas?.find((a: any) => a.id === data.areaId);
  if (data.areaId)
    requireOk(a && a.emirateId === e.id, 422, "invalidSelection");
  return {
    emirate: e.legacy,
    emirateId: e.id,
    areaId: a?.id || null,
    region: a?.en || a?.ar || "",
  };
}
export async function loadAreas(c: PoolClient) {
  return (
    await c.query(
      "select id,emirate_id,data,created_by,created_at from ab.areas",
    )
  ).rows.map((r) => ({
    ...r.data,
    id: r.id,
    emirateId: r.emirate_id,
    createdBy: r.created_by,
    createdAt: r.created_at.toISOString(),
  }));
}
export function assertRevision(actual: any, expected: any) {
  requireOk(
    Number.isInteger(expected) && expected === actual,
    409,
    "revisionConflict",
  );
}
export function bounded(data: unknown, max = 64000) {
  requireOk(
    data && typeof data === "object" && !Array.isArray(data),
    422,
    "invalid",
  );
  requireOk(Buffer.byteLength(JSON.stringify(data)) <= max, 422, "tooLarge");
  return data as any;
}
export async function persistCompany(
  c: PoolClient,
  m: any,
  tenant: string,
  input: any,
  id?: string,
) {
  const data = bounded(input, 1024 * 1024);
  const isNew = !id;
  const prior = id
    ? structuredClone(m.state.companies.find((co: any) => co.id === id))
    : null;
  if (id) {
    const old = m.state.companies.find((co: any) => co.id === id);
    requireOk(old, 404, "notFound");
    assertRevision(old.revision, data.revision);
    m.state.areas = await loadAreas(c);
    m.company.update(id, data);
  } else {
    requireOk(m.company.canCreate());
    requireOk(
      data.arabicName?.trim() &&
        data.englishName?.trim() &&
        data.tradeLicenseNumber?.trim(),
      422,
      "required",
    );
    m.company.prepare(data, []);
    const temporary = { id: randomUUID(), status: "Active", documents: [] };
    m.state.companies.push(temporary);
    id = temporary.id;
    m.state.areas = await loadAreas(c);
    CompanyPolicy.createService({
      state: () => m.state,
      actor: () => ({ ...m.actor, permissions: ["edit_company"] }),
      persist: () => true,
      validateLocation: (d: any) => location(m.state, d),
    }).update(id, data);
  }
  const row = m.state.companies.find((co: any) => co.id === id);
  const {
    id: ignored,
    revision,
    licenseId,
    tradeLicenseNumber,
    issuingAuthority,
    issueDate,
    expiryDate,
    createdAt,
    ...payload
  } = row;
  if (isNew)
    await c.query(
      "insert into ab.companies(id,tenant_id,data,created_by,emirate_id,area_id)values($1,$2,$3,$4,$5,$6)",
      [
        id,
        tenant,
        payload,
        m.actor.id,
        row.emirateId || null,
        row.areaId || null,
      ],
    );
  else
    await c.query(
      "update ab.companies set data=$2,emirate_id=$3,area_id=$4,revision=revision+1,updated_at=now() where id=$1",
      [id, payload, row.emirateId || null, row.areaId || null],
    );
  await c.query(
    `insert into ab.company_licenses(id,tenant_id,company_id,number,authority,issued_on,expires_on,is_primary)values($1,$2,$3,$4,$5,$6,$7,true) on conflict(company_id) where is_primary do update set number=excluded.number,authority=excluded.authority,issued_on=excluded.issued_on,expires_on=excluded.expires_on`,
    [
      licenseId || randomUUID(),
      tenant,
      id,
      tradeLicenseNumber,
      issuingAuthority || "",
      issueDate || null,
      expiryDate || null,
    ],
  );
  await audit(
    c,
    tenant,
    m.actor.id,
    isNew ? "created" : "updated",
    "company",
    id!,
    Object.keys(row).filter(
      (k) =>
        !["id", "revision", "createdAt", "licenseId"].includes(k) &&
        JSON.stringify(row[k]) !== JSON.stringify(prior?.[k]),
    ),
  );
  return id!;
}
export async function persistBank(
  c: PoolClient,
  m: any,
  cipher: Cipher,
  tenant: string,
  input: any,
  id?: string,
) {
  const data = bounded(input);
  const prior = id
    ? structuredClone(m.state.bankAccounts.find((r: any) => r.id === id))
    : null;
  if (id) {
    const old = m.state.bankAccounts.find((r: any) => r.id === id);
    requireOk(old, 404, "notFound");
    assertRevision(old.revision, data.revision);
  }
  const row = m.bank.save(id || null, data);
  const license = Object.hasOwn(data, "licenseId")
    ? data.licenseId || null
    : prior?.licenseId || null;
  if (id && license !== (prior?.licenseId || null))
    requireOk(m.bank.can("edit", prior.companyId));
  if (license) {
    const valid = await c.query(
      "select id from ab.company_licenses where id=$1 and company_id=$2",
      [license, row.companyId],
    );
    requireOk(valid.rowCount, 422, "invalidReference");
  }
  row.licenseId = license;
  const changed = Object.keys(row).filter(
    (k) =>
      ![
        "id",
        "revision",
        "createdAt",
        "createdBy",
        "updatedAt",
        "updatedBy",
      ].includes(k) && JSON.stringify(row[k]) !== JSON.stringify(prior?.[k]),
  );
  if (id && !changed.length) return id;
  const values = [
    row.id,
    tenant,
    row.companyId,
    license,
    row.bankId,
    row.purposeId,
    row.status,
    row.openedAt,
    row.closedAt || null,
    row.openingBalance,
    row.currency,
    cipher.digest(BankPolicy.normalize(row.iban)),
    cipher.digest(BankPolicy.normalize(row.accountNumber)),
    cipher.seal(row),
    m.actor.id,
  ];
  if (!id)
    await c.query(
      `insert into ab.bank_accounts(id,tenant_id,company_id,license_id,bank_id,purpose_id,status,opened_on,closed_on,opening_balance,currency,iban_digest,account_digest,payload_cipher,created_by)values(${values.map((_, i) => "$" + (i + 1)).join(",")})`,
      values,
    );
  else
    await c.query(
      "update ab.bank_accounts set company_id=$3,license_id=$4,bank_id=$5,purpose_id=$6,status=$7,opened_on=$8,closed_on=$9,opening_balance=$10,currency=$11,iban_digest=$12,account_digest=$13,payload_cipher=$14,revision=revision+1,updated_at=now() where id=$1 and tenant_id=$2",
      values.slice(0, 14),
    );
  await audit(
    c,
    tenant,
    m.actor.id,
    !id ? "created" : row.status === "Closed" ? "closed" : "updated",
    "bank",
    row.id,
    changed,
  );
  return row.id;
}
