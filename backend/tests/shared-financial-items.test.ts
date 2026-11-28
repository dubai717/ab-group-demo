import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { ledgerFixture } from './ledger-fixture.js';

test('one group item is available to current and new companies, with separately approved accounting', async () => {
    const f = await ledgerFixture();
    try {
        const payload = {
            nameAr: 'رسم اختبار مشترك', nameEn: 'Synthetic shared fee', category: 'general',
            companyIds: [f.co1], invoice: true, receipt: true, payment: true, methods: ['manual', 'automatic'],
            recurrence: 'monthly', recurringAmount: '90',
            receivableId: f.accounts.ar.id, revenueId: f.accounts.income.id,
            expenseId: f.accounts.expense.id, payableId: f.accounts.payable.id
        };
        const shared = await f.req('POST', '/api/ledger/items', payload);
        const co3 = (await f.req('POST', '/api/companies', {
            arabicName: 'شركة اختبار جديدة', englishName: 'New synthetic company',
            tradeLicenseNumber: 'SHARED-ITEMS-NEW', status: 'Active'
        })).id;
        const book = (companyId: string) => f.req('GET', '/api/ledger/workbench?companyId=' + companyId);
        const find = async (companyId: string) => (await book(companyId)).finance_items.find((row: any) => row.id === shared.id);
        assert.equal((await find(f.co1)).mappingReady, true);
        for (const co of [f.co2, co3]) {
            const row = await find(co);
            assert.equal(row.mappingReady, false);
            assert.equal(row.details.receivableId, null);
            assert.deepEqual(row.details.companyIds, [co]);
            assert.equal(row.name_ar, payload.nameAr);
            assert.equal(row.name_en, payload.nameEn);
            assert.equal(row.details.recurrence, 'monthly');
        }
        const count = async (companyId: string) => (await f.admin.query(`select
            (select count(*)::int from ab.finance_invoice_links where company_id=$1 and item_id=$2) invoices,
            (select count(*)::int from ab.finance_vouchers where company_id=$1 and item_id=$2) vouchers,
            (select count(*)::int from ab.finance_journals where company_id=$1) journals`,
        [companyId, shared.id])).rows[0];
        const before = await count(f.co2);
        const beforeNew = await count(co3);
        const voucher = (companyId: string, status = 200) => f.req('POST', '/api/ledger/vouchers', {
            companyId, itemId: shared.id, amount: '10', currency: 'AED', issuedOn: f.date,
            beneficiary: 'Synthetic beneficiary', reason: 'Synthetic test', sourceKey: randomUUID()
        }, status);
        const invoice = (companyId: string, status = 200) => f.req('POST', '/api/ledger/invoices', {
            companyId, customerId: companyId === f.co1 ? f.client : f.client2, itemId: shared.id,
            amount: '90', currency: 'AED', issuedOn: f.date, dueOn: f.date, sourceKey: randomUUID()
        }, status);
        assert.equal((await invoice(f.co2, 409)).error, 'itemAccountingMappingPending');
        assert.equal((await voucher(f.co2, 409)).error, 'itemAccountingMappingPending');
        assert.equal((await voucher(co3, 409)).error, 'itemAccountingMappingPending');
        const first = await invoice(f.co1);
        assert.equal((await voucher(f.co1)).status, 'Pending');
        assert.deepEqual(await count(f.co2), before);
        assert.deepEqual(await count(co3), beforeNew);

        const altIncome = await f.req('POST', '/api/ledger/accounts', {
            code: 'shared-alt-income', nameAr: 'إيراد بديل', nameEn: 'Synthetic alternate income',
            kind: 'income', companyIds: [f.co2], currency: 'AED', eliminate: false
        });
        const approve = (companyId: string, revenueId: string, status = 200) => f.req('POST',
            '/api/ledger/items/' + shared.id + '/accounting-mapping', {
                companyId, currency: 'AED', confirm: true, receivableId: payload.receivableId,
                revenueId, expenseId: payload.expenseId, payableId: payload.payableId
            }, status);
        await approve(co3, altIncome.id, 409);
        await approve(f.co2, altIncome.id);
        assert.equal((await find(f.co2)).mappingReady, true);
        assert.equal((await f.req('POST','/api/ledger/recurring/run',{companyId:f.co2})).issued,0);
        assert.deepEqual(await count(f.co2),before);
        const second = await invoice(f.co2);
        const entries = (await f.admin.query(`select j.source_key,e.company_id,c.definition_id
            from ab.finance_journals j join ab.finance_entries e on e.journal_id=j.id
            join ab.finance_chart c on c.id=e.chart_id where j.source_key=any($1::text[])`,
        [['invoice:' + first.id, 'invoice:' + second.id]])).rows;
        assert(entries.some(row => row.source_key === 'invoice:' + first.id && row.company_id === f.co1 && row.definition_id === payload.revenueId));
        assert(entries.some(row => row.source_key === 'invoice:' + second.id && row.company_id === f.co2 && row.definition_id === altIncome.id));
        assert.equal(entries.length, 4);
        assert.deepEqual(await count(co3), beforeNew);
        assert.equal((await f.admin.query('select count(*)::int n from ab.finance_items where name_en=$1', [payload.nameEn])).rows[0].n, 1);
        await approve(f.co2, payload.revenueId, 409);

        const duplicate = await f.req('POST', '/api/ledger/items', {
            ...payload, companyIds: [f.co2], recurrence: 'none', recurringAmount: '0', payment: false
        });
        const review=(await book(f.co2)).itemDefinitionReview.find((row:any)=>row.nameEn===payload.nameEn);
        assert.equal(review.codes.length, 2);
        assert(review.differences.includes('recurrence'));
        assert(review.differences.includes('payment'));
        assert(review.differences.includes('revenueId'));
        const newCompanyReview=(await book(co3)).itemDefinitionReview.find((row:any)=>row.nameEn===payload.nameEn);
        assert(newCompanyReview.differences.includes('revenueId'));
        assert.deepEqual(newCompanyReview.codes,review.codes);
        assert.equal((await find(co3)).mappingReady,false);
        assert.notEqual(duplicate.id, shared.id);
        assert.equal((await f.admin.query('select item_id from ab.finance_invoice_links where invoice_id=$1',[first.id])).rows[0].item_id, shared.id);

        const staff=await f.employee();
        await f.req('POST','/api/users/'+staff.id+'/grants',{
            action:'ledger_view',scope:{type:'company',id:f.co1},delegable:false
        });
        await f.login(staff.username,staff.password);
        assert((await find(f.co1))?.mappingReady);
        await f.req('GET','/api/ledger/workbench?companyId='+f.co2,undefined,403);
        await approve(f.co1,payload.revenueId,403);
    } finally {
        await f.close();
    }
});
