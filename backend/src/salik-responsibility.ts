// Read-only attribution to the original vehicle/customer relation and recorded effective dates.
import {z} from 'zod';import {requireOk,sha} from './core.js';
const day=z.iso.date();
export function salikResponsibilityProof(vehicle:any,profile:any,events:any[],occurredOn:string){
 requireOk(day.safeParse(profile.registeredOn).success&&day.safeParse(occurredOn).success&&occurredOn>=profile.registeredOn,422,'salikResponsibilityReviewRequired');
 const relevant=events.filter(e=>e.vehicleId===vehicle.id&&e.companyId===vehicle.company_id&&((e.kind==='status_changed'&&e.after?.status==='Terminated')||e.kind==='sale_closed'));
 requireOk(relevant.length<=50,422,'salikResponsibilityReviewRequired');
 const terminals=relevant.map(e=>({id:e.id,kind:e.kind,endOn:e.kind==='sale_closed'?e.after?.completedOn:e.after?.effectiveOn}));
 requireOk(terminals.every(e=>day.safeParse(e.endOn).success&&e.endOn>=profile.registeredOn),422,'salikResponsibilityReviewRequired');
 requireOk(vehicle.status!=='Terminated'||terminals.length>0,422,'salikResponsibilityReviewRequired');
 // A file containing only calendar dates cannot resolve liability on the handover/end day itself.
 // Do not invent an inclusive/exclusive contractual time or use audit creation time as an effective date.
 requireOk(terminals.every(e=>occurredOn<e.endOn),422,'salikResponsibilityBoundaryReviewRequired');
 const ordered=terminals.sort((a,b)=>a.id.localeCompare(b.id)),earliest=[...ordered].sort((a,b)=>a.endOn.localeCompare(b.endOn)||a.id.localeCompare(b.id)).slice(0,1);
 const source={format:'AB-SALIK-RESPONSIBILITY-1',vehicleId:vehicle.id,assetId:vehicle.asset_id||null,companyId:vehicle.company_id,customerId:vehicle.customer_id,vehicleRevision:vehicle.revision,registeredOn:profile.registeredOn,occurredOn,terminalSources:earliest,terminalSourceCount:ordered.length,terminalSourceDigest:sha(JSON.stringify(ordered))};
 return{...source,digest:sha(JSON.stringify(source)),basis:'original relation and recorded effective dates; same-day/unknown boundaries require review'};
}
export async function salikResponsibilityEvents(c:any,cipher:any,companyId:string,vehicleIds:string[]){
 const ids=[...new Set(vehicleIds)];requireOk(ids.length<=1000,422,'importLimit');if(!ids.length)return new Map<string,any[]>();
 const rows=(await c.query("select id,vehicle_id,company_id,kind,payload_cipher from ab.vehicle_events where company_id=$1 and vehicle_id=any($2::uuid[])and kind in('status_changed','sale_closed')order by id limit 5001",[companyId,ids])).rows;requireOk(rows.length<=5000,422,'registerTooLarge');const map=new Map<string,any[]>();for(const r of rows){const p=cipher.open(r.payload_cipher),list=map.get(r.vehicle_id)||[];list.push({id:r.id,vehicleId:r.vehicle_id,companyId:r.company_id,kind:r.kind,after:p.after});map.set(r.vehicle_id,list);}return map;
}
