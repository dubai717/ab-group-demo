// Read-only projections of existing, recorded lifecycle events. No inferred balances.
import {z} from 'zod';
import {requireOk} from './core.js';
import {has,Areas} from './data.js';
import {vehicleRight,today} from './vehicle-domain.js';
export function movementDirection(kind:string,before:any,after:any){
 if(kind==='registered'||kind==='internal_sale_registered')return 'in';
 if(kind==='status_changed'&&before?.status!=='Active'&&after?.status==='Active')return 'in';
 if(kind==='status_changed'&&before?.status==='Active'&&['Pending','Terminated'].includes(after?.status))return 'out';
 if(kind==='sale_closed'&&before?.status==='Active')return 'out';
 return null;
}
export function movementSeries(events:any[],{months=12,end=today(),from='',to=''}:{months?:number;end?:string;from?:string;to?:string}={}){
 const last=new Date(end.slice(0,7)+'-01T00:00:00Z'),bins=Array.from({length:months},(_,i)=>{const date=new Date(last);date.setUTCMonth(date.getUTCMonth()-(months-1-i));return{month:date.toISOString().slice(0,7),in:0,out:0};}),seen=new Set(),rows:any[]=[];
 for(const event of events){if(seen.has(event.id))continue;seen.add(event.id);const direction=movementDirection(event.kind,event.before,event.after);if(!direction)continue;
 const effective=event.kind==='registered'?event.after?.registeredOn:event.kind==='status_changed'?event.after?.effectiveOn:null,date=effective||String(event.createdAt).slice(0,10),bin=bins.find(b=>b.month===date.slice(0,7));if(!bin||date>end||from&&date<from||to&&date>to)continue;
 bin[direction]++;rows.push({id:event.id,vehicleId:event.vehicleId,companyId:event.companyId,fileNumber:event.fileNumber,plate:event.plate,date,month:bin.month,direction,dateBasis:effective?'recordedEffectiveDate':'recordedEventTimestamp'});
 }const entered=bins.reduce((a,b)=>a+b.in,0),exited=bins.reduce((a,b)=>a+b.out,0);return{months:bins,rows,entered,exited,net:entered-exited};
}
export function registerVehicleMovementReport(app:any,call:any,cipher:any){app.get('/api/central-dashboard/vehicle-movements',call(async(c:any,m:any,_s:any,req:any)=>{
 const q=z.object({months:z.coerce.number().refine(n=>n===12||n===24).default(12),companyId:z.uuid().optional(),licenseId:z.uuid().optional(),emirate:z.string().max(80).optional(),from:z.iso.date().optional(),to:z.iso.date().optional()}).strict().parse(req.query);requireOk(has(m.actor,'view_dashboard'));requireOk(!q.from||!q.to||q.to>=q.from,422,'invalidPeriod');
 if(!(await c.query("select to_regclass('ab.vehicle_events') ok")).rows[0].ok)return{available:false,reason:'vehicleSchemaPending'};
 const vehicles=(await c.query('select id,company_id,file_number,payload_cipher from ab.vehicles')).rows.filter((v:any)=>vehicleRight(m,'view',v.company_id)&&(!q.companyId||v.company_id===q.companyId)&&(!q.licenseId||m.state.companies.some((co:any)=>co.id===v.company_id&&co.licenseId===q.licenseId)));
 const allowed=new Map<string,any>();for(const v of vehicles){const p=cipher.open(v.payload_cipher);const geo=(value:string)=>Areas.emirates.find((e:any)=>[e.id,e.legacy,e.ar,e.en].includes(value))?.id||value;if(!q.emirate||geo(p.emirate)===geo(q.emirate))allowed.set(v.id,{...v,plate:p.plate});}
 const raw=allowed.size?(await c.query("select id,vehicle_id,company_id,kind,payload_cipher,created_at from ab.vehicle_events where vehicle_id=any($1::uuid[])and kind=any($2::text[])order by created_at,id limit 50001",[[...allowed.keys()],['registered','internal_sale_registered','status_changed','sale_closed']])).rows:[];requireOk(raw.length<=50000,422,'reportTooLarge');
 const events=raw.map((r:any)=>{const p=cipher.open(r.payload_cipher),v=allowed.get(r.vehicle_id);return{id:r.id,vehicleId:r.vehicle_id,companyId:r.company_id,fileNumber:String(v.file_number),plate:v.plate,kind:r.kind,before:p.before,after:p.after,createdAt:r.created_at.toISOString()};});
 return{available:true,...movementSeries(events,{...q,end:q.to&&q.to<today()?q.to:today()}),basis:'Existing registration and status/sale lifecycle events; effective date when recorded, otherwise event timestamp; current company licence/geography. Pending-to-terminated is not a second exit.'};
 }));}
