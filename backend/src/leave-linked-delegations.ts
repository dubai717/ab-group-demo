// Optional linkage over original HR delegations; no transfer of permissions or money.
import {z} from 'zod';
import {requireOk,sha,ApiError} from './core.js';
import {employee,employeeIn,scope,hrRight,taskEvent,auditHR,notice,leaders} from './personnel-domain.js';
import {model} from './data.js';
import {authorizedCommunicationThread} from './communications.js';
import {readCommunicationCase} from './communication-cases.js';
import {today} from './vehicle-domain.js';
import {employeeDocumentTaskSource} from './employee-document-task.js';
const supported=new Set(['manual','employee_document','communication']);
const date=(v:any)=>v instanceof Date?v.toISOString().slice(0,10):String(v).slice(0,10);
const field=(ok:any,status:number,code:string,keys:string[])=>{if(!ok)throw Object.assign(new ApiError(status,code),{fieldErrors:Object.fromEntries(keys.map(k=>[k,code]))});};
// Delegation never supplies missing source access or grants conversation membership.
export async function delegatedTaskSourceReview(c:any,cipher:any,tenantId:string,tasks:any[],target:any){
 const linked=tasks.filter(t=>['communication','employee_document'].includes(t.source_type));if(!linked.length)return null;
 const unavailable=linked.some(t=>t.source_type==='employee_document')?'employeeDocumentDelegateSourceReviewRequired':'communicationDelegateSourceReviewRequired';
 if(!target?.user_id||!(await c.query("select 1 from ab.users where id=$1 and status='Active'",[target.user_id])).rowCount)return unavailable;
 const m=await model(c,target.user_id,cipher),threads=new Map<string,any>(),cases=new Set<string>();
 for(const task of linked){if(task.source_type==='employee_document'){
   try{const original=await employeeDocumentTaskSource(c,cipher,task);if(!original)return'employeeDocumentDelegateSourceReviewRequired';const e=await employee(c,m,original.employee_id);if(!(e.user_id===m.actor.id||hrRight(m,'document_update',e.company_id)))return'employeeDocumentDelegateSourceReviewRequired';}
   catch(error){if(error instanceof ApiError&&[401,403,404,409,422].includes(error.status))return'employeeDocumentDelegateSourceReviewRequired';throw error;}continue;
  }const p=cipher.open(task.payload_cipher);if(!z.uuid().safeParse(p.caseId).success||p.threadId!==task.source_id)return'communicationDelegateSourceReviewRequired';
  try{if(!threads.has(task.source_id)){const thread=await authorizedCommunicationThread(c,m,cipher,task.source_id);if(thread.company_id!==task.company_id||cipher.open(thread.subject_cipher).general)return'communicationDelegateSourceReviewRequired';threads.set(task.source_id,thread);}
   const identity=task.source_id+':'+p.caseId;if(!cases.has(identity)){await readCommunicationCase(c,cipher,{tenant_id:tenantId},task.source_id,p.caseId);cases.add(identity);}
  }catch(error){if(error instanceof ApiError&&[401,403,404,409].includes(error.status))return'communicationDelegateSourceReviewRequired';throw error;}
 }
 return null;
}
export async function validateLeaveDelegation(c:any,cipher:any,m:any,s:any,d:any){
 if(!d.leaveId)return null;
 requireOk(hrRight(m,'task_delegate',d.companyId),403,'denied');
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenant_id+':leave-delegation:'+d.leaveId]);
 const original=await employee(c,m,d.originalId),sub=await employeeIn(c,d.substituteId,d.companyId),leave=(await c.query('select * from ab.hr_leaves where id=$1',[d.leaveId])).rows[0];
 field(leave&&leave.employee_id===original.id&&leave.company_id===d.companyId&&leave.state==='Approved',409,'approvedLeaveLinkRequired',['leaveId']);
 const digest=sha(JSON.stringify({...d,taskIds:[...new Set(d.taskIds)].sort()})),existing=(await c.query('select * from ab.hr_delegations where company_id=$1 and original_id=$2 order by created_at,id limit 2001',[d.companyId,d.originalId])).rows;
 requireOk(existing.length<=2000,422,'delegationRangeRequired');
 for(const row of existing){const meta=cipher.open(row.payload_cipher);if(meta.leaveLinkedVersion===1&&meta.leaveId===d.leaveId&&meta.leaveLinkedDigest===digest)return{existingId:row.id,digest};}
 field(d.startsOn>=date(leave.starts_on)&&d.endsOn<=date(leave.ends_on)&&d.endsOn>=today(),422,'delegationOutsideApprovedLeave',['startsOn','endsOn']);
 requireOk((await scope(c,original)).includes(d.companyId),422,'invalidAssignment');
 field(sub.state==='Active'&&sub.user_id&&(await c.query("select 1 from ab.users where id=$1 and status='Active'",[sub.user_id])).rowCount,409,'substituteUnavailable',['substituteId']);
 requireOk(!(await c.query("select 1 from ab.hr_leaves where employee_id=$1 and state='Approved'and starts_on<=$2 and ends_on>=$3 limit 1",[sub.id,d.endsOn,d.startsOn])).rowCount,409,'substituteLeaveOverlap');
 const chosen=new Set(d.taskIds);requireOk(chosen.size===d.taskIds.length,422,'duplicateTask');
 for(const row of existing.filter((r:any)=>['Active','Extended'].includes(r.state)&&date(r.starts_on)<=d.endsOn&&date(r.ends_on)>=d.startsOn))requireOk(!(cipher.open(row.payload_cipher).taskIds||[]).some((id:string)=>chosen.has(id)),409,'taskDelegationOverlap');
 const tasks=(await c.query('select * from ab.tasks where company_id=$1 and id=any($2::uuid[]) for update',[d.companyId,d.taskIds])).rows;
 requireOk(tasks.length===chosen.size&&tasks.every((t:any)=>t.employee_id===original.id&&!['Completed','Closed'].includes(t.state)),422,'invalidTaskScope');
 requireOk(tasks.every((t:any)=>supported.has(t.source_type)),409,'leaveDelegationSourceReviewRequired');
 const sourceReview=await delegatedTaskSourceReview(c,cipher,s.tenant_id,tasks,sub);requireOk(!sourceReview,409,sourceReview||'communicationDelegateSourceReviewRequired');
 return{existingId:null,digest};
}
export async function reconcileLeaveDelegations(c:any,cipher:any,m:any,s:any,co:string,asOf=today(),onlyLeaveId?:string){
 z.iso.date().parse(asOf);const configured=hrRight(m,'configure',co);requireOk(configured||onlyLeaveId,403,'denied');
 const hasReturnTable=!!(await c.query("select to_regclass('ab.hr_leave_return_requests') ok")).rows[0].ok;
 const confirmed=hasReturnTable?(await c.query("select leave_id from ab.hr_leave_return_requests where company_id=$1 and state='Confirmed'and($2::uuid is null or leave_id=$2)",[co,onlyLeaveId||null])).rows.map((r:any)=>r.leave_id):[];
 if(!configured){const l=(await c.query('select l.*,e.manager_id from ab.hr_leaves l join ab.hr_employees e on e.id=l.employee_id where l.id=$1 and l.company_id=$2',[onlyLeaveId,co])).rows[0];requireOk(l&&confirmed.includes(l.id)&&(l.manager_id===m.actor.id||hrRight(m,'leave_approve',co)),403,'denied');}
 const rows=(await c.query("select * from ab.hr_delegations where company_id=$1 and state in('Active','Extended') order by id limit 2001 for update",[co])).rows;requireOk(rows.length<=2000,422,'delegationRangeRequired');let returned=0,returnedTasks=0;const review:any[]=[];
 for(const row of rows){const meta=cipher.open(row.payload_cipher);if(meta.leaveLinkedVersion!==1||!z.uuid().safeParse(meta.leaveId).success||onlyLeaveId&&meta.leaveId!==onlyLeaveId)continue;
  const leave=(await c.query('select * from ab.hr_leaves where id=$1',[meta.leaveId])).rows[0],actualReturn=confirmed.includes(meta.leaveId);
  if(!leave||leave.state!=='Approved'||leave.employee_id!==row.original_id||leave.company_id!==co||!actualReturn&&(date(row.starts_on)<date(leave.starts_on)||date(row.ends_on)>date(leave.ends_on))){review.push({delegationId:row.id,reason:'approvedLeaveLinkReviewRequired'});continue;}
  if(!actualReturn&&date(row.ends_on)>=asOf)continue;
  const original=(await c.query('select e.*,u.status linked_status from ab.hr_employees e left join ab.users u on u.id=e.user_id where e.id=$1',[row.original_id])).rows[0];if(!original||['Ended','Inactive'].includes(original.state)||!(await scope(c,original,asOf)).includes(co)){review.push({delegationId:row.id,reason:'originalEmployeeReviewRequired'});continue;}
  const ids=z.array(z.uuid()).min(1).max(1000).parse(meta.taskIds),tasks=(await c.query('select * from ab.tasks where company_id=$1 and id=any($2::uuid[]) for update',[co,ids])).rows;
  if(tasks.length!==new Set(ids).size||tasks.some((t:any)=>!supported.has(t.source_type))){review.push({delegationId:row.id,reason:'leaveDelegationSourceReviewRequired'});continue;}
  const sourceReview=await delegatedTaskSourceReview(c,cipher,s.tenant_id,tasks.filter((t:any)=>t.employee_id===row.substitute_id&&!['Completed','Closed'].includes(t.state)),original);if(sourceReview){review.push({delegationId:row.id,reason:sourceReview});continue;}
  const result={returnedTaskIds:[]as string[],completedPreserved:[]as string[],externalAssignmentPreserved:[]as string[],reviewTaskIds:[]as string[]};
  await c.query('SAVEPOINT leave_delegation_row');
  for(const t of tasks){if(['Completed','Closed'].includes(t.state)){result.completedPreserved.push(t.id);continue;}if(t.employee_id!==row.substitute_id){result.externalAssignmentPreserved.push(t.id);continue;}
   const latest=(await c.query("select * from ab.hr_task_events where task_id=$1 and kind in('delegated','delegation_returned','leave_delegation_returned','reassign') order by created_at desc,id desc limit 2",[t.id])).rows;
   if(!latest[0]||latest.length>1&&latest[0].created_at.getTime()===latest[1].created_at.getTime()||latest[0].kind!=='delegated'||cipher.open(latest[0].payload_cipher).delegationId!==row.id){result.reviewTaskIds.push(t.id);continue;}
   await c.query('update ab.tasks set employee_id=$2,revision=revision+1 where id=$1',[t.id,row.original_id]);await taskEvent(c,cipher,s,t.id,'leave_delegation_returned',{delegationId:row.id,leaveId:meta.leaveId,from:row.substitute_id,to:row.original_id,reason:actualReturn?'confirmed_return':'period_ended',financialAuthorityTransferred:false});await notice(c,s,co,original.user_id,t.id,'task_returned_from_leave',row.id+':returned:'+t.id);result.returnedTaskIds.push(t.id);
  }
  if(result.reviewTaskIds.length){await c.query('ROLLBACK TO SAVEPOINT leave_delegation_row');await c.query('RELEASE SAVEPOINT leave_delegation_row');review.push({delegationId:row.id,reason:'taskAssignmentReviewRequired',taskIds:result.reviewTaskIds});continue;}
  await c.query('RELEASE SAVEPOINT leave_delegation_row');
  const followupReviewReason=result.returnedTaskIds.length?(!actualReturn?'returnConfirmationPending':original.linked_status!=='Active'?'originalAccountReviewRequired':null):null;
  const decision={action:'return',automatic:true,reason:actualReturn?'confirmed_return':'period_ended',at:new Date().toISOString(),actor:s.user_id,result,returnConfirmationRecorded:actualReturn,followupReviewReason,workAccessChanged:false};
  await c.query("update ab.hr_delegations set state='Returned',payload_cipher=$2 where id=$1",[row.id,cipher.seal({...meta,lastDecision:decision})]);await auditHR(c,cipher,s,original,'leave_delegation_returned',{state:row.state},{delegationId:row.id,leaveId:meta.leaveId,...decision});returned++;returnedTasks+=result.returnedTaskIds.length;if(followupReviewReason)review.push({delegationId:row.id,reason:followupReviewReason,taskIds:result.returnedTaskIds});
 }
 return{returned,returnedTasks,review,permissionsChanged:false,financialAuthorityTransferred:false};
}
export async function linkedDelegationActivationReview(c:any,cipher:any,row:any,meta:any,asOf:string){
 const leave=(await c.query('select * from ab.hr_leaves where id=$1',[meta.leaveId])).rows[0];
 if(!leave||leave.state!=='Approved'||leave.employee_id!==row.original_id||leave.company_id!==row.company_id||date(row.starts_on)<date(leave.starts_on)||date(row.ends_on)>date(leave.ends_on))return'approvedLeaveLinkReviewRequired';
 const sub=(await c.query('select e.*,u.status account_status from ab.hr_employees e left join ab.users u on u.id=e.user_id where e.id=$1',[row.substitute_id])).rows[0];
 if(!sub||sub.state!=='Active'||sub.account_status!=='Active'||!(await scope(c,sub,asOf)).includes(row.company_id))return'substituteUnavailable';
 if((await c.query("select 1 from ab.hr_leaves where employee_id=$1 and state='Approved'and starts_on<=$2 and ends_on>=$2 limit 1",[sub.id,asOf])).rowCount)return'substituteLeaveOverlap';
 const ids=z.array(z.uuid()).min(1).max(1000).parse(meta.taskIds),tasks=(await c.query('select * from ab.tasks where company_id=$1 and id=any($2::uuid[])',[row.company_id,ids])).rows;
 if(tasks.length!==new Set(ids).size||tasks.some((t:any)=>!supported.has(t.source_type)))return'leaveDelegationSourceReviewRequired';
 return await delegatedTaskSourceReview(c,cipher,row.tenant_id,tasks,sub);
}
export async function notifyLeaveDelegationReviews(c:any,cipher:any,m:any,s:any,co:string,reviews:any[]){
 if(!reviews.length)return;const ids=[...new Set(reviews.map(r=>r.delegationId))],rows=(await c.query('select d.*,e.manager_id from ab.hr_delegations d join ab.hr_employees e on e.id=d.original_id where d.company_id=$1 and d.id=any($2::uuid[])',[co,ids])).rows;
 const targets=await leaders(c,co);
 for(const item of reviews){const row=rows.find((r:any)=>r.id===item.delegationId);if(!row)continue;requireOk(hrRight(m,'configure',co)||hrRight(m,'leave_approve',co)||row.manager_id===m.actor.id,403,'denied');let fresh=0;for(const target of targets)fresh+=await notice(c,s,co,target.id,row.id,'delegation_review','leave-link:'+row.id+':'+item.reason);if(fresh)await auditHR(c,cipher,s,{id:row.original_id,company_id:co},'leave_delegation_review',null,{delegationId:row.id,reason:item.reason,taskIds:item.taskIds||[],ownershipChanged:false});}
}
