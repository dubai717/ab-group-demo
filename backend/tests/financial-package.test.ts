import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { businessCentersFixture } from './business-centers-fixture.js';
import { planAdministrativeFees, planRecurring, addCalendarMonths } from '../src/financial-package.js';
import { security, transaction } from '../src/core.js';
import { model } from '../src/data.js';
import {runAdministrativeFees} from '../src/financial-package.js';
import {latestClosedDubaiMonth,planMonthlyFollowup} from '../src/monthly-followup.js';
import { today } from '../src/vehicle-domain.js';
const bill = (patch: any = {}) => ({ id: 'invoice-a', company_id: 'co', customer_id: 'customer', item_id: 'salik', vehicle_id: null, dueOn: '2027-01-01', outstanding: '200', written_off: '0', currency: 'AED', ...patch });
const rule = (patch: any = {}) => ({ id: 'rule', companyId: 'co', itemId: 'salik', feeItemId: 'fees', enabled: true, effectiveOn: '2027-01-01', delayMonths: 2, amount: '10', repeat: 'once', unit: 'customer_item', revision: 1, ...patch });
test('administrative rules: calendar delay, partial/full settlement, aggregate versus per-invoice, monthly replay and no retroactive/compound charges', () => { assert.equal(addCalendarMonths('2028-01-31', 1), '2028-02-29'); assert.equal(planAdministrativeFees(rule(), [bill()], '2027-02-28').length, 0); const p = planAdministrativeFees(rule(), [bill(), bill({ id: 'invoice-b', outstanding: '50' })], '2027-03-01'); assert.equal(p.length, 1); assert.equal(p[0].baseOutstanding, '250.000'); assert.equal(p[0].amount, '10'); assert.equal(p[0].originInvoiceIds.length, 2); assert.equal(planAdministrativeFees(rule(), [bill({ outstanding: '0' })], '2027-03-01').length, 0); assert.equal(planAdministrativeFees(rule(), [bill({ outstanding: '5' })], '2027-03-01')[0].amount, '10'); assert.equal(planAdministrativeFees(rule({ unit: 'invoice' }), [bill(), bill({ id: 'b' })], '2027-03-01').length, 2); assert.equal(planAdministrativeFees(rule(), [bill()], '2027-04-01', new Set([p[0].sourceKey])).length, 0); const march = planAdministrativeFees(rule({ repeat: 'monthly' }), [bill()], '2027-03-01')[0], april = planAdministrativeFees(rule({ repeat: 'monthly' }), [bill()], '2027-04-01', new Set([march.sourceKey]))[0]; assert.notEqual(march.sourceKey, april.sourceKey); for (const b of [bill({ company_id: 'other' }), bill({ currency: 'USD' }), bill({ administrativeFee: true }), bill({ dueOn: '2026-12-01' }), bill({ written_off: '20' })])
    assert.equal(planAdministrativeFees(rule(), [b], '2027-03-01').length, 0); assert.equal(planAdministrativeFees(rule({ enabled: false }), [bill()], '2027-03-01').length, 0); assert.equal(planAdministrativeFees(rule({ eligibleFrom: '2027-01-01', effectiveOn: '2027-04-10', repeat: 'monthly', amount: '15' }), [bill()], '2027-04-20').length, 0); assert.equal(planAdministrativeFees(rule({ eligibleFrom: '2027-01-01', effectiveOn: '2027-04-10', repeat: 'monthly', amount: '15' }), [bill()], '2027-05-01')[0].amount, '15'); });
test('explicit recurrence: one time/month/year/contract authority, anchor clamping, approved proration, end dates and period deduplication', () => { const relation = { id: 'r', companyId: 'co', customerId: 'customer', itemId: 'i', enabled: true, effectiveOn: '2027-01-01', anchorOn: '2027-01-15', untilOn: '2027-03-31', amount: '300', currency: 'AED', proration: 'none' }, it = (recurrence: string) => ({ id: 'i', active: true, data: { recurrence } }); const one = planRecurring(relation, it('none'), '2027-01-15')[0]; assert.equal(planRecurring(relation, it('none'), '2027-02-15', new Set([one.sourceKey])).length, 0); const jan = planRecurring(relation, it('monthly'), '2027-01-15')[0], feb = planRecurring(relation, it('monthly'), '2027-02-15')[0]; assert.notEqual(jan.sourceKey, feb.sourceKey); assert.equal(planRecurring(relation, it('monthly'), '2027-04-15').length, 0); assert.equal(planRecurring(relation, it('monthly'), '2027-01-14').length, 0); assert.equal(planRecurring(relation, it('contract'), '2027-01-15').length, 0); assert.equal(planRecurring({ ...relation, untilOn: null }, it('annual'), '2028-01-15')[0].dueOn, '2028-01-15'); assert.equal(planRecurring({ ...relation, proration: 'calendar_days' }, it('monthly'), '2027-01-15')[0].amount, '164.516'); assert.equal(planRecurring({ ...relation, anchorOn: '2027-01-31' }, it('monthly'), '2027-02-28')[0].dueOn, '2027-02-28'); assert.equal(planRecurring({ ...relation, proration: 'calendar_days' }, it('monthly'), '2027-02-01')[0].dueOn, '2027-02-01'); assert.equal(planRecurring({ ...relation, proration: 'calendar_days', untilOn: '2027-02-10' }, it('monthly'), '2027-02-01')[0].amount, '107.143'); });
async function approve(f: any, features: string[]) { const cipher = security(f.secret.key); await f.admin.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value', [f.org.tenant, 'financial-package-v1:approval:' + f.co1, { cipher: cipher.seal({ companyId: f.co1, features, reviewedDigest: 'isolated-policy-review', reason: 'Synthetic isolated owner approval only', approvedBy: f.org.user, approvedOn: today() }) }]); }
async function newItem(f: any, patch: any = {}) { return f.req('POST', '/api/ledger/items', { nameAr: 'بند اختبار مستقل', nameEn: 'Isolated item', category: 'general', companyIds: [f.co1], invoice: true, receipt: true, payment: false, methods: ['manual', 'automatic', 'bulk'], receivableId: f.accounts.ar.id, revenueId: f.accounts.income.id, ...patch }); }
test('vehicle/category rules use fixed policy, save disabled, preserve money/grants and require reviewed activation',async()=>{
 const f=await businessCentersFixture();try{
  const fee=await newItem(f),proof=await f.proof(),before=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const body={companyId:f.co1,itemId:f.items.salik,feeItemId:fee.id,delayMonths:2,amount:'10',repeat:'monthly',unit:'vehicle_category',effectiveOn:today(),contractEvidenceId:proof,confirm:true};
  await f.req('POST','/api/ledger/package/fees',{...body,delayMonths:1},422);
  await f.req('POST','/api/ledger/package/fees',{...body,repeat:'once'},422);
  const r=await f.req('POST','/api/ledger/package/fees',body);assert.equal(r.enabled,false);assert.equal(r.unit,'vehicle_category');
  await f.req('PATCH','/api/ledger/package/fees/'+r.id,{...body,revision:r.revision,enabled:true},403);
  const preview=await f.req('POST','/api/ledger/package/fees/'+r.id+'/preview',{companyId:f.co1});assert.equal(preview.financiallyEnabled,false);assert.deepEqual(preview.rows,[]);
  assert.equal((await f.admin.query('select count(*)::int n from ab.vehicle_invoices')).rows[0].n,0);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,0);
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);
 }finally{await f.close();}
});
test('safe configuration: automatic immutable codes, isolated scopes, preserved old roles/balances, priority preview and disabled fees', async () => { const f = await businessCentersFixture(); try {
    const cipher = security(f.secret.key), before = (await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows, grants = (await f.admin.query('select * from ab.permission_grants order by id')).rows, old = (await f.admin.query('select * from ab.finance_items where id=$1', [f.items.loan])).rows[0], created = await newItem(f), second = await newItem(f);
    const rows = (await f.req('GET', '/api/ledger/workbench?companyId=' + f.co1)).finance_items, a = rows.find((r: any) => r.id === created.id), b = rows.find((r: any) => r.id === second.id);
    assert.match(a.code, /^FI-\d+/);
    assert.notEqual(a.code, b.code);
    await newItem(f, { code: 'FI-000500' });
    const afterLegacy = await newItem(f);
    assert.equal((await f.req('GET', '/api/ledger/workbench?companyId=' + f.co1)).finance_items.find((r: any) => r.id === afterLegacy.id).code, 'FI-000501');
    assert.equal(a.details.recurrenceBinding, 'explicit');
    await f.req('PATCH', '/api/ledger/items/' + a.id, { ...a.details, code: 'REPLACE' }, 409);
    assert.deepEqual((await f.admin.query('select * from ab.finance_items where id=$1', [f.items.loan])).rows[0], old);
    assert.equal((await f.admin.query('select count(*)::int n from ab.vehicle_invoices')).rows[0].n, 0);
    const priority = await f.req('POST', '/api/ledger/package/priority', { companyId: f.co1, enabled: true, itemIds: [created.id, f.items.salik], revision: 0, confirm: true });
    assert.equal(priority.enabled, false);
    assert.equal(priority.requestedEnabled, true);
    assert.equal((await f.admin.query('select priority from ab.finance_items where id=$1', [f.items.salik])).rows[0].priority, 2);
    const proof = await f.proof(), fee = await f.req('POST', '/api/ledger/package/fees', { companyId: f.co1, itemId: f.items.salik, feeItemId: created.id, delayMonths: 2, amount: '10', repeat: 'monthly', unit: 'customer_item', effectiveOn: today(), contractEvidenceId: proof, confirm: true });
    assert.equal(fee.enabled, false);
    await f.req('PATCH', '/api/ledger/package/fees/' + fee.id, { companyId: f.co1, itemId: f.items.salik, feeItemId: created.id, delayMonths: 2, amount: '10', repeat: 'monthly', unit: 'customer_item', effectiveOn: today(), contractEvidenceId: proof, enabled: true, revision: 1, confirm: true }, 403);
    const preview = await f.req('POST', '/api/ledger/package/fees/' + fee.id + '/preview', { companyId: f.co1 });
    assert.equal(preview.simulation, true);
    assert.equal(preview.financiallyEnabled, false);
    await f.req('POST', '/api/ledger/package/fees/' + fee.id + '/apply', { companyId: f.co1, digest: preview.digest, confirm: true }, 403);
    assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows, before);
    assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows, grants);
    const u = await f.employee('employee');
    await f.login(u.username, u.password);
    await f.req('GET', '/api/ledger/package/state?companyId=' + f.co1, undefined, 403);
}
finally {
    await f.close();
} });
test('approved isolated recurrence and precise invoice allocation reuse native invoices, receipts and accounting without replay', async () => { const f = await businessCentersFixture(); try {
    const r = await newItem(f, { recurrence: 'monthly', recurringAmount: '100' }), proof = await f.proof();
    const relation = await f.req('POST', '/api/ledger/package/relations', { companyId: f.co1, customerId: f.client, itemId: r.id, amount: '100', currency: 'AED', effectiveOn: today(), anchorOn: today(), dateBasis: 'relationship_start', contractEvidenceId: proof, notes: 'Isolated explicit service entitlement', confirm: true });
    assert.equal(relation.enabled, false);
    assert.equal((await f.req('POST', '/api/ledger/recurring/run', { companyId: f.co1 })).issued, 0);
    await approve(f, ['recurring', 'priority']);
    await f.req('POST', '/api/ledger/package/relations/' + relation.id + '/status', { companyId: f.co1, enabled: true, revision: relation.revision, confirm: true });
    assert.equal((await f.req('POST', '/api/ledger/recurring/run', { companyId: f.co1 })).issued, 1);
    assert.equal((await f.req('POST', '/api/ledger/recurring/run', { companyId: f.co1 })).issued, 0);
    const a = await f.bill('50', r.id), b = await f.bill('70', r.id);
    await f.req('POST', '/api/ledger/package/priority', { companyId: f.co1, enabled: false, itemIds: [r.id], revision: 0, confirm: true });
    await f.req('POST', '/api/ledger/collections', { companyId: f.co1, customerId: f.client, currency: 'AED', receivedOn: today(), method: 'cash', mode: 'automatic', amount: '30', items: [{ itemId: r.id, amount: '30' }] }, 422);
    const key = randomUUID(), body = { companyId: f.co1, customerId: f.client, currency: 'AED', receivedOn: today(), method: 'cash', mode: 'manual', amount: '50', allocations: [{ invoiceId: a.id, amount: '20' }, { invoiceId: b.id, amount: '30' }] }, col = await f.req('POST', '/api/ledger/collections', body, 200, key);
    assert.equal((await f.req('POST', '/api/ledger/collections', body, 200, key)).id, col.id);
    const balances = (await f.req('GET', '/api/ledger/invoices?companyId=' + f.co1)).rows;
    assert.equal(balances.find((r: any) => r.id === a.id).paid, '20.000');
    assert.equal(balances.find((r: any) => r.id === b.id).paid, '30.000');
    const vouchers = await f.req('GET', '/api/ledger/package/documents?companyId=' + f.co1 + '&type=RV');
    assert.equal(vouchers.rows.length, 1);
    assert(vouchers.rows[0].createdByName);
    assert(vouchers.rows[0].number);
    await f.req('POST', '/api/ledger/package/relations/' + relation.id + '/status', { companyId: f.co1, enabled: false, revision: 2, confirm: true });
}
finally {
    await f.close();
} });
test('native document corrections distinguish discount, unsafe cancellation and noncash bad debt; effects require owner activation', async () => { const f = await businessCentersFixture(); try {
    const a = await f.bill('100', f.items.salik), future = await f.bill('200', f.items.salik, { dueOn: addCalendarMonths(today(), 1) }), data = { companyId: f.co1, kind: 'Discount', items: [{ invoiceId: a.id, amount: '10' }], reason: 'Isolated approved discount', effectiveOn: today(), confirm: true }, preview = await f.req('POST', '/api/ledger/package/adjustments/preview', data), result = await f.req('POST', '/api/ledger/package/adjustments/confirm', { data, digest: preview.digest });
    assert.match(result.number, /^DS-/);
    assert.equal((await f.admin.query('select count(*)::int n from ab.finance_receipts')).rows[0].n, 0);
    let rows = (await f.req('GET', '/api/ledger/invoices?companyId=' + f.co1)).rows;
    assert.equal(rows.find((r: any) => r.id === a.id).outstanding, '90.000');
    const cancel = { ...data, kind: 'Cancel', items: [{ invoiceId: future.id, amount: '200' }] }, p = await f.req('POST', '/api/ledger/package/adjustments/preview', cancel);
    await f.req('POST', '/api/ledger/package/adjustments/confirm', { data: cancel, digest: p.digest }, 403);
    await approve(f, ['documents']);
    await f.req('POST', '/api/ledger/package/adjustments/confirm', { data: cancel, digest: p.digest });
    await f.req('POST', '/api/ledger/package/adjustments/preview', { ...cancel, items: [{ invoiceId: a.id, amount: '90' }] }, 409);
    const bad = { ...data, kind: 'BadDebt', writeOffAccountId: f.accounts.expense.id, items: [{ invoiceId: a.id, amount: '90' }] }, b = await f.req('POST', '/api/ledger/package/adjustments/preview', bad);
    await f.req('POST', '/api/ledger/package/adjustments/confirm', { data: bad, digest: b.digest });
    rows = (await f.req('GET', '/api/ledger/invoices?companyId=' + f.co1)).rows;
    assert.equal(rows.find((r: any) => r.id === a.id).outstanding, '90.000');
    assert.equal(rows.find((r: any) => r.id === a.id).bookOutstanding, '0.000');
    const docs = await f.req('GET', '/api/ledger/package/documents?companyId=' + f.co1 + '&type=Discount');
    assert.equal(docs.rows.length, 1);
    assert(docs.rows.every((r: any) => r.number && r.createdByName));
    assert.equal((await f.admin.query('select count(*)::int n from ab.finance_receipts')).rows[0].n, 0);
}
finally {
    await f.close();
} });
test('approved isolated administrative posting preserves original debt, aggregates once, holds customer credits, and never compounds fees', async () => { const f = await businessCentersFixture(); try {
    const cipher = security(f.secret.key), feeItem = await newItem(f), proof = await f.proof(), a = await f.bill('200', f.items.salik), b = await f.bill('100', f.items.salik);
    await f.collection('50', { items: [{ itemId: f.items.salik, amount: '50' }] });
    const key = randomUUID(), definition = { id: key, companyId: f.co1, itemId: f.items.salik, feeItemId: feeItem.id, enabled: true, delayMonths: 2, amount: '10', repeat: 'monthly', unit: 'customer_item', effectiveOn: f.date, contractEvidenceId: proof, notes: 'Synthetic isolated contract review', revision: 1, createdBy: f.org.user, updatedBy: f.org.user };
    await f.admin.query('insert into ab.settings values($1,$2,$3)', [f.org.tenant, 'financial-package-v1:fees:' + f.co1 + ':' + key, { cipher: cipher.seal(definition) }]);
    const preview = await f.req('POST', '/api/ledger/package/fees/' + key + '/preview', { companyId: f.co1 });
    assert.equal(preview.rows.length, 1);
    assert.equal(preview.rows[0].baseOutstanding, '250.000');
    assert.equal(preview.rows[0].originInvoiceIds.length, 2);
    await f.req('POST', '/api/ledger/package/fees/' + key + '/apply', { companyId: f.co1, digest: preview.digest, confirm: true }, 403);
    await approve(f, ['fees']);
    const result = await f.req('POST', '/api/ledger/package/fees/' + key + '/apply', { companyId: f.co1, digest: preview.digest, confirm: true });
    assert.equal(result.issued, 1);
    const native = (await f.admin.query('select amount::text from ab.vehicle_invoices where id=$1', [a.id])).rows[0];
    assert.equal(native.amount, '200.000');
    const again = await f.req('POST', '/api/ledger/package/fees/' + key + '/preview', { companyId: f.co1 });
    assert.equal(again.rows.length, 0);
    assert.equal((await f.req('POST', '/api/ledger/package/fees/' + key + '/apply', { companyId: f.co1, digest: again.digest, confirm: true })).issued, 0);
    await f.collection('250', { items: [{ itemId: f.items.salik, amount: '250' }] });
    assert.equal((await f.req('POST', '/api/ledger/package/fees/' + key + '/preview', { companyId: f.co1 })).rows.length, 0);
    const balances = (await f.req('GET', '/api/ledger/invoices?companyId=' + f.co1)).rows;
    assert.equal(balances.find((r: any) => r.id === result.invoiceIds[0]).outstanding, '10.000');
    assert.equal(balances.find((r: any) => r.id === b.id).outstanding, '0.000');
    await f.req('PATCH', '/api/ledger/package/fees/' + key, { companyId: f.co1, itemId: f.items.salik, feeItemId: feeItem.id, delayMonths: 2, amount: '15', repeat: 'monthly', unit: 'customer_item', effectiveOn: today(), contractEvidenceId: proof, enabled: false, revision: 1, confirm: true });
    assert.equal((await f.admin.query('select amount::text from ab.vehicle_invoices where id=$1', [result.invoiceIds[0]])).rows[0].amount, '10.000');
    assert.equal((await f.req('GET', '/api/ledger/package/state?companyId=' + f.co1)).feeRules[0].history.length, 1);
    await f.collection('50', { items: [{ itemId: f.items.salik, amount: '50' }] });
    const owed = await f.bill('20', f.items.salik), heldRule = { ...definition, id: randomUUID(), repeat: 'once' };
    await f.admin.query('insert into ab.settings values($1,$2,$3)', [f.org.tenant, 'financial-package-v1:fees:' + f.co1 + ':' + heldRule.id, { cipher: cipher.seal(heldRule) }]);
    assert.equal((await f.req('POST', '/api/ledger/package/fees/' + heldRule.id + '/preview', { companyId: f.co1 })).rows.length, 0);
    assert.equal((await f.req('GET', '/api/ledger/invoices?companyId=' + f.co1)).rows.find((r: any) => r.id === owed.id).outstanding, '20.000');
}
finally {
    await f.close();
} });
test('draft amendments are owner reviewed; PV guard proposal and rollback are isolated, narrow and preserve all old protections', async () => { const f = await businessCentersFixture(); try {
    const { readFile } = await import('node:fs/promises');
    assert.match(f.sourceDatabase, /^ab_backup_[a-f0-9]{32}$/);
    const original = (await f.admin.query("select pg_get_functiondef('ab.financial_voucher_guard()'::regprocedure) definition")).rows[0].definition, roles = (await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows, v = await f.req('POST', '/api/ledger/vouchers', { companyId: f.co1, itemId: f.items.expense, customerId: f.client, amount: '20', currency: 'AED', issuedOn: today(), reason: 'Synthetic draft', beneficiary: 'Synthetic recipient' }), legacy = await f.req('POST', '/api/ledger/vouchers', { companyId: f.co1, itemId: f.items.expense, amount: '30', currency: 'AED', issuedOn: today(), reason: 'Preserved old draft', beneficiary: 'Original recipient', sourceKey: 'legacy-draft' }), data = { companyId: f.co1, type: 'PV', documentId: v.id, amount: '25', effectiveOn: today(), beneficiary: 'Corrected synthetic recipient', notes: 'Isolated owner reviewed correction', confirm: true }, preview = await f.req('POST', '/api/ledger/package/drafts/preview', data);
    await f.req('POST', '/api/ledger/package/drafts/confirm', { data, digest: preview.digest }, 403);
    await approve(f, ['documents']);
    const guarded = await f.req('POST', '/api/ledger/package/drafts/confirm', { data, digest: preview.digest }, 409);
    assert.equal(guarded.error, 'pvDraftGuardReviewRequired');
    const before = (await f.admin.query('select * from ab.finance_vouchers where id=$1', [v.id])).rows[0];
    await f.admin.query(await readFile('docs/proposals/financial-pv-draft-guard.sql.txt', 'utf8'));
    await f.req('POST', '/api/ledger/package/drafts/confirm', { data, digest: preview.digest });
    const after = (await f.admin.query('select * from ab.finance_vouchers where id=$1', [v.id])).rows[0];
    assert.equal(after.amount, '25.000');
    assert.equal(after.status, 'Pending');
    for (const key of ['tenant_id', 'company_id', 'item_id', 'customer_id', 'number', 'source_key', 'currency', 'created_by'])
        assert.equal(after[key], before[key]);
    assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals where source_key=$1', ['voucher:' + v.id])).rows[0].n, 0);
    await assert.rejects(() => f.admin.query('update ab.finance_vouchers set amount=1 where id=$1', [v.id]), (e: any) => e.code === '23514');
    await f.req('POST', '/api/ledger/package/drafts/preview', { ...data, documentId: legacy.id }, 409);
    const bank = await f.bank(), proof = await f.proof();
    await f.req('POST', '/api/ledger/vouchers/' + v.id + '/prepare', { bankAccountId: bank.id, chequeNumber: 'ISOLATED-PV-DRAFT', issuedOn: today(), dueOn: today(), documentVersionId: proof });
    await f.req('POST', '/api/ledger/package/drafts/preview', data, 409);
    await f.admin.query(await readFile('docs/proposals/financial-pv-draft-rollback.sql.txt', 'utf8'));
    assert.equal((await f.admin.query("select pg_get_functiondef('ab.financial_voucher_guard()'::regprocedure) definition")).rows[0].definition, original);
    assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows, roles);
}
finally {
    await f.close();
} });
test('one discount document can allocate to several invoices without duplicate RVs or document headers; approved templates remain scoped', async () => { const f = await businessCentersFixture(); try {
    const clone = await newItem(f, { category: 'salik', templateItemId: f.items.salik }), row = (await f.req('GET', '/api/ledger/workbench?companyId=' + f.co1)).finance_items.find((r: any) => r.id === clone.id);
    assert.equal(row.details.revenueId, f.accounts.income.id);
    await f.req('POST', '/api/ledger/items', { nameAr: 'تصنيف غير مطابق', nameEn: 'Mismatched classification', category: 'general', templateItemId: f.items.salik, companyIds: [f.co1], invoice: true, receipt: true, payment: false, methods: ['manual'] }, 422);
    await f.req('POST', '/api/ledger/items', { nameAr: 'أصل تمويل جديد', nameEn: 'New principal', category: 'loan', companyIds: [f.co1], invoice: true, receipt: true, payment: false, methods: ['manual'], receivableId: f.accounts.ar.id, revenueId: f.accounts.income.id }, 422);
    const a = await f.bill('100'), b = await f.bill('200'), data = { companyId: f.co1, kind: 'Discount', items: [{ invoiceId: a.id, amount: '10' }, { invoiceId: b.id, amount: '20' }], reason: 'Synthetic reviewed general discount', effectiveOn: today(), confirm: true }, preview = await f.req('POST', '/api/ledger/package/adjustments/preview', data), result = await f.req('POST', '/api/ledger/package/adjustments/confirm', { data, digest: preview.digest });
    assert.equal(result.adjustmentIds.length, 2);
    const list = await f.req('GET', '/api/ledger/package/documents?companyId=' + f.co1 + '&type=Discount');
    assert.equal(list.count, 1);
    assert.equal(list.rows.length, 1);
    assert.equal(list.rows[0].amount, '30.000');
    assert.equal(list.rows[0].allocationCount, 2);
    assert.equal(list.rows[0].number, result.number);
    assert.equal((await f.admin.query('select count(*)::int n from ab.finance_receipts')).rows[0].n, 0);
}
finally {
    await f.close();
} });

test('cash and standalone bank payment documents reuse their original journals/operations and never create a second expense',async()=>{const f=await businessCentersFixture();try{const cash=await f.req('POST','/api/ledger/funds',{companyId:f.co1,name:'Synthetic document cash',kind:'cash',holderId:f.org.user,chartId:f.accounts.cash.charts[f.co1],currency:'AED',ceiling:'100',threshold:'10',openingBalance:'100',openingEquityId:f.accounts.equity.charts[f.co1],effectiveOn:today()}),spent=await f.req('POST','/api/ledger/funds/'+cash.id+'/spend',{itemId:f.items.expense,amount:'20',reason:'Synthetic paid cash expense',effectiveOn:today()}),bank=await f.bank(),payment=await f.req('POST','/api/finance/operations',{companyId:f.co1,kind:'payment',bankAccountId:bank.id,amount:'5',currency:'AED',direction:'debit',effectiveOn:today(),beneficiary:'Synthetic bank beneficiary',reason:'Synthetic bank draft',reference:'ISOLATED-PAYMENT-DOCUMENT',counterpartId:f.accounts.expense.charts[f.co1]}),before=(await f.admin.query('select count(*)::int n from ab.finance_entries')).rows[0].n,list=await f.req('GET','/api/ledger/package/documents?companyId='+f.co1+'&type=PV');assert.equal(list.count,2);const cpv=list.rows.find((r:any)=>r.id===spent.id),bpv=list.rows.find((r:any)=>r.id===payment.id);assert.equal(cpv.amount,'20.000');assert.equal(cpv.status,'Posted');assert.equal(cpv.paymentMethod,'cash');assert.match(cpv.number,/^CPV-/);assert.equal(bpv.status,'Draft');assert.equal(bpv.amount,'5.000');await f.req('POST','/api/ledger/package/documents/notes',{companyId:f.co1,type:'PV',documentId:spent.id,sourceKind:'cash_journal',notes:'Synthetic documented cash correction note',revision:1,confirm:true});assert.equal((await f.admin.query('select count(*)::int n from ab.finance_entries')).rows[0].n,before);assert.equal((await f.req('GET','/api/ledger/workbench?companyId='+f.co1)).finance_funds.find((r:any)=>r.id===cash.id).balance,'80.000');await f.req('POST','/api/ledger/package/documents/notes',{companyId:f.co1,type:'PV',documentId:payment.id,sourceKind:'bank_operation',notes:'Synthetic note before original approval',revision:0,confirm:true});await f.req('POST','/api/finance/operations/'+payment.id+'/approve',{revision:1});const approved=(await f.req('GET','/api/ledger/package/documents?companyId='+f.co1+'&type=PV')).rows.find((r:any)=>r.id===payment.id),latest=(await f.admin.query('select created_at from ab.finance_events where entity_id=$1 order by created_at desc limit 1',[payment.id])).rows[0];assert.equal(approved.status,'Approved');assert.equal(new Date(approved.lastModifiedAt).toISOString(),latest.created_at.toISOString(),'a later native approval supersedes older presentation metadata');}finally{await f.close();}});

test('cash selection remains in custody until the original bank deposit confirms it exactly once', async()=>{
 const f=await businessCentersFixture();
 try{
  const bill=await f.bill('300',f.items.salik),bank=await f.bank(),wrong=await f.bank(f.co2),proof=await f.proof();
  await approve(f,['priority','deposit-allocation']);
  await f.req('POST','/api/ledger/package/priority',{companyId:f.co1,enabled:true,itemIds:[f.items.loan],revision:0,confirm:true});
  const input={companyId:f.co1,customerId:f.client!,currency:'AED',receivedOn:today(),amount:'200',mode:'manual',itemId:f.items.salik};
  const preview=async(body:Record<string,string>)=>f.req('GET','/api/ledger/collections/deposit-preview?'+new URLSearchParams(body));
  const {itemId,...automatic}=input;
  assert.equal((await preview({...automatic,mode:'automatic'})).unallocated,'200.000');
  const planned=await preview(input);
  assert.deepEqual(planned.receipts.map((r:any)=>[r.invoiceId,r.amount]),[[bill.id,'200.000']]);
  const saved=await f.req('POST','/api/ledger/collections/deposit-pending',{...input,digest:planned.digest,actualCashReceived:true});
  assert.equal(saved.receipts[0].state,'Pending');
  const paid=async()=>(await f.admin.query('select ab.financial_allocation_total($1)::text paid',[bill.id])).rows[0].paid;
  assert.equal(Number(await paid()),0);
  const held=await f.req('GET','/api/ledger/deposits/held-summary');
  assert.equal(held.rows[0].bankAccountId,bank.id);
  assert.equal(held.rows[0].amount,'200.000');
  const deposit={companyId:f.co1,bankAccountId:wrong.id,amount:'200',currency:'AED',effectiveOn:today(),documentVersionId:proof,reference:'Synthetic deferred deposit'};
  await f.req('POST','/api/ledger/deposits',deposit,422);
  const correct=await f.req('POST','/api/ledger/deposits',{...deposit,bankAccountId:bank.id});
  assert.equal(Number(await paid()),0);
  const confirmation={confirmedAmount:'200',bankConfirmation:'Verified synthetic custody closure',effectiveOn:today(),accountAndDateVerified:true};
  await f.req('POST','/api/ledger/deposits/'+correct.id+'/confirm',confirmation);
  await f.req('POST','/api/ledger/deposits/'+correct.id+'/confirm',confirmation,409);
  assert.equal((await f.admin.query('select coalesce(sum(amount),0)::text total from ab.vehicle_allocations where invoice_id=$1',[bill.id])).rows[0].total,'200.000');
  assert.equal((await f.req('GET','/api/ledger/deposits/held-summary')).rows.length,0);
 }finally{await f.close();}
});

test('Dubai month close preserves amounts, ignores next-month installments and creates one document per base item', async()=>{
 const f=await businessCentersFixture();
 try{
  await approve(f,['monthly-followup']);
  const now=today(),[year,month]=now.split('-').map(Number);
  const next=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  const following=new Date(Date.UTC(year,month+1,1)).toISOString().slice(0,10);
  const monthly={companyId:f.co1,itemId:f.items.salik,incomeAccountId:f.accounts.income.id,
   effectiveOn:now,amount:'20',condition:'double_fee',enabled:true,revision:0,confirm:true};
  const save=await f.req('POST','/api/ledger/package/monthly-followup',monthly);
  const other=await f.req('POST','/api/ledger/package/monthly-followup',
   {...monthly,itemId:f.items.expense,amount:'10',condition:'any_unpaid'});
  assert.notEqual(save.feeItemId,other.feeItemId);
  const zero=await f.req('POST','/api/ledger/package/monthly-followup',
   {...monthly,itemId:f.items.loan,condition:'any_unpaid'});
  const transition=await f.req('POST','/api/ledger/package/monthly-followup',
   {...monthly,itemId:f.items.commission,condition:'any_unpaid'});
  await f.bill('42',f.items.loan);
  await f.collection('42',{receivedOn:now});
  await f.bill('50',f.items.commission);
  await f.bill('15',f.items.card,{issuedOn:now,dueOn:now,
   sourceKey:'admin-fee:vehicle60:'+f.co1+':'+randomUUID()+':'+f.items.commission+':'+now.slice(0,7)});
  await f.bill('50',f.items.salik);
  await f.bill('5',f.items.expense);
  await f.bill('999',f.items.salik,{dueOn:next});
  await f.req('POST','/api/ledger/package/monthly-followup',
   {...monthly,revision:save.revision,effectiveOn:next,amount:'30'});
  const cipher=security(f.secret.key);
  const close=(when:string)=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>
   runAdministrativeFees(c,cipher,await model(c,f.org.user,cipher),{tenant_id:f.org.tenant,user_id:f.org.user},f.co1,when));
  assert.equal((await close(next)).issued,2);
  assert.equal((await close(next)).issued,0);
  assert.equal((await close(following)).issued,3);
  const rows=(await f.admin.query(`select l.item_id,i.amount::text,l.source_key,i.invoice_number
    from ab.finance_invoice_links l join ab.vehicle_invoices i on i.id=l.invoice_id
    where l.company_id=$1 and l.source_key like 'monthly-followup:%' order by i.invoice_number`,[f.co1])).rows;
  assert.deepEqual(rows.filter(r=>r.item_id===save.feeItemId).map(r=>r.amount),['20.000','30.000']);
  assert.equal(new Set(rows.map(r=>r.invoice_number)).size,5);
  assert.equal(rows.filter(r=>r.item_id===zero.feeItemId).length,0);
  assert.equal(rows.filter(r=>r.item_id===transition.feeItemId).length,1);
  assert.equal(rows.filter(r=>r.source_key.endsWith(latestClosedDubaiMonth(next).month)).length,2);
 }finally{await f.close();}
});

test('monthly thresholds, zero balance and legacy transition do not double charge',()=>{
 const rule={companyId:'dubai',itemId:'salik',feeItemId:'salik-fee',effectiveOn:'2026-01-01',
  enabled:true,amount:'20',condition:'double_fee' as const};
 assert.equal(latestClosedDubaiMonth('2028-03-01').closeOn,'2028-02-29');
 assert.equal(planMonthlyFollowup(rule,'2026-01-31',[{customerId:'one',outstanding:'39.999'}],new Set(),new Set()).length,0);
 assert.equal(planMonthlyFollowup(rule,'2026-01-31',[{customerId:'one',outstanding:'40'}],new Set(),new Set()).length,1);
 assert.equal(planMonthlyFollowup(rule,'2026-02-28',[{customerId:'one',outstanding:'40'}],new Set(['one']),new Set()).length,0);
 assert.equal(planMonthlyFollowup({...rule,condition:'any_unpaid'},'2026-03-31',[{customerId:'one',outstanding:'0'}],new Set(),new Set()).length,0);
});

test('Sharjah workers with only workflow grants can deposit Dubai company cash without acquiring bank screen access',async()=>{
 const f=await businessCentersFixture();
 try{
  const collector=await f.employee(),depositor=await f.employee(),bank=await f.bank(),otherBank=await f.bank(f.co2);
  const issued=await f.bill('300',f.items.salik);
  await approve(f,['deposit-allocation']);
  for(const person of [collector,depositor]){
   const revision=(await f.admin.query('select revision from ab.users where id=$1',[person.id])).rows[0].revision;
   await f.req('PATCH','/api/users/'+person.id,{revision,companyIds:[f.co2]});
  }
  for(const [person,actions] of [[collector,['ledger_collect','ledger_hand_over']],[depositor,['ledger_receive','ledger_deposit','ledger_deposit_verify']]] as const){
   for(const action of actions)await f.req('POST','/api/users/'+person.id+'/grants',{
    action,scope:{type:'company',id:f.co1},delegable:false,
   });
  }
  await f.req('POST','/api/ledger/custody/routes',{
   companyId:f.co1,senderId:collector.id,receiverId:depositor.id,effectiveOn:today(),
  });
  const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create(),page=pdf.addPage();
  const reference='DUBAI-DEPOSIT-200';
  for(const [index,line] of ['Bank: Synthetic Bank','IBAN: AE070331234567890123456','Amount: 200.000','Date: '+today(),'Reference: '+reference].entries()){
   page.drawText(line,{x:30,y:720-index*32,size:13});
  }
  const evidence=await f.req('POST','/api/documents',{bankAccountId:bank.id,category:'other',title:'Synthetic Dubai deposit',
   date:today(),name:'dubai-proof.pdf',mime:'application/pdf',base64:Buffer.from(await pdf.save()).toString('base64')});
  await f.login(collector.username,collector.password);
  const body={companyId:f.co1,customerId:f.client!,currency:'AED',receivedOn:today(),amount:'200',mode:'manual',invoiceId:issued.id};
  const plan=await f.req('GET','/api/ledger/collections/deposit-preview?'+new URLSearchParams(body));
  const cash=await f.req('POST','/api/ledger/collections/deposit-pending',{...body,digest:plan.digest,actualCashReceived:true});
  const outgoing=await f.req('GET','/api/ledger/custody/deposit-handover');
  assert.deepEqual(outgoing.outgoing.map((r:any)=>[r.company_id,r.receiver_id,r.amount]),[[f.co1,depositor.id,'200.000']]);
  const handover=await f.req('POST','/api/ledger/custody/handovers',{companyId:f.co1,receiverId:depositor.id,currency:'AED',
   amount:'200',receipts:[{receiptId:cash.receipts[0].id,amount:'200'}]});
  await f.login(depositor.username,depositor.password);
  const incoming=await f.req('GET','/api/ledger/custody/deposit-handover');
  assert.deepEqual(incoming.incoming.map((r:any)=>r.id),[handover.id]);
  await f.req('POST','/api/ledger/custody/handovers/'+handover.id+'/receive',{actual:'200',reason:'Synthetic Sharjah handover'});
  const summary=await f.req('GET','/api/ledger/deposits/held-summary');
  assert.deepEqual(summary.rows.map((r:any)=>[r.companyId,r.amount,r.bankAccountId]),[[f.co1,'200.000',bank.id]]);
  await f.req('GET','/api/ledger/workbench?companyId='+f.co1,undefined,403);
  const deposit={companyId:f.co1,bankAccountId:bank.id,documentVersionId:evidence.versionId,currency:'AED',
   amount:'200',effectiveOn:today(),reference};
  await f.req('POST','/api/ledger/deposits',{...deposit,bankAccountId:otherBank.id},422);
  const filed=await f.req('POST','/api/ledger/deposits',deposit);
  const confirmation={confirmedAmount:'200',effectiveOn:today(),bankConfirmation:'Synthetic matching receipt',accountAndDateVerified:true};
  await f.req('POST','/api/ledger/deposits/'+filed.id+'/confirm',confirmation);
  await f.req('POST','/api/ledger/deposits/'+filed.id+'/confirm',confirmation,409);
  const debt=(await f.admin.query(`select (i.amount-coalesce(sum(a.amount),0))::text outstanding
   from ab.vehicle_invoices i left join ab.vehicle_allocations a on a.invoice_id=i.id where i.id=$1 group by i.id`,[issued.id])).rows[0];
  assert.equal(debt.outstanding,'100.000');
  assert.equal((await f.req('GET','/api/ledger/deposits/held-summary')).rows.length,0);
 }finally{await f.close();}
});

test('configured automatic allocation exhausts the first item by oldest due and excludes future or disabled items',async()=>{
 const f=await businessCentersFixture();
 try{
  await approve(f,['priority','deposit-allocation']);
  await f.req('POST','/api/ledger/package/priority',{companyId:f.co1,enabled:true,itemIds:[f.items.salik,f.items.loan],revision:0,confirm:true});
  const newer=await f.bill('30',f.items.salik,{dueOn:'2026-01-20'});
  const older=await f.bill('20',f.items.salik,{dueOn:'2026-01-10'});
  const next=await f.bill('70',f.items.loan,{dueOn:'2026-01-01'});
  await f.bill('500',f.items.expense);
  await f.bill('999',f.items.salik,{dueOn:'2099-01-01'});
  const d={companyId:f.co1,customerId:f.client!,currency:'AED',receivedOn:today(),amount:'75',mode:'automatic'};
  const response=await f.req('GET','/api/ledger/collections/deposit-preview?'+new URLSearchParams(d));
  assert.deepEqual(response.receipts.map((r:any)=>[r.invoiceId,r.amount]),
   [[older.id,'20.000'],[newer.id,'30.000'],[next.id,'25.000']]);
  assert.equal(response.unallocated,'0.000');
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_receipts')).rows[0].n,0);
 }finally{await f.close();}
});

test('accounting catalogue scopes read, create, and removal, preserving used items',async()=>{
 const f=await businessCentersFixture();
 try{
  const {readFile}=await import('node:fs/promises');
  await f.admin.query(await readFile('supabase/proposed/026_accounting_item_catalogue.sql','utf8'));
  const viewer=await f.employee(),creator=await f.employee(),editor=await f.employee();
  for(const [person,permissions] of [[viewer,['ledger_view']],[creator,['ledger_view','ledger_item_create']],
   [editor,['ledger_view','ledger_item_edit']]] as const){
   for(const action of permissions)await f.req('POST','/api/users/'+person.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  }
  const draft={nameAr:'بند للمراجعة',nameEn:'Catalogue review item',category:'general',companyIds:[f.co1],
   invoice:true,receipt:true,payment:false,methods:['manual'],receivableId:f.accounts.ar.id,revenueId:f.accounts.income.id};
  const used=await newItem(f);
  await f.bill('80',used.id);
  await f.login(viewer.username,viewer.password);
  assert((await f.req('GET','/api/ledger/workbench?companyId='+f.co1)).finance_items.some((r:any)=>r.id===f.items.salik));
  await f.req('GET','/api/ledger/workbench?companyId='+f.co2,undefined,403);
  await f.req('POST','/api/ledger/items',draft,403);
  await f.req('POST','/api/ledger/items/'+f.items.salik+'/remove',{companyId:f.co1},403);
  await f.login(creator.username,creator.password);
  const unused=await f.req('POST','/api/ledger/items',draft);
  await f.req('PATCH','/api/ledger/items/'+unused.id,draft,403);
  await f.req('POST','/api/ledger/items/'+unused.id+'/remove',{companyId:f.co1},403);
  await f.req('POST','/api/ledger/items',{...draft,companyIds:[f.co2]},403);
  await f.login(editor.username,editor.password);
  await f.req('POST','/api/ledger/items',draft,403);
  await f.req('PATCH','/api/ledger/items/'+unused.id,{...draft,nameEn:'Edited catalogue item'});
  assert.equal((await f.req('POST','/api/ledger/items/'+unused.id+'/remove',{companyId:f.co1})).disabled,false);
  await f.req('POST','/api/ledger/items/'+f.items.salik+'/remove',{companyId:f.co1},403);
  assert.equal((await f.req('POST','/api/ledger/items/'+used.id+'/remove',{companyId:f.co1})).disabled,true);
  assert.equal((await f.admin.query('select active from ab.finance_items where id=$1',[used.id])).rows[0].active,false);
  assert.equal((await f.admin.query('select id from ab.finance_items where id=$1',[unused.id])).rowCount,0);
  assert.equal((await f.admin.query('select invoice_id from ab.finance_invoice_links where item_id=$1',[used.id])).rowCount,1);
 }finally{await f.close();}
});

test('catalogue fee thresholds are independent of fees and use month-end allocated balances',async()=>{
 const f=await businessCentersFixture();
 try{
  const now=today(),[year,month]=now.split('-').map(Number);
  const next=new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
  const later=new Date(Date.UTC(year,month+1,1)).toISOString().slice(0,10);
  const config={companyId:f.co1,incomeAccountId:f.accounts.income.id,effectiveOn:now,amount:'50',
   configured:true,enabled:true,revision:0};
  const setup={recurrence:'monthly',recurringAmount:'300',dueDateBasis:'specific'};
  const create=(condition:string,threshold?:string)=>newItem(f,{...setup,monthlyFollowup:{...config,condition,threshold}});
  await assert.rejects(create('double_monthly_due'));
  await approve(f,['monthly-followup']);
  const doubled=await create('double_monthly_due'),limit=await create('above_limit','500'),over=await create('above_limit','500'),partial=await create('above_limit','500');
  await f.bill('600',doubled.id);
  await f.bill('500',limit.id);
  await f.bill('501',over.id);
  const paid=await f.bill('550',partial.id);
  await f.collection('51',{receivedOn:now,targetInvoiceId:paid.id,overridePriority:true,reason:'Synthetic threshold allocation',items:[{itemId:partial.id,amount:'51'}]});
  const cipher=security(f.secret.key);
  const close=(when:string)=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>
   runAdministrativeFees(c,cipher,await model(c,f.org.user,cipher),{tenant_id:f.org.tenant,user_id:f.org.user},f.co1,when));
  for(const month of [next,later]){
   assert.equal((await close(month)).issued,2);
   assert.equal((await close(month)).issued,0);
  }
  const invoices=(await f.admin.query("select source_key from ab.finance_invoice_links where source_key like 'monthly-followup:%'")).rows;
  assert.equal(invoices.length,4);
  assert.equal(invoices.filter(r=>r.source_key.includes(doubled.id)).length,2);
  assert.equal(invoices.filter(r=>r.source_key.includes(over.id)).length,2);
 }finally{await f.close();}
});

test('accounting imports retain legacy invoice mapping and use the original receipt, voucher and deposit workflows',async()=>{
 const f=await businessCentersFixture();
 try{
    const {unzipSync,zipSync,strFromU8,strToU8}=await import('fflate');
    const now=today(),bank=await f.bank(),proof=await f.proof(),otherBank=await f.bank(f.co2);
    const customer=(await f.admin.query('select file_number from ab.customers where id=$1',[f.client])).rows[0].file_number;
    const payload=(csv:string)=>({companyId:f.co1,format:'csv',name:'synthetic.csv',base64:Buffer.from(csv).toString('base64')});
    const upload=(type:string,csv:string)=>f.req('POST','/api/ledger/accounting-imports',{type,...payload(csv)});
    const commit=(id:string,companyId=f.co1,status=200)=>f.req('POST','/api/ledger/accounting-imports/'+id+'/commit',{companyId},status);
    const template=(type:string,format:string)=>f.req('GET','/api/ledger/accounting-imports/template?companyId='+f.co1+'&type='+type+'&format='+format);
    const columns:Record<string,string>={};
    for(const type of ['invoice','receipt','voucher','deposit']){
        const csv=await template(type,'csv'),xlsx=await template(type,'xlsx');
        columns[type]=Buffer.from(csv.base64,'base64').toString().trim();
        assert.match(columns[type],/^sourceKey,/);
        const archive=unzipSync(Buffer.from(xlsx.base64,'base64'));
        assert.match(strFromU8(archive['xl/worksheets/sheet1.xml']),/sourceKey/);
    }
    const existing=await f.req('POST','/api/ledger/invoice-imports',{...payload('ref,file,code,total,ccy,due\nINV-300,'+customer+',salik,300,AED,'+now),
        mapping:{sourceKey:'ref',customerNumber:'file',itemCode:'code',amount:'total',currency:'ccy',dueOn:'due'}});
    assert.equal(existing.rows[0].error,'');
    const invoice=(await f.req('POST','/api/ledger/invoice-imports/'+existing.id+'/commit',{})).created[0];
    const receipts=columns.receipt+'\nRC-ORIGINAL,'+customer+',INV-300,salik,200,AED,'+now;
    const receipt=await upload('receipt',receipts+'\n'+receipts.split('\n')[1]+'\nBAD,'+customer+',INVALID,salik,2,AED,'+now);
    assert.deepEqual(receipt.rows.map((r:any)=>r.error),[undefined,'duplicate','unmatchedInvoice']);
    assert.equal((await f.admin.query('select count(*)::int n from ab.finance_receipts where customer_id=$1',[f.client])).rows[0].n,0);
    await commit(receipt.id,f.co2,404);
    const importer=await f.employee();
    await f.req('POST','/api/users/'+importer.id+'/grants',{action:'ledger_invoice_import',scope:{type:'company',id:f.co1},delegable:false});
    await f.login(importer.username,importer.password);
    await commit(receipt.id,f.co1,403);
    await f.login(f.username,f.password);
    const imported=await commit(receipt.id);
    assert.equal(imported.created.length,1);
    assert.deepEqual(await commit(receipt.id),imported);
    const reupload=await upload('receipt',receipts+'\n'+receipts.split('\n')[1]+'\nBAD,'+customer+',INVALID,salik,2,AED,'+now);
    assert.equal(reupload.completed,true);
    assert.equal(reupload.rows[0].error,'duplicate');

    const voucher=await template('voucher','xlsx');
    const archive=unzipSync(Buffer.from(voucher.base64,'base64'));
    const row=['PV-ORIGINAL','Synthetic beneficiary','','expense','25','AED',now,'Synthetic payable'];
    const cells=row.map((value,index)=>'<c r="'+String.fromCharCode(65+index)+'2" t="inlineStr"><is><t>'+value+'</t></is></c>').join('');
    archive['xl/worksheets/sheet1.xml']=strToU8(strFromU8(archive['xl/worksheets/sheet1.xml']).replace('</sheetData>','<row r="2">'+cells+'</row></sheetData>'));
    const payment=await f.req('POST','/api/ledger/accounting-imports',{companyId:f.co1,type:'voucher',
        name:'synthetic.xlsx',format:'xlsx',base64:Buffer.from(zipSync(archive)).toString('base64')});
    assert.equal(payment.rows[0].error,undefined);
    const pending=(await commit(payment.id)).created[0];
    assert.equal(pending.status,'Pending');
    assert.equal((await f.admin.query('select status from ab.finance_vouchers where id=$1',[pending.ids[0]])).rows[0].status,'Pending');

    const wrong='BAD-DEPOSIT,'+otherBank.id+',RC-ORIGINAL,'+proof+',200,AED,'+now;
    const good='DEP-ORIGINAL,'+bank.id+',RC-ORIGINAL,'+proof+',200,AED,'+now;
    const deposits=await upload('deposit',columns.deposit+'\n'+wrong+'\n'+good);
    assert.deepEqual(deposits.rows.map((r:any)=>r.error),['inactiveBank',undefined]);
    const deposit=(await commit(deposits.id)).created[0];
    assert.equal(deposit.status,'Review');
    const confirmation={confirmedAmount:'200',bankConfirmation:'Synthetic verified deposit',effectiveOn:now,accountAndDateVerified:true};
    await f.req('POST','/api/ledger/deposits/'+deposit.ids[0]+'/confirm',confirmation);
    await f.req('POST','/api/ledger/deposits/'+deposit.ids[0]+'/confirm',confirmation,409);
    const totals=(await f.admin.query(`select
        (select sum(amount)::text from ab.vehicle_allocations where invoice_id=$1) allocated,
        (select sum(amount)::text from ab.finance_receipts where customer_id=$2 and payment_state='Cleared') collected,
        (select sum(amount)::text from ab.finance_custody_moves where receipt_id=$3) held`,[invoice.id,f.client,imported.created[0].ids[0]])).rows[0];
    assert.deepEqual(totals,{allocated:'200.000',collected:'200.000',held:'0.000'});
    assert.equal(300-Number(totals.allocated),100);
    const report=await f.req('GET','/api/ledger/reports?companies='+f.co1+'&from='+now+'&to='+now+'&kind=collections');
    assert.deepEqual(report.rows.map((row:any)=>row.amount),['200.000']);

    const cash=()=>f.collection('30',{receivedOn:now,targetInvoiceId:invoice.id,items:[{itemId:f.items.salik,amount:'30'}]});
    const first=(await cash()).receipts[0],second=(await cash()).receipts[0];
    const ordinary=await f.req('POST','/api/ledger/deposits',{companyId:f.co1,bankAccountId:bank.id,
        currency:'AED',amount:'30',effectiveOn:now,documentVersionId:proof,reference:'DEP-ORDINARY'});
    const reserved=await upload('deposit',columns.deposit+'\nDEP-LINKED,'+bank.id+','+first.id+','+proof+',30,AED,'+now);
    assert.equal(reserved.rows[0].error,undefined);
    const linked=(await commit(reserved.id)).created[0];
    await f.req('POST','/api/ledger/deposits/'+ordinary.id+'/confirm',{...confirmation,confirmedAmount:'30'});
    await f.req('POST','/api/ledger/deposits/'+linked.ids[0]+'/confirm',{...confirmation,confirmedAmount:'30'});
    const moved=async(depositId:string)=>(await f.admin.query('select receipt_id from ab.finance_custody_moves where source_key like $1',
        ['deposit:'+depositId+':out:%'])).rows.map(r=>r.receipt_id);
    assert.deepEqual(await moved(ordinary.id),[second.id]);
    assert.deepEqual(await moved(linked.ids[0]),[first.id]);
 }finally{await f.close();}
});
