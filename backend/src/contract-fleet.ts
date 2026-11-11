import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireOk} from './core.js';
import {assertRevision} from './data.js';
import {V,vehicleRight} from './vehicle-domain.js';
const money=z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).refine(v=>V.units(v)>0n);
const terms=z.object({vehicleId:z.uuid(),type:z.string().trim().min(1).max(120),capacityTonnes:z.string().regex(/^\d{1,4}(\.\d{1,3})?$/).optional(),seats:z.number().int().min(1).max(200).optional(),rate:money,value:money,notes:z.string().max(2000).default('')}).strict();
export async function checkFleet(c:any,m:any,cipher:any,r:any,items:any[],reserve=false,s?:any){
 requireOk(vehicleRight(m,'view',r.company_id));const p=cipher.open(r.payload_cipher);
 requireOk(r.kind==='customer',422,'customerContractRequired');
 requireOk(items.length>0&&new Set(items.map(x=>x.vehicleId)).size===items.length,422,'uniqueVehiclesRequired');
 requireOk(p.period!=='day'||items.length===1,422,'dailyVehicleSeparateContract');
 requireOk(items.reduce((n,x)=>n+V.units(x.value),0n)===V.units(p.value),422,'fleetContractValueMismatch');
 const start=r.starts_on.toISOString().slice(0,10)+'T00:00:00+04:00',end=new Date(new Date(r.ends_on.toISOString().slice(0,10)+'T00:00:00+04:00').getTime()+86400000).toISOString();
 for(const x of [...items].sort((a,b)=>a.vehicleId.localeCompare(b.vehicleId))){
 await c.query('select pg_advisory_xact_lock(hashtext($1))',['marketing-resource:'+x.vehicleId]);
 const actual=(await c.query("select file_number,payload_cipher from ab.vehicles where id=$1 and company_id=$2 and status='Active'",[x.vehicleId,r.company_id])).rows[0];requireOk(actual,422,'invalidVehicle');x.fileNumber=String(actual.file_number);x.plate=cipher.open(actual.payload_cipher).plate||'';
 requireOk(!(await c.query("select 1 from ab.marketing_allocations where vehicle_id=$1 and state='Active'and starts_at<$3::timestamptz and ends_at>$2::timestamptz",[x.vehicleId,start,end])).rowCount,409,'resourceUnavailable');
 if(reserve)await c.query('insert into ab.marketing_allocations(id,tenant_id,company_id,contract_id,vehicle_id,starts_at,ends_at,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[randomUUID(),s.tenant_id,r.company_id,r.id,x.vehicleId,start,end,cipher.seal({...x,period:p.period,currency:p.currency,reason:'Confirmed contract fleet',contractRevision:r.revision}),s.user_id]);
 }
}
export function registerContractFleet(app:any,route:any,get:any,cipher:any,event:any){
 app.get('/api/marketing/contracts/:id/fleet',route(async(c:any,m:any,_s:any,req:any)=>{const r=await get(c,m,'marketing_contracts',req.params.id);requireOk(vehicleRight(m,'view',r.company_id));const p=cipher.open(r.payload_cipher),start=r.starts_on.toISOString().slice(0,10)+'T00:00:00+04:00',end=new Date(new Date(r.ends_on.toISOString().slice(0,10)+'T00:00:00+04:00').getTime()+86400000).toISOString();const rows=(await c.query("select v.*,exists(select 1 from ab.marketing_allocations a where a.vehicle_id=v.id and a.state='Active'and a.starts_at<$3::timestamptz and a.ends_at>$2::timestamptz and a.contract_id<>$4) busy from ab.vehicles v where v.company_id=$1 and v.status='Active'order by file_number",[r.company_id,start,end,r.id])).rows;
 return {state:r.state,revision:r.revision,period:p.period,currency:p.currency,value:p.value,vehicles:p.fleetVehicles||[],options:rows.map((v:any)=>{const d=cipher.open(v.payload_cipher);return{id:v.id,fileNumber:String(v.file_number),plate:d.plate||'',type:d.vehicleType,capacityTonnes:d.capacityTonnes||'',seats:d.seats||'',available:!v.busy};})};
 },false));
 app.post('/api/marketing/contracts/:id/fleet',route(async(c:any,m:any,s:any,req:any)=>{const r=await get(c,m,'marketing_contracts',req.params.id,true),d=z.object({revision:z.number().int().positive(),vehicles:z.array(terms).min(1).max(100)}).strict().parse(req.body);assertRevision(r.revision,d.revision);requireOk(r.state==='Draft',409,'draftContractRequired');await checkFleet(c,m,cipher,r,d.vehicles);const p=cipher.open(r.payload_cipher);await c.query('update ab.marketing_contracts set payload_cipher=$2,revision=revision+1 where id=$1',[r.id,cipher.seal({...p,fleetVehicles:d.vehicles})]);await event(c,s,r.company_id,r.id,'contract_fleet_saved',{fleetVehicles:p.fleetVehicles||[]},{fleetVehicles:d.vehicles,reserved:false});return {saved:true,id:r.id,revision:r.revision+1};},false));
}
