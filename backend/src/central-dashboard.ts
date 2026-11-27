import {dashboardSecurity,registerDashboardSecurity} from './dashboard-security.js';
import {effectiveDashboardLayout,registerDashboardPreferences} from './dashboard-preferences.js';
import {centralDatasetAccess} from './central-read-models.js';
import {registerVehicleMovementReport} from './vehicle-movement-report.js';
import {dashboardFinancial,registerDashboardDeposits} from './dashboard-financial.js';
import {financeRight} from './finance.js';
import {hrRight} from './personnel-domain.js';
import {marketingAllowed} from './marketing.js';
import { z } from 'zod';
import {requireOk} from './core.js';
import {audit,has,model} from './data.js';
import {centralDataset,dashboardInvoiceLabels,datasetNames} from './central-read-models.js';
import {V} from './vehicle-domain.js';

export function registerCentralDashboard(app:any,call:any,cipher:any){
 registerDashboardSecurity(app,call,cipher);
 registerDashboardDeposits(app,call,cipher);
 registerVehicleMovementReport(app,call,cipher);
 registerDashboardPreferences(app,call,cipher);
 app.get('/api/central-dashboard',call(async(c:any,original:any,s:any,req:any)=>{
  const q=z.object({companyId:z.uuid().optional(),departmentId:z.uuid().optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),asUserId:z.uuid().optional(),source:datasetNames.optional()}).strict().parse(req.query);
  let m=original;if(q.asUserId){requireOk(original.actor.roleId==='owner');const target=original.state.users.find((u:any)=>u.id===q.asUserId&&u.status==='Active');requireOk(target,404,'notFound');m=await model(c,target.id,cipher);await audit(c,s.tenant_id,s.user_id,'owner_readonly_dashboard_preview','user',target.id,['dashboard','reports']);}
  const security=await dashboardSecurity(c,m),emptySecurityScope=security.companyIds?.length===0||security.departmentIds?.length===0;requireOk(security.open,403,'dashboardDenied');if(q.companyId&&security.companyIds!==null)requireOk(security.companyIds.includes(q.companyId),403,'dashboardCompanyDenied');if(q.departmentId&&security.departmentIds!==null)requireOk(security.departmentIds.includes(q.departmentId),403,'dashboardDepartmentDenied');if(q.source)requireOk(!emptySecurityScope&&security.widgets.includes(q.source)&&security.details.includes(q.source),403,'dashboardDetailDenied');
  requireOk(has(m.actor,'view_dashboard'));if(q.companyId)requireOk(m.state.companies.some((co:any)=>co.id===q.companyId),403,'companyScopeDenied');requireOk(!q.from||!q.to||q.to>=q.from,422,'invalidPeriod');const departments=m.state.departments.filter((d:any)=>m.actor.roleId==='owner'||m.actor.departmentIds?.includes(d.id)||hrRight(m,'view',d.companyId)||marketingAllowed(m,d.companyId));if(q.departmentId)requireOk(departments.some((d:any)=>d.id===q.departmentId));const departmentSources=new Set(['employees','tasks','marketing']);
  const tables=['contracting_companies','customers','vehicles','finance_invoice_links','hr_employees','tasks','marketing_opportunities','investor_agreements','investor_profiles'];const present=(await c.query("select name from unnest($1::text[])name where to_regclass('ab.'||name)is not null",[tables])).rows;const context={tables:new Set(present.map((r:any)=>r.name)),rows:new Map()};
  const filtered=new Map<string,any[]>();const datasetCache=new Map<string,any[]>();const read=async(source:string)=>{if(!datasetCache.has(source))datasetCache.set(source,(await centralDataset(c,m,cipher,source,context)).filter((r:any)=>(security.companyIds===null||security.companyIds.includes(r.companyId))&&(security.departmentIds===null||security.departmentIds.includes(r.departmentId))));return datasetCache.get(source)!;};
  const availability:any={},layout=await effectiveDashboardLayout(c,m);layout.widgets=layout.widgets.filter((k:string)=>!emptySecurityScope&&security.widgets.includes(k)&&(security.departmentIds===null||departmentSources.has(k)));Object.assign(layout,{detailWidgets:security.details,securityConfigured:security.configured});for(const k of ['charts','reports','tasks','alerts'])if(!security.panels.includes(k))layout.sections[k as keyof typeof layout.sections]=false;if(security.companyIds!==null||security.departmentIds!==null)layout.sections.tasks=false;const sources:any={},counts:any={},money=new Map<string,{currency:string,amount:bigint,paid:bigint,outstanding:bigint}>();
  for(const source of datasetNames.options){if((q.departmentId||security.departmentIds!==null)&&!departmentSources.has(source)){counts[source]=null;availability[source]={allowed:false,state:'unattributed'};if(q.source===source){requireOk(security.departmentIds===null,403,'dashboardDepartmentAttributionUnavailable');sources[source]=[];}continue;}if(emptySecurityScope||!security.widgets.includes(source)){counts[source]=null;availability[source]={allowed:false,state:'denied'};continue;}const raw=await read(source);const allowed=centralDatasetAccess(m,source,raw.filter((r:any)=>!q.companyId||r.companyId===q.companyId),q.companyId);availability[source]={allowed,state:'ready'};if(!allowed){counts[source]=null;if(q.source===source)requireOk(false,403,'dashboardSourceDenied');continue;}const table=({contractingCompanies:'contracting_companies',customers:'customers',vehicles:'vehicles',invoices:'finance_invoice_links',employees:'hr_employees',tasks:'tasks',marketing:'marketing_opportunities',investments:'investor_agreements'}as any)[source];if(table&&!context.tables.has(table)){counts[source]=null;availability[source].state='unavailable';if(q.source===source)requireOk(false,503,'dashboardSourceUnavailable');continue;}const data=raw.filter(r=>(!q.departmentId||r.departmentId===q.departmentId)&&(!q.companyId||r.companyId===q.companyId)&&(!q.from||!r.dueOn&&!r.createdAt&&!r.hiredOn||String(r.dueOn||r.createdAt||r.hiredOn).slice(0,10)>=q.from)&&(!q.to||!r.dueOn&&!r.createdAt&&!r.hiredOn||String(r.dueOn||r.createdAt||r.hiredOn).slice(0,10)<=q.to));filtered.set(source,data);counts[source]=data.length;if(q.source===source)sources[source]=data;if(source==='invoices')for(const r of data){const key=r.currency,value=money.get(key)||{currency:r.currency,amount:0n,paid:0n,outstanding:0n};for(const field of ['amount','paid','outstanding']as const)value[field]+=V.units(r[field]);money.set(key,value);}}
  const visibleCompanyIds=new Set<string>();for(const source of ['companies','contractingCompanies','banks','customers','vehicles','employees','investments'])if(security.widgets.includes(source))for(const row of await read(source))if(row.companyId)visibleCompanyIds.add(row.companyId);
  for(const co of m.state.companies)if(financeRight(m,'ledger_view',co.id)||financeRight(m,'finance_view',co.id))visibleCompanyIds.add(co.id);const postedFinancial=q.departmentId||security.departmentIds!==null||!security.panels.includes('financial')?{ledger:[],banks:[],departmentAttributionAvailable:false}:await dashboardFinancial(c,m,{...q,companyIds:security.companyIds});
  const ageing=security.panels.includes('financial')&&layout.sections.reports
   ?dashboardDebtLists(filtered.get('invoices')||[]):null;
  const employeeNumbers=new Map<string,string[]>();if(original.actor.roleId==='owner'&&(await c.query("select to_regclass('ab.hr_employees') ok")).rows[0].ok)for(const row of(await c.query('select user_id,employee_number::text from ab.hr_employees where user_id is not null order by employee_number')).rows)employeeNumbers.set(row.user_id,[...(employeeNumbers.get(row.user_id)||[]),row.employee_number]);
  return {counts,sources,availability,layout,ageing,panels:{tasks:layout.sections.tasks?(filtered.get('tasks')||[]).slice(0,10):[],alerts:layout.sections.alerts?(filtered.get('tasks')||[]).filter((r:any)=>r.dueOn&&r.dueOn<new Date().toISOString().slice(0,10)&&!['Done','Completed','Cancelled','Closed'].includes(r.status)).slice(0,10):[]},postedFinancial,departments:departments.filter((d:any)=>security.departmentIds===null||security.departmentIds.includes(d.id)).map((d:any)=>({id:d.id,companyId:d.companyId,name:d.name})),departmentAttribution:q.departmentId?'direct employee, assignee and task department only; financial attribution unavailable':'notApplied',financial:(!security.panels.includes('financial')?[]:[...money.values()]).map(r=>({currency:r.currency,amount:V.money(r.amount),paid:V.money(r.paid),outstanding:V.money(r.outstanding)})),actor:{id:m.actor.id,roleId:m.actor.roleId,name:m.actor.fullName||m.actor.nameEn||m.actor.username},viewAs:q.asUserId?{readOnly:true,ownerId:original.actor.id,scope:'dashboard projections; original transactions stay in owner mode'}:null,companies:original.state.companies.filter((co:any)=>visibleCompanyIds.has(co.id)&&(security.companyIds===null||security.companyIds.includes(co.id))).map((co:any)=>({id:co.id,name:co.englishName||co.arabicName})),targets:original.actor.roleId==='owner'?original.state.users.map((u:any)=>({id:u.id,name:u.fullName||u.nameAr||u.nameEn||u.username,username:u.username,status:u.status,employeeNumber:(employeeNumbers.get(u.id)||[]).join(', '),roleId:u.roleId})):[],externalAI:'notActivated',branchFilterAvailable:false};
 }));
}

function dashboardDebtLists(invoices:any[]){
 type Balance={nameAr:string,nameEn:string,currency:string,total:bigint};
 const debtors=new Map<string,Balance>(),items=new Map<string,Balance>();
 function add(group:Map<string,Balance>,id:string,currency:string,nameAr:string,nameEn:string,amount:bigint){
  if(!id)return;
  const key=currency+':'+id;
  const row=group.get(key)||{nameAr,nameEn,currency,total:0n};
  row.total+=amount;
  group.set(key,row);
 }
 for(const invoice of invoices){
  const amount=V.units(invoice.outstanding),label=dashboardInvoiceLabels.get(invoice);
  if(amount<=0n||!label)continue;
  add(debtors,label.debtorId,invoice.currency,label.debtorName,label.debtorName,amount);
  add(items,label.itemId,invoice.currency,label.itemAr,label.itemEn,amount);
 }
 const order=(group:Map<string,Balance>)=>[...group.values()]
  .sort((a,b)=>a.currency.localeCompare(b.currency)||(a.total>b.total?-1:a.total<b.total?1:0)||a.nameEn.localeCompare(b.nameEn))
  .map(({total,...row})=>({...row,amount:V.money(total)}));
 return {debtors:order(debtors),items:order(items)};
}
