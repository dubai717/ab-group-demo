// Isolated build acceptance only. No environment flag, server registration, approval or live activation.
import{z}from'zod';import{ApiError,requireOk}from'./core.js';import{actualActorServiceEligibilityCreationCheck,actualActorServiceEligibilityApprovalCheck}from'./service-eligibility-actor-source.js';import{today}from'./vehicle-domain.js';
function isolatedServiceGuard(cipher:any,effectiveFrom:string,phase:'create'|'approve'){
 z.iso.date().parse(effectiveFrom);
 return async(c:any,m:any,s:any,input:{customerId:string;companyId:string;type:'vehicle'|'residence'|'general'})=>{
  const database=(await c.query('select current_database()name')).rows[0]?.name;
  requireOk(typeof database==='string'&&/^ab_backup_[a-f0-9]{32}$/.test(database),503,'isolatedEligibilityPrototypeOnly');
  if(today()<effectiveFrom)return;
  const result=await (phase==='approve'?actualActorServiceEligibilityApprovalCheck:actualActorServiceEligibilityCreationCheck)(c,m,s,cipher,input);
  if(result.status!=='allowed')throw new ApiError(409,result.status==='blocked'?'newServiceArrearsBlocked':'newServiceArrearsReviewRequired');
 };
}

export const isolatedNewServiceEligibilityGuard=(cipher:any,effectiveFrom:string)=>isolatedServiceGuard(cipher,effectiveFrom,'create');
export const isolatedServiceApprovalEligibilityGuard=(cipher:any,effectiveFrom:string)=>isolatedServiceGuard(cipher,effectiveFrom,'approve');
