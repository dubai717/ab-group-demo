import{useExecutionException}from'./service-execution-exceptions.js';
import{serviceActivation,serviceActivationFrame}from'./service-activation-clock.js';
// Isolated build acceptance only. No environment flag, server registration, approval or live activation.
import{z}from'zod';import{ApiError,requireOk}from'./core.js';import{actualActorServiceEligibilityCreationCheck,actualActorServiceEligibilityApprovalCheck}from'./service-eligibility-actor-source.js';
function isolatedServiceGuard(cipher:any,effectiveFrom:string,phase:'create'|'approve'){
 const activation=serviceActivation(effectiveFrom);
 return async(c:any,m:any,s:any,input:{customerId:string;companyId:string;type:'vehicle'|'residence'|'general';requestId?:string})=>{
  const database=(await c.query('select current_database()name')).rows[0]?.name;
  requireOk(typeof database==='string'&&/^ab_backup_[a-f0-9]{32}$/.test(database),503,'isolatedEligibilityPrototypeOnly');
  if(!serviceActivationFrame(activation,new Date()).active)return;
  const {requestId,...identity}=input;
  const result=await (phase==='approve'?actualActorServiceEligibilityApprovalCheck:actualActorServiceEligibilityCreationCheck)(c,m,s,cipher,identity);
  if(phase==='approve'&&requestId&&result.status==='blocked'&&await useExecutionException(c,m,s,cipher,{...identity,requestId,phase:'approve'},result))return;
  if(result.status!=='allowed')throw new ApiError(409,result.status==='blocked'?'newServiceArrearsBlocked':'newServiceArrearsReviewRequired');
 };
}

export const isolatedNewServiceEligibilityGuard=(cipher:any,effectiveFrom:string)=>isolatedServiceGuard(cipher,effectiveFrom,'create');
export const isolatedServiceApprovalEligibilityGuard=(cipher:any,effectiveFrom:string)=>isolatedServiceGuard(cipher,effectiveFrom,'approve');

// Original status route calls this only for the first InProgress transition. The immutable
// original start, not a client flag, distinguishes continuation. Owner approval itself
// remains covered by beforeServiceApproval; neither hook is registered by server.ts.
export function isolatedCustomerServiceExecutionEligibilityGuard(cipher:any,effectiveFrom:string){
 const activation=serviceActivation(effectiveFrom);
 const eligibility=isolatedNewServiceEligibilityGuard(cipher,effectiveFrom);
 return async(c:any,m:any,s:any,input:{customerId:string;companyId:string;type:'residence'|'general';requestId:string})=>{
  const d=z.object({customerId:z.uuid(),companyId:z.uuid(),type:z.enum(['residence','general']),requestId:z.uuid()}).strict().parse(input);
  const name=(await c.query('select current_database()name')).rows[0]?.name;
  requireOk(typeof name==='string'&&/^ab_backup_[a-f0-9]{32}$/.test(name),503,'isolatedEligibilityPrototypeOnly');
  if(!serviceActivationFrame(activation,new Date()).active)return;
  requireOk(!s.viewAs&&(s.actor_type===undefined||s.actor_type==='user')&&m.actor.id===s.user_id&&m.actor.status==='Active'&&m.actor.roleId!=='investor',403,'denied');
  const r=(await c.query("select tenant_id,customer_id,company_id,case when octet_length(payload_cipher)<=65536 then payload_cipher else null end payload_cipher from ab.customer_events where id=$1 and kind='service_request_created'",[d.requestId])).rows[0];
  requireOk(r&&r.tenant_id===s.tenant_id&&r.customer_id===d.customerId&&r.company_id===d.companyId,404,'notFound');
  requireOk(typeof r.payload_cipher==='string'&&cipher.open(r.payload_cipher)?.after?.type===d.type,409,'newServiceArrearsReviewRequired');
  const budget=(await c.query("select count(*)::int n,coalesce(sum(octet_length(payload_cipher)),0)::text bytes from ab.customer_events where tenant_id=$1 and customer_id=$2 and company_id=$3 and kind='service_request_action'",[s.tenant_id,d.customerId,d.companyId])).rows[0];
  requireOk(budget.n<=2000&&Number(budget.bytes)<=1048576,409,'newServiceArrearsReviewRequired');
  const raw=(await c.query("select case when octet_length(payload_cipher)<=65536 then payload_cipher else null end payload_cipher from ab.customer_events where tenant_id=$1 and customer_id=$2 and company_id=$3 and kind='service_request_action' order by created_at,id limit 2001",[s.tenant_id,d.customerId,d.companyId])).rows;
  requireOk(raw.length===budget.n&&raw.every((e:any)=>typeof e.payload_cipher==='string'),409,'newServiceArrearsReviewRequired');
  const history=raw.map((e:any)=>cipher.open(e.payload_cipher)?.after).filter((e:any)=>e?.requestId===d.requestId);
  // A legacy optional-review request cannot acquire its first execution without Owner
  // approval. Existing re-submission establishes mandatory review through the original API.
  requireOk(!history.some((e:any)=>e.action==='status'&&e.state==='InProgress'),409,'serviceAlreadyStarted');
  requireOk(history.filter((e:any)=>e.action==='request_approval').at(-1)?.decision==='Approved',409,'requestApprovalRequired');
  const decision=await actualActorServiceEligibilityCreationCheck(c,m,s,cipher,{customerId:d.customerId,companyId:d.companyId,type:d.type});
  if(decision.status==='blocked'&&await useExecutionException(c,m,s,cipher,{...d,phase:'start'},decision))return;
  if(decision.status!=='allowed')throw new ApiError(409,decision.status==='blocked'?'newServiceArrearsBlocked':'newServiceArrearsReviewRequired');
 };
}
