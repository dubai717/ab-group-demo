import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { businessCentersFixture } from './business-centers-fixture.js';
import { security, transaction } from '../src/core.js';
import { model } from '../src/data.js';
import { readCrossBranchCollectionSource, readCrossBranchReceivingSite } from '../src/cross-branch-collection-source.js';

test('cross-branch receiving site uses actual dated work location and separate legal-company authority', async () => {
  const f = await businessCentersFixture();
  try {
    const worker = await f.employee();
    const cipher = security(f.secret.key);
    await f.bill('100');
    for (const file of ['operating-centres.sql', 'employee-work-locations.sql', 'cross-branch-collection-source.sql', 'cross-branch-receiving-site.sql']) {
      await f.admin.query(await readFile('backend/review/' + file, 'utf8'));
    }
    const read = (companyId = f.co1, session = {}) => transaction(f.runtime, f.org.tenant, worker.id, async c =>
      readCrossBranchReceivingSite(c, await model(c, worker.id, cipher), {
        user_id: worker.id, tenant_id: f.org.tenant, ...session,
      }, companyId), { readOnly: true, repeatableRead: true, auditActor: worker.id });
    await assert.rejects(read(), (error: any) => error.status === 403);
    await f.req('POST', '/api/users/' + worker.id + '/grants', {
      action: 'ledger_cross_branch_collect', scope: { type: 'company', id: f.co1 }, delegable: false,
    });
    assert.equal((await read() as any).reviewRequired, 'receiving_site_unassigned');
    const emirateId = (await f.admin.query('select id from ab.emirates order by id limit 1')).rows[0].id;
    const centreId = randomUUID();
    const advance = async (revision: number, state: string) => {
      const draft = {
        centreId, revision, state, emirateId, areaId: null, companyIds: [f.co2], effectiveOn: '2026-01-01',
        nameAr: 'موقع استلام اصطناعي', nameEn: 'Synthetic receiving site', reason: 'Synthetic original site evidence',
      };
      const plan = await f.req('POST', '/api/operating-centres/plan', draft);
      return f.req('POST', '/api/operating-centres/apply', { ...draft, planHash: plan.planHash, confirm: true });
    };
    await advance(0, 'Active');
    const selectSite = async (centreId: string | null, revision: number, effectiveOn: string) => {
      const draft = { userId: worker.id, centreId, revision, effectiveOn, reason: 'Synthetic dated physical assignment' };
      const plan = await f.req('POST', '/api/users/work-location/plan', draft);
      return f.req('POST', '/api/users/work-location/apply', { ...draft, planHash: plan.planHash, confirm: true });
    };
    await selectSite(centreId, 0, '2026-01-01');
    await selectSite(null, 1, '2099-01-01');
    const readOnlySite: any = await read();
    assert.equal(readOnlySite.centreId, centreId);
    assert.equal(readOnlySite.companyId, f.co1);
    assert.equal(readOnlySite.canCollect, false);
    assert.equal(readOnlySite.financialEffect, false);
    assert.match(readOnlySite.locationSourceId, /^[a-f0-9-]{36}$/);
    assert.match(readOnlySite.centreSourceId, /^[a-f0-9-]{36}$/);
    const source = await transaction(f.runtime, f.org.tenant, worker.id, async c =>
      readCrossBranchCollectionSource(c, await model(c, worker.id, cipher), {
        user_id: worker.id, tenant_id: f.org.tenant,
      }, cipher, { companyId: f.co1, customerId: f.client }),
    { readOnly: true, repeatableRead: true, auditActor: worker.id });
    assert.equal(source.state, 'reviewed_source');
    assert.deepEqual((source as any).receivingSite, readOnlySite);
    await assert.rejects(read(f.co2), (error: any) => error.status === 403);
    await assert.rejects(read(f.co1, { viewAs: true }), (error: any) => error.status === 403);
    await assert.rejects(read(f.co1, { actor_type: 'service' }), (error: any) => error.status === 403);

    await f.login(worker.username, worker.password);
    await f.req('GET', '/api/users/' + worker.id + '/work-location', undefined, 403);
    await f.req('GET', '/api/ledger/receivables', undefined, 403);
    await f.login();
    await advance(1, 'Inactive');
    assert.equal((await read() as any).reviewRequired, 'receiving_site_unavailable');
    const summary = await f.req('GET', '/api/users/' + worker.id + '/permission-summary');
    const grant = summary.directGrants.find((entry: any) => entry.action === 'ledger_cross_branch_collect');
    assert.ok(grant);
    await f.req('POST', '/api/users/' + worker.id + '/revoke', { grantId: grant.id });
    await assert.rejects(read(), (error: any) => error.status === 403);
  } finally {
    await f.close();
  }
});
