import { readFile } from 'node:fs/promises';
import { vehicleFixture } from './vehicle-fixture.js';
export async function ledgerFixture() {
    const f = await vehicleFixture();
    await f.admin.query(await readFile('supabase/proposed/012_financial_management.sql', 'utf8'));
    const date = '2026-01-05', accounts: any = {};
    for (const [code, kind] of [['ar', 'asset'], ['income', 'income'], ['expense', 'expense'], ['payable', 'liability'], ['custody', 'asset'], ['cheques', 'asset'], ['credit', 'liability'], ['equity', 'equity'], ['cash', 'asset'], ['petty', 'asset'], ['work', 'liability'], ['duefrom', 'asset'], ['dueto', 'liability']]) {
        const a = await f.req('POST', '/api/ledger/accounts', { code, nameAr: 'حساب اختبار ' + code, nameEn: 'Synthetic ' + code, kind, companyIds: [f.co1, f.co2], currency: 'AED', eliminate: code.startsWith('due') });
        accounts[code] = { id: a.id, charts: Object.fromEntries(a.charts.map((x: any) => [x.companyId, x.id])) };
    }
    for (const co of [f.co1, f.co2])
        await f.req('POST', '/api/ledger/configuration', { companyId: co, currency: 'AED', custodyAccountId: accounts.custody.charts[co], chequeTransitAccountId: accounts.cheques.charts[co], customerCreditAccountId: accounts.credit.charts[co], workdays: [1, 2, 3, 4, 5], holidays: [], depositDays: 1 });
    const items: any = {};
    for (const [code, priority] of [['loan', 1], ['salik', 2], ['expense', 3], ['work_amount', 4], ['commission', 5], ['card', 6], ['intercompany', 7]] as const) {
        items[code] = (await f.req('POST', '/api/ledger/items', { code, nameAr: 'بند اختبار ' + code, nameEn: 'Synthetic ' + code, category: code, priority, companyIds: [f.co1, f.co2], invoice: true, receipt: true, payment: true, methods: ['manual', 'automatic', 'bulk'], receivableId: accounts.ar.id, revenueId: code === 'work_amount' ? accounts.work.id : accounts.income.id, expenseId: code === 'work_amount' ? accounts.work.id : accounts.expense.id, payableId: code === 'work_amount' ? accounts.work.id : accounts.payable.id })).id;
    }
    const bill = (amount = '1000', itemId = items.loan, patch: any = {}) => f.req('POST', '/api/ledger/invoices', { companyId: f.co1, customerId: f.client, itemId, amount, currency: 'AED', issuedOn: date, dueOn: date, sourceKey: crypto.randomUUID(), ...patch });
    const collection = (amount = '600', patch: any = {}, status = 200) => f.req('POST', '/api/ledger/collections', { companyId: f.co1, customerId: f.client, currency: 'AED', receivedOn: date, method: 'cash', mode: 'manual', amount, items: [{ itemId: items.loan, amount }], ...patch }, status);
    async function bank(co = f.co1) { const b = await f.req('POST', '/api/bank-accounts', { companyId: co, bankId: 'demo-bank', branch: 'Synthetic', accountName: 'Test', accountNumber: crypto.randomUUID(), iban: co === f.co1 ? 'AE070331234567890123456' : 'GB82WEST12345698765432', swift: '', openedAt: '2025-01-01', status: 'Active', purposeId: 'operations', openingBalance: '0', currency: 'AED', notes: '' }); const a = await f.req('POST', '/api/ledger/accounts', { code: 'bank' + crypto.randomUUID().slice(0, 8), nameAr: 'بنك وهمي', nameEn: 'Synthetic bank', kind: 'asset', companyIds: [co], currency: 'AED', bankAccountId: b.id }); return { id: b.id, chartId: a.charts[0].id }; }
    async function proof(co = f.co1) { return (await f.req('POST', '/api/documents', { companyId: co, category: 'other', title: 'Synthetic financial evidence', description: 'Fake fixture only', date, name: 'fixture.pdf', mime: 'application/pdf', base64: Buffer.from('%PDF-1.4 Synthetic fixture').toString('base64') })).versionId; }
    return { ...f, accounts, items, date, bill, collection, bank, proof };
}
