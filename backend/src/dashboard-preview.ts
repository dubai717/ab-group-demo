import {deferReadAudit,requireOk} from './core.js';
import {audit,has,model} from './data.js';
import {dashboardSecurity} from './dashboard-security.js';

export async function dashboardPreviewScope(c:any,m:any){
 if(!has(m.actor,'view_dashboard'))return [];
 if(m.actor.roleId==='owner')return null;
 const settings=await dashboardSecurity(c,m);
 if(!settings.open)return [];
 const rows=await c.query('select value from ab.settings where key=$1',['dashboard-security-user:'+m.actor.id]);
 const allowed=rows.rows[0]?.value?.previewCompanyIds;
 if(!Array.isArray(allowed))return [];
 const membership=new Set(m.actor.companyIds||[]);
 return [...new Set<string>(allowed)].filter(id=>membership.has(id)&&(settings.companyIds===null||settings.companyIds.includes(id)));
}

function targetInScope(actor:any,target:any,scope:string[]|null){
 return target.status==='Active'&&(scope===null||target.roleId!=='owner'&&target.id!==actor.id&&target.companyIds?.some((id:string)=>scope.includes(id)));
}

export function registerDashboardPreviewTargets(app:any,call:any){
 app.get('/api/central-dashboard/preview-targets',call(async(c:any,m:any)=>{
  const scope=await dashboardPreviewScope(c,m);
  requireOk(scope===null||scope.length>0,403,'dashboardPreviewDenied');
  return {rows:m.state.users.filter((user:any)=>user.roleId!=='owner'&&targetInScope(m.actor,user,scope)).map((u:any)=>({id:u.id,roleId:u.roleId,nameAr:u.nameAr,nameEn:u.nameEn,username:u.username,status:u.status}))};
 }));
}

export async function projectDashboard(c:any,original:any,cipher:any,targetId:string,companyId?:string,session?:{tenant_id:string;user_id:string}){
 const scope=await dashboardPreviewScope(c,original);
 const target=original.state.users.find((user:any)=>user.id===targetId);
 requireOk(target&&targetInScope(original.actor,target,scope),403,'dashboardPreviewDenied');
 const reviewer=scope===null?null:await dashboardSecurity(c,original);
 const allowed=scope===null?null:scope.filter(id=>target.companyIds.includes(id));
 requireOk(!companyId||allowed===null||allowed.includes(companyId),403,'dashboardCompanyDenied');
 if(session){
  const action=reviewer?'delegated_readonly_dashboard_preview':'owner_readonly_dashboard_preview';
  const record=(client:any)=>audit(client,session.tenant_id,session.user_id,action,'user',targetId,['dashboard','reports']);
  if(!deferReadAudit(c,record))await record(c);
 }
 await c.query("select set_config('ab.actor',$1,true)",[targetId]);
 const projected=await model(c,targetId,cipher);
 const security=await dashboardSecurity(c,projected);
 const intersect=(a:string[]|null,b:string[]|null)=>a===null?b:b===null?a:a.filter(id=>b.includes(id));
 if(reviewer){
  security.companyIds=intersect(security.companyIds,allowed);
  security.departmentIds=intersect(security.departmentIds,reviewer.departmentIds);
  security.widgets=security.widgets.filter(id=>reviewer.widgets.includes(id));
  security.details=security.details.filter(id=>reviewer.details.includes(id));
  security.panels=security.panels.filter(id=>reviewer.panels.includes(id));
 }
 return {projected,security,delegated:reviewer!==null};
}
