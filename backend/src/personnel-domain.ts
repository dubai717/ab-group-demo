import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { requireOk, ApiError } from './core.js';
import { has, audit } from './data.js';
import { number, today } from './vehicle-domain.js';
import { financeRight } from './finance.js';
import { L, event, journal, resolve, chart, line, balance, createFinancialVoucher,config as financialConfig } from './ledger-domain.js';
const CustomerPolicy = createRequire(import.meta.url)('../../customer-policy.js');
export const H = createRequire(import.meta.url)('../../personnel-policy.js') as {
    rights: string[];
    units: (v: any) => bigint;
    money: (n: bigint) => string;
    allocate: (v: string, s: any[]) => any[];
    days: (a: string, b: string) => number;
    eos: (v: any) => any;
    evaluation: (c: any[], f: any) => any;
    level: (...v: any[]) => string;
};
export const hrRight = (m: any, right: string, co: string) => financeRight(m, 'hr_' + right, co);
export const need = (m: any, r: string, co: string) => requireOk(hrRight(m, r, co));
export const actorCo = (m: any, co: string) => m.actor.roleId === 'owner' || m.actor.companyIds?.includes(co);
export async function ready(c: any) { requireOk((await c.query("select to_regclass('ab.hr_employees')ok")).rows[0].ok, 503, 'personnelSchemaPending'); }
export async function settings(c: any, cipher: any, co: string) { const r = (await c.query('select value from ab.settings where key=$1', ['personnel:' + co])).rows[0]; return r ? cipher.open(r.value.cipher) : { documentKinds: ['photo', 'identity', 'passport', 'residence', 'workPermit', 'contract', 'driving'], documentDays: [30, 15, 7, 0, -7, -15], orangeDays: 1, redDays: 7, coachingSessions: 3, automaticFollowup: false, incentivesEnabled: false, reserveEnabled: false, noticeMonths: 1, leaveKinds: [{ id: 'annual', deductBalance: true, paid: true, workingDays: false }, { id: 'unpaid', deductBalance: false, paid: false, workingDays: false }], workdays: [1, 2, 3, 4, 5], holidays: [], evaluationVisibility: 'hidden' }; }
export async function employee(c: any, m: any, key: string, right = 'view') { const e = (await c.query('select * from ab.hr_employees where id=$1', [key])).rows[0]; requireOk(e, 404, 'notFound'); const self = e.user_id === m.actor.id, manager = e.manager_id === m.actor.id; requireOk(hrRight(m, right, e.company_id) || (right === 'view' && (self || manager||(await scope(c,e)).some(co=>hrRight(m,'view',co)))), 403, 'denied'); return e; }
export const profile = (e: any, cipher: any) => ({ ...cipher.open(e.payload_cipher), id: e.id, number: String(e.employee_number), companyId: e.company_id, userId: e.user_id, managerId: e.manager_id, departmentId: e.department_id, jobTitle: e.job_title, state: e.state, hiredOn: e.hired_on.toISOString().slice(0, 10),primarySince:e.primary_since.toISOString().slice(0,10), revision: e.revision });
export async function scope(c: any, e: any, date = today()) { const rows = (await c.query('select company_id from ab.hr_assignments where employee_id=$1 and effective_on<=$2 and(until_on is null or until_on>=$2)', [e.id, date])).rows; return [...new Set([e.company_id, ...rows.map((r: any) => r.company_id)])] as string[]; }
export async function periodEmployee(c:any,key:string,co:string,month:string){const end=new Date(month+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);const e=(await c.query('select * from ab.hr_employees where id=$1',[key])).rows[0];requireOk(e&&e.hired_on<=end&&(e.company_id===co&&e.primary_since<=end||(await c.query('select 1 from ab.hr_assignments where employee_id=$1 and company_id=$2 and effective_on<=$3 and(until_on is null or until_on>=$4)',[e.id,co,end.toISOString().slice(0,10),month])).rowCount),422,'invalidHistoricalAssignment');return e;}
export async function employeeIn(c: any, key: string, co: string, date = today()) { const e = (await c.query('select * from ab.hr_employees where id=$1', [key])).rows[0]; requireOk(e && e.state !== 'Ended' && (await scope(c, e, date)).includes(co), 422, 'invalidAssignment'); return e; }
export async function auditHR(c: any, cipher: any, s: any, e: any, kind: string, before: any, after: any) { await c.query('insert into ab.hr_audit_events(id,tenant_id,company_id,employee_id,actor_id,kind,payload_cipher,actor_type)values($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), s.tenant_id, e.company_id, e.id, s.user_id, kind, cipher.seal({ before, after }),s.actor_type||'user']); if(s.actor_type==='service')await c.query("insert into ab.audit_events(id,tenant_id,actor_id,actor_type,action,entity_type,entity_id,fields,request_id)values(gen_random_uuid(),$1,$2,'service',$3,'personnel',$4,$5,gen_random_uuid())",[s.tenant_id,s.user_id,kind,e.id,Object.keys(after||{})]);else await audit(c, s.tenant_id, s.user_id, kind, 'personnel', e.id, Object.keys(after || {})); }
export async function notice(c: any, s: any, co: string, user: string | null, entity: string, kind: string, key: string) { if (!user)
    return; await c.query("insert into ab.finance_notifications(id,tenant_id,company_id,user_id,action,event_key,entity_id)select $1,$2,$3,$4,$5,$6,$7 where exists(select 1 from ab.users where id=$4 and status='Active')on conflict(tenant_id,user_id,event_key)do nothing", [randomUUID(), s.tenant_id, co, user, 'personnel:' + kind, 'personnel:' + co + ':' + key, entity]); }
export async function leaders(c: any, co: string) { return (await c.query("select u.id,u.role_id from ab.users u where u.tenant_id=ab.tenant()and u.status='Active'and(u.role_id='owner'or(u.role_id='general_manager'and exists(select 1 from ab.user_companies x where x.user_id=u.id and x.company_id=$1 and x.active)))", [co])).rows; }
export function taskRight(m: any, action: string, co: string, e?: any) { if (hrRight(m, 'task_manage', co))
    return true; if (action === 'view' && e?.user_id === m.actor.id)
    return true; return actorCo(m, co) && has(m.actor, action === 'create' ? 'create_task' : action === 'assign' ? 'assign_task' : 'view_tasks'); }
export async function task(c: any, m: any, key: string) { const r = (await c.query('select t.*,e.user_id,e.manager_id from ab.tasks t join ab.hr_employees e on e.id=t.employee_id where t.id=$1', [key])).rows[0]; requireOk(r, 404, 'notFound'); requireOk(r.user_id === m.actor.id || r.manager_id === m.actor.id || hrRight(m, 'task_manage', r.company_id)||taskRight(m,'assign',r.company_id), 403, 'denied'); return r; }
export async function makeTask(c: any, cipher: any, s: any, d: any) { const old = (await c.query('select id from ab.tasks where company_id=$1 and source_key=$2', [d.companyId, d.sourceKey])).rows[0]; if (old)
    return { id: old.id, created: false }; const e = await employeeIn(c, d.employeeId, d.companyId), key = randomUUID(); await c.query('insert into ab.tasks(id,tenant_id,company_id,employee_id,original_employee_id,task_number,source_type,source_id,source_key,due_on,priority,payload_cipher,created_by)values($1,$2,$3,$4,$4,$5,$6,$7,$8,$9,$10,$11,$12)', [key, s.tenant_id, d.companyId, e.id, await number(c, s.tenant_id, 'task'), d.sourceType || 'manual', d.sourceId || null, d.sourceKey, d.dueOn, d.priority || 'normal', cipher.seal({ title: d.title, expectedResult: d.expectedResult, ...d.details }), s.user_id]); await notice(c, s, d.companyId, e.user_id, key, 'task_assigned', key + ':assigned'); await taskEvent(c, cipher, s, key, 'created', d);await auditHR(c,cipher,s,{id:e.id,company_id:d.companyId},'task_created',null,{taskId:key,sourceType:d.sourceType||'manual',employeeId:e.id}); return { id: key, created: true }; }
export async function taskEvent(c: any, cipher: any, s: any, id: string, kind: string, payload: any) { await c.query('insert into ab.hr_task_events(id,tenant_id,task_id,kind,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6)', [randomUUID(), s.tenant_id, id, kind, cipher.seal({...payload,actorType:s.actor_type||'user'}), s.user_id]); }
export async function sourceComplete(c: any, cipher: any, t: any) { const d = cipher.open(t.payload_cipher); switch (t.source_type) {
    case 'manual': return true;
    case 'employee_document': return !!(await c.query("select 1 from ab.hr_document_records r join ab.document_versions v on v.id=r.version_id where r.employee_id=$1 and r.kind=$2 and r.state='Approved'and v.scan_status='clean'and(r.expires_on is null or r.expires_on>=$3)", [t.source_id, d.documentKind, today()])).rowCount;
    case 'card_invoice': return !!(await c.query('select 1 from ab.finance_card_splits where id=$1 and invoice_id is not null', [t.source_id])).rowCount;
    case 'recovery': return !!(await c.query("select 1 from ab.vehicle_recovery_tasks where id=$1 and state='Closed'", [t.source_id])).rowCount;
    case 'deposit': return !(await c.query('select 1 from ab.finance_custody_moves where holder_id=$1 and company_id=$2 and currency=$3 group by currency having sum(amount)>0', [d.holderUserId, t.company_id,d.currency])).rowCount;
    case 'customer_data': {const row=(await c.query('select payload_cipher from ab.customers where id=$1',[t.source_id])).rows[0];return !!row&&CustomerPolicy.completeness(cipher.open(row.payload_cipher)).missing.length===0;}
case 'customer_followup': {const original=(await c.query('select * from ab.customer_events where id=$1',[t.source_id])).rows[0];if(!original)return false;const later=(await c.query("select payload_cipher from ab.customer_events where customer_id=$1 and kind='call'and created_at>$2",[original.customer_id,original.created_at])).rows;return later.some((r:any)=>['confirmed','rescheduled'].includes(cipher.open(r.payload_cipher).after?.outcome));}
case 'vehicle_registration': return !!(await c.query('select 1 from ab.vehicles where request_id=$1', [t.source_id])).rowCount;
    case 'circular': return !!(await c.query("select 1 from ab.vehicle_circular_results where circular_id=$1 and vehicle_id=$2 and state in('Completed','Exempted')", [t.source_id, d.vehicleId])).rowCount;
    default: return false;
} }
export async function documentState(c: any, cipher: any, e: any) { const cfg = await settings(c, cipher, e.company_id), rows = (await c.query('select r.*,v.scan_status,v.document_id from ab.hr_document_records r join ab.document_versions v on v.id=r.version_id where employee_id=$1 order by r.created_at desc,r.id', [e.id])).rows; const current = new Map(); for (const r of rows)
    if (!current.has(r.kind) && r.state === 'Approved' && r.scan_status === 'clean')
        current.set(r.kind, r); const missing = cfg.documentKinds.filter((k: string) => !current.has(k)), expired = [...current.values()].filter(r => r.expires_on && r.expires_on.toISOString().slice(0, 10) < today()).map(r => r.kind); return { rows: rows.map((r: any) => ({ ...r, payload: cipher.open(r.payload_cipher), payload_cipher: undefined })), missing, expired, completeness: Math.round((cfg.documentKinds.length - missing.length - expired.length) * 100 / Math.max(1, cfg.documentKinds.length)) }; }
export async function compensation(c: any, eid: string, asOf: string, cipher: any) { const r = (await c.query('select * from ab.hr_compensation where employee_id=$1 and effective_on<=$2 order by effective_on desc,version desc limit 1', [eid, asOf])).rows[0]; requireOk(r, 409, 'compensationRequired'); return { ...r, data: cipher.open(r.payload_cipher) }; }
export async function observe(c: any, cipher: any, e: any, co: string, month: string,currency?:string) {
    const end = new Date(month + 'T00:00:00Z');
    end.setUTCMonth(end.getUTCMonth() + 1);
    const facts: any = {},traces=new Map<string,any>();
    const add = (metric: string, id: string, delta: bigint) => { facts[metric] ??= { actual: 0n, samples: 0, sourceIds: [] }; const f = facts[metric]; if (f.sourceIds.includes(id))
        return; f.sourceIds.push(id); f.actual += delta; f.samples++; };
    if (e.user_id) {
        const receiptCurrencies=new Map((await c.query('select id,currency from ab.finance_receipts where company_id=$1',[co])).rows.map((r:any)=>[r.id,r.currency])),depositCurrencies=new Map((await c.query('select id,currency from ab.finance_deposits where company_id=$1',[co])).rows.map((r:any)=>[r.id,r.currency])),fundCurrencies=new Map((await c.query('select id,currency from ab.finance_funds where company_id=$1',[co])).rows.map((r:any)=>[r.id,r.currency]));
        const countCurrencies=new Map((await c.query("select id,payload_cipher from ab.finance_kpi_facts where employee_id=$1 and company_id=$2 and kind='fund_count_reported'",[e.user_id,co])).rows.map((r:any)=>[r.id,fundCurrencies.get(cipher.open(r.payload_cipher).fundId)]));
        const financial = (await c.query('select * from ab.finance_kpi_facts where employee_id=$1 and company_id=$2 and created_at>=$3 and created_at<$4', [e.user_id, co, month, end.toISOString()])).rows;
        for (const f of financial) {
            const d = cipher.open(f.payload_cipher), key = 'finance:' + f.id;const sourceId=f.source_key.split(':').at(-1),sourceCurrency=f.kind.startsWith('collection_')?receiptCurrencies.get(sourceId):f.kind==='deposit_confirmed'?depositCurrencies.get(sourceId):f.kind==='fund_count_verified'?countCurrencies.get(d.countId||sourceId):null;traces.set(key,{id:f.id,module:'finance',sourceKey:f.source_key,actorId:f.employee_id,createdAt:f.created_at,kind:f.kind,currency:sourceCurrency});if(['collection_confirmed','collection_reversed','deposit_confirmed','fund_count_verified'].includes(f.kind)&&(!currency||sourceCurrency!==currency))continue;
            if (f.kind === 'collection_confirmed')
                add('collection_amount', key, H.units(f.amount || '0'));
            if (f.kind === 'collection_reversed')
                add('collection_amount', key, H.units(f.amount || '0'));
            if (f.kind === 'deposit_confirmed')
                add('deposit_amount', key, H.units(f.amount || '0'));
            if (f.kind === 'missing_invoice_completed')
                add('invoice_completed', key, 1n);
            if (f.kind === 'fund_count_verified')
                add('verified_shortage', key, H.units(f.amount||'0')<0n?-H.units(f.amount):0n);
        }
        const ce = (await c.query('select * from ab.customer_events where actor_id=$1 and company_id=$2 and created_at>=$3 and created_at<$4', [e.user_id, co, month, end.toISOString()])).rows;
        for (const r of ce) {
            const d = cipher.open(r.payload_cipher), after = d.after || d;traces.set('customer:'+r.id,{id:r.id,module:'customers',sourceKey:r.source_key,actorId:r.actor_id,createdAt:r.created_at,kind:r.kind});
            if ((r.kind === 'created' && after.fullName) || (r.kind === 'updated' && d.before && CustomerPolicy.completeness(after).percent > CustomerPolicy.completeness(d.before).percent))
                add('customer_data', 'customer:' + r.id, 1n);
            if (r.kind === 'call' && ['confirmed', 'rescheduled'].includes(after.outcome))
                add('successful_calls', 'customer:' + r.id, 1n);
        }
        const ve = (await c.query('select * from ab.vehicle_events where actor_id=$1 and company_id=$2 and created_at>=$3 and created_at<$4', [e.user_id, co, month, end.toISOString()])).rows;
        for (const r of ve) {
            const d = cipher.open(r.payload_cipher), a = d.after || {}, key = 'vehicle:' + r.id;traces.set(key,{id:r.id,module:'vehicles',sourceKey:r.source_key,actorId:r.actor_id,createdAt:r.created_at,kind:r.kind});
            if (['registered', 'vehicle_registered'].includes(r.kind))
                add('vehicle_registered', key, 1n);
            if (r.kind === 'key_received' || r.kind === 'key_event' && a.action === 'received')
                add('key_received', key, 1n);
            if (['gps_installed', 'gps'].includes(r.kind))
                add('gps_installed', key, 1n);
            if (['circular_completed', 'circular_result'].includes(r.kind) && a.state === 'Completed')
                add('circular_completed', key, 1n);
            if (['recovery_closed'].includes(r.kind))
                add('recovery_completed', key, 1n);
        }
    }
    const tasks = (await c.query('select * from ab.tasks where employee_id=$1 and company_id=$2 and due_on>=$3 and due_on<$4', [e.id, co, month, end.toISOString()])).rows;
    for(const t of tasks)traces.set('task:'+t.id,{id:t.id,module:'tasks',sourceKey:t.source_key,employeeId:t.employee_id,createdBy:t.created_by,createdAt:t.created_at,completedAt:t.completed_at,dueOn:t.due_on});if (tasks.length)
        facts.task_on_time = { actual: String(Math.floor(tasks.filter((t: any) => ['Completed', 'Closed'].includes(t.state) && t.completed_at.toISOString().slice(0, 10) <= t.due_on.toISOString().slice(0, 10)).length * 10000 / tasks.length)), samples: tasks.length, sourceIds: tasks.map((r: any) => 'task:' + r.id) };
    if(tasks.length)facts.task_late={actual:String(tasks.filter((t:any)=>t.completed_at?t.completed_at.toISOString().slice(0,10)>t.due_on.toISOString().slice(0,10):t.due_on.toISOString().slice(0,10)<today()).length),samples:tasks.length,sourceIds:tasks.map((t:any)=>'task:'+t.id)};
    for (const f of Object.values(facts) as any[])
        {f.actual = String(f.actual);f.sources=f.sourceIds.map((id:string)=>traces.get(id)).filter(Boolean);}
    return facts;
}
export const metrics = ['collection_amount', 'deposit_amount', 'invoice_completed', 'verified_shortage', 'customer_data', 'successful_calls', 'vehicle_registered', 'key_received', 'gps_installed', 'circular_completed', 'recovery_completed', 'task_on_time','task_late'];
export async function reviewPreview(c: any, cipher: any, e: any, co: string, month: string) { const assignments = (await c.query('select job_title from ab.hr_assignments where employee_id=$1 and company_id=$2 and effective_on<=($3::date+interval\'1 month\'-interval\'1 day\')and(until_on is null or until_on>=$3)', [e.id, co, month])).rows; const jobs = [...new Set([...(e.company_id===co&&e.primary_since<new Date(new Date(month+'T00:00:00Z').setUTCMonth(new Date(month+'T00:00:00Z').getUTCMonth()+1))?[e.job_title]:[]), ...assignments.map((r: any) => r.job_title)])]; const result = []; for (const job of jobs) {
    const row = (await c.query('select * from ab.hr_models where company_id=$1 and job_title=$2 order by version desc limit 1', [co, job])).rows[0];
    if (!row) {
        result.push({ jobTitle: job, available: false, reason: 'modelNotConfigured' });
        continue;
    }
    const model = cipher.open(row.payload_cipher), facts = await observe(c, cipher, e, co, month,model.currency);
    const criteria = model.criteria.map((r: any) => ({ ...r, target: ['collection_amount', 'deposit_amount', 'verified_shortage'].includes(r.metric) ? H.units(r.target).toString() : r.metric === 'task_on_time' ? (H.units(r.target) / 10n).toString() : r.target }));
    result.push({ jobTitle: job, modelId: row.id, version: row.version, minimumScore: model.minimumScore,currency:model.currency||null, ...H.evaluation(criteria, facts) });
} const configured=(await c.query('select value from ab.settings where key=$1',['personnel-job-weights:'+e.id+':'+co])).rows[0],weights=jobs.length===1?[{jobTitle:jobs[0],weight:10000}]:configured?cipher.open(configured.value.cipher).weights:[],weightsValid=weights.length===jobs.length&&weights.every((r:any)=>jobs.includes(r.jobTitle))&&new Set(weights.map((r:any)=>r.jobTitle)).size===jobs.length&&weights.reduce((n:number,r:any)=>n+r.weight,0)===10000,available=result.length>0&&result.every(r=>r.available)&&weightsValid;return {employeeId:e.id,companyId:co,month,available,score:available?Math.floor(result.reduce((n,r)=>n+r.score*weights.find((w:any)=>w.jobTitle===r.jobTitle).weight,0)/10000):null,models:result,jobWeights:weights,aggregation:jobs.length===1?'single configured job model':weightsValid?'explicitly configured job weights':'job weights require explicit configuration'}; }
export async function legalEOS(c: any, cipher: any, e: any, asOf = today()) { let comp: any; try {
    comp = await compensation(c, e.id, asOf, cipher);
}
catch {
    return { available: false, reason: 'compensationRequired' };
} const privateData = cipher.open(e.private_cipher), settled = (await c.query("select t.payload_cipher,v.status from ab.hr_terminations t left join ab.finance_vouchers v on v.id=t.voucher_id where t.employee_id=$1 and t.state='Settled'", [e.id])).rows.filter((r: any) => r.status === 'Paid').reduce((n: bigint, r: any) => n + H.units(cipher.open(r.payload_cipher).settlement?.eosAmount || '0'), 0n); return { ...H.eos({ regime: privateData.legalRegime || 'unconfigured', start: e.hired_on.toISOString().slice(0, 10), end: asOf, basic: comp.data.basic, unpaidDays: privateData.excludedServiceDays || 0, settled: H.money(settled) }), currency: comp.currency, companyId: comp.company_id }; }
export async function deductionAccount(c:any,cipher:any,co:string,currency:string,definitionId:string){const counter=await resolve(c,co,currency,definitionId),financial=await financialConfig(c,cipher,co);requireOk(!counter.bank_account_id&&!(await c.query('select 1 from ab.finance_funds where chart_id=$1',[counter.id])).rowCount&&counter.id!==financial?.custodyAccountId,422,'payrollLiquidityAccountForbidden');return counter;}
export async function payrollPreview(c: any, cipher: any, e: any, month: string) {const end=new Date(month+'T00:00:00Z');end.setUTCMonth(end.getUTCMonth()+1);requireOk(e.hired_on<end,422,'payrollBeforeHire');requireOk(!(await c.query("select 1 from ab.hr_terminations where employee_id=$1 and state in('Approved','Settled')and last_on<$2",[e.id,month])).rowCount,409,'payrollAfterEmployment'); const comp = await compensation(c, e.id, month, cipher), decisions = (await c.query("select * from ab.hr_decisions where employee_id=$1 and company_id=$2 and month=$3 and state='Approved'and kind<>'void'and not exists(select 1 from ab.hr_decisions v where v.reverses_id=hr_decisions.id and v.state='Approved')and not exists(select 1 from ab.hr_payroll_decisions x where x.decision_id=hr_decisions.id) order by hr_decisions.id", [e.id, comp.company_id, month])).rows; requireOk(decisions.every((r:any)=>cipher.open(r.payload_cipher).currency===comp.currency),409,'decisionCurrencyChangedReviewRequired');const gross: bigint = H.units(comp.data.basic) + H.units(comp.data.allowances) + decisions.filter((d: any) => d.kind !== 'deduction').reduce((n: bigint, d: any) => n + H.units(d.amount), 0n), deductions: bigint = decisions.filter((d: any) => d.kind === 'deduction').reduce((n: bigint, d: any) => n + H.units(d.amount), 0n); requireOk(gross >= deductions, 422, 'deductionsExceedSalary'); const cfg = await settings(c, cipher, comp.company_id); if (deductions)
    requireOk(Number.isInteger(cfg.legalDeductionMaxBps) && deductions * 10000n <= gross * BigInt(cfg.legalDeductionMaxBps), 422, 'deductionPolicyRequired'); return { compensationId: comp.id, payingCompanyId: comp.company_id, currency: comp.currency, basic: comp.data.basic, allowances: comp.data.allowances, gross: H.money(gross), deductions: H.money(deductions), net: H.money(gross - deductions), allocations: H.allocate(H.money(gross), comp.data.allocations), decisions: decisions.map((r: any) => ({ ...r, details: cipher.open(r.payload_cipher), payload_cipher: undefined })), month }; }
export async function accruePayroll(c: any, cipher: any, m: any, s: any, e: any, slip: any, data: any) {
    const cfg = await settings(c, cipher, slip.company_id);
    requireOk(cfg.payrollItemId, 409, 'payrollFinancialMappingRequired');
    const it = (await c.query('select * from ab.finance_items where id=$1', [cfg.payrollItemId])).rows[0];
    requireOk(it?.active, 422, 'invalidItem');
    const mapping = cipher.open(it.payload_cipher), payable = await resolve(c, slip.company_id, slip.currency, mapping.payableId), lines: any[] = [];requireOk(payable.kind==='liability'&&!payable.bank_account_id,422,'payrollLiabilityRequired');
    for (const a of data.allocations) {
        need(m, 'payroll_approve', a.companyId);
        const expense = await resolve(c, a.companyId, slip.currency, mapping.expenseId);
        requireOk(expense.kind === 'expense', 422, 'accountMappingRequired');
        if (a.companyId === slip.company_id)
            lines.push(line(expense, H.units(a.amount)));
        else {
            const from = await resolve(c, slip.company_id, slip.currency, cfg.dueFromDefinitionId), targetCfg = await settings(c, cipher, a.companyId), to = await resolve(c, a.companyId, slip.currency, targetCfg.dueToDefinitionId);
            requireOk(from.kind === 'asset' && to.kind === 'liability', 422, 'accountMappingRequired');
            lines.push(line(from, H.units(a.amount)));
            await journal(c, cipher, s, a.companyId, today(), slip.currency, 'payroll-cost:' + slip.id + ':' + a.companyId, [line(expense, H.units(a.amount)), line(to, -H.units(a.amount))], { payrollId: slip.id, employeeId: e.id, otherCompanyId: slip.company_id });
        }
    }
    if (H.units(data.net))
        lines.push(line(payable, -H.units(data.net)));
    for (const d of data.decisions.filter((d: any) => d.kind === 'deduction')) {
        const counter=await deductionAccount(c,cipher,slip.company_id,slip.currency,d.details.counterpartDefinitionId);
        lines.push(line(counter, -H.units(d.amount)));
    }
    if (H.units(data.gross))
        await journal(c, cipher, s, slip.company_id, today(), slip.currency, 'payroll:' + slip.id, lines.filter((r: any) => H.units(r.debit) || H.units(r.credit)), { payrollId: slip.id, employeeId: e.id, month: slip.month });
    if (!H.units(data.net))
        return null;
    const v = await createFinancialVoucher(c, cipher, m, s, { companyId: slip.company_id, itemId: it.id, amount: data.net, currency: slip.currency, issuedOn: today(), beneficiary: profile(e, cipher).nameEn || profile(e, cipher).nameAr, reason: 'Approved payroll ' + data.month, sourceKey: 'payroll:' + slip.id }, { alreadyAccrued: true, payableOverrideId: payable.id, payrollId: slip.id });
    return v.id;
}
