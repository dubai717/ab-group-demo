import type {PoolClient} from 'pg';
import {z} from 'zod';
import {requireOk,ApiError,sha,transaction} from './core.js';
import {audit} from './data.js';
import {assertTestAccess} from './test-users.js';
export const viewAsCookie='ab_view_as';
const controls=new Set(['/api/view-as/start','/api/view-as/stop','/api/view-as/control','/api/logout']);
export const readonlyPostPaths=new Set(['/api/central-reports/preview','/api/central-reports/export','/api/personnel/export','/api/communication-templates/preview','/api/communications/from-template/preview']);
export const isReadOnlyPost=(path:string)=>readonlyPostPaths.has(path)||/^\/api\/central-reports\/runs\/[a-f0-9-]{36}\/export$/i.test(path);
const grantKey=(viewer:string,target:string)=>'view-as-grant:'+viewer+':'+target;
async function previewAccess(c:PoolClient,viewer:string){
 const user=(await c.query("select role_id from ab.users where id=$1 and status='Active'",[viewer])).rows[0];
 if(user?.role_id==='owner')return {owner:true,targets:[] as string[]};
 const prefix='view-as-grant:'+viewer+':';
 const rows=user?(await c.query("select key from ab.settings where starts_with(key,$1) and value='true'::jsonb",[prefix])).rows:[];
 return {owner:false,targets:rows.map((row:any)=>String(row.key).slice(prefix.length)) as string[]};
}
async function assertPreviewTarget(pool:any,s:any,target:string,testEnabled:boolean){try{await transaction(pool,s.tenant_id,target,async c=>{if((await c.query("select to_regprocedure('ab.hr_actor_allowed()')ok")).rows[0].ok)requireOk((await c.query('select ab.hr_actor_allowed()ok')).rows[0].ok,403,'viewAsUnavailable');await assertTestAccess(c,target,testEnabled);},{readOnly:true,auditActor:s.user_id});}catch(error){if(error instanceof ApiError&&error.status===401)throw new ApiError(403,'viewAsUnavailable');throw error;}}
export async function projectOwnerSession(pool:any,cipher:any,s:any,req:any,testEnabled:boolean){
 if(controls.has(req.url.split('?')[0])||!req.cookies[viewAsCookie])return s;
 let v:any;try{v=cipher.open(req.cookies[viewAsCookie]);}catch{throw new ApiError(403,'viewAsInvalid');}
 requireOk(v.ownerId===s.user_id&&v.tenantId===s.tenant_id&&v.sessionHash===sha(s.sid),403,'viewAsSessionMismatch');
 requireOk(Number.isFinite(v.expiresAt)&&v.expiresAt>Date.now(),403,'viewAsExpired');
 await transaction(pool,s.tenant_id,s.user_id,async c=>{const access=await previewAccess(c,s.user_id),target=(await c.query("select id,role_id from ab.users where id=$1 and status='Active'",[v.targetId])).rows[0];requireOk((access.owner||access.targets.includes(v.targetId))&&target&&target.role_id!=='owner',403,'viewAsUnavailable');});await assertPreviewTarget(pool,s,v.targetId,testEnabled);
 requireOk(['GET','HEAD'].includes(req.method)||isReadOnlyPost(req.url.split('?')[0]),403,'viewAsReadOnly');
 return {...s,user_id:v.targetId,viewAs:{ownerId:s.user_id,targetId:v.targetId,expiresAt:v.expiresAt,readOnly:true}};
}
export function registerViewAs(app:any,{pool,cipher,session,secureCookies,testEnabled=false}:any){
 const withActor=async(req:any,fn:(c:PoolClient,s:any)=>any,readOnly=true)=>{
  const s=await session(req,true);
  return transaction(pool,s.tenant_id,s.user_id,c=>fn(c,s),readOnly?{readOnly:true,auditActor:s.user_id}:undefined);
 };
 app.post('/api/view-as/grants',async(req:any)=>withActor(req,async(c,s)=>{
  requireOk(!req.cookies[viewAsCookie],403,'viewAsReadOnly');
  requireOk((await previewAccess(c,s.user_id)).owner,403,'ownerOnly');
  const d=z.object({viewerId:z.uuid(),targetId:z.uuid(),allowed:z.boolean()}).strict().parse(req.body);
  requireOk(d.viewerId!==d.targetId,422,'viewAsUnavailable');
  const users=(await c.query("select id from ab.users where id=any($1::uuid[]) and role_id<>'owner'",[[d.viewerId,d.targetId]])).rows;
  requireOk(users.length===2,422,'viewAsUnavailable');
  const key=grantKey(d.viewerId,d.targetId);
  await c.query('insert into ab.settings(tenant_id,key,value) values($1,$2,$3::jsonb) on conflict(tenant_id,key) do update set value=excluded.value',
   [s.tenant_id,key,JSON.stringify(d.allowed)]);
  await audit(c,s.tenant_id,s.user_id,d.allowed?'view_as_granted':'view_as_revoked','user',d.targetId,[d.viewerId]);
  return {saved:true};
 },false));
 app.get('/api/view-as/targets',async(req:any)=>withActor(req,async(c,s)=>{
  const access=await previewAccess(c,s.user_id);
  requireOk(access.owner||access.targets.length,403,'denied');
  const users=(await c.query("select id,username,role_id,status,data from ab.users where $1 or (id=any($2::uuid[]) and status='Active' and role_id<>'owner') order by username,id",[access.owner,access.targets])).rows;
  const departments=(await c.query('select id,name from ab.departments')).rows;
  const memberships=(await c.query('select user_id,department_id from ab.user_departments where active')).rows;
  const employees=(await c.query("select to_regclass('ab.hr_employees') ok")).rows[0].ok?(await c.query('select user_id,employee_number::text,department_id,payload_cipher from ab.hr_employees where user_id=any($1::uuid[]) order by employee_number',[users.map(u=>u.id)])).rows:[];
  return {rows:users.map(u=>{const staff=employees.filter(e=>e.user_id===u.id),ids=new Set([...memberships.filter(d=>d.user_id===u.id).map(d=>d.department_id),...staff.map(e=>e.department_id)]);return {id:u.id,nameAr:u.data.nameAr||'',nameEn:u.data.nameEn||'',fullName:u.data.fullName||'',username:u.username,roleId:u.role_id,status:u.status,employeeNumber:staff.map(e=>e.employee_number).join(', '),employeeNames:[...new Set(staff.flatMap(e=>{try{const names=cipher.open(e.payload_cipher);return [names.nameAr,names.nameEn].filter(v=>typeof v==='string'&&v.trim());}catch{return [];}}))],departments:departments.filter(d=>ids.has(d.id)).map(d=>({id:d.id,name:d.name})),previewable:u.status==='Active'&&u.role_id!=='owner'&&u.id!==s.user_id};})};
 }));
 app.get('/api/view-as/control',async(req:any)=>{const s=await session(req,true);let preview=null;try{const v=cipher.open(req.cookies[viewAsCookie]);if(v.ownerId===s.user_id&&v.tenantId===s.tenant_id&&v.sessionHash===sha(s.sid)&&v.expiresAt>Date.now())preview={targetId:v.targetId,expiresAt:v.expiresAt,readOnly:true};}catch{}return {ownerId:s.user_id,csrfToken:cipher.digest('csrf:'+s.sid),active:!!req.cookies[viewAsCookie],preview};});
 app.post('/api/view-as/start',async(req:any,reply:any)=>{const s=await session(req,true),d=z.object({userId:z.uuid()}).strict().parse(req.body),expiresAt=Date.now()+15*60000;await transaction(pool,s.tenant_id,s.user_id,async c=>{const access=await previewAccess(c,s.user_id);requireOk(access.owner||access.targets.includes(d.userId),403,'denied');const u=(await c.query("select id,role_id from ab.users where id=$1 and status='Active'",[d.userId])).rows[0];requireOk(u&&u.role_id!=='owner',422,'viewAsTargetMustBeNonOwner');});await assertPreviewTarget(pool,s,d.userId,testEnabled);await transaction(pool,s.tenant_id,s.user_id,c=>audit(c,s.tenant_id,s.user_id,'owner_view_started','user',d.userId,['readonly']));reply.setCookie(viewAsCookie,cipher.seal({ownerId:s.user_id,tenantId:s.tenant_id,targetId:d.userId,sessionHash:sha(s.sid),expiresAt}),{httpOnly:true,secure:secureCookies,sameSite:'strict',path:'/',maxAge:3660});return {saved:true,readOnly:true,expiresAt};});
 app.post('/api/view-as/stop',async(req:any,reply:any)=>{const s=await session(req,true);let target=null;try{const v=cipher.open(req.cookies[viewAsCookie]);if(v.ownerId===s.user_id&&v.sessionHash===sha(s.sid))target=v.targetId;}catch{}await transaction(pool,s.tenant_id,s.user_id,c=>audit(c,s.tenant_id,s.user_id,'owner_view_stopped','user',target,['readonly']));reply.clearCookie(viewAsCookie,{path:'/'});return {saved:true,ownerRestored:true};});
}
