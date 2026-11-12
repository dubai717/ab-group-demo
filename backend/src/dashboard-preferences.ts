import {z} from 'zod';
import {requireOk} from './core.js';
import {audit,has} from './data.js';
import {datasetNames} from './central-read-models.js';
export const dashboardSections=['charts','reports','tasks','shortcuts','alerts'] as const;
const sectionSchema=z.object(Object.fromEntries(dashboardSections.map(k=>[k,z.boolean().optional()]))).strict();
const defaults=()=>({widgets:[...datasetNames.options],sections:Object.fromEntries(dashboardSections.map(k=>[k,true]))});
function targetKey(m:any,q:any){const choices=[q.userId,q.roleId,q.departmentId].filter(Boolean);requireOk(choices.length<=1,422,'oneDashboardTargetRequired');if(!choices.length)return 'dashboard:'+m.actor.id;requireOk(m.actor.roleId==='owner',403,'ownerOnly');if(q.userId){requireOk(m.state.users.some((u:any)=>u.id===q.userId),404,'notFound');return 'dashboard-owner-user:'+q.userId;}if(q.roleId){requireOk(m.state.roles.some((r:any)=>r.id===q.roleId),404,'notFound');return 'dashboard-owner-role:'+q.roleId;}requireOk(m.state.departments.some((d:any)=>d.id===q.departmentId),404,'notFound');return 'dashboard-owner-department:'+q.departmentId;}
const targets={userId:z.uuid().optional(),roleId:z.string().min(1).max(100).optional(),departmentId:z.uuid().optional()};
export async function effectiveDashboardLayout(c:any,m:any){
 const keys=['dashboard-owner-user:'+m.actor.id,'dashboard-owner-role:'+m.actor.roleId,...(m.actor.departmentIds||[]).map((id:string)=>'dashboard-owner-department:'+id),'dashboard:'+m.actor.id,...(m.actor.departmentIds||[]).map((id:string)=>'dashboard-department:'+id)];
 const rows=(await c.query('select key,value from ab.settings where key=any($1::text[])',[keys])).rows,byKey=new Map<string,any>(rows.map((r:any)=>[r.key,r.value]));
 const ownerKeys=keys.filter(k=>k.startsWith('dashboard-owner-')),owner=ownerKeys.map(k=>byKey.get(k)).filter(Boolean),personal=byKey.get('dashboard:'+m.actor.id),legacy=(m.actor.departmentIds||[]).map((id:string)=>byKey.get('dashboard-department:'+id)).find(Boolean),base=personal||legacy||defaults();
 // Every configured administrative bound applies; personal choices can only narrow it.
 const widgets=datasetNames.options.filter(k=>(base.widgets||datasetNames.options).includes(k)&&owner.every((v:any)=>(v.widgets||datasetNames.options).includes(k))),sections=Object.fromEntries(dashboardSections.map(k=>[k,base.sections?.[k]!==false&&owner.every((v:any)=>v.sections?.[k]!==false)]));
 return {widgets,sections,scope:owner.length?'owner-managed':personal?'personal':legacy?'department':'default',changesAccessRights:false};
}
export function registerDashboardPreferences(app:any,call:any,cipher:any){
 app.get('/api/central-dashboard/preferences',call(async(c:any,m:any,_s:any,r:any)=>{requireOk(has(m.actor,'view_dashboard'));const q=z.object(targets).strict().parse(r.query);if(!Object.values(q).some(Boolean))return effectiveDashboardLayout(c,m);const key=targetKey(m,q),row=(await c.query('select value from ab.settings where key=$1',[key])).rows[0];return {...(row?.value||defaults()),configured:!!row,version:cipher.digest(JSON.stringify(row?.value||null)),scope:key.split(':')[0],changesAccessRights:false};}));
 app.get('/api/central-dashboard/layout-targets',call(async(_c:any,m:any)=>{requireOk(m.actor.roleId==='owner',403,'ownerOnly');return {users:m.state.users.map((u:any)=>({id:u.id,nameAr:u.nameAr,nameEn:u.nameEn,username:u.username,roleId:u.roleId,departmentIds:u.departmentIds,companyIds:u.companyIds})),roles:m.state.roles.map((r:any)=>({id:r.id,name:r.name})),departments:m.state.departments.map((d:any)=>({id:d.id,name:d.name,companyId:d.companyId})),changesAccessRights:false};}));
 app.post('/api/central-dashboard/preferences',call(async(c:any,m:any,s:any,r:any)=>{
 const d=z.object({widgets:z.array(datasetNames).max(datasetNames.options.length),sections:sectionSchema.optional(),...targets,confirm:z.literal(true).optional(),version:z.string().length(64).optional()}).strict().parse(r.body);requireOk(has(m.actor,'view_dashboard'));const explicit=d.userId||d.roleId||d.departmentId;
 // Preserve the existing department default API, while new administrative bounds require confirmation.
 const legacyDepartment=d.departmentId&&!d.confirm&&!d.version;const key=legacyDepartment?(targetKey(m,d),'dashboard-department:'+d.departmentId):targetKey(m,d);
 if(explicit&&!legacyDepartment){requireOk(d.confirm&&d.version,422,'dashboardConfirmationRequired');await c.query('select pg_advisory_xact_lock(hashtext($1))',[s.tenant_id+':'+key]);const old=(await c.query('select value from ab.settings where key=$1',[key])).rows[0];requireOk(d.version===cipher.digest(JSON.stringify(old?.value||null)),409,'dashboardLayoutChanged');}
 const value={widgets:[...new Set(d.widgets)],sections:Object.fromEntries(dashboardSections.map(k=>[k,(d.sections as any)?.[k]!==false]))};await c.query('insert into ab.settings values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,key,value]);await audit(c,s.tenant_id,s.user_id,'dashboard_preferences','settings',null,['widgets','sections',key.split(':')[0]]);return {saved:true,changesAccessRights:false};
 }));
}
