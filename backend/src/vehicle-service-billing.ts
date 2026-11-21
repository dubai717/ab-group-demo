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
