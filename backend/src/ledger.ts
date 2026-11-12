import {contractingParty,contractingRight,exactFinancialParty} from './contracting-access.js';
import { assertInvestorPayoutEligible,notifyInvestorCheque } from './investors.js';
import {registerArgs,filterRegister,registerResponse} from './register-query.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createRequire } from 'node:module';
import { financialReminders, recurringFinancial } from './financial-jobs.js';
import { customerSpreadsheet } from './customer-spreadsheet.js';
const Csv = createRequire(import.meta.url)('../../customer-policy.js');
const normalize = (x: string) => x.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
import { ApiError, requireOk, sha } from './core.js';
import { financeRight } from './finance.js';
import { customerCan } from './customers.js';
import { number, today } from './vehicle-domain.js';
import {createFinancialVoucher} from './ledger-domain.js';
import { L, P, need, ready, company, open, event, notify, fact, config, chart, resolve, item, line, journal, post, reverse, evidence, balance, invoices, customer, invoice, linkInvoice, custody, move, moveAmount, bankPosting, allocateReceipt, postReceipt } from './ledger-domain.js';
const id = z.uuid(), day = z.iso.date(), money = z.string().regex(/^\d{1,15}(\.\d{1,3})?$/), positive = money.refine(x => L.units(x) > 0n), currency = z.string().regex(/^[A-Z]{3}$/), text = z.string().trim().min(1).max(2000), opt = id.nullish();
const invoiceSchema = z.object({ companyId: id, customerId: id.optional(), contractingCompanyId:id.optional(), vehicleId: opt, itemId: id, amount: positive, currency, issuedOn: day, dueOn: day, sourceKey: z.string().trim().min(1).max(160), description: z.string().max(2000).default('') }).strict().refine(exactFinancialParty,'financialPartyRequired');
export async function ledgerWorkbench(c:any,m:any,s:any,cipher:any,companyId:string){
        const co = id.parse(companyId);
        need(m, 'view', co);
        const tables = ['finance_accounts', 'finance_items', 'finance_chart', 'finance_funds', 'finance_vouchers', 'finance_deposits', 'finance_custody_transfers', 'finance_journals', 'finance_periods', 'finance_cards', 'finance_card_charges', 'finance_statements', 'finance_intercompany', 'finance_kpi_facts'];
        const out: any = { companyId: co, rights: L.rights.filter((r: string) => financeRight(m, r, co)), config: await config(c, cipher, co), banks: m.bank.list().filter((b: any) => b.companyId === co), users: m.state.users.filter((u: any) => u.status === 'Active').map((u: any) => ({ id: u.id, name: u.nameEn || u.fullName || u.username })), scope: 'posted ledger only; no inferred opening balances; currencies kept separate' };
        for (const tab of tables) {
            const global = ['finance_accounts', 'finance_items'].includes(tab);
            let rows = (await c.query('select * from ab.' + tab + (global ? '' : ' where company_id=$1') + ' order by created_at desc limit 20001', global ? [] : [co])).rows;
            requireOk(rows.length<=20000,422,'registerTooLarge');
            if (tab === 'finance_items')
                rows = rows.filter((r: any) => { const d = cipher.open(r.payload_cipher); return !d.companyIds?.length || d.companyIds.includes(co); });
            if (tab === 'finance_kpi_facts' && !financeRight(m, 'ledger_audit', co))
                rows = rows.filter((r: any) => r.employee_id === s.user_id);
            out[tab] = rows.map((r: any) => ({ ...r, ...(r.payload_cipher ? { details: cipher.open(r.payload_cipher) } : {}), payload_cipher: undefined }));
        }
        out.receipts = (await c.query('select id,receipt_number,customer_id,vehicle_id,item_id,kind,amount::text,currency,holder_id,payment_state,received_on,batch_id from ab.finance_receipts where company_id=$1 and item_id is not null order by created_at desc limit 20001', [co])).rows;
        out.custody = (await c.query('select m.holder_id,m.currency,r.kind,sum(m.amount)::text amount from ab.finance_custody_moves m join ab.finance_receipts r on r.id=m.receipt_id where m.company_id=$1 group by m.holder_id,m.currency,r.kind having sum(m.amount)<>0', [co])).rows.filter((r: any) => r.holder_id === s.user_id || financeRight(m, 'ledger_audit', co));
        for (const f of out.finance_funds) {
            f.balance = L.money(await balance(c, f.chart_id));
            f.refill = L.money(L.units(f.ceiling) - L.units(f.balance));
            f.needsRefill = L.units(f.balance) < L.units(f.threshold);
        }
        requireOk(out.receipts.length<=20000,422,'registerTooLarge');out.complete=true;return out;
}
export function registerLedger(app: any, call: any, cipher: any) {
    const route = (fn: any) => call(async (c: any, m: any, s: any, req: any) => {
        await ready(c);
        if (req.method !== 'GET')
            requireOk(!!req.headers['idempotency-key'], 422, 'idempotencyRequired');
        try {
            return await fn(c, m, s, req);
        }
        catch (e: any) {
            if (['invalidAmount', 'unbalanced', 'invalidCalendar', 'invalidDate'].includes(e.message))
                throw new ApiError(422, e.message);
            throw e;
        }
    });
    const companyIds = (m: any, right = 'view') => m.state.companies.filter((co: any) => financeRight(m, 'ledger_' + right, co.id)).map((co: any) => co.id);
    app.get('/api/ledger/capabilities', call(async (c: any, m: any) => ({ available: !!(await c.query("select to_regclass('ab.finance_journals') ok")).rows[0].ok, companies: m.state.companies.filter((co: any) => companyIds(m).includes(co.id)), rights: L.rights, ocr: false, bankFeed: false, whatsapp: false, cloudMigrationsAppliedByThisFeature: false })));
    app.get('/api/ledger/register-view',route(async(c:any,m:any,s:any,req:any)=>{const q=z.object({companyId:id,source:z.enum(['finance_accounts','finance_items','finance_chart','finance_funds','finance_vouchers','finance_deposits','finance_custody_transfers','finance_journals','finance_periods','finance_cards','finance_card_charges','finance_statements','finance_intercompany','finance_kpi_facts','receipts','custody','invoices']),columns:z.string().max(2000),...registerArgs,format:z.enum(['json','csv','excel','print']).default('json')}).strict().parse(req.query);need(m,'view',q.companyId);if(q.format!=='json'){need(m,'report',q.companyId);need(m,q.format==='print'?'print':'export',q.companyId);}const book=await ledgerWorkbench(c,m,s,cipher,q.companyId),rows=q.source==='invoices'?await invoices(c,{companyId:q.companyId}):book[q.source],fields=q.columns.split(',');requireOk(fields.length<=30&&fields.every(k=>/^[a-zA-Z_][a-zA-Z0-9_]{0,79}$/.test(k)&&!/(cipher|password|token)/i.test(k)&&(!rows.length||rows.some((r:any)=>Object.hasOwn(r,k)))),422,'invalidRegisterColumn');return registerResponse(rows,q,fields,q.source);}));
    app.get('/api/ledger/workbench',route(async(c:any,m:any,s:any,req:any)=>ledgerWorkbench(c,m,s,cipher,req.query.companyId)));
    app.get('/api/ledger/receipt-batches/:id', route(async (c: any, m: any, s: any, req: any) => { const r = (await c.query('select * from ab.finance_receipt_batches where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(r, 404, 'notFound'); need(m, 'view', r.company_id); return { id: r.id, chequeId: r.cheque_id, operationId: r.operation_id }; }));
    app.get('/api/ledger/card-charges/:id', route(async (c: any, m: any, s: any, req: any) => { const r = (await c.query('select * from ab.finance_card_charges where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(r, 404, 'notFound'); need(m, 'cards', r.company_id); const rows = (await c.query('select * from ab.finance_card_splits where charge_id=$1', [r.id])).rows.filter((x: any) => financeRight(m, 'ledger_view', x.company_id)); return { id: r.id, splits: rows }; }));
    app.get('/api/ledger/preferences', route(async (c: any, m: any, s: any) => { const r = (await c.query('select value from ab.settings where key=$1', ['ledger-prefs:' + s.user_id])).rows[0]; return r ? cipher.open(r.value.cipher) : {}; }));
    app.post('/api/ledger/preferences', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, tab: z.enum(['dashboard', 'invoices', 'collect', 'custody', 'deposits', 'vouchers', 'funds', 'cards', 'journals', 'reports', 'setup', 'import', 'closing', 'work', 'intercompany', 'reconciliation']), columns: z.array(z.string().max(60)).max(30).default([]) }).strict().parse(req.body); need(m, 'view', d.companyId); await c.query('insert into ab.settings values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value', [s.tenant_id, 'ledger-prefs:' + s.user_id, { cipher: cipher.seal(d) }]); return { saved: true }; }));
    app.post('/api/ledger/accounts', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ code: z.string().trim().min(1).max(30), nameAr: text, nameEn: text, kind: z.enum(['asset', 'liability', 'equity', 'income', 'expense']), parentId: opt, eliminate: z.boolean().default(false), cashFlow: z.enum(['operating', 'investing', 'financing']).nullish(), companyIds: z.array(id).min(1).max(100), currency, bankAccountId: opt }).strict().parse(req.body);
        for (const co of d.companyIds) {
            need(m, 'account_manage', co);
            company(m, co);
        }
        if (d.parentId)
            requireOk((await c.query('select 1 from ab.finance_accounts where id=$1', [d.parentId])).rowCount, 422, 'invalidReference');
        const key = randomUUID();
        await c.query('insert into ab.finance_accounts(id,tenant_id,code,name_ar,name_en,kind,parent_id,eliminate,cash_flow,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [key, s.tenant_id, d.code, d.nameAr, d.nameEn, d.kind, d.parentId, d.eliminate, d.cashFlow, s.user_id]);
        const charts = [];
        for (const co of [...new Set(d.companyIds)]) {
            let bankId = null;
            if (d.bankAccountId) {
                requireOk(d.companyIds.length === 1 && d.kind === 'asset', 422, 'invalidReference');
                const b = m.bank.list().find((b: any) => b.id === d.bankAccountId && b.companyId === co && b.currency === d.currency);
                requireOk(b, 422, 'invalidReference');
                bankId = b.id;
            }
            const old = bankId ? (await c.query('select * from ab.finance_chart where bank_account_id=$1', [bankId])).rows[0] : null;
            if (old) {
                requireOk(!old.definition_id, 409, 'duplicate');
                await c.query('update ab.finance_chart set definition_id=$2 where id=$1', [old.id, key]);
                charts.push({ companyId: co, id: old.id });
            }
            else {
                const chartId = randomUUID();
                await c.query('insert into ab.finance_chart(id,tenant_id,company_id,code,name_ar,name_en,kind,bank_account_id,currency,created_by,definition_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [chartId, s.tenant_id, co, d.code + ':' + d.currency, d.nameAr, d.nameEn, bankId ? 'bank' : d.kind, bankId, d.currency, s.user_id, key]);
                charts.push({ companyId: co, id: chartId });
            }
            await event(c, cipher, s, co, key, 'account_created', null, d);
        }
        return { id: key, charts };
    }));
    app.patch('/api/ledger/accounts/:id', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ nameAr: text, nameEn: text, active: z.boolean() }).strict().parse(req.body), r = (await c.query('select * from ab.finance_accounts where id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(r, 404, 'notFound');
        const cos = (await c.query('select distinct company_id from ab.finance_chart where definition_id=$1', [r.id])).rows;
        for (const co of cos)
            need(m, 'account_manage', co.company_id);
        requireOk(cos.length > 0);
        await c.query('update ab.finance_accounts set name_ar=$2,name_en=$3,active=$4 where id=$1', [r.id, d.nameAr, d.nameEn, d.active]);
        for (const co of cos)
            await event(c, cipher, s, co.company_id, r.id, 'account_updated', { nameAr: r.name_ar, nameEn: r.name_en, active: r.active }, d);
        return { id: r.id };
    }));
    const itemSchema = z.object({ code: z.string().trim().min(1).max(40), nameAr: text, nameEn: text, category: z.string().min(1).max(100), priority: z.number().int().min(0).max(10000), active: z.boolean().default(true), companyIds: z.array(id).min(1).max(100), invoice: z.boolean(), receipt: z.boolean(), payment: z.boolean(), methods: z.array(z.enum(['manual', 'automatic', 'bulk'])).min(1), receivableId: opt, revenueId: opt, expenseId: opt, payableId: opt, permission: z.enum(L.rights).optional(), recurrence: z.enum(['none', 'monthly', 'annual']).default('none'), annualMonth: z.number().int().min(0).max(12).default(0), recurrenceStart: day.optional(), recurringAmount: money.default('0'), taxAccountId: opt, taxRate: z.string().regex(/^\d{1,2}(\.\d{1,3})?$/).default('0') }).strict();
    async function validateItem(c: any, m: any, d: any) {
        for (const co of d.companyIds)
            need(m, 'item_manage', co);
        for (const k of ['receivableId', 'revenueId', 'expenseId', 'payableId', 'taxAccountId'])
            if (d[k])
                requireOk((await c.query('select 1 from ab.finance_accounts where id=$1 and active', [d[k]])).rowCount, 422, 'accountMappingRequired');
        requireOk(!d.invoice || d.receivableId && d.revenueId, 422, 'accountMappingRequired');
        requireOk(!d.payment || d.expenseId && d.payableId, 422, 'accountMappingRequired');
        requireOk(L.units(d.taxRate) === 0n || !!d.taxAccountId, 422, 'taxAccountRequired');
    }
    app.post('/api/ledger/items', route(async (c: any, m: any, s: any, req: any) => {
        const d = itemSchema.parse(req.body);
        await validateItem(c, m, d);
        const key = randomUUID();
        await c.query('insert into ab.finance_items(id,tenant_id,code,name_ar,name_en,category,priority,active,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [key, s.tenant_id, d.code, d.nameAr, d.nameEn, d.category, d.priority, d.active, cipher.seal(d), s.user_id]);
        for (const co of d.companyIds)
            await event(c, cipher, s, co, key, 'item_created', null, d);
        return { id: key };
    }));
    app.patch('/api/ledger/items/:id', route(async (c: any, m: any, s: any, req: any) => {
        const old = (await c.query('select * from ab.finance_items where id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(old, 404, 'notFound');
        const before = cipher.open(old.payload_cipher), d = itemSchema.parse(req.body);
        await validateItem(c, m, d);
        for (const co of before.companyIds)
            need(m, 'item_manage', co);
        if ((await c.query('select 1 from ab.finance_invoice_links where item_id=$1 union all select 1 from ab.finance_receipts where item_id=$1 union all select 1 from ab.finance_vouchers where item_id=$1 limit 1', [old.id])).rowCount)
            for (const k of ['receivableId', 'revenueId', 'expenseId', 'payableId', 'category', 'taxAccountId', 'taxRate'])
                requireOk((d as any)[k] === before[k], 409, 'usedItemMappingImmutable');
        await c.query('update ab.finance_items set code=$2,name_ar=$3,name_en=$4,category=$5,priority=$6,active=$7,payload_cipher=$8 where id=$1', [old.id, d.code, d.nameAr, d.nameEn, d.category, d.priority, d.active, cipher.seal(d)]);
        for (const co of d.companyIds)
            await event(c, cipher, s, co, old.id, 'item_updated', before, d);
        return { id: old.id };
    }));
    app.post('/api/ledger/configuration', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id, currency, custodyAccountId: id, chequeTransitAccountId: id, customerCreditAccountId: id, workdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]), holidays: z.array(day).max(400).default([]), depositDays: z.number().int().min(1).max(30).default(1), automaticFinanceJobs: z.boolean().default(false) }).strict().parse(req.body);
        need(m, 'configure', d.companyId);
        for (const key of ['custodyAccountId', 'chequeTransitAccountId', 'customerCreditAccountId'])
            await chart(c, d.companyId, d.currency, (d as any)[key], key === 'customerCreditAccountId' ? 'liability' : 'asset');
        if (d.automaticFinanceJobs)
            need(m, 'invoice_create', d.companyId);
        const before = await config(c, cipher, d.companyId);
        await c.query('insert into ab.settings values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value', [s.tenant_id, 'ledger:' + d.companyId, { cipher: cipher.seal(d) }]);
        await c.query('insert into ab.vehicle_billing_jobs(tenant_id,company_id,enabled,financial_enabled,financial_actor_id)values($1,$2,false,$3,$4)on conflict(tenant_id,company_id)do update set financial_enabled=excluded.financial_enabled,financial_actor_id=excluded.financial_actor_id', [s.tenant_id, d.companyId, d.automaticFinanceJobs, s.user_id]);
        await event(c, cipher, s, d.companyId, d.companyId, 'ledger_configured', before, d);
        return { saved: true };
    }));
    app.post('/api/ledger/invoices', route(async (c: any, m: any, s: any, req: any) => { const d = invoiceSchema.parse(req.body); need(m, 'invoice_create', d.companyId); return invoice(c, cipher, m, s, d); }));
    app.post('/api/ledger/invoices/adopt', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ invoiceId: id, itemId: id, issuedOn: day, confirmHistoricalClassification: z.literal(true) }).strict().parse(req.body), i = (await c.query('select * from ab.vehicle_invoices where id=$1', [d.invoiceId])).rows[0]; requireOk(i, 404, 'notFound'); need(m, 'invoice_create', i.company_id); need(m, 'journal_approve', i.company_id); requireOk(!(await c.query('select 1 from ab.vehicle_allocations where invoice_id=$1', [i.id])).rowCount && !(await c.query('select 1 from ab.vehicle_invoice_adjustments where invoice_id=$1', [i.id])).rowCount, 409, 'historicalAccountingReviewRequired'); const it = await item(c, cipher, m, d.itemId, i.company_id); await linkInvoice(c, cipher, m, s, i.id, it, d.issuedOn, 'vehicle:' + i.id); return { id: i.id }; }));
    app.get('/api/ledger/invoices', route(async (c: any, m: any, s: any, req: any) => {
        const q = z.object({ companyId: id, customerId: id.optional(), contractingCompanyId:id.optional(), vehicleId: id.optional(), currency: currency.optional() }).strict().parse(req.query);
        need(m, 'view', q.companyId);
        if (q.customerId)
            await customer(c, m, q.customerId, q.companyId, q.vehicleId);
        if(q.contractingCompanyId)await contractingParty(c,m,q.contractingCompanyId,q.companyId,false);
        const rows = (await invoices(c, q)).filter((r:any)=>!r.contracting_company_id||contractingRight(m,'view',q.companyId));
        requireOk(rows.length<=20000,422,'registerTooLarge');return {rows,truncated:false,complete:true};
    }));
    app.post('/api/ledger/invoices/:id/correct', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ amount: positive, reason: text, effectiveOn: day }).strict().parse(req.body), i = (await c.query('select i.*,l.item_id from ab.vehicle_invoices i join ab.finance_invoice_links l on l.invoice_id=i.id where i.id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(i, 404, 'notFound');
        need(m, 'invoice_correct', i.company_id);
        const b = (await invoices(c, { companyId: i.company_id })).find((x: any) => x.id === i.id);
        requireOk(L.units(d.amount) <= L.units(b.outstanding), 422, 'amountMismatch');
        await open(c, i.company_id, d.effectiveOn);
        const it = await item(c, cipher, m, i.item_id, i.company_id, true), ar = await resolve(c, i.company_id, i.currency, it.data.receivableId), income = await resolve(c, i.company_id, i.currency, it.data.revenueId), key = randomUUID();
        await c.query("insert into ab.vehicle_invoice_adjustments(id,tenant_id,company_id,invoice_id,kind,amount,payload_cipher,created_by)values($1,$2,$3,$4,'waiver',$5,$6,$7)", [key, s.tenant_id, i.company_id, i.id, d.amount, cipher.seal(d), s.user_id]);
        const rate = L.units(it.data.taxRate || '0'), originalTax = rate ? (L.units(i.amount) * rate + (100000n + rate) / 2n) / (100000n + rate) : 0n;
        const previous = (await c.query("select a.amount,j.payload_cipher from ab.vehicle_invoice_adjustments a left join ab.finance_journals j on j.source_key='credit:'||a.id::text and j.company_id=a.company_id and j.status='Posted'where a.invoice_id=$1 and a.id<>$2 and a.kind<>'writeoff'", [i.id, key])).rows;
        requireOk(previous.every((r: any) => !!r.payload_cipher), 409, 'priorAdjustmentAccountingReviewRequired');
        const creditedGross = previous.reduce((n: bigint, r: any) => n + L.units(r.amount), 0n), creditedTax = previous.reduce((n: bigint, r: any) => n + L.units(cipher.open(r.payload_cipher).taxAmount || '0'), 0n), tax = L.taxPortion(L.units(i.amount), originalTax, creditedGross, creditedTax, L.units(d.amount)), lines = [line(ar, -L.units(d.amount)), ...(L.units(d.amount) > tax ? [line(income, L.units(d.amount) - tax)] : [])];
        if (tax)
            lines.push(line(await resolve(c, i.company_id, i.currency, it.data.taxAccountId), tax));
        await journal(c, cipher, s, i.company_id, d.effectiveOn, i.currency, 'credit:' + key, lines, { invoiceId: i.id, taxAmount: L.money(tax), ...d });
        return { id: key };
    }));
    const collection = z.object({ targetInvoiceId:id.optional(),companyId: id, customerId: id.optional(), contractingCompanyId:id.optional(), vehicleId: opt, currency, receivedOn: day, method: z.enum(['cash', 'cheque', 'transfer']), mode: z.enum(['manual', 'automatic']), amount: positive, items: z.array(z.object({ itemId: id, amount: positive }).strict()).max(100).default([]), overridePriority: z.boolean().default(false), reason: z.string().max(2000).default(''), operationId: opt, cheque: z.object({ number: text, bankAccountId: id, beneficiary: text, issuedOn: day, dueOn: day }).strict().optional() }).strict().refine(exactFinancialParty,'financialPartyRequired');
    async function collect(c: any, m: any, s: any, d: any) {
        need(m, 'collect', d.companyId);
        company(m, d.companyId);
        if(d.contractingCompanyId)await contractingParty(c,m,d.contractingCompanyId,d.companyId);else await customer(c, m, d.customerId, d.companyId, d.vehicleId);
        await open(c, d.companyId, d.receivedOn);
        let selected = d.items;
        const due = (await invoices(c, d)).filter((i: any) => i.vehicle_id === (d.vehicleId || null));
        if(d.contractingCompanyId&&!d.targetInvoiceId){const rows=(await c.query('select payload_cipher from ab.vehicle_invoices where contracting_company_id=$1 and company_id=$2',[d.contractingCompanyId,d.companyId])).rows;requireOk(!rows.some((v:any)=>cipher.open(v.payload_cipher).contractVehicleId),422,'vehicleInvoiceSelectionRequired');}
        if(d.targetInvoiceId){const chosen=due.find((i:any)=>i.id===d.targetInvoiceId);requireOk(d.contractingCompanyId&&d.mode==='manual'&&chosen&&L.units(d.amount)<=L.units(chosen.outstanding)&&d.items.length===1&&d.items[0].itemId===chosen.item_id,422,'invalidTargetInvoice');}
        requireOk(!due.some((i: any) => L.units(i.written_off) > 0n && L.units(i.outstanding) > 0n), 409, 'writeoffRecoveryAccountingReviewRequired');
        if (d.mode === 'automatic') {
            const auto = L.distribute(d.amount, due.filter((r: any) => r.vehicle_id === (d.vehicleId || null)).map((r: any) => ({ id: r.id, itemId: r.item_id, priority: r.priority, dueOn: r.dueOn, outstanding: r.outstanding }))), by: any = {};
            for (const a of auto.allocations)
                by[a.itemId] = (by[a.itemId] || 0n) + L.units(a.amount);
            if (L.units(auto.excess) > 0n) {
                requireOk(d.items.length === 1, 422, 'excessItemRequired');
                by[d.items[0].itemId] = (by[d.items[0].itemId] || 0n) + L.units(auto.excess);
            }
            selected = Object.entries(by).map(([itemId, amount]) => ({ itemId, amount: L.money(amount as bigint) }));
        }
        requireOk(selected.length > 0 && new Set(selected.map((x: any) => x.itemId)).size === selected.length && selected.reduce((n: bigint, x: any) => n + L.units(x.amount), 0n) === L.units(d.amount), 422, 'amountMismatch');
        if (d.mode === 'manual') {
            const chosen = new Map<string, bigint>(selected.map((x: any) => [x.itemId, L.units(x.amount)]));
            const ordered = [...new Set<string>(due.filter((x: any) => L.units(x.outstanding) > 0n).map((x: any) => x.item_id))];
            let skipped = false, violation = false;
            for (const k of ordered) {
                const wanted = chosen.get(k) || 0n, owed = due.filter((x: any) => x.item_id === k).reduce((n: bigint, x: any) => n + L.units(x.outstanding), 0n);
                if (skipped && wanted > 0n)
                    violation = true;
                if (wanted < owed)
                    skipped = true;
            }
            if (violation) {
                requireOk(d.overridePriority && d.reason.trim(), 403, 'priorityOverrideRequired');
                need(m, 'collection_override', d.companyId);
            }
        }
        const batchId = randomUUID();
        let chequeId = null, transfer: any = null;
        if (d.method === 'cheque') {
            requireOk(d.cheque && !d.operationId, 422, 'invalidReference');
            const b = m.bank.list().find((b: any) => b.id === d.cheque.bankAccountId && b.companyId === d.companyId && b.currency === d.currency && b.status === 'Active');
            requireOk(b && d.cheque.dueOn >= d.cheque.issuedOn, 422, 'invalidReference');
            chequeId = randomUUID();
            await c.query("insert into ab.finance_cheques(id,tenant_id,company_id,bank_account_id,direction,number,beneficiary,amount,currency,issued_on,due_on,status,integration_refs,created_by)values($1,$2,$3,$4,'incoming',$5,$6,$7,$8,$9,$10,'Received',$11,$12)", [chequeId, s.tenant_id, d.companyId, b.id, d.cheque.number, d.cheque.beneficiary, d.amount, d.currency, d.cheque.issuedOn, d.cheque.dueOn, { ...(d.customerId?{clientReference:d.customerId}:{contractingReference:d.contractingCompanyId}), vehicleReference: d.vehicleId || '', receiptBatch: batchId }, s.user_id]);
        }
        else
            requireOk(!d.cheque, 422, 'invalidReference');
        if (d.method === 'transfer') {
            transfer = (await c.query('select * from ab.finance_operations where id=$1', [d.operationId])).rows[0];
            requireOk(transfer && transfer.status === 'Approved' && transfer.kind === 'receipt' && !transfer.cheque_id && transfer.company_id === d.companyId && transfer.currency === d.currency && L.units(transfer.amount) === L.units(d.amount) && (d.contractingCompanyId?transfer.integration_refs.contractingReference===d.contractingCompanyId&&!transfer.integration_refs.clientReference:transfer.integration_refs.clientReference===d.customerId&&!transfer.integration_refs.contractingReference) && (transfer.integration_refs.vehicleReference || null) === (d.vehicleId || null), 422, 'invalidReference');
            requireOk(!(await c.query('select 1 from ab.vehicle_allocations where operation_id=$1', [transfer.id])).rowCount, 409, 'duplicate');
        }
        else
            requireOk(!d.operationId, 422, 'invalidReference');
        const corporateColumn=d.contractingCompanyId?',contracting_company_id':'';
        await c.query('insert into ab.finance_receipt_batches(id,tenant_id,company_id,customer_id,vehicle_id,method,currency,amount,received_on,cheque_id,operation_id,payload_cipher,created_by'+corporateColumn+')values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13'+(d.contractingCompanyId?',$14':'')+')', [batchId, s.tenant_id, d.companyId, d.customerId, d.vehicleId || null, d.method, d.currency, d.amount, d.receivedOn, chequeId, transfer?.id || null, cipher.seal(d), s.user_id,...(d.contractingCompanyId?[d.contractingCompanyId]:[])]);
        const result = [];
        for (const selectedItem of selected) {
            const it = await item(c, cipher, m, selectedItem.itemId, d.companyId);
            requireOk(it.data.receipt, 403, 'denied');
            const key = randomUUID(), n = await number(c, s.tenant_id, 'receipt'), state = d.method === 'cheque' ? 'Pending' : 'Cleared';
            await c.query('insert into ab.finance_receipts(id,tenant_id,company_id,holder_id,amount,currency,kind,cheque_id,reference,created_by,item_id,batch_id,customer_id,vehicle_id,receipt_number,received_on,payment_state,payload_cipher'+corporateColumn+')values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18'+(d.contractingCompanyId?',$19':'')+')', [key, s.tenant_id, d.companyId, s.user_id, selectedItem.amount, d.currency, d.method, chequeId, 'RC-' + n, s.user_id, it.id, batchId, d.customerId, d.vehicleId || null, n, d.receivedOn, state, cipher.seal({ override: d.overridePriority, reason: d.reason,...(d.targetInvoiceId?{targetInvoiceId:d.targetInvoiceId}:{}) }),...(d.contractingCompanyId?[d.contractingCompanyId]:[])]);
            const r = (await c.query('select * from ab.finance_receipts where id=$1', [key])).rows[0];
            if (d.method === 'cheque')
                await move(c, s, d.companyId, key, s.user_id, d.currency, L.units(r.amount), 'physical-cheque:' + key, d.receivedOn);
            if (d.method === 'cash') {
                await postReceipt(c, cipher, m, s, r, 'cash', d.receivedOn);
                await move(c, s, d.companyId, key, s.user_id, d.currency, L.units(r.amount), 'collect:' + key, d.receivedOn);
            }
            if (d.method === 'transfer') { // The approved bank operation already owns its ONE journal. Allocate without reposting.
                const allocated = await allocateReceipt(c, s, r, cipher);
                const itar = await resolve(c, d.companyId, d.currency, it.data.receivableId);
                requireOk(transfer.counterpart_id === itar.id, 422, 'transferCounterpartMismatch');
                if (allocated) {
                    const cfg = await config(c, cipher, d.companyId);
                    await journal(c, cipher, s, d.companyId, d.receivedOn, d.currency, 'transfer-credit:' + r.id, [line(itar, allocated), line(await chart(c, d.companyId, d.currency, cfg.customerCreditAccountId, 'liability'), -allocated)], { receiptId: r.id, excess: L.money(allocated), bankReposted: false });
                }
            }
            result.push({ id: key, number: String(n), itemId: it.id, amount: selectedItem.amount, state });
            await fact(c, cipher, s, d.companyId, s.user_id, (state === 'Cleared' ? 'collection_confirmed' : 'collection_pending'), 'receipt:' + key, r.amount, { method: d.method, receiptId: key, receivedOn: d.receivedOn, confirmed: state === 'Cleared' });
        }
        await event(c, cipher, s, d.companyId, batchId, 'collection_created', null, { ...d, receipts: result });
        return { id: batchId, chequeId, receipts: result };
    }
    app.post('/api/ledger/collections', route(async (c: any, m: any, s: any, req: any) => collect(c, m, s, collection.parse(req.body))));
    app.post('/api/ledger/cheques/:id/resolve', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ outcome: z.enum(['Collected', 'Returned']), effectiveOn: day, bankConfirmation: text, reason: text }).strict().parse(req.body), ch = (await c.query('select * from ab.finance_cheques where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(ch && ch.direction === 'incoming', 422, 'invalidReference');
        need(m, 'cheques', ch.company_id);
        need(m, 'settle', ch.company_id);
        const batch = (await c.query('select * from ab.finance_receipt_batches where cheque_id=$1', [ch.id])).rows[0];
        requireOk(batch, 422, 'legacyChequeUseExistingWorkflow');
        const rows = (await c.query('select * from ab.finance_receipts where batch_id=$1', [batch.id])).rows;
        requireOk(ch.status !== 'Returned' && ch.status !== 'Cancelled' && (d.outcome === 'Returned' || ch.status !== 'Collected'), 409, 'invalidTransition');
        if (d.outcome === 'Collected') {
            for (const r of rows) {
                await fact(c, cipher, s, ch.company_id, r.created_by, 'collection_confirmed', 'receipt-cleared:' + r.id, r.amount, { method: 'cheque', confirmedOn: d.effectiveOn });
                await c.query("update ab.finance_receipts set payment_state='Cleared'where id=$1", [r.id]);
                await postReceipt(c, cipher, m, s, { ...r, payment_state: 'Cleared' }, 'cheque', d.effectiveOn);
            }
            const cfg = await config(c, cipher, ch.company_id), operationId = await bankPosting(c, cipher, m, s, { companyId: ch.company_id, bankAccountId: ch.bank_account_id, kind: 'receipt', amount: ch.amount, currency: ch.currency, effectiveOn: d.effectiveOn, counterpartId: cfg.chequeTransitAccountId, chequeId: ch.id, reference: 'clear:' + ch.id, reason: d.reason, integrationRefs: { ...(batch.contracting_company_id?{contractingReference:batch.contracting_company_id}:{clientReference:batch.customer_id}), vehicleReference: batch.vehicle_id || '', receiptBatch: batch.id } });
            await c.query('update ab.finance_receipts set deposit_operation_id=$1 where batch_id=$2', [operationId, batch.id]);
        }
        else {
            for (const r of rows) {
                if (r.payment_state === 'Cleared') {
                    await fact(c, cipher, s, ch.company_id, r.created_by, 'collection_reversed', 'receipt-returned:' + r.id, L.money(-L.units(r.amount)), { method: 'cheque', returnedOn: d.effectiveOn });
                    const applications = (await c.query("select cr.* from ab.finance_credit_applications x join ab.finance_receipts cr on cr.id=x.application_receipt_id where x.source_receipt_id=$1 and cr.payment_state='Cleared'", [r.id])).rows;
                    for (const app of applications) {
                        const j = (await c.query('select id from ab.finance_journals where source_key=$1', ['credit-application:' + app.id])).rows[0];
                        await reverse(c, cipher, s, j.id, d.effectiveOn, d.reason);
                        for (const a of (await c.query('select id from ab.vehicle_allocations where receipt_id=$1', [app.id])).rows)
                            await c.query('insert into ab.finance_allocation_reversals(id,tenant_id,company_id,allocation_id,reason,created_by)values($1,$2,$3,$4,$5,$6)', [randomUUID(), s.tenant_id, ch.company_id, a.id, d.reason, s.user_id]);
                        await c.query("update ab.finance_receipts set payment_state='Returned'where id=$1", [app.id]);
                    }
                    const j = (await c.query('select id from ab.finance_journals where source_key=$1', ['receipt:' + r.id])).rows[0];
                    await reverse(c, cipher, s, j.id, d.effectiveOn, d.reason);
                    const allocations = (await c.query('select id from ab.vehicle_allocations where receipt_id=$1', [r.id])).rows;
                    for (const a of allocations)
                        await c.query('insert into ab.finance_allocation_reversals(id,tenant_id,company_id,allocation_id,reason,created_by)values($1,$2,$3,$4,$5,$6)', [randomUUID(), s.tenant_id, ch.company_id, a.id, d.reason, s.user_id]);
                }
                await c.query("update ab.finance_receipts set payment_state='Returned'where id=$1", [r.id]);
            }
            if (ch.status === 'Collected') {
                const cfg = await config(c, cipher, ch.company_id);
                await bankPosting(c, cipher, m, s, { companyId: ch.company_id, bankAccountId: ch.bank_account_id, kind: 'payment', amount: ch.amount, currency: ch.currency, effectiveOn: d.effectiveOn, counterpartId: cfg.chequeTransitAccountId, reference: 'return:' + ch.id, reason: d.reason });
            }
            await notify(c, s, ch.company_id, ch.id, 'ledger:cheque_returned', 'return:' + ch.id);
        }
        for (const receipt of rows) {
            const held = (await c.query('select holder_id,sum(amount)::text amount from ab.finance_custody_moves where receipt_id=$1 group by holder_id having sum(amount)>0', [receipt.id])).rows;
            for (const h of held)
                await move(c, s, ch.company_id, receipt.id, h.holder_id, ch.currency, -L.units(h.amount), 'cheque-exit:' + ch.id + ':' + receipt.id + ':' + h.holder_id, d.effectiveOn);
        }
        await c.query('update ab.finance_cheques set status=$2,revision=revision+1 where id=$1', [ch.id, d.outcome]);
        await event(c, cipher, s, ch.company_id, ch.id, 'cheque_' + d.outcome, { status: ch.status }, d);
        return { id: ch.id, state: d.outcome };
    }));
    app.post('/api/ledger/custody/routes', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id, senderId: id, receiverId: id, effectiveOn: day, untilOn: day.nullish() }).strict().parse(req.body);
        need(m, 'configure', d.companyId);
        requireOk(d.senderId !== d.receiverId, 422, 'invalidReference');
        for (const uid of [d.senderId, d.receiverId])
            requireOk(m.state.users.some((u: any) => u.id === uid && u.status === 'Active'), 422, 'invalidReference');
        const key = randomUUID();
        await c.query('insert into ab.finance_custody_routes(id,tenant_id,company_id,sender_id,receiver_id,effective_on,until_on,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)', [key, s.tenant_id, d.companyId, d.senderId, d.receiverId, d.effectiveOn, d.untilOn, s.user_id]);
        await event(c, cipher, s, d.companyId, key, 'custody_route_created', null, d);
        return { id: key };
    }));
    app.post('/api/ledger/custody/handovers', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, receiverId: id, currency, amount: positive, kind: z.enum(['cash', 'cheque']).default('cash') }).strict().parse(req.body); need(m, 'hand_over', d.companyId); requireOk(d.receiverId !== s.user_id, 422, 'invalidReference'); const receiver = m.state.users.find((u: any) => u.id === d.receiverId && u.status === 'Active'); requireOk(receiver && financeRight({ ...m, actor: receiver }, 'ledger_receive', d.companyId), 403, 'denied'); const r = (await c.query('select receiver_id from ab.finance_custody_routes where company_id=$1 and sender_id=$2 and effective_on<=$3 and(until_on is null or until_on>=$3)order by effective_on desc,created_at desc limit 1', [d.companyId, s.user_id, today()])).rows[0]; requireOk(r?.receiver_id === d.receiverId, 403, 'custodyRouteRequired'); const available = (await custody(c, d.companyId, s.user_id, d.currency, undefined, 'kind' in d ? String(d.kind) : 'cash')).reduce((n: bigint, r: any) => n + L.units(r.amount), 0n); requireOk(available >= L.units(d.amount), 409, 'insufficientCustody'); requireOk(d.kind !== 'cheque' || available === L.units(d.amount), 422, 'wholeChequeCustodyRequired'); requireOk(!(await c.query("select 1 from ab.finance_custody_transfers where company_id=$1 and sender_id=$2 and currency=$3 and status='Pending'", [d.companyId, s.user_id, d.currency])).rowCount, 409, 'handoverPending'); const key = randomUUID(); await c.query('insert into ab.finance_custody_transfers(id,tenant_id,company_id,sender_id,receiver_id,currency,amount,payload_cipher,created_by,kind)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [key, s.tenant_id, d.companyId, s.user_id, d.receiverId, d.currency, d.amount, cipher.seal(d), s.user_id, d.kind]); await event(c, cipher, s, d.companyId, key, 'custody_handover_requested', null, d); return { id: key }; }));
    app.post('/api/ledger/custody/handovers/:id/receive', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ actual: money, reason: text }).strict().parse(req.body), h = (await c.query('select * from ab.finance_custody_transfers where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(h, 404, 'notFound');
        need(m, 'receive', h.company_id);
        requireOk(h.receiver_id === s.user_id, 403, 'receiverOnly');
        requireOk(h.status === 'Pending' && L.units(d.actual) <= L.units(h.amount), 409, 'invalidTransition');
        requireOk(h.kind !== 'cheque' || L.units(d.actual) === L.units(h.amount), 422, 'wholeChequeCustodyRequired');
        if (L.units(d.actual))
            await moveAmount(c, s, h.company_id, h.sender_id, h.currency, L.units(d.actual), 'handover:' + h.id, s.user_id, today(), h.kind);
        await c.query("update ab.finance_custody_transfers set status='Accepted',actual=$2,received_at=now()where id=$1", [h.id, d.actual]);
        const difference = L.units(h.amount) - L.units(d.actual);
        if (difference) {
            await fact(c, cipher, s, h.company_id, h.sender_id, 'short_collection_reported', 'short:' + h.id, L.money(difference), { verifiedLiability: false, reason: d.reason });
            await notify(c, s, h.company_id, h.id, 'ledger:short_collection', 'short:' + h.id);
        }
        await fact(c, cipher, s, h.company_id, h.sender_id, 'handover_confirmed', 'handover:' + h.id, d.actual, { requested: h.amount, createdAt: h.created_at, confirmedAt: new Date().toISOString() });
        await event(c, cipher, s, h.company_id, h.id, 'custody_received', { requested: h.amount }, d);
        return { id: h.id, transferred: d.actual, remaining: L.money(difference), salaryDeduction: false };
    }));
    app.post('/api/ledger/deposits', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, bankAccountId: id, currency, amount: positive, effectiveOn: day, documentVersionId: id, reference: text }).strict().parse(req.body); need(m, 'deposit', d.companyId); const b = m.bank.list().find((b: any) => b.id === d.bankAccountId && b.companyId === d.companyId && b.status === 'Active' && b.currency === d.currency); requireOk(b, 422, 'inactiveBank'); await evidence(c, m, d.companyId, d.documentVersionId, false); const available = (await custody(c, d.companyId, s.user_id, d.currency, undefined, 'kind' in d ? String(d.kind) : 'cash')).reduce((n: bigint, r: any) => n + L.units(r.amount), 0n); requireOk(available >= L.units(d.amount), 409, 'insufficientCustody'); const key = randomUUID(); await c.query('insert into ab.finance_deposits(id,tenant_id,company_id,holder_id,bank_account_id,currency,amount,effective_on,document_version_id,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [key, s.tenant_id, d.companyId, s.user_id, d.bankAccountId, d.currency, d.amount, d.effectiveOn, d.documentVersionId, cipher.seal(d), s.user_id]); await event(c, cipher, s, d.companyId, key, 'deposit_review_requested', null, d); return { id: key, status: 'Review', ocr: false, custodyClosed: '0.000' }; }));
    app.post('/api/ledger/deposits/:id/confirm', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ confirmedAmount: positive, bankConfirmation: text, effectiveOn: day, accountAndDateVerified: z.literal(true) }).strict().parse(req.body), r = (await c.query('select * from ab.finance_deposits where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(r, 404, 'notFound');
        need(m, 'deposit_verify', r.company_id);
        requireOk(r.status === 'Review' && L.units(d.confirmedAmount) <= L.units(r.amount), 409, 'invalidTransition');
        await evidence(c, m, r.company_id, r.document_version_id);
        const pending = (await c.query("select 1 from ab.finance_custody_transfers where company_id=$1 and sender_id=$2 and currency=$3 and status='Pending'", [r.company_id, r.holder_id, r.currency])).rowCount;
        requireOk(!pending, 409, 'handoverPending');
        await moveAmount(c, s, r.company_id, r.holder_id, r.currency, L.units(d.confirmedAmount), 'deposit:' + r.id, undefined, d.effectiveOn);
        const cfg = await config(c, cipher, r.company_id), operation = await bankPosting(c, cipher, m, s, { companyId: r.company_id, bankAccountId: r.bank_account_id, kind: 'receipt', amount: d.confirmedAmount, currency: r.currency, effectiveOn: d.effectiveOn, counterpartId: cfg.custodyAccountId, reference: 'deposit:' + r.id, reason: d.bankConfirmation });
        await c.query("update ab.finance_deposits set status='Confirmed',confirmed=$2,operation_id=$3,verified_by=$4 where id=$1", [r.id, d.confirmedAmount, operation, s.user_id]);
        await fact(c, cipher, s, r.company_id, r.holder_id, 'deposit_confirmed', 'deposit:' + r.id, d.confirmedAmount, { requested: r.amount, confirmedAt: new Date().toISOString(), manualBankVerification: true, finalStatementReconciliation: false });
        if (L.units(d.confirmedAmount) < L.units(r.amount))
            await notify(c, s, r.company_id, r.id, 'ledger:partial_deposit', 'partial:' + r.id);
        await event(c, cipher, s, r.company_id, r.id, 'deposit_confirmed', { status: r.status }, d);
        return { id: r.id, operationId: operation, remaining: L.money(L.units(r.amount) - L.units(d.confirmedAmount)), finalBankReconciled: false };
    }));
    const voucherSchema = z.object({ companyId: id, itemId: id, customerId: opt, amount: positive, currency, issuedOn: day, beneficiary: text, reason: text, sourceKey: z.string().min(1).max(160) }).strict();
    const voucher=(c:any,m:any,s:any,d:any,details:any={})=>createFinancialVoucher(c,cipher,m,s,d,details);
    app.post('/api/ledger/vouchers', route(async (c: any, m: any, s: any, req: any) => voucher(c, m, s, voucherSchema.parse(req.body))));
    app.post('/api/ledger/vouchers/:id/prepare', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ bankAccountId: id, chequeNumber: text, issuedOn: day, dueOn: day, documentVersionId: id }).strict().parse(req.body), r = (await c.query('select * from ab.finance_vouchers where id=$1 for update', [id.parse(req.params.id)])).rows[0]; requireOk(r, 404, 'notFound'); need(m, 'voucher_create', r.company_id); need(m, 'cheques', r.company_id); requireOk(r.status === 'Pending' && !r.cheque_id, 409, 'invalidTransition'); requireOk(d.dueOn >= d.issuedOn && d.issuedOn >= r.issued_on.toISOString().slice(0, 10), 422, 'invalidDate'); const b = m.bank.list().find((b: any) => b.id === d.bankAccountId && b.companyId === r.company_id && b.currency === r.currency && b.status === 'Active'); requireOk(b, 422, 'inactiveBank'); await evidence(c, m, r.company_id, d.documentVersionId, false); const ch = randomUUID(), details = cipher.open(r.payload_cipher); await c.query("insert into ab.finance_cheques(id,tenant_id,company_id,bank_account_id,direction,number,beneficiary,amount,currency,issued_on,due_on,status,integration_refs,document_version_id,created_by)values($1,$2,$3,$4,'outgoing',$5,$6,$7,$8,$9,$10,'Issued',$11,$12,$13)", [ch, s.tenant_id, r.company_id, b.id, d.chequeNumber, details.beneficiary, r.amount, r.currency, d.issuedOn, d.dueOn, { voucherId: r.id }, d.documentVersionId, s.user_id]); await c.query('update ab.finance_vouchers set bank_account_id=$2,cheque_id=$3,revision=revision+1 where id=$1', [r.id, b.id, ch]); await event(c, cipher, s, r.company_id, r.id, 'voucher_cheque_prepared', null, { ...d, chequeId: ch }); return { id: r.id, chequeId: ch }; }));
    app.post('/api/ledger/vouchers/approval-preview', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ ids: z.array(id).min(1).max(100), signedEvidence: z.literal(true) }).strict().parse(req.body), unique = [...new Set(d.ids)], rows = (await c.query('select * from ab.finance_vouchers where id=any($1::uuid[])order by id', [unique])).rows;
        requireOk(rows.length === unique.length, 422, 'invalidReference');
        const totals: any = {};
        for (const r of rows) {
            need(m, 'voucher_approve', r.company_id);
            if (rows.length > 1)
                need(m, 'voucher_batch', r.company_id);
            requireOk(r.status === 'Pending' && r.cheque_id, 409, 'voucherNotReady');
            const ch = (await c.query('select * from ab.finance_cheques where id=$1', [r.cheque_id])).rows[0];
            await evidence(c, m, r.company_id, ch.document_version_id);
            const k = r.company_id + ':' + r.currency;
            totals[k] = L.money(L.units(totals[k] || '0') + L.units(r.amount));
        }
        const key = randomUUID(), snapshot = rows.map((r: any) => ({ id: r.id, revision: r.revision, companyId: r.company_id, amount: r.amount, currency: r.currency, number: String(r.number), beneficiary: cipher.open(r.payload_cipher).beneficiary })), digest = sha(JSON.stringify(snapshot));
        await c.query("insert into ab.finance_approval_batches(id,tenant_id,actor_id,digest,payload_cipher,expires_at,created_by)values($1,$2,$3,$4,$5,now()+interval '10 minutes',$3)", [key, s.tenant_id, s.user_id, digest, cipher.seal(snapshot)]);
        return { id: key, count: rows.length, totals, vouchers: snapshot, digest };
    }));
    app.post('/api/ledger/vouchers/approval-confirm', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ batchId: id, digest: z.string().length(64), confirm: z.literal(true) }).strict().parse(req.body), b = (await c.query('select * from ab.finance_approval_batches where id=$1 for update', [d.batchId])).rows[0];
        requireOk(b && b.actor_id === s.user_id && !b.used_at && b.expires_at > new Date() && b.digest === d.digest, 409, 'approvalExpired');
        const snapshot = cipher.open(b.payload_cipher);
        for (const expected of snapshot) {
            const r = (await c.query('select * from ab.finance_vouchers where id=$1 for update', [expected.id])).rows[0];
            need(m, 'voucher_approve', r.company_id);
            if (snapshot.length > 1)
                need(m, 'voucher_batch', r.company_id);
            requireOk(r.status === 'Pending' && r.revision === expected.revision, 409, 'revisionConflict');
            await assertInvestorPayoutEligible(c,cipher,r.id);
            const ch = (await c.query('select * from ab.finance_cheques where id=$1', [r.cheque_id])).rows[0];
            await evidence(c, m, r.company_id, ch.document_version_id);
            const it = await item(c, cipher, m, r.item_id, r.company_id, true), details = cipher.open(r.payload_cipher), payable = details.payableOverrideId ? await chart(c, r.company_id, r.currency, details.payableOverrideId) : await resolve(c, r.company_id, r.currency, it.data.payableId);
            if (!details.alreadyAccrued) {
                const expense = details.expenseOverrideId ? await chart(c, r.company_id, r.currency, details.expenseOverrideId) : await resolve(c, r.company_id, r.currency, it.data.expenseId);
                await journal(c, cipher, s, r.company_id, r.issued_on.toISOString().slice(0, 10), r.currency, 'voucher:' + r.id, [line(expense, L.units(r.amount)), line(payable, -L.units(r.amount))], { voucherId: r.id, beneficiary: details.beneficiary });
            }
            await c.query("update ab.finance_vouchers set status='Approved',approved_by=$2,approved_at=now(),revision=revision+1 where id=$1", [r.id, s.user_id]);
            await event(c, cipher, s, r.company_id, r.id, 'voucher_approved', { status: r.status }, { status: 'Approved', bankCleared: false, signedEvidenceAttestation: true });
            await notifyInvestorCheque(c,s,r.id);
        }
        await c.query('update ab.finance_approval_batches set used_at=now()where id=$1', [b.id]);
        return { approved: snapshot.length, bankCleared: false };
    }));
    app.post('/api/ledger/vouchers/:id/settle', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ effectiveOn: day, bankConfirmation: text }).strict().parse(req.body), r = (await c.query('select * from ab.finance_vouchers where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(r, 404, 'notFound');
        need(m, 'settle', r.company_id);
        requireOk(r.status === 'Approved' && r.cheque_id && !r.operation_id, 409, 'invalidTransition');
        await assertInvestorPayoutEligible(c,cipher,r.id);
        requireOk(d.effectiveOn >= r.issued_on.toISOString().slice(0, 10), 422, 'invalidDate');
        const ch = (await c.query('select * from ab.finance_cheques where id=$1', [r.cheque_id])).rows[0];
        requireOk(!['Returned', 'Cancelled', 'Collected'].includes(ch.status), 409, 'invalidTransition');
        const it = await item(c, cipher, m, r.item_id, r.company_id, true), details = cipher.open(r.payload_cipher), payable = details.payableOverrideId ? await chart(c, r.company_id, r.currency, details.payableOverrideId) : await resolve(c, r.company_id, r.currency, it.data.payableId), operation = await bankPosting(c, cipher, m, s, { companyId: r.company_id, bankAccountId: r.bank_account_id, kind: 'payment', amount: r.amount, currency: r.currency, effectiveOn: d.effectiveOn, counterpartId: payable.id, chequeId: r.cheque_id, reference: 'voucher:' + r.id, reason: d.bankConfirmation, integrationRefs: { voucherId: r.id } });
        if (details.cardId && details.issuerCompanyId !== r.company_id) {
            need(m, 'settle', details.issuerCompanyId);
            await journal(c, cipher, s, details.issuerCompanyId, d.effectiveOn, r.currency, 'card-payment:' + r.id, [line(await chart(c, details.issuerCompanyId, r.currency, details.issuerLiabilityId), L.units(r.amount)), line(await chart(c, details.issuerCompanyId, r.currency, details.issuerDueFromAccountId), -L.units(r.amount))], { voucherId: r.id, intercompany: true });
        }
        await c.query("update ab.finance_cheques set status='Collected',revision=revision+1 where id=$1", [ch.id]);
        await c.query("update ab.finance_vouchers set status='Paid',operation_id=$2,revision=revision+1 where id=$1", [r.id, operation]);
        await event(c, cipher, s, r.company_id, r.id, 'voucher_bank_settled', { status: r.status }, { ...d, operationId: operation });
        return { id: r.id, operationId: operation };
    }));
    app.post('/api/ledger/vouchers/:id/cancel', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ reason: text, effectiveOn: day, bankStopConfirmed: z.boolean().default(false) }).strict().parse(req.body), r = (await c.query('select * from ab.finance_vouchers where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(r, 404, 'notFound');
        need(m, r.status === 'Pending' ? 'voucher_create' : 'voucher_cancel', r.company_id);
        requireOk(['Pending', 'Approved'].includes(r.status), 409, 'paidVoucherNeedsSeparateReversal');
        if (r.cheque_id) {
            const ch = (await c.query('select * from ab.finance_cheques where id=$1', [r.cheque_id])).rows[0];
            requireOk(!['Collected', 'Clearing', 'Deposited'].includes(ch.status) && d.bankStopConfirmed, 409, 'bankStopRequired');
            await c.query("update ab.finance_cheques set status='Cancelled',revision=revision+1 where id=$1", [ch.id]);
        }
        const j = (await c.query('select id from ab.finance_journals where source_key=$1', ['voucher:' + r.id])).rows[0];
        if (j)
            await reverse(c, cipher, s, j.id, d.effectiveOn, d.reason);
        await c.query("update ab.finance_vouchers set status='Cancelled',revision=revision+1 where id=$1", [r.id]);
        await event(c, cipher, s, r.company_id, r.id, 'voucher_cancelled', { status: r.status }, d);
        return { id: r.id };
    }));
    app.post('/api/ledger/work-amount', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ collection: collection, workItemId: id, workAmount: positive, dueOn: day, payoutReason: text, commission: z.object({ itemId: id, amount: positive }).strict().optional() }).strict().parse(req.body);
        requireOk(!d.collection.contractingCompanyId,422,'individualCustomerRequired');
        requireOk(d.collection.method === 'cheque' && d.collection.mode === 'manual', 422, 'workAmountRequiresCheque');
        need(m, 'invoice_create', d.collection.companyId);
        const work = await item(c, cipher, m, d.workItemId, d.collection.companyId), revenue = await resolve(c, d.collection.companyId, d.collection.currency, work.data.revenueId), expense = await resolve(c, d.collection.companyId, d.collection.currency, work.data.expenseId), payable = await resolve(c, d.collection.companyId, d.collection.currency, work.data.payableId);
        requireOk(work.category === 'work_amount' && revenue.kind === 'liability' && expense.id === payable.id && payable.id === revenue.id, 422, 'workAmountLiabilityMappingRequired');
        const selected = d.collection.items.filter((x: any) => x.itemId === d.workItemId);
        requireOk(selected.length === 1 && L.units(selected[0].amount) === L.units(d.workAmount), 422, 'amountMismatch');
        const source = 'work:' + req.headers['idempotency-key'], bill = await invoice(c, cipher, m, s, { companyId: d.collection.companyId, customerId: d.collection.customerId, vehicleId: d.collection.vehicleId, itemId: d.workItemId, amount: d.workAmount, currency: d.collection.currency, issuedOn: d.collection.receivedOn, dueOn: d.dueOn, sourceKey: source });
        if (d.commission) {
            requireOk(d.collection.items.some((x: any) => x.itemId === d.commission!.itemId && L.units(x.amount) === L.units(d.commission!.amount)), 422, 'amountMismatch');
            await invoice(c, cipher, m, s, { companyId: d.collection.companyId, customerId: d.collection.customerId, vehicleId: d.collection.vehicleId, itemId: d.commission!.itemId, amount: d.commission!.amount, currency: d.collection.currency, issuedOn: d.collection.receivedOn, dueOn: d.dueOn, sourceKey: source + ':commission' });
        }
        const receipts = await collect(c, m, s, d.collection), v = await voucher(c, m, s, { companyId: d.collection.companyId, itemId: d.workItemId, customerId: d.collection.customerId, amount: d.workAmount, currency: d.collection.currency, issuedOn: d.collection.receivedOn, sourceKey: source, reason: d.payoutReason, beneficiary: 'Customer ' + d.collection.customerId }, { alreadyAccrued: true, workInvoiceId: bill.id, receiptBatchId: receipts.id });
        await c.query('insert into ab.finance_work_amounts(id,tenant_id,company_id,customer_id,batch_id,invoice_id,voucher_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), s.tenant_id, d.collection.companyId, d.collection.customerId, receipts.id, bill.id, v.id, s.user_id]);
        return { invoiceId: bill.id, collection: receipts, voucher: v, bankCleared: false };
    }));
    app.post('/api/ledger/funds', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id, name: text, kind: z.enum(['cash', 'petty']), holderId: id, chartId: id, currency, ceiling: positive.default('1000'), threshold: money.default('200'), openingBalance: money.default('0'), openingEquityId: opt, effectiveOn: day }).strict().parse(req.body);
        need(m, 'fund_manage', d.companyId);
        requireOk(m.state.users.some((u: any) => u.id === d.holderId && u.status === 'Active'), 422, 'invalidReference');
        const account = await chart(c, d.companyId, d.currency, d.chartId, 'asset');
        requireOk(L.units(d.threshold) <= L.units(d.ceiling) && L.units(d.openingBalance) <= L.units(d.ceiling), 422, 'amountMismatch');
        const key = randomUUID();
        await c.query('insert into ab.finance_funds(id,tenant_id,company_id,name,kind,holder_id,chart_id,currency,ceiling,threshold,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [key, s.tenant_id, d.companyId, d.name, d.kind, d.holderId, d.chartId, d.currency, d.ceiling, d.threshold, s.user_id]);
        if (L.units(d.openingBalance)) {
            const equity = await chart(c, d.companyId, d.currency, d.openingEquityId!, 'equity');
            await journal(c, cipher, s, d.companyId, d.effectiveOn, d.currency, 'fund-opening:' + key, [line(account, L.units(d.openingBalance)), line(equity, -L.units(d.openingBalance))], { fundId: key, explicitOpening: true });
        }
        await event(c, cipher, s, d.companyId, key, 'fund_created', null, d);
        return { id: key };
    }));
    app.post('/api/ledger/funds/:id/spend', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ itemId: id, amount: positive, reason: text, effectiveOn: day, documentVersionId: opt }).strict().parse(req.body), f = (await c.query('select * from ab.finance_funds where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(f && f.active, 404, 'notFound');
        need(m, 'petty_spend', f.company_id);
        requireOk(f.holder_id === s.user_id || financeRight(m, 'ledger_fund_manage', f.company_id));
        const it = await item(c, cipher, m, d.itemId, f.company_id), cash = await chart(c, f.company_id, f.currency, f.chart_id, 'asset'), expense = await resolve(c, f.company_id, f.currency, it.data.expenseId);
        requireOk(it.data.payment && expense.kind === 'expense' && await balance(c, f.chart_id) >= L.units(d.amount), 422, 'insufficientFund');
        if (d.documentVersionId)
            await evidence(c, m, f.company_id, d.documentVersionId, false);
        const key = await journal(c, cipher, s, f.company_id, d.effectiveOn, f.currency, 'petty:' + req.headers['idempotency-key'], [line(expense, L.units(d.amount)), line(cash, -L.units(d.amount))], { fundId: f.id, ...d });
        const remaining = await balance(c, f.chart_id);
        if (remaining < L.units(f.threshold))
            await notify(c, s, f.company_id, f.id, 'ledger:refill', 'refill:' + key);
        return { id: key, balance: L.money(remaining), refill: L.money(L.units(f.ceiling) - remaining) };
    }));
    app.post('/api/ledger/funds/:id/refill', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ sourceFundId: id, amount: positive, effectiveOn: day, reason: text }).strict().parse(req.body), f = (await c.query('select * from ab.finance_funds where id=$1', [id.parse(req.params.id)])).rows[0], source = (await c.query('select * from ab.finance_funds where id=$1', [d.sourceFundId])).rows[0]; requireOk(f && source && source.id !== f.id && source.company_id === f.company_id && source.currency === f.currency, 422, 'invalidReference'); need(m, 'fund_manage', f.company_id); const remaining = await balance(c, f.chart_id), available = await balance(c, source.chart_id); requireOk(L.units(d.amount) === L.units(f.ceiling) - remaining && available >= L.units(d.amount), 422, 'amountMismatch'); return { id: await journal(c, cipher, s, f.company_id, d.effectiveOn, f.currency, 'refill:' + req.headers['idempotency-key'], [line(await chart(c, f.company_id, f.currency, f.chart_id), L.units(d.amount)), line(await chart(c, f.company_id, f.currency, source.chart_id), -L.units(d.amount))], { ...d, fundId: f.id, expense: false }) }; }));
    app.post('/api/ledger/journals', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, currency, effectiveOn: day, reason: text, lines: z.array(z.object({ chartId: id, debit: money, credit: money }).strict()).min(2).max(100) }).strict().parse(req.body); need(m, 'journal_create', d.companyId); return { id: await journal(c, cipher, s, d.companyId, d.effectiveOn, d.currency, 'manual:' + req.headers['idempotency-key'], d.lines.map(l => ({ ...l, companyId: d.companyId, currency: d.currency })), { reason: d.reason, manual: true }, false) }; }));
    app.post('/api/ledger/journals/:id/post', route(async (c: any, m: any, s: any, req: any) => { const r = (await c.query('select * from ab.finance_journals where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(r, 404, 'notFound'); need(m, 'journal_approve', r.company_id); await post(c, s, r.id); await event(c, cipher, s, r.company_id, r.id, 'manual_journal_approved', { status: r.status }, { status: 'Posted' }); return { id: r.id }; }));
    app.post('/api/ledger/journals/:id/reverse', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ effectiveOn: day, reason: text }).strict().parse(req.body), r = (await c.query('select * from ab.finance_journals where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(r, 404, 'notFound'); need(m, 'journal_approve', r.company_id); requireOk(cipher.open(r.payload_cipher).manual === true, 409, 'correctOriginalDocument'); return { id: await reverse(c, cipher, s, r.id, d.effectiveOn, d.reason) }; }));
    app.post('/api/ledger/cards', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, holderId: id, bankName: text, lastFour: z.string().regex(/^\d{4}$/), name: text, currency, dueDay: z.number().int().min(1).max(28), liabilityId: id }).strict().parse(req.body); need(m, 'cards', d.companyId); requireOk(m.state.users.some((u: any) => u.id === d.holderId && u.status === 'Active'), 422, 'invalidReference'); await chart(c, d.companyId, d.currency, d.liabilityId, 'liability'); const key = randomUUID(); await c.query('insert into ab.finance_cards(id,tenant_id,company_id,holder_id,bank_name,last_four,name,currency,due_day,liability_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [key, s.tenant_id, d.companyId, d.holderId, d.bankName, d.lastFour, d.name, d.currency, d.dueDay, d.liabilityId, s.user_id]); await event(c, cipher, s, d.companyId, key, 'card_created', null, d); return { id: key }; }));
    app.post('/api/ledger/cards/:id/charges', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ amount: positive, paidOn: day, reference: text, beneficiary: text, documentVersionId: opt, notes: z.string().max(2000).default(''), splits: z.array(z.object({ companyId: id, itemId: id, customerId: opt, vehicleId: opt, amount: positive, invoiceId: opt, dueToAccountId: opt, issuerDueFromAccountId: opt }).strict()).min(1).max(100) }).strict().parse(req.body), card = (await c.query('select * from ab.finance_cards where id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(card && card.active, 404, 'notFound');
        need(m, 'cards', card.company_id);
        requireOk(d.splits.reduce((n: bigint, r) => n + L.units(r.amount), 0n) === L.units(d.amount), 422, 'amountMismatch');
        if (d.documentVersionId)
            await evidence(c, m, card.company_id, d.documentVersionId, false);
        const key = randomUUID();
        await c.query('insert into ab.finance_card_charges(id,tenant_id,company_id,card_id,amount,currency,paid_on,reference,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [key, s.tenant_id, card.company_id, card.id, d.amount, card.currency, d.paidOn, d.reference, cipher.seal(d), s.user_id]);
        const result = [];
        for (const split of d.splits) {
            need(m, 'cards', split.companyId);
            company(m, split.companyId);
            if (split.customerId)
                await customer(c, m, split.customerId, split.companyId, split.vehicleId || undefined);
            else
                requireOk(!split.vehicleId && !split.invoiceId, 422, 'invalidReference');
            const it = await item(c, cipher, m, split.itemId, split.companyId), expense = await resolve(c, split.companyId, card.currency, it.data.expenseId);
            requireOk(expense.kind === 'expense', 422, 'accountMappingRequired');
            if (split.invoiceId) {
                const inv = (await invoices(c, { companyId: split.companyId, customerId: split.customerId, vehicleId: split.vehicleId, currency: card.currency })).find((x: any) => x.id === split.invoiceId && x.item_id === split.itemId);
                requireOk(inv && inv.customer_id === split.customerId && inv.vehicle_id === (split.vehicleId || null) && L.units(inv.amount) === L.units(split.amount), 422, 'invalidReference');
                requireOk(!(await c.query('select 1 from ab.finance_card_splits where invoice_id=$1', [split.invoiceId])).rowCount, 409, 'duplicate');
            }
            const sid = randomUUID();
            await c.query('insert into ab.finance_card_splits(id,tenant_id,company_id,charge_id,item_id,customer_id,vehicle_id,amount,invoice_id,completed_by,completed_at,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [sid, s.tenant_id, split.companyId, key, it.id, split.customerId || null, split.vehicleId || null, split.amount, split.invoiceId || null, split.invoiceId ? s.user_id : null, split.invoiceId ? new Date() : null, s.user_id]);
            if (split.companyId === card.company_id)
                await journal(c, cipher, s, card.company_id, d.paidOn, card.currency, 'card:' + sid, [line(expense, L.units(split.amount)), line(await chart(c, card.company_id, card.currency, card.liability_id, 'liability'), -L.units(split.amount))], { chargeId: key, splitId: sid });
            else {
                const dueTo = await chart(c, split.companyId, card.currency, split.dueToAccountId!, 'liability'), dueFrom = await chart(c, card.company_id, card.currency, split.issuerDueFromAccountId!, 'asset');
                for (const a of [dueTo, dueFrom])
                    requireOk(a.definition_id && (await c.query('select eliminate from ab.finance_accounts where id=$1', [a.definition_id])).rows[0]?.eliminate, 422, 'intercompanyMappingRequired');
                await journal(c, cipher, s, split.companyId, d.paidOn, card.currency, 'card-beneficiary:' + sid, [line(expense, L.units(split.amount)), line(dueTo, -L.units(split.amount))], { chargeId: key, splitId: sid, intercompany: true, otherCompanyId: card.company_id });
                await journal(c, cipher, s, card.company_id, d.paidOn, card.currency, 'card-issuer:' + sid, [line(dueFrom, L.units(split.amount)), line(await chart(c, card.company_id, card.currency, card.liability_id, 'liability'), -L.units(split.amount))], { chargeId: key, splitId: sid, intercompany: true, otherCompanyId: split.companyId });
            }
            if (split.customerId && !split.invoiceId)
                await notify(c, s, split.companyId, sid, 'ledger:missing_invoice', 'missing-invoice:' + sid);
            result.push({ id: sid, missingInvoice: !!split.customerId && !split.invoiceId });
        }
        await event(c, cipher, s, card.company_id, key, 'card_charge_recorded', null, d);
        return { id: key, splits: result };
    }));
    app.post('/api/ledger/card-splits/:id/invoice', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ invoiceId: id }).strict().parse(req.body), r = (await c.query('select s.*,ch.currency from ab.finance_card_splits s join ab.finance_card_charges ch on ch.id=s.charge_id where s.id=$1 for update of s', [id.parse(req.params.id)])).rows[0]; requireOk(r && r.customer_id && !r.invoice_id, 409, 'invalidTransition'); need(m, 'cards', r.company_id); const i = (await invoices(c, { companyId: r.company_id, customerId: r.customer_id, vehicleId: r.vehicle_id, currency: r.currency })).find((x: any) => x.id === d.invoiceId && x.item_id === r.item_id); requireOk(i && i.customer_id === r.customer_id && i.vehicle_id === r.vehicle_id && L.units(i.amount) === L.units(r.amount), 422, 'amountMismatch'); requireOk(!(await c.query('select 1 from ab.finance_card_splits where invoice_id=$1', [i.id])).rowCount, 409, 'duplicate'); await c.query('update ab.finance_card_splits set invoice_id=$2,completed_by=$3,completed_at=now()where id=$1', [r.id, i.id, s.user_id]); await fact(c, cipher, s, r.company_id, s.user_id, 'missing_invoice_completed', 'card-invoice:' + r.id, r.amount, { createdAt: r.created_at, completedAt: new Date().toISOString(), invoiceId: i.id }); await event(c, cipher, s, r.company_id, r.id, 'card_invoice_completed', null, d); return { id: r.id }; }));
    app.post('/api/ledger/cards/:id/statements', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ periodFrom: day, periodTo: day, openingBalance: money, closingBalance: money, documentVersionId: id, lines: z.array(z.object({ date: day, amount: z.string().refine(x => {
                    try {
                        return L.units(x) !== 0n;
                    }
                    catch {
                        return false;
                    }
                }), reference: z.string().max(200) }).strict()).min(1).max(1000) }).strict().parse(req.body), card = (await c.query('select * from ab.finance_cards where id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(card, 404, 'notFound');
        need(m, 'statement_upload', card.company_id);
        requireOk(d.periodTo >= d.periodFrom && d.lines.every(l => l.date >= d.periodFrom && l.date <= d.periodTo) && L.units(d.openingBalance) + d.lines.reduce((n: bigint, l) => n + L.units(l.amount), 0n) === L.units(d.closingBalance), 422, 'statementBalanceMismatch');
        await evidence(c, m, card.company_id, d.documentVersionId, false);
        const key = randomUUID(), source = sha(JSON.stringify(d));
        await c.query('insert into ab.finance_statements(id,tenant_id,company_id,card_id,period_from,period_to,opening_balance,closing_balance,source_hash,document_version_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [key, s.tenant_id, card.company_id, card.id, d.periodFrom, d.periodTo, d.openingBalance, d.closingBalance, source, d.documentVersionId, s.user_id]);
        let n = 0;
        for (const l of d.lines)
            await c.query('insert into ab.finance_statement_lines(id,tenant_id,statement_id,line_no,effective_on,amount,reference)values($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.tenant_id, key, ++n, l.date, l.amount, l.reference]);
        await event(c, cipher, s, card.company_id, key, 'card_statement_uploaded', null, { ...d, lines: d.lines.length });
        return { id: key, ocr: false, status: 'Review' };
    }));
    app.post('/api/ledger/card-statements/:id/match', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ pairs: z.array(z.object({ lineId: id, chargeId: opt, voucherId: opt }).strict().refine(x => !!x.chargeId !== !!x.voucherId)).min(1).max(1000) }).strict().parse(req.body), st = (await c.query('select * from ab.finance_statements where id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(st?.card_id && st.status === 'Review', 409, 'invalidTransition');
        need(m, 'reconcile', st.company_id);
        for (const pair of d.pairs) {
            const l = (await c.query('select * from ab.finance_statement_lines where id=$1 and statement_id=$2', [pair.lineId, st.id])).rows[0];
            requireOk(l, 422, 'invalidReference');
            let amount: bigint, date: string;
            if (pair.chargeId) {
                const ch = (await c.query('select * from ab.finance_card_charges where id=$1 and card_id=$2', [pair.chargeId, st.card_id])).rows[0];
                requireOk(ch, 422, 'invalidReference');
                amount = L.units(ch.amount);
                date = ch.paid_on.toISOString().slice(0, 10);
            }
            else {
                const v = (await c.query("select v.*,o.effective_on from ab.finance_vouchers v join ab.finance_card_settlements x on x.voucher_id=v.id join ab.finance_operations o on o.id=v.operation_id where v.id=$1 and x.card_id=$2 and v.status='Paid'", [pair.voucherId, st.card_id])).rows[0];
                requireOk(v, 422, 'invalidReference');
                need(m, 'reconcile', v.company_id);
                amount = -L.units(v.amount);
                date = v.effective_on.toISOString().slice(0, 10);
            }
            requireOk((amount > 0n) === (L.units(l.amount) > 0n) && date === l.effective_on.toISOString().slice(0, 10), 422, 'amountMismatch');
            await c.query('insert into ab.finance_card_matches(id,tenant_id,statement_id,line_id,charge_id,voucher_id,created_by)values($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.tenant_id, st.id, l.id, pair.chargeId || null, pair.voucherId || null, s.user_id]);
            const matched = L.units((await c.query('select coalesce(sum(coalesce(ch.amount,-v.amount)),0)::text amount from ab.finance_card_matches x left join ab.finance_card_charges ch on ch.id=x.charge_id left join ab.finance_vouchers v on v.id=x.voucher_id where x.line_id=$1', [l.id])).rows[0].amount);
            requireOk((matched < 0n ? -matched : matched) <= (L.units(l.amount) < 0n ? -L.units(l.amount) : L.units(l.amount)), 422, 'amountMismatch');
        }
        await event(c, cipher, s, st.company_id, st.id, 'card_statement_matched', null, d);
        return { matched: d.pairs.length };
    }));
    app.post('/api/ledger/card-statements/:id/approve', route(async (c: any, m: any, s: any, req: any) => { const st = (await c.query('select * from ab.finance_statements where id=$1 for update', [id.parse(req.params.id)])).rows[0]; requireOk(st?.card_id && st.status === 'Review', 409, 'invalidTransition'); need(m, 'reconcile', st.company_id); requireOk(!(await c.query('select 1 from ab.finance_statement_lines l where statement_id=$1 and not exists(select 1 from ab.finance_card_matches x where x.line_id=l.id)', [st.id])).rowCount, 409, 'unresolvedDifference'); requireOk(!(await c.query("select 1 from ab.finance_vouchers v join ab.finance_card_settlements x on x.voucher_id=v.id join ab.finance_operations o on o.id=v.operation_id where x.card_id=$1 and v.status='Paid'and o.effective_on between $2 and $3 and not exists(select 1 from ab.finance_card_matches mt where mt.voucher_id=v.id and mt.statement_id=$4)", [st.card_id, st.period_from, st.period_to, st.id])).rowCount, 409, 'unresolvedDifference'); requireOk(!(await c.query('select 1 from ab.finance_card_splits sp join ab.finance_card_charges ch on ch.id=sp.charge_id where ch.card_id=$1 and ch.paid_on between $2 and $3 and sp.customer_id is not null and sp.invoice_id is null', [st.card_id, st.period_from, st.period_to])).rowCount, 409, 'missingInvoices'); await c.query("update ab.finance_statements set status='Approved',approved_by=$2 where id=$1", [st.id, s.user_id]); await event(c, cipher, s, st.company_id, st.id, 'card_reconciliation_approved', null, { approved: true }); return { id: st.id }; }));
    app.post('/api/ledger/card-statements/:id/vouchers', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ itemId: id }).strict().parse(req.body), st = (await c.query('select * from ab.finance_statements where id=$1', [id.parse(req.params.id)])).rows[0];
        requireOk(st?.card_id && st.status === 'Approved' && st.period_from.toISOString().slice(8, 10) === '01', 409, 'invalidTransition');
        const card = (await c.query('select * from ab.finance_cards where id=$1', [st.card_id])).rows[0];
        need(m, 'card_settle', st.company_id);
        const splitRows = (await c.query('select sp.*,ch.paid_on,ch.payload_cipher charge_payload from ab.finance_card_splits sp join ab.finance_card_charges ch on ch.id=sp.charge_id where ch.card_id=$1 and ch.paid_on between $2 and $3', [card.id, st.period_from, st.period_to])).rows, grouped = new Map<string, any[]>();
        for (const row of splitRows) {
            need(m, 'card_settle', row.company_id);
            grouped.set(row.company_id, [...(grouped.get(row.company_id) || []), row]);
        }
        const result = [];
        for (const [co, rows] of grouped) {
            const amount = L.money(rows.reduce((n: bigint, r: any) => n + L.units(r.amount), 0n));
            const details: any = { alreadyAccrued: true, cardId: card.id, statementId: st.id, issuerCompanyId: card.company_id, payableOverrideId: card.liability_id };
            if (co !== card.company_id) {
                const source = cipher.open(rows[0].charge_payload), first = source.splits.find((x: any) => x.companyId === co);
                requireOk(rows.every(r => { const x = cipher.open(r.charge_payload).splits.find((x: any) => x.companyId === co); return x.dueToAccountId === first.dueToAccountId && x.issuerDueFromAccountId === first.issuerDueFromAccountId; }), 422, 'inconsistentIntercompanyMapping');
                details.payableOverrideId = first.dueToAccountId;
                details.issuerDueFromAccountId = first.issuerDueFromAccountId;
                details.issuerLiabilityId = card.liability_id;
            }
            const v = await voucher(c, m, s, { companyId: co, itemId: d.itemId, amount, currency: card.currency, issuedOn: today(), beneficiary: card.bank_name, reason: 'Card monthly settlement', sourceKey: 'card:' + card.id + ':' + st.period_from.toISOString().slice(0, 7) + ':' + co }, details);
            await c.query('insert into ab.finance_card_settlements(id,tenant_id,company_id,card_id,month,voucher_id,amount,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), s.tenant_id, co, card.id, st.period_from, v.id, amount, s.user_id]);
            result.push(v);
        }
        return { vouchers: result };
    }));
    app.post('/api/ledger/intercompany', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id, toCompanyId: id, toBankAccountId: id, itemId: id, amount: positive, currency, effectiveOn: day, sourceDueFromId: id, destinationDueToId: id, reason: text }).strict().parse(req.body);
        for (const co of [d.companyId, d.toCompanyId])
            need(m, 'intercompany', co);
        requireOk(d.companyId !== d.toCompanyId, 422, 'invalidReference');
        const b = m.bank.list().find((b: any) => b.id === d.toBankAccountId && b.companyId === d.toCompanyId && b.status === 'Active' && b.currency === d.currency);
        requireOk(b, 422, 'inactiveBank');
        const a = await chart(c, d.companyId, d.currency, d.sourceDueFromId, 'asset'), liability = await chart(c, d.toCompanyId, d.currency, d.destinationDueToId, 'liability');
        for (const account of [a, liability])
            requireOk(account.definition_id && (await c.query('select eliminate from ab.finance_accounts where id=$1', [account.definition_id])).rows[0]?.eliminate, 422, 'intercompanyMappingRequired');
        const v = await voucher(c, m, s, { companyId: d.companyId, itemId: d.itemId, amount: d.amount, currency: d.currency, issuedOn: d.effectiveOn, beneficiary: b.accountName, reason: d.reason, sourceKey: 'intercompany:' + req.headers['idempotency-key'] }, { expenseOverrideId: a.id, intercompany: true });
        const key = randomUUID();
        await c.query('insert into ab.finance_intercompany(id,tenant_id,company_id,to_company_id,to_bank_account_id,voucher_id,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)', [key, s.tenant_id, d.companyId, d.toCompanyId, b.id, v.id, cipher.seal(d), s.user_id]);
        return { id: key, voucher: v };
    }));
    app.post('/api/ledger/intercompany/:id/deposit', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ effectiveOn: day, bankConfirmation: text, documentVersionId: id }).strict().parse(req.body), r = (await c.query('select x.*,v.status voucher_status,v.amount,v.currency,v.cheque_id from ab.finance_intercompany x join ab.finance_vouchers v on v.id=x.voucher_id where x.id=$1 for update of x', [id.parse(req.params.id)])).rows[0];
        requireOk(r && r.state === 'Pending' && r.voucher_status === 'Paid', 409, 'sourceChequeNotCleared');
        for (const co of [r.company_id, r.to_company_id])
            need(m, 'intercompany', co);
        await evidence(c, m, r.to_company_id, d.documentVersionId);
        const details = cipher.open(r.payload_cipher), op = await bankPosting(c, cipher, m, s, { companyId: r.to_company_id, bankAccountId: r.to_bank_account_id, kind: 'receipt', amount: r.amount, currency: r.currency, effectiveOn: d.effectiveOn, counterpartId: details.destinationDueToId, reference: 'intercompany:' + r.id, reason: d.bankConfirmation, integrationRefs: { intercompanyId: r.id, sourceChequeId: r.cheque_id } });
        await c.query("update ab.finance_intercompany set state='Deposited',receipt_operation_id=$2 where id=$1", [r.id, op]);
        await event(c, cipher, s, r.to_company_id, r.id, 'intercompany_deposited', null, { operationId: op, ...d });
        return { id: r.id, operationId: op };
    }));
    app.post('/api/ledger/invoice-imports', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id, name: z.string().min(1).max(200), format: z.enum(['csv', 'xlsx']), base64: z.string().min(4).max(7000000), mapping: z.object({ sourceKey: text, customerNumber: text, vehicleNumber: z.string().max(100).default(''), plate: z.string().max(100).default(''), itemCode: text, amount: text, currency: text, dueOn: text }).strict() }).strict().parse(req.body);
        need(m, 'invoice_import', d.companyId);
        const bytes = Buffer.from(d.base64, 'base64');
        requireOk(bytes.length <= 5e6 && bytes.toString('base64') === d.base64, 422, 'invalidFile');
        const records = d.format === 'csv' ? Csv.csv(bytes.toString('utf8'), d.mapping.sourceKey) : await customerSpreadsheet(bytes, d.mapping.sourceKey);
        requireOk(records.length > 0 && records.length <= 1000, 422, 'importLimit');
        const rows = [], seen = new Set();
        for (let n = 0; n < records.length; n++) {
            const r = records[n], value: any = Object.fromEntries(Object.entries(d.mapping).map(([k, v]) => [k, v ? r[v] : '']));
            let error = '';
            try {
                const it = (await c.query('select id from ab.finance_items where code=$1 and active', [value.itemCode])).rows[0], cu = (await c.query('select * from ab.customers where file_number=$1 and status=\'Active\'', [String(value.customerNumber).match(/^\d{1,15}$/) ? value.customerNumber : '0'])).rows[0];
                requireOk(it && cu && customerCan(m, 'view', cu.company_id), 422, 'unmatchedCustomerOrItem');
                let vid = null;
                if (value.vehicleNumber) {
                    const v = (await c.query('select * from ab.vehicles where file_number=$1 and company_id=$2 and customer_id=$3', [/^\d{1,15}$/.test(value.vehicleNumber) ? value.vehicleNumber : '0', d.companyId, cu.id])).rows[0];
                    requireOk(v, 422, 'unmatchedVehicle');
                    if (value.plate)
                        requireOk(normalize(cipher.open(v.payload_cipher).plate || '') === normalize(value.plate), 422, 'unmatchedPlate');
                    vid = v.id;
                }
                else
                    requireOk(!value.plate, 422, 'vehicleNumberRequiredForPlate');
                Object.assign(value, { companyId: d.companyId, customerId: cu.id, vehicleId: vid, itemId: it.id, issuedOn: today() });
                const parsed = invoiceSchema.parse({ companyId: d.companyId, customerId: cu.id, vehicleId: vid, itemId: it.id, issuedOn: today(), dueOn: value.dueOn, currency: value.currency, amount: value.amount, sourceKey: value.sourceKey });
                const itemRow = await item(c, cipher, m, it.id, d.companyId);
                requireOk(itemRow.data.invoice && itemRow.data.methods.includes('bulk'), 403, 'denied');
                if (seen.has(value.sourceKey) || (await c.query('select 1 from ab.finance_invoice_links where company_id=$1 and source_key=$2', [d.companyId, value.sourceKey])).rowCount)
                    error = 'duplicate';
                seen.add(value.sourceKey);
                rows.push({ line: n + 1, data: parsed, error });
            }
            catch (e: any) {
                rows.push({ line: n + 1, error: e instanceof ApiError ? e.code || 'unmatched' : 'invalidRow', original: value });
            }
        }
        const key = randomUUID(), hash = sha(bytes);
        await c.query('insert into ab.finance_invoice_imports(id,tenant_id,company_id,source_hash,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6)', [key, s.tenant_id, d.companyId, hash, cipher.seal({ name: d.name, format: d.format, originalBase64: d.base64, mapping: d.mapping, rows }), s.user_id]);
        await event(c, cipher, s, d.companyId, key, 'invoice_import_preview', null, { sourceHash: hash, rows: rows.length });
        return { id: key, rows, originalStoredEncrypted: true };
    }));
    app.post('/api/ledger/invoice-imports/:id/commit', route(async (c: any, m: any, s: any, req: any) => {
        const r = (await c.query('select * from ab.finance_invoice_imports where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(r?.status === 'Preview', 409, 'invalidTransition');
        need(m, 'invoice_import', r.company_id);
        need(m, 'invoice_create', r.company_id);
        const d = cipher.open(r.payload_cipher), result = { created: [] as any[], duplicate: 0, rejected: 0 };
        for (const row of d.rows) {
            if (row.error) {
                if (row.error === 'duplicate')
                    result.duplicate++;
                else
                    result.rejected++;
                continue;
            }
            if ((await c.query('select 1 from ab.finance_invoice_links where company_id=$1 and source_key=$2', [r.company_id, row.data.sourceKey])).rowCount) {
                result.duplicate++;
                continue;
            }
            result.created.push(await invoice(c, cipher, m, s, { ...row.data, mode: 'bulk' }));
        }
        await c.query("update ab.finance_invoice_imports set status='Completed'where id=$1", [r.id]);
        await event(c, cipher, s, r.company_id, r.id, 'invoice_import_committed', null, result);
        return result;
    }));
    app.get('/api/ledger/invoice-imports/:id/source', route(async (c: any, m: any, s: any, req: any) => { const r = (await c.query('select * from ab.finance_invoice_imports where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(r, 404, 'notFound'); need(m, 'invoice_import', r.company_id); const d = cipher.open(r.payload_cipher); await event(c, cipher, s, r.company_id, r.id, 'invoice_import_source_read', null, { sourceHash: r.source_hash }); return { name: d.name, base64: d.originalBase64 }; }));
    app.get('/api/ledger/statements/:id', route(async (c: any, m: any, s: any, req: any) => { const st = (await c.query('select * from ab.finance_statements where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(st, 404, 'notFound'); need(m, 'reconcile', st.company_id); const lines = (await c.query('select * from ab.finance_statement_lines where statement_id=$1 order by line_no', [st.id])).rows; const charges = st.card_id ? (await c.query('select ch.* from ab.finance_card_charges ch where ch.card_id=$1 and ch.paid_on between $2 and $3', [st.card_id, st.period_from, st.period_to])).rows : []; const matches = st.card_id ? (await c.query('select line_id,charge_id,voucher_id from ab.finance_card_matches where statement_id=$1', [st.id])).rows : []; const entries = st.bank_account_id ? (await c.query("select e.*,coalesce(o.effective_on,j.effective_on)effective_on from ab.finance_entries e left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.bank_account_id=$1 and(o.status='Approved'or j.status='Posted')and coalesce(o.effective_on,j.effective_on)between $2 and $3", [st.bank_account_id, st.period_from, st.period_to])).rows : []; const paymentVouchers = st.card_id ? (await c.query("select v.id,v.company_id,v.amount,o.effective_on from ab.finance_vouchers v join ab.finance_card_settlements x on x.voucher_id=v.id join ab.finance_operations o on o.id=v.operation_id where x.card_id=$1 and v.status='Paid'and o.effective_on between $2 and $3", [st.card_id, st.period_from, st.period_to])).rows.filter((x: any) => financeRight(m, 'ledger_view', x.company_id)) : []; return { statement: st, lines, entries, paymentVouchers, charges: charges.map((x: any) => ({ ...x, payload_cipher: undefined })), matches, ocr: false, manualReviewAvailable: true }; }));
    async function closeReview(c: any, co: string, month: string) {
        const end = new Date(month + 'T00:00:00Z');
        end.setUTCMonth(end.getUTCMonth() + 1);
        const until = end.toISOString().slice(0, 10), problems: any = {};
        const count = async (name: string, sql: string, params: any[]) => {
            const n = Number((await c.query(sql, params)).rows[0].n);
            if (n)
                problems[name] = n;
        };
        await count('unpostedJournals', "select count(*)n from ab.finance_journals where company_id=$1 and effective_on<$2 and status='Draft'", [co, until]);
        await count('pendingVouchers', "select count(*)n from ab.finance_vouchers where company_id=$1 and issued_on<$2 and status in('Pending','Approved')", [co, until]);
        await count('pendingDeposits', "select count(*)n from ab.finance_deposits where company_id=$1 and effective_on<$2 and status='Review'", [co, until]);
        await count('openCustody', 'select count(*)n from(select holder_id,currency from ab.finance_custody_moves where company_id=$1 and effective_on<$2 group by holder_id,currency having sum(amount)<>0)x', [co, until]);
        await count('openCheques', "select count(*)n from ab.finance_cheques where company_id=$1 and issued_on<$2 and status not in('Collected','Returned','Cancelled')", [co, until]);
        await count('bankReconciliationRequired', "select count(*)n from ab.bank_accounts b where b.company_id=$1 and b.status='Active' and not exists(select 1 from ab.finance_statements s where s.bank_account_id=b.id and s.status='Approved'and s.period_from<=$2 and s.period_to>=($3::date-1))", [co, month, until]);
        await count('pendingBankOperations', "select count(*)n from ab.finance_operations where company_id=$1 and effective_on<$2 and status='Draft'", [co, until]);
        await count('missingCustomerInvoices', 'select count(*)n from ab.finance_card_splits s join ab.finance_card_charges ch on ch.id=s.charge_id where s.company_id=$1 and ch.paid_on<$2 and s.customer_id is not null and s.invoice_id is null', [co, until]);
        await count('unsettledIntercompany', "select count(*)n from ab.finance_intercompany x join ab.finance_vouchers v on v.id=x.voucher_id where(x.company_id=$1 or x.to_company_id=$1)and v.issued_on<$2 and x.state<>'Deposited'", [co, until]);
        await count('unreconciledCards', "select count(*)n from ab.finance_cards ca where ca.company_id=$1 and ca.active and exists(select 1 from ab.finance_card_charges ch where ch.card_id=ca.id and ch.paid_on>=$2 and ch.paid_on<$3)and not exists(select 1 from ab.finance_statements st where st.card_id=ca.id and st.status='Approved'and st.period_from<=$2 and st.period_to>=($3::date-1))", [co, month, until]);
        await count('unpostedInvoiceAdjustments', "select count(*)n from ab.vehicle_invoice_adjustments a join ab.finance_invoice_links l on l.invoice_id=a.invoice_id where a.company_id=$1 and a.created_at::date<$2 and not exists(select 1 from ab.finance_journals j where j.company_id=a.company_id and j.status='Posted'and j.source_key='credit:'||a.id::text)", [co, until]);
        await count('unclassifiedInvoices', "select count(*)n from ab.vehicle_invoices i where i.company_id=$1 and i.created_at::date<$2 and not exists(select 1 from ab.finance_invoice_links l where l.invoice_id=i.id)", [co, until]);
        return { companyId: co, month, problems, canClose: Object.keys(problems).length === 0 };
    }
    app.get('/api/ledger/closing-review', route(async (c: any, m: any, s: any, req: any) => { const q = z.object({ companyId: id, month: day.refine(x => x.endsWith('-01')) }).strict().parse(req.query); need(m, 'close', q.companyId); return closeReview(c, q.companyId, q.month); }));
    app.post('/api/ledger/close', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, month: day.refine(x => x.endsWith('-01')), confirm: z.literal(true) }).strict().parse(req.body); need(m, 'close', d.companyId); requireOk(d.month < today().slice(0, 7) + '-01', 422, 'periodNotEnded'); const report = await closeReview(c, d.companyId, d.month); requireOk(report.canClose, 409, 'closingChecklistIncomplete'); const key = randomUUID(); await c.query('insert into ab.finance_periods(id,tenant_id,company_id,month,closed_by,report_cipher,created_by)values($1,$2,$3,$4,$5,$6,$5)', [key, s.tenant_id, d.companyId, d.month, s.user_id, cipher.seal(report)]); await event(c, cipher, s, d.companyId, key, 'financial_period_closed', null, report); return { id: key, ...report }; }));
    app.post('/api/ledger/group-close', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyIds: z.array(id).min(1), month: day.refine(x => x.endsWith('-01')), confirm: z.literal(true) }).strict().parse(req.body);
        const cos = [...new Set(d.companyIds)];
        const activeCompanyIds=m.state.companies.filter((co:any)=>co.status==='Active').map((co:any)=>co.id);requireOk(cos.length===activeCompanyIds.length&&activeCompanyIds.every((co:string)=>cos.includes(co)),422,'allActiveCompaniesRequired');
        for (const co of cos) {
            need(m, 'group_close', co);
            requireOk((await c.query('select 1 from ab.finance_periods where company_id=$1 and month=$2', [co, d.month])).rowCount, 409, 'companyNotClosed');
            requireOk((await closeReview(c, co, d.month)).canClose, 409, 'closingChecklistIncomplete');
        }
        const key = randomUUID();
        await c.query('insert into ab.finance_group_closings(id,tenant_id,month,companies,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6)', [key, s.tenant_id, d.month, cos, cipher.seal({ companyIds: cos, month: d.month }), s.user_id]);
        return { id: key };
    }));
    app.post('/api/ledger/recurring/run', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id }).strict().parse(req.body); need(m, 'invoice_create', d.companyId); return recurringFinancial(c, cipher, m, s, d.companyId); }));
    app.post('/api/ledger/reminders/run', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id }).strict().parse(req.body);
        need(m, 'configure', d.companyId);
        return financialReminders(c, cipher, s, d.companyId);
    }));
    app.get('/api/ledger/events', route(async (c: any, m: any, s: any, req: any) => { const co = id.parse(req.query.companyId); need(m, 'audit', co); return { rows: (await c.query("select * from ab.finance_events where company_id=$1 and entity_type='ledger' order by created_at desc limit 200", [co])).rows.map((r: any) => ({ ...r, payload: cipher.open(r.payload_cipher), payload_cipher: undefined })) }; }));
    app.get('/api/ledger/reports', route(async (c: any, m: any, s: any, req: any) => {
        const q = z.object({ companies: z.string().min(1), from: day, to: day, kind: z.enum(['trial', 'balance', 'profit', 'cashflow', 'ledger', 'journal', 'receivables', 'custody', 'vouchers', 'cards', 'kpi', 'vat', 'collections', 'deposits', 'cheques', 'funds', 'intercompany', 'installments', 'adjustments', 'profitability']), currency: currency.optional(), employeeId: id.optional(), itemId: id.optional(), emirate: z.string().max(100).optional(), areaId: z.string().max(100).optional(), page: z.coerce.number().int().min(0).default(0), format: z.enum(['json', 'csv', 'excel', 'print']).default('json'), consolidated: z.enum(['true', 'false']).default('false'), groupBy: z.enum(['day', 'month', 'year', 'employee', 'item']).default('day'),...registerArgs }).strict().parse(req.query);
        const cos = [...new Set(q.companies.split(',').map((x: string) => id.parse(x)))];
        requireOk(q.to >= q.from, 422, 'invalidDate');
        for (const co of cos) {
            need(m, 'report', co);
            if (q.kind === 'kpi')
                need(m, 'audit', co);
            if (q.format !== 'json' && q.format !== 'print')
                need(m, 'export', co);
        }
        const selected = cos.filter((co: any) => { const row = m.state.companies.find((x: any) => x.id === co); return row && (!q.emirate || [row.emirate, row.emirateId].includes(q.emirate)) && (!q.areaId || row.areaId === q.areaId); });
        let eliminationStatus = 'not_requested';
        let rows: any[] = [], scope = 'posted entries only; no inferred historical balances';
        if (['trial', 'balance', 'profit', 'cashflow', 'ledger', 'journal', 'vat', 'profitability'].includes(q.kind)) {
            const source = (await c.query(`select e.id,e.company_id,e.chart_id,a.code,a.name_ar,a.name_en,a.kind,ca.eliminate,ca.cash_flow,e.debit::text,e.credit::text,e.currency,coalesce(o.effective_on,j.effective_on)date,e.operation_id,e.journal_id,coalesce(o.created_by,j.created_by)actor_id,j.payload_cipher journal_payload,j.source_key journal_source from ab.finance_entries e join ab.finance_chart a on a.id=e.chart_id left join ab.finance_accounts ca on ca.id=a.definition_id left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.company_id=any($1::uuid[])and(o.status='Approved'or j.status='Posted')and coalesce(o.effective_on,j.effective_on)<=$2 and($3::text is null or e.currency=$3)and($4::uuid is null or coalesce(o.created_by,j.created_by)=$4)order by coalesce(o.effective_on,j.effective_on),e.id`, [selected, q.to, q.currency || null, q.employeeId || null])).rows;
            const voucherItems = new Map((await c.query('select id,item_id from ab.finance_vouchers where company_id=any($1::uuid[])', [selected])).rows.map((r: any) => [r.id, r.item_id]));
            const splitItems = new Map((await c.query('select id,item_id from ab.finance_card_splits where company_id=any($1::uuid[])', [selected])).rows.map((r: any) => [r.id, r.item_id]));
            for (const r of source) {
                const meta = r.journal_payload ? cipher.open(r.journal_payload) : {};
                r.item_id = meta.itemId || voucherItems.get(meta.voucherId) || splitItems.get(meta.splitId) || null;
                delete r.journal_payload;
            }
            if (q.itemId)
                for (let i = source.length - 1; i >= 0; i--)
                    if (source[i].item_id !== q.itemId)
                        source.splice(i, 1);
            if (q.kind === 'vat') {
                const taxIds = (await c.query('select payload_cipher from ab.finance_items')).rows.map((r: any) => cipher.open(r.payload_cipher).taxAccountId).filter(Boolean);
                const chartIds = (await c.query('select id from ab.finance_chart where definition_id=any($1::uuid[])', [taxIds])).rows.map((r: any) => r.id);
                rows = source.filter((r: any) => chartIds.includes(r.chart_id) && r.date.toISOString().slice(0, 10) >= q.from).map((r: any) => ({ ...r, tax: L.money(L.units(r.credit) - L.units(r.debit)), date: r.date.toISOString().slice(0, 10) }));
                scope = 'posted configured tax-account entries; management report, not a certified VAT return';
            }
            else if (q.kind === 'profitability') {
                const groups = new Map<string, any>();
                for (const r of source.filter((r: any) => ['income', 'expense'].includes(r.kind) && r.date.toISOString().slice(0, 10) >= q.from)) {
                    const k = r.company_id + ':' + r.currency + ':' + (r.item_id || 'unclassified');
                    if (!groups.has(k))
                        groups.set(k, { company_id: r.company_id, currency: r.currency, item_id: r.item_id || 'unclassified', income: 0n, expense: 0n });
                    const g = groups.get(k);
                    if (r.kind === 'income')
                        g.income += L.units(r.credit) - L.units(r.debit);
                    else
                        g.expense += L.units(r.debit) - L.units(r.credit);
                }
                rows = [...groups.values()].map(r => ({ ...r, income: L.money(r.income), expense: L.money(r.expense), net: L.money(BigInt(r.income) - BigInt(r.expense)) }));
                scope = 'item profitability from posted income/expense entries; unclassified sources remain explicit';
            }
            else if (['ledger', 'journal', 'cashflow'].includes(q.kind)) {
                rows = source.filter((r: any) => r.date.toISOString().slice(0, 10) >= q.from && (q.kind !== 'cashflow' || r.kind === 'bank' || r.cash_flow)).map((r: any) => ({ ...r, date: r.date.toISOString().slice(0, 10), net: L.money(L.units(r.debit) - L.units(r.credit)) }));
            }
            else {
                const grouped = new Map<string, any>();
                for (const r of source) {
                    if (q.kind === 'profit' && (r.date.toISOString().slice(0, 10) < q.from || !['income', 'expense'].includes(r.kind)))
                        continue;
                    if (q.kind === 'balance' && ['income', 'expense'].includes(r.kind))
                        continue;
                    const k = r.company_id + ':' + r.chart_id + ':' + r.currency;
                    if (!grouped.has(k))
                        grouped.set(k, { company_id: r.company_id, chart_id: r.chart_id, code: r.code, name_ar: r.name_ar, name_en: r.name_en, kind: r.kind, currency: r.currency, debit: 0n, credit: 0n, eliminate: r.eliminate === true });
                    const x = grouped.get(k);
                    x.debit += L.units(r.debit);
                    x.credit += L.units(r.credit);
                }
                rows = [...grouped.values()].map(r => ({ ...r, debit: L.money(BigInt(r.debit)), credit: L.money(BigInt(r.credit)), net: L.money(BigInt(r.debit) - BigInt(r.credit)) }));
                if (q.kind === 'balance') {
                    for (const co of selected) {
                        const curs = [...new Set(source.filter((r: any) => r.company_id === co).map((r: any) => r.currency))];
                        for (const cur of curs) {
                            const earnings: bigint = source.filter((r: any) => r.company_id === co && r.currency === cur && ['income', 'expense'].includes(r.kind)).reduce((n: bigint, r: any) => n + L.units(r.credit) - L.units(r.debit), 0n);
                            if (earnings)
                                rows.push({ company_id: co, code: 'CURRENT_EARNINGS', kind: 'equity', currency: cur, debit: earnings < 0n ? L.money(-earnings) : '0.000', credit: earnings > 0n ? L.money(earnings) : '0.000', net: L.money(-earnings), derivedFromPostedIncomeAndExpense: true });
                        }
                    }
                }
            }
        }
        else if (q.kind === 'receivables') {
            for (const co of selected)
                rows.push(...(await invoices(c, { companyId: co, currency: q.currency })).filter((r: any) => (!q.itemId || r.item_id === q.itemId) && r.dueOn <= q.to).map((r: any) => ({ ...r, overdue: r.dueOn < today() ? r.outstanding : '0.000', ageDays: Math.max(0, Math.floor((Date.now() - new Date(r.dueOn).getTime()) / 86400000)) })));
            scope = 'classified invoice balances; pending cheques are not payments';
        }
        else if (q.kind === 'collections') {
            const rs = (await c.query("select r.*,j.effective_on cleared_on,jr.effective_on returned_on from ab.finance_receipts r left join ab.finance_journals j on j.source_key='receipt:'||r.id::text and j.company_id=r.company_id and j.status='Posted'left join ab.finance_journals jr on jr.reversal_of=j.id and jr.status='Posted'where r.company_id=any($1::uuid[])and r.item_id is not null and r.kind<>'credit'and($2::uuid is null or r.created_by=$2)and($3::uuid is null or r.item_id=$3)", [selected, q.employeeId || null, q.itemId || null])).rows;
            const groups = new Map<string, any>();
            for (const r of rs) {
                if (r.kind === 'cheque' && !r.cleared_on)
                    continue;
                const moves = [{ date: (r.kind === 'cheque' ? r.cleared_on : r.received_on).toISOString().slice(0, 10), delta: L.units(r.amount) }];
                if (r.returned_on)
                    moves.push({ date: r.returned_on.toISOString().slice(0, 10), delta: -L.units(r.amount) });
                for (const x of moves) {
                    if (x.date < q.from || x.date > q.to || q.currency && q.currency !== r.currency)
                        continue;
                    const period = q.groupBy === 'month' ? x.date.slice(0, 7) : q.groupBy === 'year' ? x.date.slice(0, 4) : q.groupBy === 'employee' ? r.created_by : q.groupBy === 'item' ? r.item_id : x.date, k = r.company_id + ':' + r.currency + ':' + period;
                    if (!groups.has(k))
                        groups.set(k, { company_id: r.company_id, currency: r.currency, period, amount: 0n });
                    groups.get(k).amount += x.delta;
                }
            }
            rows = [...groups.values()].map(r => ({ ...r, net: L.money(r.amount), amount: L.money(r.amount) }));
            scope = 'actual receipt confirmations minus dated cheque reversals; credit applications are not new money';
        }
        else if (q.kind === 'funds') {
            const fs = (await c.query('select id,company_id,name,kind,holder_id,chart_id,currency,ceiling,threshold from ab.finance_funds where company_id=any($1::uuid[])', [selected])).rows;
            for (const f of fs) {
                const b = L.units((await c.query("select coalesce(sum(e.debit-e.credit),0)::text amount from ab.finance_entries e left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.chart_id=$1 and(o.status='Approved'or j.status='Posted')and coalesce(o.effective_on,j.effective_on)<=$2", [f.chart_id, q.to])).rows[0].amount);
                rows.push({ ...f, balance: L.money(b), refill: L.money(L.units(f.ceiling) - b) });
            }
        }
        else if (['deposits', 'cheques', 'intercompany', 'installments', 'adjustments'].includes(q.kind)) {
            const defs: any = { deposits: ['finance_deposits', 'effective_on'], cheques: ['finance_cheques', 'due_on'], intercompany: ['finance_intercompany', 'created_at'], installments: ['vehicle_invoices', 'due_on'], adjustments: ['vehicle_invoice_adjustments', 'created_at'] };
            const [table, date] = defs[q.kind];
            rows = (await c.query('select * from ab.' + table + ' where company_id=any($1::uuid[])and ' + date + '::date between $2 and $3' + (q.kind === 'installments' ? " and kind='finance'" : '') + ' order by ' + date + ',id', [selected, q.from, q.to])).rows.map((r: any) => ({ ...r, payload_cipher: undefined }));
        }
        else if (q.kind === 'custody') {
            rows = (await c.query('select company_id,holder_id,currency,sum(amount)::text amount from ab.finance_custody_moves where company_id=any($1::uuid[])and effective_on<=$2 and($3::uuid is null or holder_id=$3)group by company_id,holder_id,currency having sum(amount)<>0', [selected, q.to, q.employeeId || null])).rows;
        }
        else {
            const tables: any = { vouchers: 'finance_vouchers', cards: 'finance_card_charges', kpi: 'finance_kpi_facts' };
            rows = (await c.query('select * from ab.' + tables[q.kind] + ' where company_id=any($1::uuid[])and created_at::date between $2 and $3 order by created_at,id', [selected, q.from, q.to])).rows.map((r: any) => ({ ...r, payload_cipher: undefined }));
        }
        if (q.consolidated === 'true' && ['trial', 'balance', 'profit'].includes(q.kind)) {
            const active = m.state.companies.filter((x: any) => x.status === 'Active').map((x: any) => x.id);
            requireOk(active.every((x: string) => selected.includes(x)), 403, 'allActiveCompaniesRequired');
            const sums: Record<string, bigint> = {};
            for (const r of rows.filter((r: any) => r.eliminate))
                sums[r.currency] = (sums[r.currency] || 0n) + L.units(r.net);
            if (Object.values(sums).some(x => x !== 0n))
                eliminationStatus = 'blocked_unbalanced_reciprocal_accounts';
            else {
                rows = rows.filter((r: any) => !r.eliminate);
                eliminationStatus = 'matched_reciprocal_balances_eliminated';
            }
            scope += '; consolidation removes only configured balanced reciprocal accounts, no FX conversion';
        }
        if(q.full==='true'||q.search||q.grid!=='{}')rows=filterRegister(rows,q).rows;
        const total = rows.length, totals: any = {};
        for (const r of rows)
            if (r.currency && r.net) {
                const k = r.currency;
                totals[k] = L.money(L.units(totals[k] || '0') + L.units(r.net));
            }
        if(q.full!=='true')rows = rows.slice(q.page * 200, (q.page + 1) * 200);
        const coverage = (await c.query('select count(*)n from ab.vehicle_invoices i where company_id=any($1::uuid[])and not exists(select 1 from ab.finance_invoice_links l where l.invoice_id=i.id)', [selected])).rows[0].n;
        const unpostedAdjustments = Number((await c.query("select count(*)n from ab.vehicle_invoice_adjustments a join ab.finance_invoice_links l on l.invoice_id=a.invoice_id where a.company_id=any($1::uuid[])and not exists(select 1 from ab.finance_journals j where j.company_id=a.company_id and j.status='Posted'and j.source_key='credit:'||a.id::text)", [selected])).rows[0].n);
        const profitByCurrency: Record<string, string> = {};
        if (q.kind === 'profit')
            for (const [cur, net] of Object.entries(totals))
                profitByCurrency[cur] = L.money(-L.units(net));
        const result = { profitByCurrency, unpostedInvoiceAdjustments: unpostedAdjustments, rows, total, page: q.page, pageSize: 200, totals, scope, unclassifiedInvoices: Number(coverage), groupEliminations: eliminationStatus, groupClosingRequired: true, vatReturnCertified: false };
        if (q.format === 'json' || q.format === 'print')
            return result;
        const columns = [...new Set(rows.flatMap(r => Object.keys(r)))], values = [columns, ...rows.map(r => columns.map(k => r[k] instanceof Date ? r[k].toISOString() : typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k] ?? ''))];
        if (q.format === 'csv')
            return { ...result, filename: q.kind + '.csv', mime: 'text/csv;charset=utf-8', data: '\uFEFF' + values.map(r => r.map(L.csvCell).join(',')).join('\r\n') };
        const esc = (x: any) => String(x).replace(/[&<>"']/g, (v: string) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' } as any)[v]);
        return { ...result, filename: q.kind + '.xml', mime: 'application/vnd.ms-excel', data: '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Report"><Table>' + values.map(r => '<Row>' + r.map(v => '<Cell><Data ss:Type="String">' + esc(v) + '</Data></Cell>').join('') + '</Row>').join('') + '</Table></Worksheet></Workbook>' };
    }));
    app.post('/api/ledger/bank-statements', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ companyId: id, bankAccountId: id, periodFrom: day, periodTo: day, openingBalance: z.string(), closingBalance: z.string(), documentVersionId: id, csv: z.string().min(1).max(2000000) }).strict().parse(req.body);
        need(m, 'statement_upload', d.companyId);
        const b = m.bank.list().find((b: any) => b.id === d.bankAccountId && b.companyId === d.companyId);
        requireOk(b, 422, 'invalidReference');
        await evidence(c, m, d.companyId, d.documentVersionId, false);
        const lines = P.parseCsv(d.csv);
        requireOk(d.periodTo >= d.periodFrom && lines.every((l: any) => l.date >= d.periodFrom && l.date <= d.periodTo) && L.units(d.openingBalance) + lines.reduce((n: bigint, l: any) => n + L.units(l.amount), 0n) === L.units(d.closingBalance), 422, 'statementBalanceMismatch');
        const key = randomUUID();
        await c.query('insert into ab.finance_statements(id,tenant_id,company_id,bank_account_id,period_from,period_to,opening_balance,closing_balance,source_hash,document_version_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)', [key, s.tenant_id, d.companyId, b.id, d.periodFrom, d.periodTo, d.openingBalance, d.closingBalance, sha(d.csv), d.documentVersionId, s.user_id]);
        for (const l of lines)
            await c.query('insert into ab.finance_statement_lines(id,tenant_id,statement_id,line_no,effective_on,amount,reference)values($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.tenant_id, key, l.line_no, l.date, l.amount, l.reference]);
        await event(c, cipher, s, d.companyId, key, 'bank_statement_created', null, { ...d, csv: undefined, lines: lines.length });
        return { id: key, status: 'Review', ocr: false };
    }));
    app.post('/api/ledger/bank-statement-lines/:id/match', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ entryId: id }).strict().parse(req.body), r = (await c.query('select l.*,st.company_id,st.bank_account_id,st.status,st.period_from,st.period_to from ab.finance_statement_lines l join ab.finance_statements st on st.id=l.statement_id where l.id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(r?.bank_account_id && r.status === 'Review', 409, 'invalidTransition'); need(m, 'reconcile', r.company_id); const e = (await c.query("select e.*,coalesce(o.effective_on,j.effective_on)date from ab.finance_entries e left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.id=$1 and(o.status='Approved'or j.status='Posted')", [d.entryId])).rows[0]; requireOk(e && e.company_id === r.company_id && e.bank_account_id === r.bank_account_id && L.units(e.debit) - L.units(e.credit) === L.units(r.amount) && e.date.toISOString().slice(0, 10) === r.effective_on.toISOString().slice(0, 10) && e.date >= r.period_from && e.date <= r.period_to, 422, 'amountMismatch'); await c.query('update ab.finance_statement_lines set entry_id=$2 where id=$1', [r.id, e.id]); await event(c, cipher, s, r.company_id, r.id, 'bank_statement_line_matched', { entryId: r.entry_id }, d); return { id: r.id }; }));
    app.post('/api/ledger/bank-statements/:id/approve', route(async (c: any, m: any, s: any, req: any) => {
        const st = (await c.query('select * from ab.finance_statements where id=$1 for update', [id.parse(req.params.id)])).rows[0];
        requireOk(st?.bank_account_id && st.status === 'Review', 409, 'invalidTransition');
        need(m, 'reconcile', st.company_id);
        await evidence(c, m, st.company_id, st.document_version_id);
        const b = m.bank.list().find((x: any) => x.id === st.bank_account_id);
        requireOk(b, 403, 'denied');
        requireOk(!(await c.query('select 1 from ab.finance_statement_lines where statement_id=$1 and entry_id is null', [st.id])).rowCount, 409, 'unresolvedDifference');
        const entries = (await c.query("select e.*,coalesce(o.effective_on,j.effective_on)date from ab.finance_entries e left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.bank_account_id=$1 and(o.status='Approved'or j.status='Posted')and coalesce(o.effective_on,j.effective_on)<=$2", [b.id, st.period_to])).rows;
        const opening = L.units(b.openingBalance) + entries.filter((e: any) => e.date < st.period_from).reduce((n: bigint, e: any) => n + L.units(e.debit) - L.units(e.credit), 0n), closing = L.units(b.openingBalance) + entries.reduce((n: bigint, e: any) => n + L.units(e.debit) - L.units(e.credit), 0n);
        requireOk(opening === L.units(st.opening_balance) && closing === L.units(st.closing_balance), 409, 'unresolvedDifference');
        for (const e of entries.filter((e: any) => e.date >= st.period_from))
            requireOk((await c.query('select 1 from ab.finance_statement_lines where statement_id=$1 and entry_id=$2', [st.id, e.id])).rowCount, 409, 'unresolvedDifference');
        await c.query("update ab.finance_statements set status='Approved',approved_by=$2 where id=$1", [st.id, s.user_id]);
        await event(c, cipher, s, st.company_id, st.id, 'bank_reconciliation_approved', null, { status: 'Approved' });
        return { id: st.id };
    }));
    app.get('/api/ledger/customer-credit', route(async (c: any, m: any, s: any, req: any) => { const q = z.object({ companyId: id, customerId: id, currency }).strict().parse(req.query); need(m, 'view', q.companyId); await customer(c, m, q.customerId, q.companyId); const receipts = (await c.query("select r.id,r.amount::text,(coalesce((select sum(a.amount)from ab.vehicle_allocations a where a.receipt_id=r.id and not exists(select 1 from ab.finance_allocation_reversals x where x.allocation_id=a.id)),0)+coalesce((select sum(x.amount)from ab.finance_credit_applications x join ab.finance_receipts y on y.id=x.application_receipt_id where x.source_receipt_id=r.id and y.payment_state='Cleared'),0))::text allocated from ab.finance_receipts r where company_id=$1 and customer_id=$2 and currency=$3 and payment_state='Cleared'and kind<>'credit'", [q.companyId, q.customerId, q.currency])).rows; return { currency: q.currency, amount: L.money(receipts.reduce((n: bigint, r: any) => n + L.units(r.amount) - L.units(r.allocated), 0n)), receipts }; }));
    app.post('/api/ledger/notification-rules', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, userId: id, action: z.enum(['ledger:short_collection', 'ledger:partial_deposit', 'ledger:deposit_due', 'ledger:deposit_overdue', 'ledger:cheque_returned', 'ledger:missing_invoice', 'ledger:refill', 'ledger:card_AwaitingStatement', 'ledger:card_UrgentApproval']) }).strict().parse(req.body); need(m, 'configure', d.companyId); const u = m.state.users.find((x: any) => x.id === d.userId); requireOk(u?.status === 'Active' && financeRight({ ...m, actor: u }, 'ledger_view', d.companyId), 422, 'invalidReference'); const key = randomUUID(); await c.query('insert into ab.finance_notification_rules(id,tenant_id,company_id,user_id,action,created_by)values($1,$2,$3,$4,$5,$6)', [key, s.tenant_id, d.companyId, d.userId, d.action, s.user_id]); await event(c, cipher, s, d.companyId, key, 'ledger_notification_rule', null, d); return { id: key }; }));
    app.post('/api/ledger/credits/apply', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, customerId: id, vehicleId: opt, sourceReceiptId: id, itemId: id, currency, amount: positive, effectiveOn: day, reason: text }).strict().parse(req.body); need(m, 'collect', d.companyId); await customer(c, m, d.customerId, d.companyId, d.vehicleId || undefined); const r = (await c.query('select * from ab.finance_receipts where id=$1 for update', [d.sourceReceiptId])).rows[0]; requireOk(r && r.payment_state === 'Cleared' && r.kind !== 'credit' && r.company_id === d.companyId && r.customer_id === d.customerId && r.currency === d.currency, 422, 'invalidReference'); const allocated = L.units((await c.query('select coalesce(sum(a.amount),0)::text amount from ab.vehicle_allocations a where receipt_id=$1 and not exists(select 1 from ab.finance_allocation_reversals x where x.allocation_id=a.id)', [r.id])).rows[0].amount), applied = L.units((await c.query("select coalesce(sum(x.amount),0)::text amount from ab.finance_credit_applications x join ab.finance_receipts a on a.id=x.application_receipt_id where source_receipt_id=$1 and a.payment_state='Cleared'", [r.id])).rows[0].amount); requireOk(L.units(r.amount) - allocated - applied >= L.units(d.amount), 422, 'insufficientCustomerCredit'); const it = await item(c, cipher, m, d.itemId, d.companyId); requireOk(it.data.receipt, 403, 'denied'); const cfg = await config(c, cipher, d.companyId), credit = await chart(c, d.companyId, d.currency, cfg.customerCreditAccountId, 'liability'), ar = await resolve(c, d.companyId, d.currency, it.data.receivableId), key = randomUUID(), n = await number(c, s.tenant_id, 'receipt'); const due = await invoices(c, d); requireOk(!due.some((i: any) => i.item_id === it.id && L.units(i.written_off) > 0n), 409, 'writeoffRecoveryAccountingReviewRequired'); await c.query("insert into ab.finance_receipts(id,tenant_id,company_id,holder_id,amount,currency,kind,reference,created_by,item_id,customer_id,vehicle_id,receipt_number,received_on,payment_state,payload_cipher)values($1,$2,$3,$4,$5,$6,'credit',$7,$4,$8,$9,$10,$11,$12,'Cleared',$13)", [key, s.tenant_id, d.companyId, s.user_id, d.amount, d.currency, 'CR-' + n, it.id, d.customerId, d.vehicleId || null, n, d.effectiveOn, cipher.seal(d)]); const receipt = (await c.query('select * from ab.finance_receipts where id=$1', [key])).rows[0]; requireOk(await allocateReceipt(c, s, receipt, cipher) === 0n, 422, 'amountExceedsDues'); await c.query('insert into ab.finance_credit_applications(id,tenant_id,company_id,source_receipt_id,application_receipt_id,amount,created_by)values($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.tenant_id, d.companyId, r.id, key, d.amount, s.user_id]); await journal(c, cipher, s, d.companyId, d.effectiveOn, d.currency, 'credit-application:' + key, [line(credit, L.units(d.amount)), line(ar, -L.units(d.amount))], { ...d, applicationReceiptId: key, newMoneyReceived: false }); return { id: key, newMoneyReceived: false }; }));
    app.post('/api/ledger/funds/:id/count', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ actual: money, effectiveOn: day, reason: text }).strict().parse(req.body), f = (await c.query('select * from ab.finance_funds where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(f, 404, 'notFound'); need(m, 'petty_spend', f.company_id); requireOk(f.holder_id === s.user_id || financeRight(m, 'ledger_fund_manage', f.company_id)); const book = await balance(c, f.chart_id), countId = await fact(c, cipher, s, f.company_id, f.holder_id, 'fund_count_reported', 'fund-count:' + req.headers['idempotency-key'], L.money(L.units(d.actual) - book), { ...d, fundId: f.id, bookBalance: L.money(book), verified: false, salaryDeduction: false }); await event(c, cipher, s, f.company_id, f.id, 'fund_count_reported', null, { ...d, countId, bookBalance: L.money(book) }); return { id: countId, bookBalance: L.money(book), actual: d.actual, salaryDeduction: false }; }));
    app.post('/api/ledger/funds/:id/counts/:countId/settle', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ counterpartId: id, effectiveOn: day, reason: text, confirm: z.literal(true) }).strict().parse(req.body), f = (await c.query('select * from ab.finance_funds where id=$1', [id.parse(req.params.id)])).rows[0]; requireOk(f, 404, 'notFound'); need(m, 'fund_manage', f.company_id); need(m, 'settle', f.company_id); const count = (await c.query("select * from ab.finance_kpi_facts where id=$1 and kind='fund_count_reported'", [id.parse(req.params.countId)])).rows[0]; requireOk(count?.company_id === f.company_id, 422, 'invalidReference'); const data = cipher.open(count.payload_cipher); requireOk(data.fundId === f.id && d.effectiveOn >= data.effectiveOn, 422, 'invalidReference'); const current = await balance(c, f.chart_id), delta = L.units(data.actual) - L.units(data.bookBalance); requireOk(current === L.units(data.bookBalance) && delta !== 0n, 409, 'recountRequired'); const cash = await chart(c, f.company_id, f.currency, f.chart_id, 'asset'), counter = await chart(c, f.company_id, f.currency, d.counterpartId); requireOk((delta < 0n ? ['expense', 'asset'] : ['income', 'liability']).includes(counter.kind), 422, 'accountMappingRequired'); const key = await journal(c, cipher, s, f.company_id, d.effectiveOn, f.currency, 'fund-count:' + count.id, [line(cash, delta), line(counter, -delta)], { fundId: f.id, countId: count.id, reason: d.reason, verified: true, salaryDeduction: false }); await fact(c, cipher, s, f.company_id, f.holder_id, 'fund_count_verified', 'fund-count-verified:' + count.id, L.money(delta), { ...d, countId: count.id, verified: true, salaryDeduction: false }); return { id: key, balance: data.actual, salaryDeduction: false }; }));
}
