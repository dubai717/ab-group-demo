import {z} from 'zod';
import {requireOk,ApiError,sha,transaction} from './core.js';
import {audit} from './data.js';
import {assertTestAccess} from './test-users.js';
export const viewAsCookie='ab_view_as';
const controls=new Set(['/api/view-as/start','/api/view-as/stop','/api/view-as/control','/api/logout']);
export const readonlyPostPaths=new Set(['/api/central-reports/preview','/api/central-reports/export','/api/personnel/export','/api/communication-templates/preview','/api/communications/from-template/preview']);
export async function projectOwnerSession(pool:any,cipher:any,s:any,req:any,testEnabled:boolean){
 if(controls.has(req.url.split('?')[0])||!req.cookies[viewAsCookie])return s;
 let v:any;try{v=cipher.open(req.cookies[viewAsCookie]);}catch{throw new ApiError(403,'viewAsInvalid');}
 requireOk(v.ownerId===s.user_id&&v.tenantId===s.tenant_id&&v.sessionHash===sha(s.sid),403,'viewAsSessionMismatch');
 requireOk(Number.isFinite(v.expiresAt)&&v.expiresAt>Date.now(),403,'viewAsExpired');
 await transaction(pool,s.tenant_id,s.user_id,async c=>{const owner=(await c.query("select role_id from ab.users where id=$1 and status='Active'",[s.user_id])).rows[0],target=(await c.query("select id,role_id from ab.users where id=$1 and status='Active'",[v.targetId])).rows[0];requireOk(owner?.role_id==='owner'&&target&&target.role_id!=='owner',403,'viewAsUnavailable');await assertTestAccess(c,target.id,testEnabled);});
 requireOk(['GET','HEAD'].includes(req.method)||readonlyPostPaths.has(req.url.split('?')[0]),403,'viewAsReadOnly');
 return {...s,user_id:v.targetId,viewAs:{ownerId:s.user_id,targetId:v.targetId,expiresAt:v.expiresAt,readOnly:true}};
}
export function registerViewAs(app:any,{pool,cipher,session,secureCookies,testEnabled=false}:any){
 const owner=async(req:any)=>{const s=await session(req,true);await transaction(pool,s.tenant_id,s.user_id,async c=>requireOk((await c.query("select 1 from ab.users where id=$1 and role_id='owner'and status='Active'",[s.user_id])).rowCount));return s;};
 app.get('/api/view-as/control',async(req:any)=>{const s=await owner(req);return {ownerId:s.user_id,csrfToken:cipher.digest('csrf:'+s.sid),active:!!req.cookies[viewAsCookie]};});
 app.post('/api/view-as/start',async(req:any,reply:any)=>{const s=await owner(req),d=z.object({userId:z.uuid()}).strict().parse(req.body),expiresAt=Date.now()+15*60000;await transaction(pool,s.tenant_id,s.user_id,async c=>{const u=(await c.query("select id,role_id from ab.users where id=$1 and status='Active'",[d.userId])).rows[0];requireOk(u&&u.role_id!=='owner',422,'viewAsTargetMustBeNonOwner');});await transaction(pool,s.tenant_id,d.userId,async c=>{if((await c.query("select to_regprocedure('ab.hr_actor_allowed()')ok")).rows[0].ok)requireOk((await c.query('select ab.hr_actor_allowed()ok')).rows[0].ok,403,'viewAsUnavailable');await assertTestAccess(c,d.userId,testEnabled);},{readOnly:true,auditActor:s.user_id});await transaction(pool,s.tenant_id,s.user_id,c=>audit(c,s.tenant_id,s.user_id,'owner_view_started','user',d.userId,['readonly']));reply.setCookie(viewAsCookie,cipher.seal({ownerId:s.user_id,tenantId:s.tenant_id,targetId:d.userId,sessionHash:sha(s.sid),expiresAt}),{httpOnly:true,secure:secureCookies,sameSite:'strict',path:'/',maxAge:3660});return {saved:true,readOnly:true,expiresAt};});
 app.post('/api/view-as/stop',async(req:any,reply:any)=>{const s=await owner(req);let target=null;try{const v=cipher.open(req.cookies[viewAsCookie]);if(v.ownerId===s.user_id&&v.sessionHash===sha(s.sid))target=v.targetId;}catch{}await transaction(pool,s.tenant_id,s.user_id,c=>audit(c,s.tenant_id,s.user_id,'owner_view_stopped','user',target,['readonly']));reply.clearCookie(viewAsCookie,{path:'/'});return {saved:true,ownerRestored:true};});
}
