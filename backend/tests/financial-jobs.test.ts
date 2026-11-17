import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledgerFixture } from './ledger-fixture.js';
import { financialTick } from '../src/financial-jobs.js';
import { security } from '../src/core.js';
test('default-off financial worker reuses company registry; approved general recurring rules issue next-year invoices once in December and audit service identity', async () => { const f = await ledgerFixture(); try {
    const r = await f.request({ financeType: 'cash', expectedFunding: '0' });
    await f.register(r.id);
    const definition=await f.req('POST', '/api/ledger/items', { code: 'annual-service-fees', nameAr: 'رسم دوري وهمي', nameEn: 'Synthetic configured recurring fee', category: 'number_fee', priority: 100, companyIds: [f.co1], invoice: true, receipt: true, payment: false, methods: ['automatic'], receivableId: f.accounts.ar.id, revenueId: f.accounts.income.id, recurrence: 'monthly', recurringAmount: '10.001' });
    // Arrange a preserved pre-package recurring definition. New definitions require explicit relations.
    const row=(await f.admin.query('select payload_cipher from ab.finance_items where id=$1',[definition.id])).rows[0],cipher=security(f.secret.key),legacy=cipher.open(row.payload_cipher);delete legacy.recurrenceBinding;await f.admin.query('update ab.finance_items set payload_cipher=$2 where id=$1',[definition.id,cipher.seal(legacy)]);
    assert.equal((await financialTick(f.runtime, security(f.secret.key), '2026-12-01')).issued, 0);
    const cfg = (await f.req('GET', '/api/ledger/workbench?companyId=' + f.co1)).config;
    await f.req('POST', '/api/ledger/configuration', { ...cfg, automaticFinanceJobs: true });
    assert.equal((await financialTick(f.runtime, security(f.secret.key), '2026-12-01')).issued, 12);
    assert.equal((await financialTick(f.runtime, security(f.secret.key), '2026-12-01')).issued, 0);
    assert.equal(Number((await f.admin.query("select count(*)n from ab.finance_events where actor_type='service'and action='journal_posted'")).rows[0].n), 12);
    assert.equal(Number((await f.admin.query('select count(*)n from ab.vehicle_invoices where company_id=$1', [f.co2])).rows[0].n), 0);
    assert.equal(Number((await f.admin.query('select count(*)n from ab.finance_journals where company_id=$1', [f.co1])).rows[0].n), 12);
}
finally {
    await f.close();
} });
