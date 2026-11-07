import {investorManager} from './investors.js';
import { z } from 'zod';
import { financeRight } from './finance.js';
import { vehicleRight } from './vehicle-domain.js';
import { hrRight } from './personnel-domain.js';
import { requireOk } from './core.js';

// Read-only adapters. Decisions execute the authoritative source endpoint, not a second workflow.
export function registerApprovalCenter(app:any,call:any){
    app.get('/api/approval-center',call(async(c:any,m:any,_s:any,req:any)=>{
        const q=z.object({q:z.string().max(200).default(''),state:z.string().max(40).optional(),companyId:z.uuid().optional()}).strict().parse(req.query),out:any[]=[];
        const employees=(await c.query("select to_regclass('ab.hr_employees') ok")).rows[0].ok?(await c.query('select id,user_id,manager_id,company_id from ab.hr_employees')).rows:[];
        const leaveAllowed=(r:any)=>{const e=employees.find((e:any)=>e.id===r.employee_id);return e&&e.user_id!==m.actor.id&&(e.manager_id===m.actor.id||hrRight(m,'leave_approve',e.company_id));};
        const add=async(table:string,stateColumn:string,module:string,authorize:(r:any)=>boolean,decorate:(r:any)=>any)=>{
            if(!(await c.query('select to_regclass($1) ok',['ab.'+table])).rows[0].ok)return;
            const rows=(await c.query('select * from ab.'+table+' order by created_at desc limit 10001')).rows;
            requireOk(rows.length<=10000,422,'registerTooLarge');
            for(const r of rows){if(!authorize(r)||q.companyId&&q.companyId!==r.company_id)continue;const extra=decorate(r),row={id:r.id,key:table+':'+r.id,module,type:table,companyId:r.company_id,state:r[stateColumn],createdAt:r.created_at,revision:r.revision,...extra};if(q.state&&q.state!==row.state)continue;if(q.q&&!JSON.stringify({type:row.type,state:row.state,label:row.label}).normalize('NFKC').toLowerCase().includes(q.q.normalize('NFKC').toLowerCase()))continue;out.push(row);}
        };
        await add('vehicle_requests','funding_state','vehicles',r=>vehicleRight(m,'funding_approve',r.company_id),r=>({label:'#'+r.request_number,sourcePage:'vehicles',sourceId:r.id,sourceView:'requests',pending:r.funding_state==='Requested',decision:r.funding_state==='Requested'?{path:'vehicle-requests/'+r.id+'/funding-decision',style:'boolean',revision:r.revision}:null}));
        await add('vehicle_actions','state','vehicles',r=>vehicleRight(m,r.kind==='sale'?'sale_approve':r.kind==='wanted'?'recovery_approve':r.kind==='writeoff'?'writeoff_approve':r.kind==='reschedule_extension'?'reschedule_extend':r.kind==='settlement'?'settlement':'approve',r.company_id),r=>({label:r.kind,sourcePage:'vehicles',sourceId:r.vehicle_id,pending:r.state==='Requested',decision:r.state==='Requested'?{path:'vehicle-actions/'+r.id+'/decision',style:'vehicle'}:null}));
        await add('hr_leaves','state','personnel',r=>m.actor.roleId==='owner'||leaveAllowed(r),r=>({label:'Leave',sourcePage:'personnel',sourceId:r.employee_id,pending:r.state==='Requested',decision:r.state==='Requested'&&leaveAllowed(r)?{path:'personnel/leaves/'+r.id+'/decision',style:'leave',revision:r.revision}:null}));
        await add('hr_decisions','state','personnel',r=>hrRight(m,r.kind==='deduction'?'deductions':'awards',r.company_id),r=>({label:r.kind,sourcePage:'personnel',sourceId:r.employee_id,pending:r.state==='Requested',decision:r.state==='Requested'?{path:'personnel/decisions/'+r.id+'/approve',style:'boolean'}:null}));
        await add('hr_terminations','state','personnel',r=>hrRight(m,'termination',r.company_id),r=>({label:r.kind,sourcePage:'personnel',sourceId:r.employee_id,pending:r.state==='Requested',decision:r.state==='Requested'?{path:'personnel/terminations/'+r.id+'/approve',style:'boolean'}:null}));
        await add('hr_payroll','state','personnel',r=>hrRight(m,'payroll_approve',r.company_id),r=>({label:'Payroll '+String(r.month).slice(0,10),sourcePage:'personnel',sourceId:r.employee_id,pending:r.state==='Draft',decision:r.state==='Draft'?{path:'personnel/payroll/'+r.id+'/approve',style:'confirm',rejectUnsupported:true}:null}));
        if((await c.query("select to_regclass('ab.investor_funding_requests') ok")).rows[0].ok){const agreements=(await c.query('select a.id,a.company_id,p.user_id from ab.investor_agreements a join ab.investor_profiles p on p.id=a.investor_id')).rows;await add('investor_funding_requests','state','investors',r=>agreements.some((a:any)=>a.id===r.agreement_id&&(a.user_id===m.actor.id||investorManager(m,a.company_id))),r=>({label:'Funding '+r.amount,sourcePage:'investors',sourceId:r.agreement_id,pending:r.state==='Requested',decision:r.state==='Requested'&&agreements.find((a:any)=>a.id===r.agreement_id)?.user_id===m.actor.id?{path:'investors/funding-requests/'+r.id+'/respond',style:'investor'}:null}));}
        await add('finance_operations','status','finance',r=>financeRight(m,'finance_approve',r.company_id),r=>({label:r.kind,sourcePage:'bankAccounts',sourceId:r.id,pending:r.status==='Draft',decision:null,originalProcedureRequired:true}));
        await add('finance_vouchers','status','ledger',r=>financeRight(m,'ledger_voucher_approve',r.company_id),r=>({label:'Voucher #'+r.number,sourcePage:'financialManagement',sourceId:r.id,pending:r.status==='Pending',decision:null,originalProcedureRequired:true}));
        await add('finance_deposits','status','ledger',r=>financeRight(m,'ledger_deposit_verify',r.company_id),r=>({label:'Deposit',sourcePage:'financialManagement',sourceId:r.id,pending:r.status==='Review',decision:null,originalProcedureRequired:true}));
        return {rows:out.sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()),originalWorkflows:true,additionalApprovalSteps:0};
    }));
}
