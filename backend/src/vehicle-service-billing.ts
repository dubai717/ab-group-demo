import {requireOk} from './core.js';
export const dueMonthPolicy='due_month_only_v1';
function month(value:string,offset=0){const [y,m]=value.split('-').map(Number);return new Date(Date.UTC(y,m-1+offset,1)).toISOString().slice(0,10);}
// Forecasts are data projections, never invoice rows or customer balances.
export function serviceBillingProjection(contract:any,asOf:string,amendments:any[]=[]){
 if(contract.serviceBillingPolicy!==dueMonthPolicy)return{policy:'legacy',due:[],forecast:[],historicalPolicyUnchanged:true};
 const start=contract.startOn,amount=String(contract.serviceMonthly),current=month(asOf);
 if(!start)return{policy:dueMonthPolicy,due:[],forecast:[],historicalPolicyUnchanged:true};
 const rates=[...amendments].sort((a,b)=>a.effectiveOn.localeCompare(b.effectiveOn)||a.revision-b.revision);
 const at=(date:string)=>{const rate=rates.filter(r=>r.effectiveOn<=date).at(-1);return{amount:String(rate?.amount??amount),rateRevision:rate?.revision||0};};
 const value=at(current),due=start<=current&&/[1-9]/.test(value.amount)?[{dueOn:current,...value,sourceKey:'service:'+current,period:current.slice(0,7)}]:[];
 let first=month(current,1);if(start>first)first=start;
 const forecast=Array.from({length:12},(_,i)=>({dueOn:month(first,i),...at(month(first,i)),period:month(first,i).slice(0,7),forecast:true,posted:false})).filter(r=>/[1-9]/.test(r.amount));
 return{policy:dueMonthPolicy,due,forecast,historicalPolicyUnchanged:true};
}

export async function serviceFeeAmendments(c:any,cipher:any,vehicleId:string,contractId:string){
 const rows=(await c.query("select payload_cipher from ab.vehicle_events where vehicle_id=$1 and kind='service_fee_amended' order by created_at,id limit 501",[vehicleId])).rows;
 requireOk(rows.length<=500,422,'serviceFeeHistoryReviewRequired');
 return rows.map((r:any)=>cipher.open(r.payload_cipher).after).filter((r:any)=>r.contractId===contractId);
}

// An explicit signed Owner adoption changes only future generation, never the immutable contract or invoices.
export async function serviceBillingAdoption(c:any,cipher:any,v:any,contract:any){
 const rows=(await c.query("select id,company_id,actor_id,payload_cipher from ab.vehicle_events where vehicle_id=$1 and kind='service_billing_policy_adopted' order by created_at,id limit 101",[v.id])).rows;requireOk(rows.length<=100,409,'servicePolicySourceReviewRequired');
 const all=rows.map((r:any)=>({...cipher.open(r.payload_cipher).after,id:r.id,_sourceCompanyId:r.company_id,_sourceActorId:r.actor_id}));requireOk(all.every((r:any)=>r.format==='AB-PROSPECTIVE-SERVICE-1'&&r.companyId===v.company_id&&r._sourceCompanyId===v.company_id&&r.approvedBy===r._sourceActorId&&r.vehicleId===v.id&&typeof r.contractId==='string'&&/^\d{4}-\d{2}-01$/.test(r.effectiveOn)&&/^[a-f0-9]{64}$/.test(r.sourceDigest)&&r.confirmExistingInvoicesPreserved===true),409,'servicePolicySourceReviewRequired');
 const selected=all.filter((r:any)=>r.contractId===contract.id);requireOk(selected.length<=1,409,'servicePolicySourceReviewRequired');if(!selected.length)return null;const {_sourceCompanyId,_sourceActorId,...result}=selected[0];return result;
}
export function serviceContractForDate(contract:any,adoption:any,asOf:string){if(!adoption)return contract;if(asOf.slice(0,7)+'-01'<adoption.effectiveOn)return{...contract,legacyServiceCutoff:adoption.effectiveOn};return{...contract,serviceBillingPolicy:dueMonthPolicy,startOn:contract.startOn>adoption.effectiveOn?contract.startOn:adoption.effectiveOn};}
