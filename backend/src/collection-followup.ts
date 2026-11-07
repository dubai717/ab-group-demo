import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireOk } from './core.js';
import { audit } from './data.js';
import { customerCan } from './customers.js';
import { financeRight } from './finance.js';
import { invoices } from './ledger-domain.js';
import { makeTask, task, taskEvent, taskRight } from './personnel-domain.js';
import { V, today, vehicleInvoices } from './vehicle-domain.js';

const uuid = z.uuid(), text = z.string().trim().min(1).max(2000);
const builtins = [
    { id: 'off', nameAr: 'مغلق', nameEn: 'Switched off', minutes: 60 },
    { id: 'no_answer', nameAr: 'لا يرد', nameEn: 'No answer', minutes: 30 },
    { id: 'promise', nameAr: 'وعد بالدفع', nameEn: 'Promise to pay', minutes: null },
    { id: 'paid', nameAr: 'أفاد بالسداد', nameEn: 'Reported paid', minutes: null },
];
async function configuration(c: any, company: string) {
    const r = (await c.query('select value from ab.settings where key=$1', ['collection-followup:' + company])).rows[0];
    if (r) return r.value;
    const legacy = (await c.query('select value from ab.settings where key=$1', ['customer:' + company])).rows[0]?.value;
    return { outcomes: builtins.map(o => ({ ...o, minutes: o.id === 'off' ? legacy?.offMinutes || 60 : o.id === 'no_answer' ? legacy?.noAnswerMinutes || 30 : null })) };
}
function allowed(m: any, company: string) {
    requireOk(customerCan(m, 'followup', company) && financeRight(m, 'ledger_view', company), 403, 'denied');
}
async function bill(c: any, m: any, id: string) {
    const r = (await c.query('select * from ab.vehicle_invoices where id=$1', [id])).rows[0];
    requireOk(r, 404, 'notFound'); allowed(m, r.company_id);
    const result = r.vehicle_id ? (await vehicleInvoices(c, r.vehicle_id)).find((i: any) => i.id === r.id) : (await invoices(c, {companyId:r.company_id})).find((i:any)=>i.id===r.id);
    requireOk(result,404,'notFound'); return {...result,legalOutstanding:result.legalOutstanding ?? V.money(V.units(result.amount)-V.units(result.paid)-V.units(result.credited || '0')),invoiceNumber:result.invoiceNumber || String(result.invoice_number),dueOn:result.dueOn || result.due_on.toISOString().slice(0,10)};
}
export function registerCollectionFollowup(app: any, call: any, cipher: any) {
    const route = (fn: any) => call(async (c: any, m: any, s: any, req: any) => {
        requireOk((await c.query("select to_regclass('ab.collection_attempts') ok")).rows[0].ok, 503, 'collectionFollowupMigrationPending');
        if (req.method !== 'GET') requireOk(req.headers['idempotency-key'], 422, 'idempotencyRequired');
        return fn(c, m, s, req);
    });
    app.get('/api/collections/settings/:companyId', route(async (c: any, m: any, _s: any, req: any) => {
        const company = uuid.parse(req.params.companyId); allowed(m, company); return configuration(c, company);
    }));
    app.post('/api/collections/settings/:companyId', route(async (c: any, m: any, s: any, req: any) => {
        const company = uuid.parse(req.params.companyId); requireOk(customerCan(m, 'configure', company));
        const d = z.object({ outcomes: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_]{0,49}$/), nameAr: text, nameEn: text, minutes: z.number().int().min(1).max(43200).nullable() }).strict()).min(4).max(50) }).strict().parse(req.body);
        requireOk(new Set(d.outcomes.map(o => o.id)).size === d.outcomes.length && builtins.every(o => d.outcomes.some(v => v.id === o.id)), 422, 'invalidOutcomes');
        requireOk(d.outcomes.filter(o => ['off','no_answer'].includes(o.id)).every(o => o.minutes !== null), 422, 'followupRequired');
        await c.query('insert into ab.settings values($1,$2,$3) on conflict(tenant_id,key)do update set value=excluded.value', [s.tenant_id, 'collection-followup:' + company, d]);
        await audit(c, s.tenant_id, s.user_id, 'collection_followup_configured', 'company', company, ['outcomes']);
        return { saved: true };
    }));
    app.post('/api/collections/tasks', route(async (c: any, m: any, s: any, req: any) => {
        const d = z.object({ invoiceId: uuid, employeeId: uuid, dueOn: z.iso.date().default(today()) }).strict().parse(req.body);
        const i = await bill(c, m, d.invoiceId); requireOk(V.units(i.legalOutstanding) > 0n, 409, 'invoiceSettled');
        requireOk(taskRight(m, 'create', i.company_id));
        const e = (await c.query('select user_id from ab.hr_employees where id=$1', [d.employeeId])).rows[0];
        requireOk(e && (e.user_id === m.actor.id || taskRight(m, 'assign', i.company_id)), 403, 'assignmentDenied');
        return makeTask(c, cipher, s, { companyId: i.company_id, employeeId: d.employeeId, sourceType: 'collection_invoice', sourceId: i.id, sourceKey: 'collection:invoice:' + i.id, dueOn: d.dueOn, title: 'متابعة تحصيل / Collection follow-up #' + i.invoiceNumber, expectedResult: 'Actual settlement or authorized closure', details: { invoiceId: i.id, customerId: i.customer_id, vehicleId: i.vehicle_id } });
    }));
    app.get('/api/collections/tasks/:id', route(async (c: any, m: any, _s: any, req: any) => {
        const t = await task(c, m, uuid.parse(req.params.id)); requireOk(t.source_type === 'collection_invoice', 422, 'invalidTask');
        const i = await bill(c, m, t.source_id);
        const attempts = (await c.query('select * from ab.collection_attempts where task_id=$1 order by created_at,id', [t.id])).rows;
        const customer=(await c.query('select payload_cipher from ab.customers where id=$1',[i.customer_id])).rows[0],contact=cipher.open(customer.payload_cipher);
        return { customer:{id:i.customer_id,name:contact.fullName,phones:(contact.phones||[]).filter((p:any)=>p.status==='valid').map((p:any)=>({id:p.id,number:p.number}))},task: { id: t.id, state: t.state, revision: t.revision, employeeId: t.employee_id }, invoice: { id: i.id, number: i.invoiceNumber, customerId: i.customer_id, vehicleId: i.vehicle_id, dueOn: i.dueOn, outstanding: i.legalOutstanding, currency: i.currency }, configuration: await configuration(c, t.company_id), attempts: attempts.map((r: any) => ({ id: r.id, outcome: r.outcome, nextAt: r.next_at, createdAt: r.created_at, createdBy: r.created_by, ...cipher.open(r.payload_cipher) })) };
    }));
    app.post('/api/collections/tasks/:id/attempts', route(async (c: any, m: any, s: any, req: any) => {
        await c.query('select id from ab.tasks where id=$1 for update',[uuid.parse(req.params.id)]);
        const t = await task(c, m, uuid.parse(req.params.id));
        requireOk(t.source_type === 'collection_invoice' && !['Completed','Closed'].includes(t.state), 409, 'taskTerminal');
        const i = await bill(c, m, t.source_id), d = z.object({ outcome: z.string().max(50), phoneId: z.string().max(80), note: text, nextAt: z.iso.datetime({offset:true}).optional() }).strict().parse(req.body);
        const customer = (await c.query('select payload_cipher from ab.customers where id=$1', [i.customer_id])).rows[0];
        requireOk(cipher.open(customer.payload_cipher).phones?.some((p: any) => p.id === d.phoneId && p.status === 'valid'), 422, 'invalidPhone');
        const cfg = await configuration(c, t.company_id), outcome = cfg.outcomes.find((o: any) => o.id === d.outcome);
        requireOk(outcome, 422, 'invalidOutcome');
        const due = outcome.minutes ? new Date(Date.now() + outcome.minutes * 60000) : d.nextAt ? new Date(d.nextAt) : null;
        requireOk(d.outcome !== 'promise' || due, 422, 'followupRequired');
        requireOk(!due || due.getTime() > Date.now(), 422, 'followupMustBeFuture');
        const key = randomUUID();
        await c.query(`insert into ab.collection_attempts(id,tenant_id,company_id,customer_id,vehicle_id,invoice_id,task_id,outcome,next_at,payload_cipher,created_by)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [key,s.tenant_id,t.company_id,i.customer_id,i.vehicle_id,i.id,t.id,d.outcome,due,cipher.seal({note:d.note,phoneId:d.phoneId,outcomeSnapshot:outcome,outstandingSnapshot:i.legalOutstanding,currency:i.currency}),s.user_id]);
        if (due) {
            const assignee = (await c.query('select user_id from ab.hr_employees where id=$1', [t.employee_id])).rows[0];
            requireOk(assignee?.user_id, 409, 'taskAssigneeHasNoLogin');
            await c.query(`insert into ab.finance_notifications(id,tenant_id,company_id,user_id,action,event_key,entity_id,due_at)
                values($1,$2,$3,$4,'collection:followup',$5,$6,$7) on conflict(tenant_id,user_id,event_key)do nothing`, [randomUUID(),s.tenant_id,t.company_id,assignee.user_id,'collection:' + key,t.id,due]);
        }
        await taskEvent(c,cipher,s,t.id,'collection_attempt',{attemptId:key,outcome:d.outcome,nextAt:due});
        await audit(c,s.tenant_id,s.user_id,'collection_attempt','task',t.id,['outcome','nextAt']);
        return { id:key,saved:true,nextAt:due,taskClosed:false,reportedPaidVerified:d.outcome === 'paid' ? V.units(i.paid) >= V.units(i.amount) : null,invoiceSettled:V.units(i.legalOutstanding)<=0n };
    }));
}
