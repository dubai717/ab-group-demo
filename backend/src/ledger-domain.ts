import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { ApiError, requireOk } from './core.js';
import { audit } from './data.js';
import { financeRight } from './finance.js';
import { customerCan } from './customers.js';
import { number, today } from './vehicle-domain.js';
export const L: {
    units: (v: any) => bigint;
    money: (v: bigint) => string;
    rights: string[];
    balanced: (v: any) => boolean;
    distribute: (v: any, i: any) => any;
    nextWorkingDay: (...v: any[]) => string;
    cardPhase: (...v: any[]) => string;
    taxPortion: (g: bigint, t: bigint, cg: bigint, ct: bigint, a: bigint) => bigint;
    csvCell: (v: any) => string;
} = createRequire(import.meta.url)('../../ledger-policy.js');
export const P = createRequire(import.meta.url)('../../finance-policy.js');
export const need = (m: any, r: string, co: string) => requireOk(financeRight(m, 'ledger_' + r, co));
export function company(m: any, co: string) { requireOk(m.state.companies.some((x: any) => x.id === co && x.status === 'Active'), 422, 'inactiveCompany'); }
export async function ready(c: any) {
    if (!(await c.query("select to_regclass('ab.finance_journals') ok")).rows[0].ok)
        throw new ApiError(503, 'ledgerSchemaPending');
}
export async function open(c: any, co: string, date: string) { requireOk(!(await c.query("select 1 from ab.finance_periods where company_id=$1 and month=date_trunc('month',$2::date)::date", [co, date])).rowCount, 409, 'periodClosed'); }
export async function event(c: any, cipher: any, s: any, co: string, entity: string, action: string, before: any, after: any) {
    await c.query('insert into ab.finance_events(id,tenant_id,company_id,actor_id,entity_type,entity_id,action,payload_cipher,actor_type)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), s.tenant_id, co, s.user_id, 'ledger', entity, action, cipher.seal({ before, after }), s.actor_type || 'user']);
    if (s.actor_type === 'service')
        await c.query("insert into ab.audit_events(id,tenant_id,actor_id,actor_type,action,entity_type,entity_id,fields,request_id)values(gen_random_uuid(),$1,$2,'service',$3,'ledger',$4,$5,gen_random_uuid())", [s.tenant_id, s.user_id, action, entity, Object.keys(after || {})]);
    else
        await audit(c, s.tenant_id, s.user_id, action, 'ledger', entity, Object.keys(after || {}));
}
export async function notify(c: any, s: any, co: string, entity: string, action: string, key: string) { await c.query(`insert into ab.finance_notifications(id,tenant_id,company_id,user_id,action,event_key,entity_id)select gen_random_uuid(),u.tenant_id,$1,u.id,$2,$3,$4 from ab.users u where u.tenant_id=$5 and u.status='Active' and (u.role_id='owner' or exists(select 1 from ab.finance_notification_rules r where r.user_id=u.id and r.company_id=$1 and r.action=$2))on conflict(tenant_id,user_id,event_key)do nothing`, [co, action, 'ledger:' + co + ':' + key, entity, s.tenant_id]); }
export async function fact(c: any, cipher: any, s: any, co: string, employee: string, kind: string, key: string, amount: string | null, payload: any) { const result = await c.query('insert into ab.finance_kpi_facts(id,tenant_id,company_id,employee_id,kind,source_key,amount,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)on conflict(tenant_id,source_key)do nothing returning id', [randomUUID(), s.tenant_id, co, employee, kind, key, amount, cipher.seal({ actorType: s.actor_type || 'user', ...payload }), s.user_id]); return result.rows[0]?.id; }
export async function config(c: any, cipher: any, co: string) { const r = (await c.query('select value from ab.settings where key=$1', ['ledger:' + co])).rows[0]; return r ? cipher.open(r.value.cipher) : {}; }
export async function chart(c: any, co: string, currency: string, id: string, kind?: string) { const r = (await c.query('select c.*,a.active definition_active from ab.finance_chart c left join ab.finance_accounts a on a.id=c.definition_id where c.id=$1', [id])).rows[0]; requireOk(r && r.active && r.definition_active !== false && r.company_id === co && r.currency === currency && (!kind || r.kind === kind), 422, 'accountMappingRequired'); return r; }
export async function resolve(c: any, co: string, currency: string, definition: string) { const r = (await c.query('select id from ab.finance_chart where company_id=$1 and currency=$2 and definition_id=$3', [co, currency, definition])).rows[0]; requireOk(r, 422, 'accountMappingRequired'); return chart(c, co, currency, r.id); }
export async function item(c: any, cipher: any, m: any, id: string, co: string, allowInactive = false) {
    const r = (await c.query('select * from ab.finance_items where id=$1', [id])).rows[0];
    requireOk(r && (allowInactive || r.active), 422, 'invalidItem');
    const d = cipher.open(r.payload_cipher);
    requireOk(!d.companyIds?.length || d.companyIds.includes(co), 403, 'denied');
    if (d.permission)
        requireOk(financeRight(m, d.permission, co));
    return { ...r, data: d };
}
export const line = (a: any, delta: bigint) => ({ companyId: a.company_id, chartId: a.id, bankAccountId: a.bank_account_id || null, currency: a.currency, debit: L.money(delta > 0n ? delta : 0n), credit: L.money(delta < 0n ? -delta : 0n) });
export async function journal(c: any, cipher: any, s: any, co: string, date: string, currency: string, key: string, lines: any[], payload: any, posted = true, reversalOf?: string) {
    await open(c, co, date);
    L.balanced(lines);
    requireOk(lines.every(l => l.companyId === co && l.currency === currency), 422, 'unbalanced');
    const old = (await c.query('select id from ab.finance_journals where company_id=$1 and source_key=$2', [co, key])).rows[0];
    requireOk(!old, 409, 'duplicate');
    const id = randomUUID();
    await c.query("insert into ab.finance_journals(id,tenant_id,company_id,number,source_key,effective_on,currency,status,reversal_of,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,'Draft',$8,$9,$10)", [id, s.tenant_id, co, await number(c, s.tenant_id, 'journal'), key, date, currency, reversalOf || null, cipher.seal({ actorType: s.actor_type || 'user', ...payload }), s.user_id]);
    for (const l of lines) {
        const a = await chart(c, co, currency, l.chartId);
        await c.query('insert into ab.finance_entries(id,tenant_id,journal_id,company_id,chart_id,bank_account_id,debit,credit,currency)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), s.tenant_id, id, co, a.id, a.bank_account_id, l.debit, l.credit, currency]);
    }
    if (posted)
        await post(c, s, id);
    await event(c, cipher, s, co, id, posted ? 'journal_posted' : 'journal_draft', null, { date, key, lines, ...payload });
    return id;
}
export async function post(c: any, s: any, id: string) { const r = (await c.query('select * from ab.finance_journals where id=$1 for update', [id])).rows[0]; requireOk(r && r.status === 'Draft', 409, 'invalidTransition'); await open(c, r.company_id, r.effective_on.toISOString().slice(0, 10)); await c.query("update ab.finance_journals set status='Posted',approved_by=$2,posted_at=now()where id=$1", [id, s.user_id]); }
export async function reverse(c: any, cipher: any, s: any, key: string, date: string, reason: string) { const j = (await c.query('select * from ab.finance_journals where id=$1', [key])).rows[0]; requireOk(j && j.status === 'Posted', 422, 'invalidReference'); requireOk(!(await c.query('select 1 from ab.finance_journals where reversal_of=$1', [key])).rowCount, 409, 'duplicate'); const rows = (await c.query('select * from ab.finance_entries where journal_id=$1', [key])).rows; return journal(c, cipher, s, j.company_id, date, j.currency, 'reverse:' + key, rows.map((r: any) => ({ companyId: r.company_id, chartId: r.chart_id, currency: r.currency, debit: r.credit, credit: r.debit })), { reason, originalId: key }, true, key); }
export async function evidence(c: any, m: any, co: string, id: string, clean = true) {
    requireOk(m.company.canFiles() || m.bank.can('view_documents', co));
    const r = (await c.query('select v.scan_status,d.company_id,b.company_id bank_company from ab.document_versions v join ab.documents d on d.id=v.document_id left join ab.bank_accounts b on b.id=d.bank_account_id where v.id=$1', [id])).rows[0];
    requireOk(r && (r.company_id === co || r.bank_company === co), 422, 'invalidReference');
    if (clean)
        requireOk(r.scan_status === 'clean', 423, 'documentQuarantined');
    return r;
}
export async function balance(c: any, account: string) { return L.units((await c.query("select coalesce(sum(e.debit-e.credit),0)::text amount from ab.finance_entries e left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.chart_id=$1 and(o.status='Approved'or j.status='Posted')", [account])).rows[0].amount); }
export async function invoices(c: any, q: any) { const rows = (await c.query(`select i.*,l.item_id,l.issued_on,l.source_key financial_source,it.name_ar,it.name_en,it.priority,ab.financial_allocation_total(i.id)::text paid,coalesce((select sum(a.amount)from ab.vehicle_invoice_adjustments a where a.invoice_id=i.id and a.kind<>'writeoff'),0)::text credited,coalesce((select sum(a.amount)from ab.vehicle_invoice_adjustments a where a.invoice_id=i.id and a.kind='writeoff'),0)::text written_off from ab.vehicle_invoices i join ab.finance_invoice_links l on l.invoice_id=i.id join ab.finance_items it on it.id=l.item_id where i.company_id=$1 and($2::uuid is null or i.customer_id=$2)and($3::uuid is null or i.vehicle_id=$3)and($4::text is null or i.currency=$4) order by it.priority,i.due_on,i.invoice_number`, [q.companyId, q.customerId || null, q.vehicleId || null, q.currency || null])).rows; return rows.map((r: any) => { const legal = L.units(r.amount) - L.units(r.paid) - L.units(r.credited), book = legal - L.units(r.written_off); return { ...r, amount: L.money(L.units(r.amount)), paid: L.money(L.units(r.paid)), outstanding: L.money(legal), bookOutstanding: L.money(book > 0n ? book : 0n), status: legal === 0n ? (L.units(r.credited) === L.units(r.amount) ? 'Corrected' : 'Paid') : L.units(r.paid) > 0n ? 'Partial' : 'Unpaid', dueOn: r.due_on.toISOString().slice(0, 10), invoiceNumber: String(r.invoice_number), payload_cipher: undefined }; }); }
export async function customer(c: any, m: any, id: string, co: string, vehicle?: string) {
    const r = (await c.query('select * from ab.customers where id=$1', [id])).rows[0];
    requireOk(r && r.status === 'Active' && customerCan(m, 'view', r.company_id), 403, 'denied');
    if (vehicle) {
        const v = (await c.query('select customer_id from ab.vehicles where id=$1 and company_id=$2', [vehicle, co])).rows[0];
        requireOk(v?.customer_id === id, 422, 'invalidReference');
    }
    return r;
}
export async function invoice(c: any, cipher: any, m: any, s: any, d: any) { company(m, d.companyId); await customer(c, m, d.customerId, d.companyId, d.vehicleId); const it = await item(c, cipher, m, d.itemId, d.companyId); requireOk(it.data.invoice && it.data.methods.includes(d.mode || 'manual'), 403, 'denied'); await open(c, d.companyId, d.issuedOn); const old = (await c.query('select id from ab.finance_invoice_links where company_id=$1 and source_key=$2', [d.companyId, d.sourceKey])).rows[0]; requireOk(!old, 409, 'duplicate'); const id = randomUUID(); await c.query("insert into ab.vehicle_invoices(id,tenant_id,company_id,customer_id,vehicle_id,invoice_number,kind,source_key,due_on,amount,currency,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,'financial',$7,$8,$9,$10,$11,$12)", [id, s.tenant_id, d.companyId, d.customerId, d.vehicleId || null, await number(c, s.tenant_id, 'invoice'), 'financial:' + d.sourceKey, d.dueOn, d.amount, d.currency, cipher.seal({ itemId: d.itemId, description: d.description || '', issuedOn: d.issuedOn, source: d.mode || 'manual' }), s.user_id]); await linkInvoice(c, cipher, m, s, id, it, d.issuedOn, d.sourceKey); return { id }; }
export async function linkInvoice(c: any, cipher: any, m: any, s: any, id: string, it: any, date: string, key: string) {
    const i = (await c.query('select * from ab.vehicle_invoices where id=$1', [id])).rows[0];
    requireOk(i, 404, 'notFound');
    await c.query('insert into ab.finance_invoice_links(id,tenant_id,company_id,invoice_id,item_id,issued_on,source_key,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), s.tenant_id, i.company_id, id, it.id, date, key, s.user_id]);
    const ar = await resolve(c, i.company_id, i.currency, it.data.receivableId), income = await resolve(c, i.company_id, i.currency, it.data.revenueId);
    requireOk(ar.kind === 'asset' && ['income', 'liability'].includes(income.kind), 422, 'accountMappingRequired');
    const rate = L.units(it.data.taxRate || '0'), tax = rate ? (L.units(i.amount) * rate + (100000n + rate) / 2n) / (100000n + rate) : 0n, lines = [line(ar, L.units(i.amount)), line(income, -(L.units(i.amount) - tax))];
    if (tax) {
        const taxAccount = await resolve(c, i.company_id, i.currency, it.data.taxAccountId);
        requireOk(taxAccount.kind === 'liability', 422, 'accountMappingRequired');
        lines.push(line(taxAccount, -tax));
    }
    await journal(c, cipher, s, i.company_id, date, i.currency, 'invoice:' + id, lines, { invoiceId: id, itemId: it.id, taxRate: it.data.taxRate || '0', taxAmount: L.money(tax) });
    return id;
}
export async function custody(c: any, co: string, holder: string, currency: string, receipt?: string, kind = 'cash') { return (await c.query('select r.id,r.reference,r.item_id,r.kind,sum(m.amount)::text amount,min(m.created_at) since from ab.finance_custody_moves m join ab.finance_receipts r on r.id=m.receipt_id where m.company_id=$1 and m.holder_id=$2 and m.currency=$3 and r.kind=$5 and($4::uuid is null or r.id=$4)group by r.id having sum(m.amount)>0 order by min(m.created_at),r.id', [co, holder, currency, receipt || null, kind])).rows; }
export async function move(c: any, s: any, co: string, receipt: string, holder: string, currency: string, amount: bigint, key: string, date = today()) { await c.query('insert into ab.finance_custody_moves(id,tenant_id,company_id,receipt_id,holder_id,currency,amount,source_key,created_by,effective_on)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [randomUUID(), s.tenant_id, co, receipt, holder, currency, L.money(amount), key, s.user_id, date]); }
export async function moveAmount(c: any, s: any, co: string, holder: string, currency: string, amount: bigint, key: string, to?: string, date = today(), kind = 'cash') {
    let remaining = amount;
    for (const r of await custody(c, co, holder, currency, undefined, kind)) {
        if (!remaining)
            break;
        const taken = L.units(r.amount) < remaining ? L.units(r.amount) : remaining;
        await move(c, s, co, r.id, holder, currency, -taken, key + ':out:' + r.id, date);
        if (to)
            await move(c, s, co, r.id, to, currency, taken, key + ':in:' + r.id, date);
        remaining -= taken;
    }
    requireOk(remaining === 0n, 409, 'insufficientCustody');
}
export async function bankPosting(c: any, cipher: any, m: any, s: any, d: any) {
    const b = m.bank.list().find((b: any) => b.id === d.bankAccountId);
    requireOk(b && b.companyId === d.companyId && b.status === 'Active' && b.currency === d.currency, 422, 'inactiveBank');
    requireOk(d.effectiveOn >= b.openedAt, 422, 'invalidDate');
    await open(c, d.companyId, d.effectiveOn);
    const counter = await chart(c, d.companyId, d.currency, d.counterpartId);
    requireOk(counter.kind !== 'bank', 422, 'accountMappingRequired');
    const id = randomUUID(), op = { id, company_id: d.companyId, bank_account_id: b.id, kind: d.kind, amount: d.amount, currency: d.currency, counterpart_id: counter.id, direction: 'credit' };
    await c.query("insert into ab.finance_operations(id,tenant_id,company_id,kind,bank_account_id,amount,currency,effective_on,direction,reason,reference,counterpart_id,cheque_id,integration_refs,created_by,payment_method)values($1,$2,$3,$4,$5,$6,$7,$8,'credit',$9,$10,$11,$12,$13,$14,$15)", [id, s.tenant_id, d.companyId, d.kind, b.id, d.amount, d.currency, d.effectiveOn, d.reason, d.reference, counter.id, d.chequeId || null, d.integrationRefs || {}, s.user_id, d.chequeId ? 'cheque' : 'electronic']);
    const rows = P.journal(op, m.state.bankAccounts, (await c.query('select * from ab.finance_chart')).rows);
    for (const l of rows)
        await c.query('insert into ab.finance_entries(id,tenant_id,operation_id,company_id,chart_id,bank_account_id,debit,credit,currency)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [randomUUID(), s.tenant_id, id, l.company_id, l.chart_id, l.bank_account_id, l.debit, l.credit, l.currency]);
    await c.query("update ab.finance_operations set status='Approved',approved_by=$2,approved_at=now()where id=$1", [id, s.user_id]);
    await event(c, cipher, s, d.companyId, id, 'bank_posted', null, { ...d, lines: rows });
    return id;
}
export async function allocateReceipt(c: any, s: any, r: any) {
    let left = L.units(r.amount);
    const bills = await invoices(c, { companyId: r.company_id, customerId: r.customer_id, vehicleId: r.vehicle_id, currency: r.currency });
    for (const b of bills.filter((b: any) => b.item_id === r.item_id && b.vehicle_id === r.vehicle_id && L.units(b.outstanding) > 0n)) {
        const take = L.units(b.outstanding) < left ? L.units(b.outstanding) : left;
        if (!take)
            break;
        await c.query('insert into ab.vehicle_allocations(id,tenant_id,company_id,invoice_id,receipt_id,amount,created_by)values($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.tenant_id, r.company_id, b.id, r.id, L.money(take), s.user_id]);
        left -= take;
    }
    return left;
}
export async function postReceipt(c: any, cipher: any, m: any, s: any, r: any, method: string, date: string) {
    const it = await item(c, cipher, m, r.item_id, r.company_id, true), cfg = await config(c, cipher, r.company_id), debit = await chart(c, r.company_id, r.currency, method === 'cash' ? cfg.custodyAccountId : cfg.chequeTransitAccountId, 'asset'), ar = await resolve(c, r.company_id, r.currency, it.data.receivableId), credit = await chart(c, r.company_id, r.currency, cfg.customerCreditAccountId, 'liability');
    const extra = await allocateReceipt(c, s, r), settled = L.units(r.amount) - extra, lines = [line(debit, L.units(r.amount))];
    if (settled)
        lines.push(line(ar, -settled));
    if (extra)
        lines.push(line(credit, -extra));
    await journal(c, cipher, s, r.company_id, date, r.currency, 'receipt:' + r.id, lines, { receiptId: r.id, excess: L.money(extra), method });
    return extra;
}
