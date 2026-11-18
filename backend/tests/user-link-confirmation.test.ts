import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { businessCentersFixture } from './business-centers-fixture.js';
import { ApiError } from '../src/core.js';

async function employee(f: any, email = randomUUID() + '@example.test') {
  return f.req('POST', '/api/personnel/employees', { companyId: f.co1, workCompanyIds: [f.co1, f.co2], nameAr: 'موظف اختبار ربط', nameEn: 'Synthetic linking employee', jobTitle: 'Test', hiredOn: '2026-01-01', email });
}
const input = (f: any, e: any, email: string) => ({ sourceEmployeeId: e.id, confirmEmployeeLink: true, nameAr: 'موظف اختبار ربط', nameEn: 'Synthetic linking employee', username: 'link_' + randomUUID().slice(0, 8), email, companyIds: [f.co1], departmentIds: [], managerId: f.org.user, status: 'Active', password: 'Synthetic-Link@2026', baseRole: 'employee' });

test('req-8p regression: an unconfirmed employee link fails before Auth, durable reservation or identity changes', async () => {
  const f = await businessCentersFixture();
  try {
    const email = randomUUID() + '@example.test', e = await employee(f, email), data = input(f, e, email), before = f.auth.accounts.size;
    for (const confirmation of [undefined, false, 'true', 'on']) {
      const rejected = await f.req('POST', '/api/users', { ...data, confirmEmployeeLink: confirmation }, 422);
      assert.equal(rejected.error, 'employeeLinkConfirmationRequired');
      assert.equal(rejected.fieldErrors.confirmEmployeeLink, 'employeeLinkConfirmationRequired');
      assert(rejected.reference);
      assert.equal(f.auth.accounts.size, before);
      assert.equal((await f.admin.query("select count(*)::int n from ab.settings where key like 'user-enrollment-v1:%'")).rows[0].n, 0);
      assert.equal((await f.req('GET', '/api/personnel/employees/' + e.id)).userId, null);
    }
    const created = await f.req('POST', '/api/users', data);
    assert.equal((await f.req('GET', '/api/personnel/employees/' + e.id)).userId, created.id);
    const memberships = (await f.admin.query('select company_id from ab.user_companies where user_id=$1', [created.id])).rows;
    assert.deepEqual(memberships.map((r: any) => r.company_id), [f.co1], 'descriptive work companies never automatically expand login access');
  } finally { await f.close(); }
});

test('employee linking, company membership and role persistence failures recover the same Auth identity without changing existing grants', async () => {
  const f = await businessCentersFixture(), originalLog = console.error, logs: string[] = [];
  try {
    const grants = (await f.admin.query('select * from ab.permission_grants order by id')).rows;
    const roles = (await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
    for (const [phase, table, operation] of [['role', 'users', 'insert'], ['company', 'user_companies', 'insert'], ['link', 'hr_employees', 'update of user_id']]) {
      const email = randomUUID() + '@example.test', e = await employee(f, email), data = input(f, e, email), before = f.auth.accounts.size, key = randomUUID();
      await f.admin.query("insert into ab.settings values($1,'synthetic-link-fault', 'true') on conflict(tenant_id,key)do update set value=excluded.value", [f.org.tenant]);
      await f.admin.query("create or replace function ab.synthetic_link_fault() returns trigger language plpgsql as $$begin if exists(select 1 from ab.settings where key='synthetic-link-fault' and value='true'::jsonb)then raise exception 'Synthetic fixture only' using errcode='23514';end if;return new;end$$");
      await f.admin.query('create trigger synthetic_link_fault before ' + operation + ' on ab.' + table + ' for each row execute function ab.synthetic_link_fault()');
      console.error = (line: any) => logs.push(String(line));
      const failed = await f.req('POST', '/api/users', data, 503, key);
      console.error = originalLog;
      assert.equal(failed.error, 'enrollmentIncomplete', phase);
      assert(failed.reference);
      assert.equal(f.auth.accounts.size, before + 1);
      const authId = f.auth.accounts.get(email)?.id;
      assert(authId);
      assert.equal((await f.admin.query('select count(*)::int n from ab.users where auth_id=$1', [authId])).rows[0].n, 0);
      assert.equal((await f.req('GET', '/api/personnel/employees/' + e.id)).userId, null);
      await f.admin.query("update ab.settings set value='false' where key='synthetic-link-fault'");
      const created = await f.req('POST', '/api/users', data, 200, key);
      assert.equal(f.auth.accounts.size, before + 1);
      assert.equal((await f.admin.query('select auth_id from ab.users where id=$1', [created.id])).rows[0].auth_id, authId);
      assert.equal((await f.req('GET', '/api/personnel/employees/' + e.id)).userId, created.id);
      assert.equal((await f.req('POST', '/api/users', data, 200, key)).id, created.id);
      await f.req('POST', '/api/users', data, 409);
      assert(!logs.join('').includes(data.password));
      assert(!logs.join('').includes(email));
      await f.admin.query('drop trigger synthetic_link_fault on ab.' + table);
    }
    assert(logs.some(l => l.includes('employee-link')));
    assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows, grants);
    assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows, roles);
  } finally { console.error = originalLog; await f.close(); }
});

test('linked employee Auth failure and a previously used email do not create duplicate or silently adopt existing identities', async () => {
  const f = await businessCentersFixture();
  try {
    const email = randomUUID() + '@example.test', e = await employee(f, email), data = input(f, e, email), before = f.auth.accounts.size, original = f.auth.create.bind(f.auth);
    let fail = true;
    f.auth.create = async (...args: any[]) => { if (fail) { fail = false; throw new ApiError(503, 'providerUnavailable'); } return (original as any)(...args); };
    const key = randomUUID();
    await f.req('POST', '/api/users', data, 503, key);
    assert.equal(f.auth.accounts.size, before);
    assert.equal((await f.req('GET', '/api/personnel/employees/' + e.id)).userId, null);
    const created = await f.req('POST', '/api/users', data, 200, key);
    assert.equal(f.auth.accounts.size, before + 1);
    assert.equal((await f.req('GET', '/api/personnel/employees/' + e.id)).userId, created.id);
    f.auth.create = original;
    const usedEmail = randomUUID() + '@example.test', existingId = await f.auth.create(usedEmail, 'Different-Synthetic@2026'), other = await employee(f, usedEmail), attempted = input(f, other, usedEmail);
    await f.req('POST', '/api/users', attempted, 409);
    await f.req('POST', '/api/users', attempted, 409);
    assert.equal(f.auth.accounts.get(usedEmail)?.id, existingId);
    assert.equal((await f.req('GET', '/api/personnel/employees/' + other.id)).userId, null);
    assert.equal((await f.admin.query('select count(*)::int n from ab.users where auth_id=$1', [existingId])).rows[0].n, 0);
  } finally { await f.close(); }
});
