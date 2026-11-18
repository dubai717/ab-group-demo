import {recordChain,contactResults} from './collection-chain.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireOk } from './core.js';
import { audit } from './data.js';
import { customerCan } from './customers.js';
import { financeRight } from './finance.js';
import { invoices } from './ledger-domain.js';
import { makeTask, task, taskEvent, taskRight, notice } from './personnel-domain.js';
import { V, today, vehicleInvoices } from './vehicle-domain.js';

const uuid = z.uuid(), text = z.string().trim().min(1).max(2000);
const builtins = [
    { id: 'off', nameAr: 'مغلق', nameEn: 'Switched off', minutes: 60 },
    { id: 'no_answer', nameAr: 'لا يرد', nameEn: 'No answer', minutes: 30 },
    { id: 'promise', nameAr: 'وعد بالدفع', nameEn: 'Promise to pay', minutes: null },
    { id: 'contacted', nameAr:'تم التواصل', nameEn:'Contacted', minutes:null },
    { id: 'extension', nameAr:'طلب مهلة', nameEn:'Requested more time', minutes:null },
    { id: 'partial', nameAr:'أفاد بسداد جزئي', nameEn:'Reported partial payment', minutes:60 },
    { id: 'escalate', nameAr:'يحتاج تصعيداً', nameEn:'Needs escalation', minutes:30 },
    { id: 'paid', nameAr: 'أفاد بالسداد', nameEn: 'Reported paid', minutes: null },
];
async function configuration(c: any, company: string) {
    const r = (await c.query('select value from ab.settings where key=$1', ['collection-followup:' + company])).rows[0];
    if (r) return {...r.value,outcomes:[...r.value.outcomes,...builtins.filter(o=>!r.value.outcomes.some((v:any)=>v.id===o.id))]};
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
        requireOk(new Set(d.outcomes.map(o => o.id)).size === d.outcomes.length && builtins.filter(o=>['off','no_answer','promise','paid'].includes(o.id)).every(o => d.outcomes.some(v => v.id === o.id)), 422, 'invalidOutcomes');
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
        const attempts = (await c.query('select a.*,t.task_number from ab.collection_attempts a join ab.tasks t on t.id=a.task_id where a.invoice_id=$1 order by a.created_at,a.id', [i.id])).rows;
        const customer=(await c.query('select payload_cipher from ab.customers where id=$1',[i.customer_id])).rows[0],contact=cipher.open(customer.payload_cipher);
        const taskNumbers=new Map((await c.query('select id,task_number from ab.tasks where source_id=$1',[i.id])).rows.map((r:any)=>[r.id,String(r.task_number)]));return { customer:{id:i.customer_id,number:String((await c.query('select file_number from ab.customers where id=$1',[i.customer_id])).rows[0].file_number),name:contact.fullName,phones:(contact.phones||[]).filter((p:any)=>p.status==='valid').map((p:any)=>({id:p.id,number:p.number}))},task: { ...cipher.open(t.payload_cipher),number:String(t.task_number),id: t.id, state: t.state, revision: t.revision, employeeId: t.employee_id }, invoice: { id: i.id, number: i.invoiceNumber, customerId: i.customer_id, vehicleId: i.vehicle_id, dueOn: i.dueOn, outstanding: i.legalOutstanding, currency: i.currency }, receipts:(await c.query("select distinct r.id,r.receipt_number,r.amount::text from ab.finance_receipts r join ab.vehicle_allocations a on a.receipt_id=r.id where a.invoice_id=$1 and r.company_id=$2 and r.payment_state='Cleared' and not exists(select 1 from ab.finance_allocation_reversals x where x.allocation_id=a.id)",[i.id,t.company_id])).rows,configuration: {...await configuration(c, t.company_id),chainOutcomes:contactResults}, attempts: attempts.map((r: any) => ({ id: r.id, outcome: r.outcome, nextAt: r.next_at, createdAt: r.created_at, createdBy: r.created_by,taskId:r.task_id,taskNumber:String(r.task_number),...cipher.open(r.payload_cipher),nextTaskNumber:taskNumbers.get(cipher.open(r.payload_cipher).nextTaskId)||null })) };
    }));
    app.post('/api/collections/tasks/:id/attempts', route(async (c: any, m: any, s: any, req: any) => {
        await c.query('select id from ab.tasks where id=$1 for update',[uuid.parse(req.params.id)]);
        const t = await task(c, m, uuid.parse(req.params.id));
        requireOk(t.source_type === 'collection_invoice' && !['Completed','Closed'].includes(t.state), 409, 'taskTerminal');
        const i = await bill(c, m, t.source_id), d = z.object({ chainVersion:z.literal(2).optional(),followupType:z.enum(['payment','call','visit']).optional(),receiptId:uuid.optional(),appointmentMissed:z.boolean().optional(),outcome: z.string().max(50), phoneId: z.string().max(80), note: z.string().trim().max(2000).default(''), nextAt: z.iso.datetime({offset:true}).optional() }).strict().parse(req.body);
        const customer = (await c.query('select payload_cipher from ab.customers where id=$1', [i.customer_id])).rows[0];
        requireOk(cipher.open(customer.payload_cipher).phones?.some((p: any) => p.id === d.phoneId && p.status === 'valid'), 422, 'invalidPhone');
        if(d.chainVersion===2){if(d.receiptId)requireOk((await c.query("select 1 from ab.finance_receipts r join ab.vehicle_allocations a on a.receipt_id=r.id where r.id=$1 and a.invoice_id=$2 and r.company_id=$3 and r.customer_id=$4 and r.payment_state='Cleared' and not exists(select 1 from ab.finance_allocation_reversals x where x.allocation_id=a.id) and (exists(select 1 from ab.finance_journals j where j.source_key='receipt:'||r.id::text and j.status='Posted')or exists(select 1 from ab.finance_operations o where o.id=r.deposit_operation_id and o.status='Approved'))",[d.receiptId,i.id,t.company_id,i.customer_id])).rowCount,422,'approvedReceiptRequired');requireOk(V.units(i.legalOutstanding)>0n||d.receiptId,409,'invoiceSettled');return recordChain(c,m,s,cipher,t,i,d);}requireOk(d.note.trim(),422,'callNoteRequired');const cfg = await configuration(c, t.company_id), outcome = cfg.outcomes.find((o: any) => o.id === d.outcome);
        requireOk(outcome, 422, 'invalidOutcome');
        const due = d.nextAt ? new Date(d.nextAt) : outcome.minutes ? new Date(Date.now() + outcome.minutes * 60000) : null;
        requireOk(!['promise','extension'].includes(d.outcome) || due, 422, 'followupRequired');
        requireOk(!due || due.getTime() > Date.now(), 422, 'followupMustBeFuture');
        const key = randomUUID();
        await c.query(`insert into ab.collection_attempts(id,tenant_id,company_id,customer_id,vehicle_id,invoice_id,task_id,outcome,next_at,payload_cipher,created_by)
            values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [key,s.tenant_id,t.company_id,i.customer_id,i.vehicle_id,i.id,t.id,d.outcome,due,cipher.seal({note:d.note,phoneId:d.phoneId,outcomeSnapshot:outcome,outstandingSnapshot:i.legalOutstanding,currency:i.currency}),s.user_id]);
        if (due) {
            await c.query("update ab.tasks set due_on=($2::timestamptz at time zone 'Asia/Dubai')::date,revision=revision+1 where id=$1",[t.id,due]);
            const assignee = (await c.query('select user_id from ab.hr_employees where id=$1', [t.employee_id])).rows[0];
            requireOk(assignee?.user_id, 409, 'taskAssigneeHasNoLogin');
            await c.query(`insert into ab.finance_notifications(id,tenant_id,company_id,user_id,action,event_key,entity_id,due_at)
                values($1,$2,$3,$4,'collection:followup',$5,$6,$7) on conflict(tenant_id,user_id,event_key)do nothing`, [randomUUID(),s.tenant_id,t.company_id,assignee.user_id,'collection:' + key,t.id,due]);
        }
        if(d.outcome==='escalate'){const assignee=(await c.query('select manager_id from ab.hr_employees where id=$1',[t.employee_id])).rows[0];for(const u of m.state.users.filter((u:any)=>u.status==='Active'&&(u.roleId==='owner'||u.id===assignee?.manager_id)&&financeRight({...m,actor:u},'ledger_view',t.company_id)))await notice(c,s,t.company_id,u.id,t.id,'collection_escalated','collection-escalation:'+key+':'+u.id);}
        await taskEvent(c,cipher,s,t.id,'collection_attempt',{attemptId:key,outcome:d.outcome,nextAt:due,previousDueOn:t.due_on,financialBalanceChanged:false});
        await audit(c,s.tenant_id,s.user_id,'collection_attempt','task',t.id,['outcome','nextAt']);
        return { id:key,saved:true,nextAt:due,taskClosed:false,reportedPaidVerified:d.outcome === 'paid' ? V.units(i.paid) >= V.units(i.amount) : null,invoiceSettled:V.units(i.legalOutstanding)<=0n };
    }));
    app.get('/api/collections/report',route(async(c:any,m:any,_s:any,req:any)=>{
      const q=z.object({companyId:uuid,employeeId:uuid.optional(),from:z.iso.date().optional(),to:z.iso.date().optional()}).strict().parse(req.query);allowed(m,q.companyId);
      const managesCompany=taskRight(m,'assign',q.companyId),staff=(await c.query('select id,user_id,manager_id,company_id from ab.hr_employees where company_id=$1',[q.companyId])).rows,visibleActors=[m.actor.id,...staff.filter((e:any)=>managesCompany||e.manager_id===m.actor.id).map((e:any)=>e.user_id).filter(Boolean)];const canInspect=managesCompany||visibleActors.length>1;
      let actor=m.actor.id;if(q.employeeId){const e=(await c.query('select user_id,manager_id,company_id from ab.hr_employees where id=$1',[q.employeeId])).rows[0];requireOk(e&&e.company_id===q.companyId&&(e.user_id===m.actor.id||managesCompany||e.manager_id===m.actor.id),403,'denied');actor=e.user_id;}
      const rows=(await c.query("select a.*,t.task_number,t.payload_cipher task_payload from ab.collection_attempts a join ab.tasks t on t.id=a.task_id where a.company_id=$1 and a.created_by=any($2::uuid[])and($3::date is null or (a.created_at at time zone 'Asia/Dubai')::date>=$3)and($4::date is null or (a.created_at at time zone 'Asia/Dubai')::date<=$4)order by a.created_at desc,a.id limit 5001",[q.companyId,canInspect&&!q.employeeId?visibleActors:[actor],q.from||null,q.to||null])).rows;requireOk(rows.length<=5000,422,'reportTooLarge');
      const items=rows.map((r:any)=>({id:r.id,taskId:r.task_id,taskNumber:String(r.task_number),invoiceId:r.invoice_id,employeeUserId:r.created_by,employeeName:m.state.users.find((u:any)=>u.id===r.created_by)?.fullName||m.state.users.find((u:any)=>u.id===r.created_by)?.username||'',outcome:r.outcome,createdAt:r.created_at,nextAt:r.next_at,...cipher.open(r.payload_cipher)})),totals:any={};
      for(const id of new Set(rows.map((r:any)=>r.invoice_id))){const i=await bill(c,m,id as string),v=totals[i.currency]||={collected:0n,outstanding:0n,overdue:0n};v.collected+=V.units(i.paid||'0');v.outstanding+=V.units(i.legalOutstanding);if(i.dueOn<today())v.overdue+=V.units(i.legalOutstanding);}
      const contacts=items.filter((a:any)=>a.actionKind!=='payment'),appointments=items.filter((a:any)=>a.followupType&&a.nextAt),missed=items.filter((a:any)=>a.appointmentMissed===true);
      return{rows:items,employeePerformance:[...new Set(contacts.map((a:any)=>a.employeeUserId))].map(id=>{const own=contacts.filter((a:any)=>a.employeeUserId===id);return{id,name:own[0]?.employeeName,attempts:own.length,answered:own.filter((a:any)=>a.outcome==='answered').length,off:own.filter((a:any)=>a.outcome==='off').length,busy:own.filter((a:any)=>a.outcome==='busy').length,no_answer:own.filter((a:any)=>a.outcome==='no_answer').length};}),counts:{attempts:contacts.length,off:contacts.filter((a:any)=>a.outcome==='off').length,busy:contacts.filter((a:any)=>a.outcome==='busy').length,no_answer:contacts.filter((a:any)=>a.outcome==='no_answer').length,answered:contacts.filter((a:any)=>a.outcome==='answered').length,appointments:appointments.length,dueAppointments:appointments.filter((a:any)=>new Date(a.nextAt)<=new Date()).length,missedAppointments:missed.length},balances:Object.entries(totals).map(([currency,v]:any)=>({currency,collected:V.money(v.collected),outstanding:V.money(v.outstanding),overdue:V.money(v.overdue)})),financialBasis:'Current approved balances of distinct source invoices; contact dates do not represent cash receipts'};
    }));

}
