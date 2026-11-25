import{dashboardSettingsWriteReady}from'./dashboard-settings-source.js';
import{effectiveDashboardRule,inheritedDashboardOverrides,validatedDashboardOverrides,dashboardOverrideCounts}from'./dashboard-overrides.js';
import {z} from 'zod';
import {requireOk} from './core.js';
import {audit} from './data.js';
import {datasetNames} from './central-read-models.js';

const panels=['financial','charts','reports','tasks','alerts'] as const;
const target=z.object({userId:z.uuid().optional(),roleId:z.string().min(1).max(120).optional()}).strict();
export const dashboardSecurityRule=z.object({open:z.boolean(),widgets:z.array(datasetNames).max(10),details:z.array(datasetNames).max(10),panels:z.array(z.enum(panels)).max(5),companyIds:z.array(z.uuid()).max(100).nullable(),departmentIds:z.array(z.uuid()).max(200).nullable()}).strict();
const defaults=()=>({open:true,widgets:[...datasetNames.options],details:[...datasetNames.options],panels:[...panels],companyIds:null,departmentIds:null});
function key(m:any,q:any,write=false,draftRoleId?:string){requireOk(m.actor.roleId==='owner',403,'ownerOnly');requireOk(!!q.userId!==!!q.roleId,422,'oneDashboardTargetRequired');if(q.userId){const u=m.state.users.find((u:any)=>u.id===q.userId);requireOk(u,404,'notFound');if(write)requireOk(u.id!==m.actor.id&&u.roleId!=='owner',403,'ownerProtected');return 'dashboard-security-user:'+u.id;}requireOk(q.roleId===draftRoleId||m.state.roles.some((r:any)=>r.id===q.roleId),404,'notFound');if(write)requireOk(q.roleId!=='owner'&&q.roleId!==m.actor.roleId,403,'ownerProtected');return 'dashboard-security-role:'+q.roleId;}
// Display choices never replace original domain/API/RLS authorization.
export async function dashboardSecurity(c:any,m:any):Promise<{open:boolean,widgets:string[],details:string[],panels:string[],companyIds:string[]|null,departmentIds:string[]|null,configured:boolean}>{
 if(m.actor.roleId==='owner')return {...defaults(),configured:false};
 const userKey='dashboard-security-user:'+m.actor.id,roleKey='dashboard-security-role:'+m.actor.roleId;
 const rows=(await c.query('select key,value from ab.settings where key=any($1::text[])',[[userKey,roleKey]])).rows;
 const role=rows.find((r:any)=>r.key===roleKey)?.value||defaults(),user=rows.find((r:any)=>r.key===userKey)?.value;
 return {...effectiveDashboardRule(dashboardSecurityRule,role,user,m.actor.id),configured:rows.length>0};
}
export const dashboardSecuritySnapshot=async(c:any,k:string,cipher:any)=>{const row=(await c.query('select value from ab.settings where key=$1',[k])).rows[0];return {value:row?.value||defaults(),version:cipher.digest(JSON.stringify(row?.value||null))};};
export async function dashboardInheritance(c:any,m:any,cipher:any,userId:string){
 const u=m.state.users.find((u:any)=>u.id===userId);requireOk(u,404,'notFound');
 const current=await dashboardSecuritySnapshot(c,'dashboard-security-user:'+u.id,cipher),baseline=await dashboardSecuritySnapshot(c,'dashboard-security-role:'+u.roleId,cipher);
 const raw=(await c.query('select value from ab.settings where key=$1',['dashboard-security-user:'+u.id])).rows[0]?.value;
 return{roleId:u.roleId,baselineVersion:baseline.version,baseline:dashboardSecurityRule.parse(baseline.value),overrides:inheritedDashboardOverrides(dashboardSecurityRule,raw,u.id),effective:effectiveDashboardRule(dashboardSecurityRule,baseline.value,raw,u.id),recordVersion:raw?.version===2?2:raw?1:0,legacy:!!raw&&raw.version!==2};
}
export const planDashboardSecurity=async(c:any,m:any,cipher:any,d:any,draftRoleId?:string)=>{
 const k=key(m,d,true,draftRoleId),current=await dashboardSecuritySnapshot(c,k,cipher);requireOk(d.version===current.version,409,'dashboardSecurityChanged');
 let value:any=d.value,inheritance:any=null;
 if(d.userId){
  inheritance=await dashboardInheritance(c,m,cipher,d.userId);
  if(d.overrides!==undefined){
   requireOk(await dashboardSettingsWriteReady(c),503,'dashboardInheritanceGuardReviewRequired');
   requireOk(d.baselineVersion===inheritance.baselineVersion&&d.roleId===undefined,409,'dashboardSecurityChanged');
   value=validatedDashboardOverrides(dashboardSecurityRule,d.overrides,d.userId);
   const effective=effectiveDashboardRule(dashboardSecurityRule,inheritance.baseline,value,d.userId);
   const canonical=(v:any)=>JSON.stringify(Object.fromEntries(Object.keys(v).sort().map(k=>[k,Array.isArray(v[k])?[...v[k]].sort():v[k]])));requireOk(canonical(effective)===canonical(d.value),409,'dashboardInheritanceSourceReviewRequired');
  }else requireOk(current.value.version!==2,409,'dashboardInheritanceSourceReviewRequired');
 }else requireOk(d.overrides===undefined&&d.baselineVersion===undefined,422,'oneDashboardTargetRequired');
 const scopes=value;
 for(const id of scopes.companyIds||[])requireOk(m.state.companies.some((co:any)=>co.id===id),422,'invalidCompany');
 for(const id of scopes.departmentIds||[])requireOk(m.state.departments.some((dep:any)=>dep.id===id),422,'invalidDepartment');
 if(value.version!==2){requireOk(value.details.every((v:string)=>value.widgets.includes(v)),422,'dashboardDetailRequiresWidget');value={...value,widgets:[...new Set(value.widgets)],details:[...new Set(value.details)],panels:[...new Set(value.panels)]};}
 return{key:k,before:current.value,value,inheritance,planHash:cipher.digest(JSON.stringify({key:k,version:d.version,value,...(d.overrides!==undefined?{roleId:inheritance.roleId,baselineVersion:inheritance.baselineVersion}: {})}))};
};
export async function dashboardStandardImpact(c:any,m:any,cipher:any,roleId:string,after:any){
 const before=(await dashboardSecuritySnapshot(c,'dashboard-security-role:'+roleId,cipher)).value,users=m.state.users.filter((u:any)=>u.roleId===roleId),keys=users.map((u:any)=>'dashboard-security-user:'+u.id),rows=(await c.query('select key,value from ab.settings where key=any($1::text[])',[keys])).rows;
 return users.map((u:any)=>{const raw=rows.find((r:any)=>r.key==='dashboard-security-user:'+u.id)?.value;return{userId:u.id,...dashboardOverrideCounts(dashboardSecurityRule,raw,u.id),before:effectiveDashboardRule(dashboardSecurityRule,before,raw,u.id),after:effectiveDashboardRule(dashboardSecurityRule,after,raw,u.id),individualOverridesRetained:true};}).sort((a:any,b:any)=>a.userId.localeCompare(b.userId));
}
export const dashboardSecurityDraft=z.object({value:dashboardSecurityRule,version:z.string().length(64)}).strict();
export function dashboardSecurityTemplate(m:any,cipher:any){return{value:defaults(),version:cipher.digest(JSON.stringify(null)),panels,datasets:datasetNames.options,companies:m.state.companies.map((c:any)=>({id:c.id,nameAr:c.arabicName,nameEn:c.englishName})),departments:m.state.departments.map((d:any)=>({id:d.id,name:d.name})),restrictionOnly:true};}
export function registerDashboardSecurity(app:any,call:any,cipher:any){
 app.get('/api/central-dashboard/security',call(async(c:any,m:any,_s:any,r:any)=>{const q=target.parse(r.query),k=key(m,q),current=await dashboardSecuritySnapshot(c,k,cipher);const inheritance=q.userId?await dashboardInheritance(c,m,cipher,q.userId):null;return {...current,...(inheritance?{value:inheritance.effective,inheritance,inheritanceWriteReady:await dashboardSettingsWriteReady(c)}:{}),panels,datasets:datasetNames.options,companies:m.state.companies.map((c:any)=>({id:c.id,nameAr:c.arabicName,nameEn:c.englishName})),departments:m.state.departments.map((d:any)=>({id:d.id,name:d.name})),restrictionOnly:true};}));
 const input=target.extend({value:dashboardSecurityRule,version:z.string().length(64),overrides:z.unknown().optional(),baselineVersion:z.string().length(64).optional()}).strict();
 app.post('/api/central-dashboard/security-plan',call(async(c:any,m:any,_s:any,r:any)=>{const d=input.parse(r.body),p=await planDashboardSecurity(c,m,cipher,d);return {before:p.inheritance?.effective||p.before,after:p.value.version===2?effectiveDashboardRule(dashboardSecurityRule,p.inheritance.baseline,p.value,d.userId!):p.value,overrides:p.value.version===2?p.value:undefined,planHash:p.planHash,saved:false,restrictionOnly:true};}));
 app.post('/api/central-dashboard/security-apply',call(async(c:any,m:any,s:any,r:any)=>{const d=input.extend({confirm:z.literal(true),planHash:z.string().length(64)}).strict().parse(r.body),k=key(m,d,true);requireOk(r.headers['idempotency-key'],422,'idempotencyRequired');await c.query('select pg_advisory_xact_lock(hashtext($1))',[s.tenant_id+':'+k]);const p=await planDashboardSecurity(c,m,cipher,d);requireOk(p.planHash===d.planHash,409,'dashboardSecurityChanged');await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,k,p.value]);await audit(c,s.tenant_id,s.user_id,'dashboard_security_changed','settings',null,[k,'before:'+JSON.stringify(p.before),'after:'+JSON.stringify(p.value),'restriction_only']);return {saved:true,restrictionOnly:true};}));
}
