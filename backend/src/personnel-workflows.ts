import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {financeRight} from './finance.js';
import { requireOk } from './core.js';
import { H, hrRight, need, employee, employeeIn, settings, auditHR, makeTask, notice, leaders, taskEvent, sourceComplete, legalEOS, profile, compensation } from './personnel-domain.js';
import {createRequire} from 'node:module';
const CustomerPolicy=createRequire(import.meta.url)('../../customer-policy.js');
import { today,vehicleData } from './vehicle-domain.js';
import { L, resolve, line, journal, balance, createFinancialVoucher } from './ledger-domain.js';
export async function personnelFollowup(c: any, cipher: any, m: any, s: any, co: string) {
    need(m, 'configure', co);
    for (const u of (await c.query('select u.auth_id from ab.users u join ab.hr_employees e on e.user_id=u.id where e.company_id=$1', [co])).rows)
        await c.query('select ab.hr_enforce_auth($1)', [u.auth_id]);
    const cfg = await settings(c, cipher, co), now = today(), employees = (await c.query("select e.* from ab.hr_employees e where e.state<>'Ended'and(e.company_id=$1 or exists(select 1 from ab.hr_assignments a where a.employee_id=e.id and a.company_id=$1 and a.effective_on<=timezone('Asia/Dubai',now())::date and(a.until_on is null or a.until_on>=timezone('Asia/Dubai',now())::date)))", [co])).rows;
    let created = 0;
    for (const e of employees) {
        if(e.company_id!==co)continue;
        const docs = (await c.query("select distinct on(r.kind) r.*,v.scan_status from ab.hr_document_records r join ab.document_versions v on v.id=r.version_id where employee_id=$1 and state='Approved'and v.scan_status='clean'order by r.kind,r.created_at desc,r.id desc", [e.id])).rows;
        for (const r of docs) {
            if (!r.expires_on)
                continue;
            const due = r.expires_on.toISOString().slice(0, 10), remaining = Math.floor((Date.parse(due) - Date.parse(now)) / 864e5), responsible = r.company_responsible ? r.responsible_id : e.id;
            if (!responsible)
                continue;
            if (remaining <= Math.max(...cfg.documentDays)) {
                const t = await makeTask(c, cipher, s, { companyId: co, employeeId: responsible, sourceType: 'employee_document', sourceId: e.id, sourceKey: 'document:' + r.id, title: 'Renew employee document', expectedResult: 'Approved current document with clean scan', dueOn: due, details: { documentKind: r.kind, recordId: r.id } });
                if (t.created)
                    created++;
                for (const days of cfg.documentDays.filter((n: number) => remaining <= n)) {
                    const targets = days <= -15 ? (await leaders(c, co)).filter((u: any) => u.role_id === 'owner') : days <= -7 ? await leaders(c, co) : [{ id: (await c.query('select user_id from ab.hr_employees where id=$1', [responsible])).rows[0]?.user_id }];
                    for (const u of targets)
                        await notice(c, s, co, u.id, t.id, 'document_expiry', r.id + ':' + days + ':' + u.id);
                }
            }
        }
    }
    const sources = (await c.query("select sp.id,ch.created_by,ch.paid_on from ab.finance_card_splits sp join ab.finance_card_charges ch on ch.id=sp.charge_id where ch.company_id=$1 and sp.customer_id is not null and sp.invoice_id is null", [co])).rows;
    for (const r of sources) {
        const e = employees.find((e: any) => e.user_id === r.created_by);
        if (e) {
            const t = await makeTask(c, cipher, s, { companyId: co, employeeId: e.id, sourceType: 'card_invoice', sourceId: r.id, sourceKey: 'card:' + r.id, title: 'Complete missing card invoice', expectedResult: 'Actual linked financial invoice', dueOn: r.paid_on.toISOString().slice(0, 10) });
            if (t.created)
                created++;
        }
    }
    const custody = (await c.query('select holder_id,currency,min(effective_on)due from ab.finance_custody_moves where company_id=$1 group by holder_id,currency having sum(amount)>0', [co])).rows;
    for (const r of custody) {
        const e = employees.find((e: any) => e.user_id === r.holder_id);
        if (e) {
            const t = await makeTask(c, cipher, s, { companyId: co, employeeId: e.id, sourceType: 'deposit', sourceId: e.id, sourceKey: 'deposit:' + e.id + ':' + r.currency + ':' + r.due.toISOString().slice(0, 10), title: 'Deposit outstanding custody', expectedResult: 'Verified deposit recorded in financial ledger', dueOn: r.due.toISOString().slice(0, 10), details: { holderUserId: r.holder_id, currency: r.currency } });
            if (t.created)
                created++;
        }
    }
    const recoveries = (await c.query("select * from ab.vehicle_recovery_tasks where company_id=$1 and state='Open'", [co])).rows;
    for (const r of recoveries) {
        const e = employees.find((e: any) => e.user_id === r.assignee_id);
        if (e) {
            const task = await makeTask(c, cipher, s, { companyId: co, employeeId: e.id, sourceType: 'recovery', sourceId: r.id, sourceKey: 'recovery:' + r.id, title: 'Follow up existing vehicle recovery', expectedResult: 'Verified closure in the vehicle module', dueOn: r.due_at.toISOString().slice(0, 10) });
            if (task.created)
                created++;
        }
    }
    const pendingRequests = (await c.query("select r.* from ab.vehicle_requests r where r.company_id=$1 and not exists(select 1 from ab.vehicles v where v.request_id=r.id)", [co])).rows;
    for (const r of pendingRequests) {
        const e = employees.find((e: any) => e.user_id === r.created_by);
        if (e) {
            const task = await makeTask(c, cipher, s, { companyId: co, employeeId: e.id, sourceType: 'vehicle_registration', sourceId: r.id, sourceKey: 'registration:' + r.id, title: 'Complete existing vehicle request', expectedResult: 'Actual registered vehicle linked to this request', dueOn: r.created_at.toISOString().slice(0, 10) });
            if (task.created)
                created++;
        }
    }

 const circulars=(await c.query('select * from ab.vehicle_circulars where company_id=$1 and effective_on<=$2',[co,now])).rows;for(const circular of circulars){const d=cipher.open(circular.payload_cipher),assignee=employees.find((e:any)=>e.user_id===d.responsibleId);if(!assignee)continue;const vehicles=(await c.query("select * from ab.vehicles where company_id=$1 and status<>'Terminated'",[co])).rows;for(const v of vehicles){if(d.types.length&&!d.types.includes(vehicleData(v,cipher).vehicleType))continue;if((await c.query("select 1 from ab.vehicle_circular_results where vehicle_id=$1 and circular_id=$2 and state in('Completed','Exempted')",[v.id,circular.id])).rowCount)continue;const task=await makeTask(c,cipher,s,{companyId:co,employeeId:assignee.id,sourceType:'circular',sourceId:circular.id,sourceKey:'circular:'+circular.id+':'+v.id,title:'Complete existing vehicle circular',expectedResult:'Actual completion evidence or authorized exemption in vehicle module',dueOn:d.deadline||circular.effective_on.toISOString().slice(0,10),details:{vehicleId:v.id}});if(task.created)created++;}}
 const customers=(await c.query("select * from ab.customers where company_id=$1 and status not in('Ended','Archived')",[co])).rows;for(const customer of customers){const assignee=employees.find((e:any)=>e.user_id===customer.created_by);if(!assignee||!CustomerPolicy.completeness(cipher.open(customer.payload_cipher)).missing.length)continue;const task=await makeTask(c,cipher,s,{companyId:co,employeeId:assignee.id,sourceType:'customer_data',sourceId:customer.id,sourceKey:'customer-data:'+customer.id,title:'Complete existing customer profile',expectedResult:'Required customer identity/contact fields actually completed',dueOn:customer.created_at.toISOString().slice(0,10)});if(task.created)created++;}
 const followups=(await c.query("select distinct on(n.entity_id,n.user_id)n.* from ab.finance_notifications n where n.company_id=$1 and n.action='customer:followup'and n.due_at<=now()order by n.entity_id,n.user_id,n.created_at desc",[co])).rows;for(const n of followups){const assignee=employees.find((e:any)=>e.user_id===n.user_id),eventId=n.event_key.replace(/^customer:/,'');if(!assignee||!/^[-a-f0-9]{36}$/.test(eventId))continue;const task=await makeTask(c,cipher,s,{companyId:co,employeeId:assignee.id,sourceType:'customer_followup',sourceId:eventId,sourceKey:'customer-followup:'+eventId,title:'Complete scheduled customer follow-up',expectedResult:'A subsequent confirmed/rescheduled call recorded in customer module',dueOn:n.due_at.toISOString().slice(0,10)});if(task.created)created++;}
    const tasks = (await c.query("select t.*,e.manager_id from ab.tasks t join ab.hr_employees e on e.id=t.employee_id where t.company_id=$1 and t.state not in('Completed','Closed')", [co])).rows;
    for (const t of tasks) {
        if (t.source_type !== 'manual' && await sourceComplete(c, cipher, t)) {
            await c.query("update ab.tasks set state='Completed',completed_at=now(),revision=revision+1 where id=$1", [t.id]);
            await taskEvent(c, cipher, s, t.id, 'source_verified', { sourceType: t.source_type, sourceId: t.source_id });
            await auditHR(c, cipher, s, { id: t.employee_id, company_id: co }, 'task_source_verified', { state: t.state }, { taskId: t.id, sourceType: t.source_type, sourceId: t.source_id });
            continue;
        }
        const level = H.level(t.due_on.toISOString().slice(0, 10), now, cfg.orangeDays, cfg.redDays);
        if (level === 'yellow')
            continue;
        const users = level === 'red' ? await leaders(c, co) : [{ id: t.manager_id }];
        for (const u of users)
            await notice(c, s, co, u.id, t.id, 'task_' + level, t.id + ':' + level + ':' + u.id);
    }
    const delegations = (await c.query("select * from ab.hr_delegations where company_id=$1 and state in('Active','Extended')", [co])).rows;
    for (const d of delegations) {
        const meta = cipher.open(d.payload_cipher);
        if (d.ends_on.toISOString().slice(0, 10) < now) {
            for (const u of await leaders(c, co))
                await notice(c, s, co, u.id, d.id, 'delegation_review', d.id + ':expired');
            continue;
        }
        if (d.starts_on.toISOString().slice(0, 10) > now)
            continue;
        for (const tid of meta.taskIds || []) {
            const t = (await c.query("select * from ab.tasks where id=$1 and company_id=$2 and employee_id=$3 and state not in('Completed','Closed')", [tid, co, d.original_id])).rows[0];
            if (!t)
                continue;
            await c.query('update ab.tasks set employee_id=$2,revision=revision+1 where id=$1', [t.id, d.substitute_id]);
            await taskEvent(c, cipher, s, t.id, 'delegated', { delegationId: d.id, from: d.original_id, to: d.substitute_id, financialAuthorityTransferred: false });
        }
    }
    return { created, tasksReviewed: tasks.length, automaticReturn: false };
}
export function registerPersonnelWorkflows(app: any, route: any, cipher: any) {
    const id = z.uuid(), day = z.iso.date(), text = z.string().trim().min(1).max(2000), money = z.string().regex(/^\d{1,15}(\.\d{1,3})?$/), month = day.refine(v => v.endsWith('-01'));
    app.get('/api/personnel/company/:id', route(async (c: any, m: any, s: any, r: any) => { const co = id.parse(r.params.id), out: any = { companyId: co, rights: [] }; for (const name of ['configure', 'task_delegate', 'evaluation_models', 'awards', 'termination', 'clearance', 'reserve'])
        if (hrRight(m, name, co))
            out.rights.push(name); requireOk(out.rights.length); if (hrRight(m, 'configure', co))
        out.config = await settings(c, cipher, co); for (const [tab, right] of [['hr_delegations', 'task_delegate'], ['hr_models', 'evaluation_models'], ['hr_incentive_rules', 'awards'], ['hr_terminations', 'termination'], ['hr_reserves', 'reserve']])
        if (hrRight(m, right, co))
            out[tab] = (await c.query('select * from ab.' + tab + ' where company_id=$1 order by created_at desc limit 1000', [co])).rows.map((r: any) => { let payload = cipher.open(r.payload_cipher); if (tab === 'hr_terminations' && !hrRight(m, 'eos_view', co))
                payload = { kind: payload.kind, reason: payload.reason }; return { ...r, payload, payload_cipher: undefined }; }); return out; }));
    app.post('/api/personnel/incentive-rules', route(async (c: any, m: any, s: any, r: any) => { const d = z.object({ companyId: id, jobTitle: text, minimumScore: z.number().int().min(0).max(10000), amount: money.refine(v => H.units(v) > 0n), active: z.boolean().default(false), reason: text }).strict().parse(r.body); need(m, 'awards', d.companyId); need(m, 'configure', d.companyId); const key = randomUUID(); await c.query('insert into ab.hr_incentive_rules(id,tenant_id,company_id,payload_cipher,active,created_by)values($1,$2,$3,$4,$5,$6)', [key, s.tenant_id, d.companyId, cipher.seal(d), d.active, s.user_id]); await auditHR(c, cipher, s, { id: key, company_id: d.companyId }, 'incentive_rule_created', null, d); return { id: key, saved: true, automaticPayment: false }; }));
    app.post('/api/personnel/incentive-rules/:id/generate', route(async (c: any, m: any, s: any, r: any) => { const d = z.object({ month }).strict().parse(r.body), rule = (await c.query('select * from ab.hr_incentive_rules where id=$1', [id.parse(r.params.id)])).rows[0]; requireOk(rule, 404, 'notFound'); need(m, 'awards', rule.company_id); requireOk(rule.active && (await settings(c, cipher, rule.company_id)).incentivesEnabled, 409, 'incentivesDisabled'); const cfg = cipher.open(rule.payload_cipher), reviews = (await c.query('select * from ab.hr_reviews where company_id=$1 and month=$2 and score>=$3', [rule.company_id, d.month, cfg.minimumScore])).rows; let created = 0; for (const review of reviews) {
        const snap = cipher.open(review.payload_cipher);
        if (!snap.models.some((v: any) => v.jobTitle === cfg.jobTitle))
            continue;
        const ref = 'incentive:' + rule.id + ':' + review.id;
        if ((await c.query('select 1 from ab.hr_decisions where employee_id=$1 and company_id=$2 and month=$3 and reference=$4', [review.employee_id, rule.company_id, d.month, ref])).rowCount)
            continue;
        const contract=await compensation(c,review.employee_id,d.month,cipher);requireOk(contract.company_id===rule.company_id,422,'payingCompanyMismatch');const key = randomUUID();
        await c.query("insert into ab.hr_decisions(id,tenant_id,employee_id,company_id,month,kind,amount,reference,payload_cipher,created_by)values($1,$2,$3,$4,$5,'bonus',$6,$7,$8,$9)", [key, s.tenant_id, review.employee_id, rule.company_id, d.month, cfg.amount, ref, cipher.seal({ ruleId: rule.id, reviewId: review.id, reason: cfg.reason,currency:contract.currency,compensationId:contract.id }), s.user_id]);
        await auditHR(c, cipher, s, { id: review.employee_id, company_id: rule.company_id }, 'incentive_requested', null, { decisionId: key, reviewId: review.id, ruleId: rule.id });
        created++;
    } return { created, paymentsCreated: 0, approvalRequired: true }; }));
    app.post('/api/personnel/followup/:companyId', route(async (c: any, m: any, s: any, r: any) => { z.object({ confirm: z.literal(true) }).strict().parse(r.body); return personnelFollowup(c, cipher, m, s, id.parse(r.params.companyId)); }));
    app.post('/api/personnel/delegations', route(async (c: any, m: any, s: any, r: any) => { const d = z.object({ companyId: id, originalId: id, substituteId: id, startsOn: day, endsOn: day, taskIds: z.array(id).min(1).max(1000), reason: text }).strict().parse(r.body); need(m, 'task_delegate', d.companyId); H.days(d.startsOn, d.endsOn); requireOk(d.originalId !== d.substituteId, 422, 'invalidSubstitute'); await employeeIn(c, d.originalId, d.companyId); await employeeIn(c, d.substituteId, d.companyId); for (const tid of d.taskIds)
        requireOk((await c.query("select 1 from ab.tasks where id=$1 and company_id=$2 and employee_id=$3 and state not in('Completed','Closed')", [tid, d.companyId, d.originalId])).rowCount, 422, 'invalidTaskScope'); const key = randomUUID(); await c.query('insert into ab.hr_delegations(id,tenant_id,company_id,original_id,substitute_id,starts_on,ends_on,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [key, s.tenant_id, d.companyId, d.originalId, d.substituteId, d.startsOn, d.endsOn, cipher.seal(d), s.user_id]); await auditHR(c, cipher, s, { id: d.originalId, company_id: d.companyId }, 'delegation_created', null, d); return { id: key, saved: true, authorityTransferred: false }; }));
    app.post('/api/personnel/delegations/:id/decision', route(async (c: any, m: any, s: any, r: any) => { requireOk(m.actor.roleId === 'owner'); const d = z.object({ action: z.enum(['return', 'extend', 'transfer']), endsOn: day.optional(), reason: text }).strict().parse(r.body), row = (await c.query('select * from ab.hr_delegations where id=$1', [id.parse(r.params.id)])).rows[0]; requireOk(row, 404, 'notFound'); requireOk(['Active', 'Extended'].includes(row.state), 409, 'invalidState'); const data = cipher.open(row.payload_cipher); if (d.action === 'extend')
        requireOk(d.endsOn && d.endsOn >= today() && d.endsOn > row.ends_on.toISOString().slice(0, 10), 422, 'invalidDate'); if (d.action === 'return') {
        await employeeIn(c, row.original_id, row.company_id);
        for (const tid of data.taskIds) {
            const t = (await c.query("select * from ab.tasks where id=$1 and employee_id=$2 and state not in('Completed','Closed')", [tid, row.substitute_id])).rows[0];
            if (t) {
                await c.query('update ab.tasks set employee_id=$2,revision=revision+1 where id=$1', [t.id, row.original_id]);
                await taskEvent(c, cipher, s, t.id, 'delegation_returned', { delegationId: row.id, ...d });
            }
        }
    } await c.query('update ab.hr_delegations set state=$2,ends_on=coalesce($3,ends_on),payload_cipher=$4 where id=$1', [row.id, d.action === 'return' ? 'Returned' : d.action === 'extend' ? 'Extended' : 'Transferred', d.endsOn || null, cipher.seal({ ...data, lastDecision: d })]); await auditHR(c, cipher, s, { id: row.original_id, company_id: row.company_id }, 'delegation_decision', { state: row.state }, d); return { saved: true }; }));
    app.get('/api/personnel/delegations', route(async (c: any, m: any) => ({ rows: (await c.query('select * from ab.hr_delegations order by created_at desc')).rows.filter((r: any) => hrRight(m, 'task_delegate', r.company_id)).map((r: any) => ({ ...r, payload: cipher.open(r.payload_cipher), payload_cipher: undefined })) })));
    app.post('/api/personnel/employees/:id/account-status', route(async (c: any, m: any, s: any, r: any) => { const e = await employee(c, m, id.parse(r.params.id), 'account_status'), d = z.object({ status: z.enum(['Active', 'Pending', 'Disabled']), reason: text }).strict().parse(r.body); requireOk(e.user_id, 422, 'noLinkedAccount'); const u = m.state.users.find((u: any) => u.id === e.user_id); requireOk(u && u.roleId !== 'owner' && u.id !== m.actor.id, 403, 'ownerProtected'); if (d.status === 'Active')
        requireOk(!(await c.query("select 1 from ab.hr_leaves where employee_id=$1 and state='Approved'and suspend_account and starts_on<=$2 and ends_on>=$2 union all select 1 from ab.hr_terminations where employee_id=$1 and state in('Approved','Settled')and last_on<$2", [e.id, today()])).rowCount, 409, 'employmentHoldActive'); await c.query('update ab.users set status=$2,revision=revision+1,updated_at=now()where id=$1', [u.id, d.status]); if (d.status !== 'Active')
        await c.query('update ab.sessions set expires_at=least(expires_at,now())where user_id=$1', [u.id]); await auditHR(c, cipher, s, e, 'account_status', { status: u.status }, d); return { saved: true, grantsChanged: false }; }));
    app.get('/api/personnel/audit/:companyId', route(async (c: any, m: any, s: any, r: any) => { const co = id.parse(r.params.companyId); need(m, 'audit', co); return { rows: (await c.query('select * from ab.hr_audit_events where company_id=$1 order by created_at desc limit 1000', [co])).rows.map((r: any) => { const right = r.kind.includes('private') ? 'private' : /compensation|payroll|decision|incentive/.test(r.kind) ? 'salary_view' : /evaluation|review_approved|coaching/.test(r.kind) ? 'evaluation_view' : r.kind.includes('document') ? 'documents' : null; return { ...r, payload: !right || hrRight(m, right, co) ? cipher.open(r.payload_cipher) : { redacted: true }, payload_cipher: undefined }; }) }; }));
    app.post('/api/personnel/employees/:id/terminations', route(async (c: any, m: any, s: any, r: any) => { const e = await employee(c, m, id.parse(r.params.id), 'termination'), d = z.object({ kind: z.enum(['resignation', 'company', 'exceptional']), noticeOn: day, lastOn: day, reason: text, exceptionBasis: z.string().max(2000).optional() }).strict().parse(r.body); H.days(d.noticeOn, d.lastOn); if (e.user_id)
        requireOk(m.state.users.find((u: any) => u.id === e.user_id)?.roleId !== 'owner', 403, 'ownerProtected'); const cfg = await settings(c, cipher, e.company_id), earliest = new Date(d.noticeOn + 'T00:00:00Z'); const dayOfMonth=earliest.getUTCDate();earliest.setUTCDate(1);earliest.setUTCMonth(earliest.getUTCMonth()+cfg.noticeMonths);earliest.setUTCDate(Math.min(dayOfMonth,new Date(Date.UTC(earliest.getUTCFullYear(),earliest.getUTCMonth()+1,0)).getUTCDate())); if (d.kind === 'company' && d.lastOn < earliest.toISOString().slice(0, 10))
        requireOk(d.exceptionBasis, 422, 'noticeLegalBasisRequired'); requireOk(!(await c.query("select 1 from ab.hr_terminations where employee_id=$1 and state<>'Rejected'", [e.id])).rowCount, 409, 'terminationAlreadyExists'); const key = randomUUID(); await c.query('insert into ab.hr_terminations(id,tenant_id,employee_id,company_id,kind,notice_on,last_on,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [key, s.tenant_id, e.id, e.company_id, d.kind, d.noticeOn, d.lastOn, cipher.seal(d), s.user_id]); await auditHR(c, cipher, s, e, 'termination_requested', null, d); return { id: key, saved: true }; }));
    app.post('/api/personnel/terminations/:id/approve', route(async (c: any, m: any, s: any, r: any) => { const d = z.object({ approve: z.boolean(), reason: text }).strict().parse(r.body), t = (await c.query('select * from ab.hr_terminations where id=$1', [id.parse(r.params.id)])).rows[0]; requireOk(t, 404, 'notFound'); need(m, 'termination', t.company_id); requireOk(t.state === 'Requested', 409, 'invalidState'); await c.query('update ab.hr_terminations set state=$2,approved_by=$3 where id=$1', [t.id, d.approve ? 'Approved' : 'Rejected', s.user_id]); await auditHR(c, cipher, s, { id: t.employee_id, company_id: t.company_id }, 'termination_decision', { state: t.state }, d); return { saved: true }; }));
    async function clearance(c: any, e: any) { const heldFunds = []; if (e.user_id)
        for (const f of (await c.query('select * from ab.finance_funds where holder_id=$1', [e.user_id])).rows) {
            const amount = await balance(c, f.chart_id);
            if (amount)
                heldFunds.push({ id: f.id, companyId: f.company_id, kind: f.kind, currency: f.currency, amount: H.money(amount) });
        } const recoveries = e.user_id ? (await c.query("select id,company_id,vehicle_id from ab.vehicle_recovery_tasks where assignee_id=$1 and state='Open'", [e.user_id])).rows : []; const custody = e.user_id ? (await c.query('select company_id,currency,sum(amount)::text amount from ab.finance_custody_moves where holder_id=$1 group by company_id,currency having sum(amount)<>0', [e.user_id])).rows : [], assets = (await c.query("select id,kind,reference from ab.hr_assets where employee_id=$1 and state='Held'", [e.id])).rows, tasks = (await c.query("select id,task_number from ab.tasks where employee_id=$1 and state not in('Completed','Closed')", [e.id])).rows, payroll = (await c.query("select p.id,p.state,v.status from ab.hr_payroll p left join ab.finance_vouchers v on v.id=p.voucher_id where employee_id=$1 and(p.state='Draft'or(p.net>0 and coalesce(v.status,'Pending')<>'Paid'))", [e.id])).rows; return { custody, heldFunds, openRecoveries: recoveries, assets, tasks, unpaidPayroll: payroll, automaticKeyAttribution: false, unrecordedPayrollRequiresLegalReview: true, requiresManualLegalAndKeyReview: true, financiallyClear: !custody.length && !heldFunds.length && !recoveries.length && !assets.length && !tasks.length && !payroll.length }; }
    app.get('/api/personnel/employees/:id/clearance', route(async (c: any, m: any, s: any, r: any) => { const e = await employee(c, m, id.parse(r.params.id), 'clearance'); return { ...await clearance(c, e), eos: hrRight(m, 'eos_view', e.company_id) ? await legalEOS(c, cipher, e) : null }; }));
    app.post('/api/personnel/employees/:id/assets', route(async (c: any, m: any, s: any, r: any) => { const e = await employee(c, m, id.parse(r.params.id), 'clearance'), d = z.object({ reference: text, kind: text, state: z.enum(['Held', 'Returned']), note: text }).strict().parse(r.body), old = (await c.query('select * from ab.hr_assets where company_id=$1 and reference=$2', [e.company_id, d.reference])).rows[0]; requireOk(!old || old.employee_id === e.id, 409, 'assetAlreadyAssigned'); const key = old?.id || randomUUID(); if (old)
        await c.query('update ab.hr_assets set state=$2,payload_cipher=$3 where id=$1', [key, d.state, cipher.seal(d)]);
    else
        await c.query('insert into ab.hr_assets(id,tenant_id,employee_id,company_id,reference,kind,state,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [key, s.tenant_id, e.id, e.company_id, d.reference, d.kind, d.state, cipher.seal(d), s.user_id]); await auditHR(c, cipher, s, e, 'asset_changed', old ? { state: old.state } : null, d); return { id: key, saved: true }; }));
    app.post('/api/personnel/terminations/:id/settle', route(async (c: any, m: any, s: any, r: any) => { const d = z.object({ eosAmount: money, leaveAmount: money, otherAmount: money, legalBasis: text, keysReviewed: z.literal(true), legalReviewed: z.literal(true), reason: text }).strict().parse(r.body), t = (await c.query('select * from ab.hr_terminations where id=$1', [id.parse(r.params.id)])).rows[0]; requireOk(t, 404, 'notFound'); need(m, 'clearance', t.company_id); need(m, 'eos_view', t.company_id); requireOk(t.state === 'Approved' && t.last_on.toISOString().slice(0, 10) <= today(), 409, 'terminationNotDue'); const e = (await c.query('select * from ab.hr_employees where id=$1', [t.employee_id])).rows[0], check = await clearance(c, e); requireOk(check.financiallyClear, 409, 'clearancePending'); const estimate = await legalEOS(c, cipher, e, t.last_on.toISOString().slice(0, 10)); requireOk(estimate.available, 409, 'legalRegimeReviewRequired'); requireOk(H.units(d.eosAmount) <= H.units(estimate.remaining), 422, 'eosExceedsRemaining'); const cfg = await settings(c, cipher, t.company_id), total = H.units(d.eosAmount) + H.units(d.leaveAmount) + H.units(d.otherAmount); let voucherId = null; if (total) {
        requireOk(cfg.finalSettlementItemId, 409, 'settlementMappingRequired');
        const comp = (await c.query('select * from ab.hr_compensation where employee_id=$1 order by effective_on desc,version desc limit 1', [e.id])).rows[0];
        const item = (await c.query('select * from ab.finance_items where id=$1', [cfg.finalSettlementItemId])).rows[0];
        requireOk(item?.active, 422, 'invalidItem');
        const mapping = cipher.open(item.payload_cipher), payable = await resolve(c, t.company_id, comp.currency, mapping.payableId), expense = await resolve(c, t.company_id, comp.currency, mapping.expenseId);
        requireOk(expense.kind === 'expense' && payable.kind === 'liability', 422, 'accountMappingRequired');
        let remaining = H.units(d.eosAmount), covered = 0n;
        const lines: any[] = [];
        for (const provision of (await c.query("select p.* from ab.hr_provisions p join ab.finance_journals j on j.id=p.journal_id where p.employee_id=$1 and p.company_id=$2 and j.status='Posted'and not exists(select 1 from ab.finance_journals r where r.reversal_of=j.id and r.status='Posted')order by p.month", [e.id, t.company_id])).rows) {
            if (!remaining)
                break;
            const meta = cipher.open(provision.payload_cipher);
            requireOk(meta.currency === comp.currency, 422, 'currencyMismatch');
            const liability = await resolve(c, t.company_id, comp.currency, meta.liabilityDefinitionId), used = H.units(provision.amount) < remaining ? H.units(provision.amount) : remaining;
            lines.push(line(liability, used));
            remaining -= used;
            covered += used;
        }
        if (total > covered)
            lines.push(line(expense, total - covered));
        lines.push(line(payable, -total));
        await journal(c, cipher, s, t.company_id, today(), comp.currency, 'personnel-settlement:' + t.id, lines, { terminationId: t.id, employeeId: e.id, provisionUsed: H.money(covered), noDuplicateExpense: true });
        const v = await createFinancialVoucher(c, cipher, m, s, { companyId: t.company_id, itemId: cfg.finalSettlementItemId, amount: H.money(total), currency: comp.currency, issuedOn: today(), beneficiary: profile(e, cipher).nameEn, reason: d.reason, sourceKey: 'personnel-settlement:' + t.id }, { alreadyAccrued: true, payableOverrideId: payable.id, terminationId: t.id, employeeId: e.id });
        voucherId = v.id;
    } await c.query("update ab.hr_terminations set state='Settled',voucher_id=$2,payload_cipher=$3 where id=$1", [t.id, voucherId, cipher.seal({ ...cipher.open(t.payload_cipher), settlement: d, clearance: check, estimate })]); await c.query("update ab.hr_employees set state='Ended',revision=revision+1 where id=$1", [e.id]); await auditHR(c, cipher, s, e, 'clearance_settled', null, { ...d, voucherId }); return { saved: true, voucherId, paid: false }; }));
    app.post('/api/personnel/employees/:id/provisions', route(async (c: any, m: any, s: any, r: any) => { const e = await employee(c, m, id.parse(r.params.id), 'reserve'), d = z.object({ month, amount: money, expenseDefinitionId: id, liabilityDefinitionId: id, currency: z.string().regex(/^[A-Z]{3}$/), reason: text }).strict().parse(r.body); need(m, 'eos_view', e.company_id);requireOk(financeRight(m,'ledger_journal_create',e.company_id)&&financeRight(m,'ledger_journal_approve',e.company_id)); const exp = await resolve(c, e.company_id, d.currency, d.expenseDefinitionId), liab = await resolve(c, e.company_id, d.currency, d.liabilityDefinitionId); requireOk(exp.kind === 'expense' && liab.kind === 'liability' && H.units(d.amount) > 0n, 422, 'accountMappingRequired'); const key = randomUUID(), j = await journal(c, cipher, s, e.company_id, today(), d.currency, 'personnel-provision:' + e.id + ':' + d.month, [line(exp, H.units(d.amount)), line(liab, -H.units(d.amount))], { employeeId: e.id, month: d.month, legalEstimateUnchanged: true }); await c.query('insert into ab.hr_provisions(id,tenant_id,employee_id,company_id,month,amount,journal_id,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [key, s.tenant_id, e.id, e.company_id, d.month, d.amount, j, cipher.seal(d), s.user_id]); await auditHR(c, cipher, s, e, 'provision_posted', null, d); return { id: key, saved: true }; }));
    app.post('/api/personnel/reserves', route(async (c: any, m: any, s: any, r: any) => { const d = z.object({ companyId: id, amount: money, currency: z.string().regex(/^[A-Z]{3}$/), effectiveOn: day, maturesOn: day.optional(), operationId: id, bankAccountId: id, term: text, expectedReturn: z.string().max(200).default(''), reason: text }).strict().parse(r.body); need(m, 'reserve', d.companyId); requireOk((await settings(c, cipher, d.companyId)).reserveEnabled, 409, 'reserveDisabled'); const op = (await c.query("select * from ab.finance_operations where id=$1 and company_id=$2 and status='Approved'", [d.operationId, d.companyId])).rows[0]; requireOk(op && op.bank_account_id === d.bankAccountId && op.direction === 'debit' && op.currency === d.currency && H.units(op.amount) === H.units(d.amount) && H.units(d.amount) > 0n, 422, 'approvedFinancialOperationRequired'); requireOk((await c.query('select 1 from ab.bank_accounts where id=$1 and company_id=$2', [d.bankAccountId, d.companyId])).rowCount, 422, 'invalidBank'); const key = randomUUID(); await c.query('insert into ab.hr_reserves(id,tenant_id,company_id,operation_id,amount,currency,effective_on,matures_on,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [key, s.tenant_id, d.companyId, d.operationId, d.amount, d.currency, d.effectiveOn, d.maturesOn || null, cipher.seal(d), s.user_id]); await auditHR(c, cipher, s, { id: key, company_id: d.companyId }, 'reserve_recorded', null, d); return { id: key, saved: true, fundsMoved: false }; }));
}
