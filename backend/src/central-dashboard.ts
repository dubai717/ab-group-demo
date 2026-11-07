import { z } from 'zod';
import {requireOk} from './core.js';
import {audit,has,model} from './data.js';
import {centralDataset,datasetNames} from './central-read-models.js';
import {V} from './vehicle-domain.js';

export function registerCentralDashboard(app:any,call:any,cipher:any){
 app.get('/api/central-dashboard',call(async(c:any,original:any,s:any,req:any)=>{
  const q=z.object({companyId:z.uuid().optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),asUserId:z.uuid().optional(),source:datasetNames.optional()}).strict().parse(req.query);
  let m=original;if(q.asUserId){requireOk(original.actor.roleId==='owner');const target=original.state.users.find((u:any)=>u.id===q.asUserId&&u.status==='Active');requireOk(target,404,'notFound');m=await model(c,target.id,cipher);await audit(c,s.tenant_id,s.user_id,'owner_readonly_dashboard_preview','user',target.id,['dashboard','reports']);}
  requireOk(has(m.actor,'view_dashboard'));
  const datasetCache=new Map<string,any[]>();const read=async(source:string)=>{if(!datasetCache.has(source))datasetCache.set(source,await centralDataset(c,m,cipher,source));return datasetCache.get(source)!;};
  const sources:any={},counts:any={},money=new Map<string,{currency:string,amount:bigint,paid:bigint,outstanding:bigint}>();
  for(const source of q.source?[q.source]:datasetNames.options){const data=(await read(source)).filter(r=>(!q.companyId||r.companyId===q.companyId)&&(!q.from||!r.dueOn&&!r.createdAt&&!r.hiredOn||String(r.dueOn||r.createdAt||r.hiredOn).slice(0,10)>=q.from)&&(!q.to||!r.dueOn&&!r.createdAt&&!r.hiredOn||String(r.dueOn||r.createdAt||r.hiredOn).slice(0,10)<=q.to));counts[source]=data.length;if(q.source)sources[source]=data;if(source==='invoices')for(const r of data){const key=r.currency,value=money.get(key)||{currency:r.currency,amount:0n,paid:0n,outstanding:0n};for(const field of ['amount','paid','outstanding']as const)value[field]+=V.units(r[field]);money.set(key,value);}}
  const visibleCompanyIds=new Set<string>();for(const source of ['companies','banks','customers','vehicles','employees','investments'])for(const row of await read(source))if(row.companyId)visibleCompanyIds.add(row.companyId);
  return {counts,sources,financial:[...money.values()].map(r=>({currency:r.currency,amount:V.money(r.amount),paid:V.money(r.paid),outstanding:V.money(r.outstanding)})),actor:{id:m.actor.id,roleId:m.actor.roleId,name:m.actor.fullName||m.actor.nameEn||m.actor.username},viewAs:q.asUserId?{readOnly:true,ownerId:original.actor.id,scope:'dashboard projections; original transactions stay in owner mode'}:null,companies:original.state.companies.filter((co:any)=>visibleCompanyIds.has(co.id)).map((co:any)=>({id:co.id,name:co.englishName||co.arabicName})),targets:original.actor.roleId==='owner'?original.state.users.filter((u:any)=>u.status==='Active').map((u:any)=>({id:u.id,name:u.fullName||u.nameEn||u.username,roleId:u.roleId})):[],externalAI:'notActivated',branchFilterAvailable:false};
 }));
 app.get('/api/central-dashboard/preferences',call(async(c:any,m:any)=>{const r=(await c.query('select value from ab.settings where key=$1',['dashboard:'+m.actor.id])).rows[0];return r?.value||{widgets:datasetNames.options};}));
 app.post('/api/central-dashboard/preferences',call(async(c:any,m:any,s:any,req:any)=>{const d=z.object({widgets:z.array(datasetNames).min(1).max(9)}).strict().parse(req.body);requireOk(has(m.actor,'view_dashboard'));await c.query('insert into ab.settings values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,'dashboard:'+m.actor.id,d]);await audit(c,s.tenant_id,s.user_id,'dashboard_preferences','settings',null,['widgets']);return {saved:true};}));
}
