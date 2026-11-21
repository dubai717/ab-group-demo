import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireOk} from './core.js';
import {need,company,event} from './ledger-domain.js';
const prefix='cost-centres-v1:';
const name=z.string().trim().min(1).max(160);
export const costCentreSchema=z.object({companyId:z.uuid(),id:z.uuid().optional(),revision:z.number().int().min(0),
 nameAr:name,nameEn:name,active:z.boolean(),reason:z.string().trim().min(1).max(2000)}).strict();
const normalized=(s:string)=>s.normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');
export async function costCentres(c:any,cipher:any,co:string){
 const rows=(await c.query('select value from ab.settings where key like $1 order by key limit 1001',[prefix+co+':%'])).rows;
 requireOk(rows.length<=1000,422,'registerTooLarge');return rows.map((r:any)=>cipher.open(r.value.cipher));
}
// The immutable snapshot belongs only to a new manual journal. No historical attribution.
export async function costCentreSnapshot(c:any,cipher:any,co:string,id:string|undefined){
 if(!id)return undefined;
 const centre=(await costCentres(c,cipher,co)).find((r:any)=>r.id===id&&r.companyId===co);
 requireOk(centre?.active,422,'invalidCostCentre');
 return{format:'AB-COST-CENTRE-1',id:centre.id,companyId:co,nameAr:centre.nameAr,nameEn:centre.nameEn,revision:centre.revision};
}
export function reversalCostCentre(payload:any,companyId:string){
 const r=payload?.costCentre;
 return r?.format==='AB-COST-CENTRE-1'&&r.companyId===companyId?{costCentre:r}:{};
}
export function registerCostCentres(app:any,route:any,cipher:any){
 app.get('/api/ledger/package/cost-centres',route(async(c:any,m:any,s:any,req:any)=>{
  const co=z.uuid().parse(req.query.companyId);need(m,'view',co);return{companyId:co,rows:await costCentres(c,cipher,co)};
 }));
 app.post('/api/ledger/package/cost-centres',route(async(c:any,m:any,s:any,req:any)=>{
  const d=costCentreSchema.parse(req.body);need(m,'configure',d.companyId);company(m,d.companyId);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+d.companyId]);
  const rows=await costCentres(c,cipher,d.companyId),old=d.id?rows.find((r:any)=>r.id===d.id):null;
  requireOk(!d.id||old,404,'notFound');requireOk((old?.revision||0)===d.revision,409,'revisionConflict');
  requireOk(!rows.some((r:any)=>r.id!==d.id&&(normalized(r.nameAr)===normalized(d.nameAr)||normalized(r.nameEn)===normalized(d.nameEn))),409,'duplicateCostCentre');
  requireOk(old||rows.length<1000,422,'registerTooLarge');
  const value={...d,id:old?.id||randomUUID(),revision:d.revision+1,createdBy:old?.createdBy||s.user_id,
   createdAt:old?.createdAt||new Date().toISOString(),updatedBy:s.user_id,updatedAt:new Date().toISOString()};
  await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',
   [s.tenant_id,prefix+d.companyId+':'+value.id,{cipher:cipher.seal(value)}]);
  await event(c,cipher,s,d.companyId,value.id,'cost_centre_saved',old,value);
  return{id:value.id,revision:value.revision,financialEffect:false};
 }));
}
