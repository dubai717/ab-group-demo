// The web process authenticates/approves only. Privileged rebuilding belongs to an isolated worker.
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {z} from 'zod';
import {AuthProvider,security,transaction,requireOk} from './core.js';
import {audit} from './data.js';
import {testUsersEnvironment} from './test-users.js';
export interface ResetPreview {ownerId:string;fingerprint:string;createdAt:string;expiresAt:string;target:'original-staging';counts:Record<string,number>;retained:string[];backupVerified:boolean;restoreVerified:boolean;canExecute:boolean;blockers:string[];}
export interface ResetWorker {preview:()=>Promise<ResetPreview>;submit:(r:{id:string;owner:string;tenant:string;fingerprint:string;approvedAt:string})=>Promise<void>;}
export const resetEnvironment=(e:NodeJS.ProcessEnv)=>e.RESET_TEST_DATABASE_ENABLED==='true'&&testUsersEnvironment(e);
export function registerResetControl(app:any,o:{pool:Pool;key:string;auth:AuthProvider;enabled:boolean;worker?:ResetWorker;session:(r:any)=>Promise<any>}){
 const cipher=security(o.key);
 const context=async(req:any)=>{requireOk(o.enabled,404,'notFound');const s=await o.session(req);const actor=await transaction(o.pool,s.tenant_id,s.user_id,async c=>(await c.query('select id,auth_id,auth_email,role_id,status from ab.users where id=$1',[s.user_id])).rows[0]);requireOk(actor?.role_id==='owner'&&actor.status==='Active',403,'denied');return {s,actor};};
 const preview=async(ownerId:string)=>{requireOk(o.worker,503,'resetWorkerNotConfigured');const p=await o.worker.preview();requireOk(p.ownerId===ownerId,403,'denied');requireOk(Date.parse(p.createdAt)>=Date.now()-600000&&Date.parse(p.createdAt)<=Date.now()+30000&&Date.parse(p.expiresAt)<=Date.parse(p.createdAt)+600000,409,'staleResetPreview');requireOk(p.target==='original-staging'&&/^[a-f0-9]{64}$/.test(p.fingerprint)&&Date.parse(p.expiresAt)>Date.now(),409,'staleResetPreview');return p;};
 app.get('/api/reset-test-database',async(req:any)=>{const {actor}=await context(req);if(!o.worker)return {configured:false,canExecute:false,blockers:['privileged-worker-not-activated']};return {...await preview(actor.id),configured:true};});
 app.post('/api/reset-test-database/reauth',{config:{rateLimit:{max:3,timeWindow:'5 minutes'}}},async(req:any)=>{
  const {s,actor}=await context(req),body=z.object({password:z.string().min(1).max(128)}).strict().parse(req.body);const p=await preview(actor.id);requireOk(p.canExecute&&p.backupVerified&&p.restoreVerified&&!p.blockers.length,409,'resetNotReady');
  let token:string|undefined;try{const login=await o.auth.login(actor.auth_email,body.password);token=login.token;requireOk(login.id===actor.auth_id&&await o.auth.verify(token)===actor.auth_id,403,'denied');}finally{body.password='';if(req.body)req.body.password='';if(token)await o.auth.logout(token,'local');}
  return {confirmation:cipher.seal({id:randomUUID(),owner:actor.id,tenant:s.tenant_id,session:cipher.digest(s.sid),fingerprint:p.fingerprint,expires:Date.now()+5*60000}),expiresIn:300};
 });
 app.post('/api/reset-test-database/confirm',async(req:any)=>{
  const {s,actor}=await context(req),d=z.object({confirmation:z.string().max(4096),phrase:z.literal('RESET TEST DATABASE')}).strict().parse(req.body),ticket=cipher.open(d.confirmation),p=await preview(actor.id);
  requireOk(p.canExecute&&p.backupVerified&&p.restoreVerified&&!p.blockers.length&&ticket.expires>Date.now()&&ticket.owner===actor.id&&ticket.tenant===s.tenant_id&&ticket.session===cipher.digest(s.sid)&&ticket.fingerprint===p.fingerprint,403,'denied');const id=z.uuid().parse(ticket.id);
  await transaction(o.pool,s.tenant_id,s.user_id,async c=>{requireOk((await c.query("select 1 from ab.settings where key like 'reset-request:%' and value->>'status' in ('ApprovedAwaitingWorker','Running') limit 1")).rowCount===0,409,'resetAlreadyPending');await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[s.tenant_id,'reset-request:'+id,{owner:actor.id,fingerprint:p.fingerprint,status:'ApprovedAwaitingWorker',approvedAt:new Date().toISOString()}]);await audit(c,s.tenant_id,s.user_id,'test_reset_approved','reset_request',id,['fingerprint']);});
  // A request is not reported as a completed reset. A worker must revalidate its immutable plan,
  // target, backup, write freeze and owner approval. No admin SQL is run by this route.
  await o.worker!.submit({id,owner:actor.id,tenant:s.tenant_id,fingerprint:p.fingerprint,approvedAt:new Date().toISOString()});
  return {requestId:id,status:'ApprovedAwaitingWorker',resetCompleted:false};
 });
}
