// Adapter over original employee advances, tasks and immutable contact attempts.
// No sales invoice, second claim, new role or financial posting is created here.
import {z} from 'zod';
import {requireOk} from './core.js';
import {L,need} from './ledger-domain.js';
import {financeRight} from './finance.js';
import {employeeAdvanceState} from './employee-advances.js';
import {employeeIn,makeTask,task,taskRight} from './personnel-domain.js';
import {recordChain,contactResults} from './collection-chain.js';
import {today} from './vehicle-domain.js';
const id=z.uuid(),text=z.string().trim().min(1).max(2000);

export async function advanceCollectionReady(c:any){
 const marker=(await c.query("select to_regprocedure('ab.employee_advance_collection_schema_version()') available")).rows[0];
 return !!marker?.available&&(await c.query('select ab.employee_advance_collection_schema_version() version')).rows[0]?.version==='EMPLOYEE-ADVANCE-COLLECTION-REVIEW-1';
}

async function financialSources(c:any,cipher:any,co:string,keys:string[]){
 const state=await employeeAdvanceState(c,cipher,co),rows=state.rows.filter((r:any)=>keys.includes(r.id));
 requireOk(rows.length===new Set(keys).size,404,'notFound');
 const journalIds=[...new Set(rows.flatMap((r:any)=>[r.receiptJournalId,...r.recoveries.filter((v:any)=>v.kind!=='bank').map((v:any)=>v.kind==='cash'?v.journalId:v.sourceId)]).filter(Boolean))];
 const bankIds=[...new Set(rows.flatMap((r:any)=>r.recoveries.filter((v:any)=>v.kind==='bank').map((v:any)=>v.sourceId)))];
 const validJournals=new Set(journalIds.length?(await c.query("select j.id from ab.finance_journals j where j.id=any($1::uuid[]) and j.company_id=$2 and j.status='Posted' and not exists(select 1 from ab.finance_journals x where x.reversal_of=j.id)",[journalIds,co])).rows.map((r:any)=>r.id):[]);
 const validBanks=new Set(bankIds.length?(await c.query("select id from ab.finance_operations where id=any($1::uuid[]) and company_id=$2 and status='Approved'",[bankIds,co])).rows.map((r:any)=>r.id):[]);
 return rows.map((r:any)=>{
  requireOk(r.status==='Received',409,'advanceReceiptRequired');
  requireOk(!state.reconciliation.find((v:any)=>v.chartId===r.mapping.receivableChartId)?.reviewRequired&&validJournals.has(r.receiptJournalId),409,'advanceCollectionReconciliationRequired');
  requireOk(r.recoveries.every((v:any)=>v.kind==='bank'?validBanks.has(v.sourceId):validJournals.has(v.kind==='cash'?v.journalId:v.sourceId)),409,'advanceCollectionReconciliationRequired');
  return {...r,number:r.cashVoucherNumber||(r.voucher?'PV-'+r.voucher.number:r.receivedAt.slice(0,10)+' — '+(r.employeeNameEn||r.employeeNameAr)),collected:L.money(L.units(r.amount)-L.units(r.outstanding))};
 });
}
async function financialSource(c:any,cipher:any,co:string,key:string){return (await financialSources(c,cipher,co,[key]))[0];}
export async function advanceCollectionReport(c:any,m:any,cipher:any,co:string,keys:string[]){need(m,'view',co);return financialSources(c,cipher,co,keys);}

export async function advanceCollectionSource(c:any,m:any,cipher:any,co:string,key:string){need(m,'view',co);return financialSource(c,cipher,co,key);}
export async function advanceCollectionIsSettled(c:any,cipher:any,co:string,key:string){const r=await financialSource(c,cipher,co,key);return L.units(r.outstanding)<=0n;}

export async function advanceCollectionTask(c:any,m:any,cipher:any,key:string){
 requireOk(await advanceCollectionReady(c),409,'advanceCollectionSchemaReviewRequired');
 const t=await task(c,m,key);requireOk(t.source_type==='collection_employee_advance',422,'invalidTask');
 const r=await advanceCollectionSource(c,m,cipher,t.company_id,t.source_id);
 const rows=(await c.query('select a.*,t.task_number from ab.collection_attempts a join ab.tasks t on t.id=a.task_id where a.employee_advance_id=$1 and a.company_id=$2 order by a.created_at,a.id limit 2001',[r.id,r.companyId])).rows;
 requireOk(rows.length<=2000,422,'registerTooLarge');
 const numbers=new Map((await c.query("select id,task_number from ab.tasks where source_type='collection_employee_advance' and source_id=$1 and company_id=$2",[r.id,r.companyId])).rows.map((r:any)=>[r.id,String(r.task_number)]));
 return {
  party:{type:'employee_advance',nameAr:r.employeeNameAr,nameEn:r.employeeNameEn},
  advance:{id:r.id,number:r.number,outstanding:r.outstanding,collected:r.collected,currency:'AED',financialParty:'employee_advance',status:r.status},
  task:{...cipher.open(t.payload_cipher),number:String(t.task_number),id:t.id,state:t.state,revision:t.revision,employeeId:t.employee_id},
  // Existing approved recoveries are documentary choices, never an instruction to post money.
  receipts:r.recoveries.map((v:any)=>({id:v.id,receipt_number:v.sourceReference,amount:v.amount,kind:v.kind})),
  configuration:{outcomes:contactResults,chainOutcomes:contactResults},
  attempts:rows.map((a:any)=>({id:a.id,outcome:a.outcome,nextAt:a.next_at,createdAt:a.created_at,createdBy:a.created_by,taskId:a.task_id,taskNumber:String(a.task_number),...cipher.open(a.payload_cipher),nextTaskNumber:numbers.get(cipher.open(a.payload_cipher).nextTaskId)||null}))
 };
}

export function registerAdvanceCollection(app:any,route:any,cipher:any){
 app.post('/api/collections/advances/:id/tasks',route(async(c:any,m:any,s:any,req:any)=>{
  const d=z.object({companyId:id,employeeId:id,dueOn:z.iso.date().default(today())}).strict().parse(req.body);
  requireOk(await advanceCollectionReady(c),409,'advanceCollectionSchemaReviewRequired');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['employee-advances-v1:'+d.companyId+':'+req.params.id]);
  const r=await advanceCollectionSource(c,m,cipher,d.companyId,id.parse(req.params.id));
  requireOk(L.units(r.outstanding)>0n,409,'advanceSettled');requireOk(taskRight(m,'create',r.companyId),403,'denied');
  const e=await employeeIn(c,d.employeeId,r.companyId),recipient=m.state.users.find((u:any)=>u.id===e.user_id);
  requireOk(e.state==='Active'&&recipient?.status==='Active'&&e.id!==r.employeeId&&recipient.id!==r.employeeUserId&&financeRight({...m,actor:recipient},'ledger_view',r.companyId)&&financeRight({...m,actor:recipient},'ledger_collect',r.companyId),422,'qualifiedClaimCollectorRequired');
  requireOk(recipient.id===s.user_id||taskRight(m,'assign',r.companyId),403,'assignmentDenied');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['collection-task:'+r.id]);
  const prior=(await c.query("select * from ab.tasks where source_type='collection_employee_advance' and source_id=$1 and company_id=$2 order by created_at desc,task_number desc",[r.id,r.companyId])).rows;
  const active=prior.find((t:any)=>!['Completed','Closed'].includes(t.state));if(active){await task(c,m,active.id);return{id:active.id,created:false};}
  const previous=prior[0],p=previous?cipher.open(previous.payload_cipher):{};
  return makeTask(c,cipher,s,{companyId:r.companyId,employeeId:d.employeeId,sourceType:'collection_employee_advance',sourceId:r.id,sourceKey:previous?'collection:resume:'+previous.id:'collection:advance:'+r.id,dueOn:d.dueOn,title:'متابعة سلفة موظف / Employee advance recovery '+r.number,expectedResult:'Actual contact or link original approved repayment; contacts never settle the advance',details:{employeeAdvanceId:r.id,financialParty:'employee_advance',advanceNumber:r.number,chainVersion:2,...(previous?{rootTaskId:p.rootTaskId||previous.id,previousTaskId:previous.id,manuallyResumed:true}:{})}});
 }));
 app.get('/api/collections/advance-tasks/:id',route(async(c:any,m:any,s:any,req:any)=>advanceCollectionTask(c,m,cipher,id.parse(req.params.id))));
 app.post('/api/collections/advance-tasks/:id/attempts',route(async(c:any,m:any,s:any,req:any)=>{
  requireOk(await advanceCollectionReady(c),409,'advanceCollectionSchemaReviewRequired');
  await c.query('select id from ab.tasks where id=$1 for update',[id.parse(req.params.id)]);
  const t=await task(c,m,id.parse(req.params.id));requireOk(t.source_type==='collection_employee_advance'&&!['Completed','Closed'].includes(t.state),409,'taskTerminal');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',['employee-advances-v1:'+t.company_id+':'+t.source_id]);
  const r=await advanceCollectionSource(c,m,cipher,t.company_id,t.source_id);need(m,'collect',r.companyId);
  requireOk(t.employee_id!==r.employeeId&&s.user_id!==r.employeeUserId,403,'independentVerifierRequired');
  const d=z.object({chainVersion:z.literal(2),contactReference:text,outcome:z.enum(['off','busy','no_answer','answered']),note:z.string().trim().max(2000).default(''),followupType:z.enum(['payment','call','visit']).optional(),nextAt:z.iso.datetime({offset:true}).optional(),recoveryId:id.optional(),appointmentMissed:z.boolean().default(false)}).strict().parse(req.body);
  const recovery=d.recoveryId?r.recoveries.find((v:any)=>v.id===d.recoveryId):null;
  requireOk(!d.recoveryId||recovery,422,'approvedAdvanceRecoveryRequired');requireOk(L.units(r.outstanding)>0n||recovery,409,'advanceSettled');
  return recordChain(c,m,s,cipher,t,{id:r.id,company_id:r.companyId,customer_id:null,vehicle_id:null,employeeAdvanceId:r.id,financialParty:'employee_advance',advanceNumber:r.number,legalOutstanding:r.outstanding,currency:'AED'},{...d,phoneId:null,receiptId:recovery?.kind==='cash'?recovery.sourceId:null,approvedRecoveryId:recovery?.id||null});
 }));
}
