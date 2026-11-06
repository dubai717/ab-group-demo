import {testDataSummary} from './test-data-summary.js';
// Managed fictional identities only. No role, grant, schema or real-user mutation.
import {randomBytes} from 'node:crypto';
import {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {AuthProvider,requireOk,security,sha,transaction} from './core.js';
import {audit} from './data.js';
export const testProjectHash='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f';
export const registryKey='managed-test-users-v1',stateKey='managed-test-users-state-v1';
export const registrySchema=z.object({format:z.literal('AB-TEST-USERS-1'),project:z.literal(testProjectHash),suite:z.uuid(),tenant:z.uuid(),owner:z.uuid(),company:z.uuid(),users:z.array(z.object({id:z.uuid(),authId:z.uuid(),username:z.string().regex(/^test_[a-z0-9_]{3,58}$/),email:z.email().endsWith('@example.test'),role:z.string().min(1),name:z.string().min(1)}).strict()).min(1).max(40)}).strict();
export function testUsersEnvironment(e:NodeJS.ProcessEnv){try{const p=new URL(e.PUBLIC_ORIGIN||''),u=new URL(e.SUPABASE_URL||'');return e.APP_ENV==='staging'&&p.origin==='https://ab-group-demo.onrender.com'&&u.protocol==='https:'&&[p,u].every(x=>!x.username&&!x.password&&!x.search&&!x.hash&&x.pathname==='/')&&sha(u.origin)===testProjectHash;}catch{return false;}}
export async function assertTestAccess(c:PoolClient,id:string,enabled:boolean){
 const data=(await c.query('select data from ab.users where id=$1',[id])).rows[0]?.data;
 if(data?.ownerCreatedTest)requireOk(enabled,401,'loginRequired');
 const state=(await c.query('select value from ab.settings where key=$1',[stateKey])).rows[0]?.value;
 const manual=(await c.query("select value from ab.settings where key='manual-test-passwords-v1'")).rows[0]?.value;if(manual?.[id])requireOk(enabled&&Date.parse(manual[id])>Date.now(),401,'loginRequired');
 if(!state&&!data?.managedTestSuite)return;
 requireOk(enabled&&state?.suite&&state.disabled===false,401,'loginRequired');
 if(state.passwordExpiresAt?.[id])requireOk(Date.parse(state.passwordExpiresAt[id])>Date.now(),401,'loginRequired');
 if(data?.managedTestSuite)requireOk(data.testProject===testProjectHash&&state.suite===data.managedTestSuite,401,'loginRequired');
}
export function registerTestUsers(app:any,options:{pool:Pool;key:string;auth:AuthProvider;enabled:boolean;session:(req:any)=>Promise<any>}){
 const {pool,auth}=options,cipher=security(options.key);
 async function context(req:any){
  requireOk(options.enabled,404,'notFound');const s=await options.session(req);
  const registry=await transaction(pool,s.tenant_id,s.user_id,async c=>{
   const actor=(await c.query('select role_id from ab.users where id=$1',[s.user_id])).rows[0];requireOk(actor?.role_id==='owner',403,'denied');
   const row=(await c.query('select value from ab.settings where key=$1',[registryKey])).rows[0];requireOk(row,404,'testUsersNotProvisioned');
   const manifest=registrySchema.parse(cipher.open(row.value.sealed));
   requireOk(new Set(manifest.users.map(u=>u.id)).size===manifest.users.length&&new Set(manifest.users.map(u=>u.authId)).size===manifest.users.length,409,'invalidReference');
   return manifest;
  });return {s,registry};
 }
 async function target<T>(r:z.infer<typeof registrySchema>,fn:(c:PoolClient,rows:any[],disabled:boolean)=>Promise<T>){return transaction(pool,r.tenant,r.owner,async c=>{
  // RLS remains on. Only a sealed registry can select this entirely fictional tenant.
  const state=(await c.query('select value from ab.settings where key=$1 for update',[stateKey])).rows[0]?.value;
  requireOk(state?.suite===r.suite&&typeof state.disabled==='boolean',409,'invalidReference');
  const rows=(await c.query('select id,auth_id,auth_email,username,role_id,status,data from ab.users where id=any($1::uuid[]) for update',[r.users.map(u=>u.id)])).rows;
  requireOk(rows.length===r.users.length,409,'invalidReference');
  for(const u of r.users){const row=rows.find(x=>x.id===u.id);requireOk(row?.auth_id===u.authId&&row.auth_email===u.email&&row.username===u.username&&row.role_id===u.role&&row.data.managedTestSuite===r.suite&&row.data.testProject===testProjectHash,409,'invalidReference');}
  return fn(c,rows,state.disabled);
 });}
 app.get('/api/test-data',async(req:any)=>{const {s,registry:r}=await context(req);return target(r,async c=>({...await testDataSummary(c,cipher,r.tenant,r.owner),sameWorkspace:s.tenant_id===r.tenant,workspaceUser:r.users.find(u=>u.id===r.owner)?.username}));});
 app.get('/api/test-users',async(req:any)=>{const {registry:r}=await context(req);return target(r,async(c,rows,disabled)=>{
  const roles=(await c.query('select id,data from ab.roles order by id')).rows;
  return {disabled,users:r.users.map(u=>({id:u.id,username:u.username,name:u.name,roleId:u.role,role:roles.find(x=>x.id===u.role)?.data.name||u.role,company:'Test Users — fictional company',scope:'isolated-test-group; fictional-company-membership',status:disabled?'Disabled':rows.find(x=>x.id===u.id).status,passwordAvailable:false}))};
 });});
 app.post('/api/test-users/:id/password',{config:{rateLimit:{max:12,timeWindow:'1 minute'}}},async(req:any)=>{
  const {s,registry:r}=await context(req),id=z.uuid().parse(req.params.id);z.object({}).strict().parse(req.body||{});
  const u=r.users.find(x=>x.id===id);requireOk(u,404,'notFound');
  const result=await target(r,async(c,rows,disabled)=>{
   requireOk(!disabled&&rows.find(x=>x.id===id)?.status==='Active',409,'invalidReference');
   requireOk(auth.inspect&&auth.setPassword,503,'providerUnavailable');
   const identity=await auth.inspect(u.authId);requireOk(identity.id===u.authId&&identity.email===u.email&&identity.confirmed,409,'invalidReference');
   const password='Aa1!'+randomBytes(30).toString('base64url');
   await audit(c,r.tenant,r.owner,'test_password_reset_started','test_user',u.id,['password-not-retained']);
   await auth.setPassword(u.authId,password);
   const verified=await auth.login(u.email,password);requireOk(verified.id===u.authId,502,'providerUnavailable');await auth.logout(verified.token);
   await c.query("update ab.settings set value=jsonb_set(value,'{passwordExpiresAt}',coalesce(value->'passwordExpiresAt','{}'::jsonb)||jsonb_build_object($2::text,$3::text)) where key=$1",[stateKey,u.id,new Date(Date.now()+24*3600000).toISOString()]);
   await c.query('update ab.sessions set expires_at=now() where user_id=$1',[u.id]);
   await audit(c,r.tenant,r.owner,'test_password_reset','test_user',u.id,['password-not-retained']);
   return {password,username:u.username,oneTime:true};
  });
  if(s.tenant_id!==r.tenant)await transaction(pool,s.tenant_id,s.user_id,c=>audit(c,s.tenant_id,s.user_id,'test_password_reset','test_user',u.id,['password-not-retained']));
  return result; // Not wrapped in request_dedup: the response is never persisted.
 });
 app.post('/api/test-users/state',async(req:any)=>{
  const {s,registry:r}=await context(req),{disabled}=z.object({disabled:z.boolean()}).strict().parse(req.body);
  await target(r,async(c)=>{await c.query('update ab.settings set value=value||$2::jsonb where key=$1',[stateKey,{suite:r.suite,disabled}]);if(disabled)await c.query('update ab.sessions set expires_at=now() where user_id=any($1::uuid[])',[r.users.map(u=>u.id)]);await audit(c,r.tenant,r.owner,disabled?'test_suite_disabled':'test_suite_enabled','test_suite',r.suite);});
  if(s.tenant_id!==r.tenant)await transaction(pool,s.tenant_id,s.user_id,c=>audit(c,s.tenant_id,s.user_id,disabled?'test_suite_disabled':'test_suite_enabled','test_suite',r.suite));
  return {disabled};
 });
}
