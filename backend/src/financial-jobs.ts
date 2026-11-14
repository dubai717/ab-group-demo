import {operatingBillingTick} from './operating-billing.js';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { security, transaction, requireOk } from './core.js';
import { model } from './data.js';
import { financeRight } from './finance.js';
import { L, config, notify, fact, invoice, company } from './ledger-domain.js';
import { today } from './vehicle-domain.js';
export async function financialReminders(c: any, cipher: any, s: any, co: string, asOf = today()) {
    const d = { companyId: co };
    const now = asOf, cfg = await config(c, cipher, d.companyId), rows = (await c.query('select holder_id,currency,min(start)::date start,sum(amount)::text amount from(select holder_id,currency,receipt_id,min(effective_on)start,sum(amount)amount from ab.finance_custody_moves where company_id=$1 group by holder_id,currency,receipt_id having sum(amount)>0)x group by holder_id,currency', [d.companyId])).rows;
    let emitted = 0;
    for (const r of rows) {
        const due = L.nextWorkingDay(r.start.toISOString().slice(0, 10), cfg.workdays || [1, 2, 3, 4, 5], cfg.holidays || [], cfg.depositDays || 1);
        if (now >= due) {
            await notify(c, s, d.companyId, r.holder_id, now === due ? 'ledger:deposit_due' : 'ledger:deposit_overdue', 'deposit-due:' + r.holder_id + ':' + r.currency + ':' + now);
            await fact(c, cipher, s, d.companyId, r.holder_id, 'deposit_due_fact', 'deposit-due:' + r.holder_id + ':' + r.currency + ':' + now, r.amount, { dueOn: due, asOf: now, confirmedShortage: false });
            emitted++;
        }
    }
    const date = new Date(now + 'T00:00:00Z'), prev = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1)).toISOString().slice(0, 10), end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 0)).toISOString().slice(0, 10);
    const cards = (await c.query('select * from ab.finance_cards where company_id=$1 and active', [d.companyId])).rows;
    for (const card of cards) {
        const st = (await c.query('select * from ab.finance_statements where card_id=$1 and period_from=$2 and period_to=$3 order by created_at desc limit 1', [card.id, prev, end])).rows[0], missing = Number((await c.query('select count(*)n from ab.finance_card_splits sp join ab.finance_card_charges ch on ch.id=sp.charge_id where ch.card_id=$1 and ch.paid_on between $2 and $3 and sp.customer_id is not null and sp.invoice_id is null', [card.id, prev, end])).rows[0].n), vouchers = (await c.query('select v.status from ab.finance_card_settlements x join ab.finance_vouchers v on v.id=x.voucher_id where x.card_id=$1 and x.month=$2', [card.id, prev])).rows, phase = L.cardPhase(date.getUTCDate(), { statement: !!st, reconciled: st?.status === 'Approved', missingInvoices: missing, vouchers: vouchers.length > 0, approved: vouchers.length > 0 && vouchers.every((x: any) => ['Approved', 'Paid'].includes(x.status)), settled: vouchers.length > 0 && vouchers.every((x: any) => x.status === 'Paid') });
        if (phase !== 'Settled' && phase !== 'Approved') {
            await notify(c, s, d.companyId, card.id, 'ledger:card_' + phase, 'card-reminder:' + card.id + ':' + prev + ':' + phase + ':' + now);
            emitted++;
        }
    }
    return { emitted, asOf: now, schedulerEnabled: process.env.FINANCIAL_JOBS_ENABLED === 'true', ocr: false };
}
// Only explicitly configured automatic GENERAL items. Existing contract finance/service/circular
// generators stay authoritative; this runner will never invent principal/profit classifications.
export async function recurringFinancial(c: any, cipher: any, m: any, s: any, co: string, asOf = today()) {
    company(m, co);
    let issued = 0, skipped = 0;
    const items = (await c.query('select * from ab.finance_items where active')).rows.map((r: any) => ({ ...r, data: cipher.open(r.payload_cipher) })).filter((r: any) => r.data.invoice && r.data.methods.includes('automatic') && r.data.recurrence !== 'none' && L.units(r.data.recurringAmount) > 0n && r.data.companyIds.includes(co));
    const vehicles = (await c.query("select v.*,u.status customer_status from ab.vehicles v join ab.customers u on u.id=v.customer_id where v.company_id=$1 and v.status in('Active','Pending')", [co])).rows;
    const targetYear = Number(asOf.slice(0, 4)) + (asOf.slice(5, 7) === '12' ? 1 : 0), startMonth = asOf.slice(5, 7) === '12' ? 1 : Number(asOf.slice(5, 7));
    for (const it of items) {
        if (['finance', 'service', 'circular', 'insurance', 'gps'].includes(it.category)) {
            skipped += vehicles.length;
            continue;
        }
        for (const v of vehicles) {
            if (v.customer_status !== 'Active') {
                skipped++;
                continue;
            }
            const data = cipher.open(v.payload_cipher), registered = data.registeredOn || asOf, months = it.data.recurrence === 'annual' ? [it.data.annualMonth || Number(registered.slice(5, 7))] : Array.from({ length: 13 - startMonth }, (_, i) => startMonth + i);
            for (const month of months) {
                const date = targetYear + '-' + String(month).padStart(2, '0') + '-01';
                if (date < registered || date < (it.data.recurrenceStart || '0001-01-01') || date < asOf.slice(0, 7) + '-01')
                    continue;
                const sourceKey = 'recurring:' + it.id + ':' + v.id + ':' + date;
                if ((await c.query('select 1 from ab.finance_invoice_links where company_id=$1 and source_key=$2', [co, sourceKey])).rowCount)
                    continue;
                await invoice(c, cipher, m, s, { companyId: co, customerId: v.customer_id, vehicleId: v.id, itemId: it.id, amount: it.data.recurringAmount, currency: data.currency, issuedOn: asOf, dueOn: date, sourceKey, mode: 'automatic', description: 'Configured recurring ' + it.code });
                issued++;
            }
        }
    }
    return { issued, skipped, throughYear: targetYear, asOf };
}
export async function financialTick(pool: Pool, cipher: any, asOf = today()) {
    if (!(await pool.query("select to_regprocedure('ab.enabled_financial_jobs()')ok")).rows[0].ok)
        return { available: false, issued: 0 };
    let issued = 0;
    for (const job of (await pool.query('select * from ab.enabled_financial_jobs()')).rows) {
        const result = await transaction(pool, job.tenant_id, job.actor_id, async (c) => { const m = await model(c, job.actor_id, cipher); if (!m.state.companies.some((co: any) => co.id === job.company_id && co.status === 'Active'))
            return { issued: 0 }; if (!financeRight(m, 'ledger_configure', job.company_id) || !financeRight(m, 'ledger_invoice_create', job.company_id))
            return { issued: 0 }; const s = { tenant_id: job.tenant_id, user_id: job.actor_id, actor_type: 'service' }, result = await recurringFinancial(c, cipher, m, s, job.company_id, asOf), reminders = await financialReminders(c, cipher, s, job.company_id, asOf), operating = await operatingBillingTick(c,cipher,m,s,job.company_id,asOf);result.issued+=operating.issued; if (result.issued || reminders.emitted)
            await c.query("insert into ab.audit_events(id,tenant_id,actor_id,actor_type,action,entity_type,entity_id,fields,request_id)values($1,$2,$3,'service','financial_scheduled_run','company',$4,ARRAY['invoices','reminders'],gen_random_uuid())", [randomUUID(), job.tenant_id, job.actor_id, job.company_id]); return result; });
        issued += result.issued;
    }
    return { available: true, issued };
}
export function startFinancialJobs(pool: Pool, key: string, enabled: boolean) { let pending: Promise<any> | null = null; const tick = () => { if (pending)
    return; pending = financialTick(pool, security(key)).catch(() => console.log('STOP: financial worker check failed; details withheld')).finally(() => { pending = null; }); }; if (!enabled)
    return async () => { }; tick(); const timer = setInterval(tick, 3600000); timer.unref(); return async () => { clearInterval(timer); if (pending)
    await pending; }; }
