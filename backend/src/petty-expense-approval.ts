// Prospective independent review using original HR tasks and original petty PV/JV.
// Configuration is explicit and never changes existing grants, balances or past expenses.
import {randomUUID} from 'node:crypto';
import {has} from './data.js';
import {z} from 'zod';
import {requireOk,sha} from './core.js';
import {L,need,item,resolve,event} from './ledger-domain.js';
import {financeRight} from './finance.js';
import {employeeIn,makeTask,task,taskEvent,notice,ready as personnelReady} from './personnel-domain.js';
import {reviewPettyReceipt,pettyEvidenceDocument} from './petty-cash-review.js';
import {today} from './vehicle-domain.js';
const id=z.uuid(),text=z.string().trim().min(1).max(2000),prefix='petty-expense-review-v1:';
const expenseSchema=z.object({itemId:id,amount:z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).refine(v=>L.units(v)>0n),reason:text,effectiveOn:z.iso.date(),documentVersionId:id}).strict();
const signature=(d:any)=>sha(JSON.stringify({itemId:d.itemId,amount:L.money(L.units(d.amount)),reason:d.reason,effectiveOn:d.effectiveOn,documentVersionId:d.documentVersionId}));
async function read(c:any,cipher:any,key:string){const r=(await c.query('select value from ab.settings where key=$1',[prefix+key])).rows[0];return r?cipher.open(r.value.cipher):null;}
async function save(c:any,cipher:any,s:any,key:string,r:any,old:any=null){await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,prefix+key,{cipher:cipher.seal(r),...(key.startsWith('records:')?{index:{companyId:r.companyId,fundId:r.fundId,referenceHash:r.referenceHash||null}}:{})}]);await event(c,cipher,s,r.companyId,r.id||r.fundId,'petty_expense_review_saved',old,r);}
async function fund(c:any,m:any,key:string){const f=(await c.query('select * from ab.finance_funds where id=$1',[key])).rows[0];requireOk(f?.active&&f.kind==='petty'&&f.currency==='AED',404,'notFound');need(m,'view',f.company_id);return f;}
function qualified(m:any,userId:string,co:string){const user=m.state.users.find((u:any)=>u.id===userId),actor=user?{...user,permissions:m.state.roles.find((r:any)=>r.id===user.roleId)?.permissions||[]}:null;return actor?.status==='Active'&&(has(actor,'view_company_documents')||has(actor,'edit_company'))&&financeRight({...m,actor},'ledger_journal_approve',co)&&financeRight({...m,actor},'ledger_fund_manage',co);}
async function source(c:any,m:any,cipher:any,key:string){const row=await read(c,cipher,'records:'+key);requireOk(row,404,'notFound');const f=await fund(c,m,row.fundId);return{r:row,f};}

export async function approvedPettyExpense(c:any,m:any,cipher:any,f:any,d:any){
 const cfg=await read(c,cipher,'config:'+f.id);if(!cfg){requireOk(!d.reviewId,422,'pettyExpenseReviewMismatch');return null;}
 requireOk(d.reviewId,409,'pettyExpenseReviewRequired');
 const r=await read(c,cipher,'records:'+d.reviewId);requireOk(r&&r.fundId===f.id&&r.companyId===f.company_id&&r.signature===signature(d),409,'pettyExpenseReviewMismatch');
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+'record:'+r.id]);
 const current=await read(c,cipher,'records:'+r.id);requireOk(['Approved','Posted'].includes(current.state)&&current.approvedBy!==f.holder_id,409,'pettyExpenseReviewRequired');
 if(current.state==='Posted'){
  requireOk((await c.query("select 1 from ab.finance_journals j where j.id=$1 and j.company_id=$2 and j.status='Posted' and not exists(select 1 from ab.finance_journals x where x.reversal_of=j.id)",[current.journalId,f.company_id])).rowCount,409,'pettyExpenseCorrectionReviewRequired');
  return current;
 }
 requireOk(qualified(m,current.approvedBy,f.company_id),409,'pettyExpenseReviewerRequired');
 const doc=await pettyEvidenceDocument(c,m,cipher,f.company_id,d.documentVersionId);requireOk(doc.sha256===current.evidenceDigest,409,'pettyExpenseReviewMismatch');
 return current;
}
export async function recordPettyExpenseApproval(c:any,cipher:any,s:any,r:any,journalId:string){if(r)await save(c,cipher,s,'records:'+r.id,{...r,state:'Posted',journalId,postedBy:s.user_id,postedAt:new Date().toISOString()},r);}
export async function pettyExpenseTaskComplete(c:any,cipher:any,key:string){const r=await read(c,cipher,'records:'+key);return !!r&&['Approved','Rejected','Posted'].includes(r.state);}

export function registerPettyExpenseApproval(app:any,route:any,cipher:any,objects:any){
 app.get('/api/ledger/funds/:id/expense-review-options',route(async(c:any,m:any,s:any,req:any)=>{
  const f=await fund(c,m,id.parse(req.params.id));need(m,'fund_manage',f.company_id);need(m,'configure',f.company_id);requireOk(m.actor.roleId==='owner',403,'ownerOnly');
  await personnelReady(c);
  const employees=(await c.query("select id,user_id,employee_number::text,payload_cipher from ab.hr_employees where state='Active' and hired_on<=$2 and(company_id=$1 or exists(select 1 from ab.hr_assignments a where a.employee_id=hr_employees.id and a.company_id=$1 and a.effective_on<=$2 and(a.until_on is null or a.until_on>=$2)))order by employee_number limit 1001",[f.company_id,today()])).rows;
  requireOk(employees.length<=1000,422,'registerTooLarge');return{configuration:await read(c,cipher,'config:'+f.id),employees:employees.filter((e:any)=>e.user_id!==f.holder_id&&qualified(m,e.user_id,f.company_id)).map((e:any)=>{const p=cipher.open(e.payload_cipher);return{id:e.id,number:e.employee_number,nameAr:p.nameAr,nameEn:p.nameEn};})};
 }));
 app.post('/api/ledger/funds/:id/expense-review-configuration',route(async(c:any,m:any,s:any,req:any)=>{
  const f=await fund(c,m,id.parse(req.params.id)),d=z.object({reviewerEmployeeId:id,revision:z.number().int().min(0).default(0),reason:text,confirm:z.literal(true)}).strict().parse(req.body);
  need(m,'configure',f.company_id);need(m,'fund_manage',f.company_id);requireOk(m.actor.roleId==='owner',403,'ownerOnly');
  await personnelReady(c);const e=await employeeIn(c,d.reviewerEmployeeId,f.company_id);requireOk(e.state==='Active'&&e.user_id!==f.holder_id&&qualified(m,e.user_id,f.company_id),422,'pettyExpenseReviewerRequired');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+'config:'+f.id]);const old=await read(c,cipher,'config:'+f.id);
  if(old?.reviewerEmployeeId===e.id)return{configured:true,revision:old.revision,financialEffect:false};
  requireOk((old?.revision||0)===d.revision,409,'revisionConflict');
  await save(c,cipher,s,'config:'+f.id,{fundId:f.id,companyId:f.company_id,reviewerEmployeeId:e.id,reviewerUserId:e.user_id,revision:(old?.revision||0)+1,reason:d.reason,configuredBy:s.user_id,configuredAt:new Date().toISOString()},old);
  return{configured:true,financialEffect:false,prospectiveOnly:true};
 }));
 app.get('/api/ledger/funds/:id/expense-reviews',route(async(c:any,m:any,s:any,req:any)=>{
  const f=await fund(c,m,id.parse(req.params.id)),cfg=await read(c,cipher,'config:'+f.id);
  requireOk(f.holder_id===s.user_id||financeRight(m,'ledger_fund_manage',f.company_id)||cfg?.reviewerUserId===s.user_id,403,'denied');
  const rows=(await c.query("select value from ab.settings where key like $1 and value->'index'->>'fundId'=$2 order by key limit 2001",[prefix+'records:%',f.id])).rows;
  requireOk(rows.length<=2000,422,'registerTooLarge');return{configuration:cfg,rows:rows.map((r:any)=>cipher.open(r.value.cipher)).filter((r:any)=>r.fundId===f.id),financialEffect:false};
 }));
 app.post('/api/ledger/funds/:id/expense-reviews',route(async(c:any,m:any,s:any,req:any)=>{
  const f=await fund(c,m,id.parse(req.params.id)),d=expenseSchema.parse(req.body);need(m,'petty_spend',f.company_id);requireOk(f.holder_id===s.user_id||financeRight(m,'ledger_fund_manage',f.company_id),403,'denied');
  const cfg=await read(c,cipher,'config:'+f.id);requireOk(cfg,409,'pettyExpenseConfigurationRequired');
  const e=await employeeIn(c,cfg.reviewerEmployeeId,f.company_id);requireOk(e.state==='Active'&&e.user_id===cfg.reviewerUserId&&e.user_id!==f.holder_id&&e.user_id!==s.user_id&&qualified(m,e.user_id,f.company_id),409,'pettyExpenseReviewerRequired');
  const it=await item(c,cipher,m,d.itemId,f.company_id);requireOk(it.data.payment&&(await resolve(c,f.company_id,f.currency,it.data.expenseId)).kind==='expense',422,'invalidItem');
  const doc=await pettyEvidenceDocument(c,m,cipher,f.company_id,d.documentVersionId),key='evidence:'+f.id+':'+doc.sha256;
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+key]);const pointer=await read(c,cipher,key),prior=pointer?await read(c,cipher,'records:'+pointer.reviewId):null;
  if(prior&&prior.state!=='Rejected'){requireOk(prior.signature===signature(d),409,'pettyExpenseReviewMismatch');return{id:prior.id,taskId:prior.taskId,taskNumber:prior.taskNumber,state:prior.state,created:false,financialEffect:false};}
  const extraction=await reviewPettyReceipt(c,m,cipher,objects,f,d);requireOk(!extraction.duplicate,409,'pettyReceiptAlreadyUsed');
  const facts=extraction.facts,referenceHash=facts&&!facts.ambiguous&&facts.supplier&&facts.reference&&facts.date?sha(JSON.stringify([facts.supplier.normalize('NFKC').trim().toLowerCase(),facts.reference,facts.date])):null;
  if(referenceHash)await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+'reference:'+f.company_id+':'+referenceHash]);
  const duplicates=referenceHash?(await c.query("select value from ab.settings where key like $1 and value->'index'->>'companyId'=$2 and value->'index'->>'referenceHash'=$3 limit 101",[prefix+'records:%',f.company_id,referenceHash])).rows.map((v:any)=>cipher.open(v.value.cipher)).filter((v:any)=>['Pending','Approved','Posted'].includes(v.state)):[];requireOk(duplicates.length<=100,422,'registerTooLarge');
  const rid=randomUUID(),t=await makeTask(c,cipher,s,{companyId:f.company_id,employeeId:e.id,sourceType:'petty_expense_review',sourceId:rid,sourceKey:'petty:review:'+rid,dueOn:today(),title:'مراجعة مستند مصروف نثري / Review petty expense evidence',expectedResult:'Independent documented classification and discrepancy decision; approval alone posts no expense',details:{fundId:f.id,expenseReviewId:rid}});
  const taskNumber=String((await c.query('select task_number from ab.tasks where id=$1',[t.id])).rows[0].task_number);
  const r={id:rid,taskNumber,companyId:f.company_id,fundId:f.id,fundName:f.name,holderId:f.holder_id,reviewerEmployeeId:e.id,reviewerUserId:e.user_id,taskId:t.id,...d,signature:signature(d),evidenceDigest:doc.sha256,referenceHash,duplicateSignals:{referenceMatchCount:duplicates.length},extraction,state:'Pending',revision:1,requestedBy:s.user_id,requestedAt:new Date().toISOString(),previousReviewId:prior?.id||null};
  await save(c,cipher,s,'records:'+rid,r);await save(c,cipher,s,key,{fundId:f.id,companyId:f.company_id,reviewId:rid});return{id:rid,taskId:t.id,taskNumber,state:r.state,created:true,financialEffect:false};
 }));
 app.get('/api/ledger/petty-expense-reviews/:id',route(async(c:any,m:any,s:any,req:any)=>{
  const {r,f}=await source(c,m,cipher,id.parse(req.params.id));await task(c,m,r.taskId);requireOk(s.user_id===r.reviewerUserId||financeRight(m,'ledger_fund_manage',f.company_id),403,'denied');
  return{...r,canReassign:m.actor.roleId==='owner'&&r.state==='Pending',financialEffect:false};
 }));
 app.post('/api/ledger/petty-expense-reviews/:id/reassign',route(async(c:any,m:any,s:any,req:any)=>{
  const key=id.parse(req.params.id),d=z.object({revision:z.number().int().min(1),employeeId:id,reason:text,confirm:z.literal(true)}).strict().parse(req.body);
  requireOk(m.actor.roleId==='owner',403,'ownerOnly');await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+'record:'+key]);
  const {r,f}=await source(c,m,cipher,key);need(m,'configure',f.company_id);need(m,'fund_manage',f.company_id);
  requireOk(r.state==='Pending'&&r.revision===d.revision,409,'revisionConflict');
  await c.query('select id from ab.tasks where id=$1 for update',[r.taskId]);const t=await task(c,m,r.taskId);requireOk(!['Completed','Closed'].includes(t.state),409,'taskTerminal');
  const e=await employeeIn(c,d.employeeId,f.company_id);requireOk(e.state==='Active'&&e.user_id!==f.holder_id&&e.user_id!==r.requestedBy&&qualified(m,e.user_id,f.company_id),422,'pettyExpenseReviewerRequired');
  if(e.id===r.reviewerEmployeeId)return{id:r.id,taskId:t.id,changed:false,financialEffect:false};
  await c.query('update ab.tasks set employee_id=$2,revision=revision+1 where id=$1',[t.id,e.id]);
  await save(c,cipher,s,'records:'+r.id,{...r,reviewerEmployeeId:e.id,reviewerUserId:e.user_id,revision:r.revision+1},r);
  await taskEvent(c,cipher,s,t.id,'reassigned',{previousEmployeeId:t.employee_id,employeeId:e.id,reason:d.reason,expenseReviewId:r.id,financialEffect:false});
  await notice(c,s,f.company_id,e.user_id,t.id,'task_assigned','petty-reassign:'+r.id+':'+(r.revision+1));
  return{id:r.id,taskId:t.id,changed:true,financialEffect:false};
 }));
 app.post('/api/ledger/petty-expense-reviews/:id/decision',route(async(c:any,m:any,s:any,req:any)=>{
  const key=id.parse(req.params.id),d=z.object({revision:z.number().int().min(1),approve:z.boolean(),reason:text,discrepancyReviewed:z.literal(true),taxTreatmentNotInferred:z.literal(true)}).strict().parse(req.body);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+'record:'+key]);const {r,f}=await source(c,m,cipher,key);
  const t=await task(c,m,r.taskId);requireOk(s.user_id===r.reviewerUserId&&qualified(m,s.user_id,f.company_id),403,'denied');requireOk(s.user_id!==f.holder_id&&s.user_id!==r.requestedBy,403,'independentVerifierRequired');
  requireOk(r.state==='Pending'&&r.revision===d.revision&&!['Completed','Closed'].includes(t.state),409,'revisionConflict');
  requireOk(t.employee_id===r.reviewerEmployeeId&&t.user_id===s.user_id,409,'pettyExpenseAssignmentChanged');
  await pettyEvidenceDocument(c,m,cipher,f.company_id,r.documentVersionId);
  if(d.approve&&r.referenceHash){
   await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+'reference:'+f.company_id+':'+r.referenceHash]);
   const matches=(await c.query("select value from ab.settings where key like $1 and value->'index'->>'companyId'=$2 and value->'index'->>'referenceHash'=$3 limit 101",[prefix+'records:%',f.company_id,r.referenceHash])).rows;
   requireOk(matches.length<=100,422,'registerTooLarge');requireOk(!matches.map((v:any)=>cipher.open(v.value.cipher)).some((v:any)=>v.id!==r.id&&['Approved','Posted'].includes(v.state)),409,'pettyExpenseDuplicateReviewRequired');
  }
  const next={...r,state:d.approve?'Approved':'Rejected',revision:r.revision+1,decisionReason:d.reason,discrepancyReviewed:true,taxTreatmentNotInferred:true,approvedBy:d.approve?s.user_id:null,decidedBy:s.user_id,decidedAt:new Date().toISOString()};
  await save(c,cipher,s,'records:'+r.id,next,r);await c.query("update ab.tasks set state='Completed',completed_at=now(),revision=revision+1 where id=$1",[t.id]);
  await taskEvent(c,cipher,s,t.id,'petty_expense_review_decision',{reviewId:r.id,approved:d.approve,reason:d.reason,financialEffect:false});
  return{id:r.id,state:next.state,taskClosed:true,financialEffect:false};
 }));
}
