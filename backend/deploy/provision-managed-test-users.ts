import {z} from 'zod';
import {randomBytes} from 'node:crypto';
// Approved test-fixture creation only. Never reset or update a real owner.
import {Pool} from 'pg';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {supabase,supabaseKeys,security,sha,requireOk,transaction} from '../src/core.js';
import {provisionTestUsers} from '../src/test-user-provisioning.js';
import {build} from '../src/app.js';
import {testProjectHash,registrySchema,stateKey} from '../src/test-users.js';
import {model,persistBank,audit} from '../src/data.js';
import {validateStagingLedger} from './safe-staging-additives.js';
let admin:Pool|undefined,runtime:Pool|undefined,stage='GUARD';
try{
 requireOk(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_REF==='refs/heads/verify/managed-test-users-20261104',403,'denied');
 const url=new URL(process.env.SUPABASE_URL||''),db=new URL(process.env.MIGRATION_DATABASE_URL||''),rt=new URL(process.env.DATABASE_URL||'');
 requireOk(sha(url.origin)===testProjectHash&&decodeURIComponent(db.username)==='postgres.'+url.hostname.split('.')[0]&&decodeURIComponent(rt.username)==='ab_runtime.'+url.hostname.split('.')[0]&&[db,rt].every(u=>u.hostname.endsWith('.pooler.supabase.com')&&(u.port||'5432')==='5432'&&u.pathname==='/postgres'&&[...u.searchParams.keys()].every(k=>k==='sslmode')),403,'denied');
 admin=new Pool({...databaseOptions(db.href),max:4});runtime=new Pool({...databaseOptions(rt.href),max:5});admin.on('error',()=>{});runtime.on('error',()=>{});
 for(const pool of [admin,runtime]){const c=await pool.connect();try{assertVerifiedDatabaseTls(c);}finally{c.release();}}
 const role=(await runtime.query("select current_user name,rolsuper,rolbypassrls,rolcreaterole from pg_roles where rolname=current_user")).rows[0];requireOk(role.name==='ab_runtime'&&!role.rolsuper&&!role.rolbypassrls&&!role.rolcreaterole,403,'denied');
 requireOk((await validateStagingLedger((await admin.query('select name,sha256 from public.ab_schema_migrations order by name')).rows)).length===0,409,'schemaChanged');
 const owner=(await admin.query("select * from ab.users where username=$1 and role_id='owner' and status='Active'",['trial_4db27b82b8bf'])).rows;requireOk(owner.length===1,409,'controllerNotMatched');const before=JSON.stringify(owner[0]);
 const keys=supabaseKeys(),provider=supabase(url.origin,keys.publishable,keys.secret,'ab-private-test');
 const app=await build({pool:runtime,key:process.env.DATA_ENCRYPTION_KEY||'',origin:'https://ab-group-demo.onrender.com',secureCookies:true,auth:provider.auth,objects:provider.objects,testUsersEnabled:true,serveFrontend:false});await app.ready();
 stage='PROVISION_AND_ACTUAL_BACKEND_ROLE_TESTS';
 try{
 const verify=async(registry:z.infer<typeof registrySchema>,passwords:ReadonlyMap<string,string>)=>{
  const bank=await transaction(runtime!,registry.tenant,registry.owner,async c=>{const existing=(await c.query('select id from ab.bank_accounts where company_id=$1 limit 1',[registry.company])).rows[0];return existing?.id||persistBank(c,await model(c,registry.owner,security(process.env.DATA_ENCRYPTION_KEY||'')),security(process.env.DATA_ENCRYPTION_KEY||''),registry.tenant,{companyId:registry.company,bankId:'demo-bank',accountName:'Test Users fictional bank account',accountNumber:'TEST-0001',iban:'AE070331234567890123456',swift:'BOMLAEAD',openedAt:'2026-01-01',status:'Active',purposeId:'operations',openingBalance:'0',currency:'AED'});});
  let index=0,ownerSession:any;
  for(const user of registry.users){
   const address='127.0.0.'+(++index); // Independent in-process HTTP clients, not forwarded headers.
   const req=(method:any,path:string,body?:any,cookie='',csrf='')=>app.inject({method,url:path,payload:body,remoteAddress:address,headers:{origin:'https://ab-group-demo.onrender.com','x-ab-request':'1',cookie,'x-csrf-token':csrf}});
   const signed=await req('POST','/api/login',{username:user.username,password:passwords.get(user.authId)});requireOk(signed.statusCode===200,502,'backendLoginFailed');
   const cookie=String(signed.headers['set-cookie']).split(';')[0],bootstrap=await req('GET','/api/bootstrap',undefined,cookie);requireOk(bootstrap.statusCode===200,502,'bootstrapFailed');const data=bootstrap.json();requireOk(data.actor.roleId===user.role&&data.companies.every((x:any)=>x.id===registry.company),403,'scopeMismatch');
   const panel=await req('GET','/api/test-users',undefined,cookie);requireOk(panel.statusCode===(user.role==='owner'?200:403),403,'ownerScreenMismatch');
   const banking=await req('GET','/api/bank-accounts/'+bank,undefined,cookie);requireOk(banking.statusCode===(user.role==='owner'?200:403),403,'bankPermissionMismatch');
   if(user.role!=='owner'){requireOk((await req('POST','/api/test-users/'+user.id+'/password',{},cookie,data.csrfToken)).statusCode===403,403,'resetEscalation');requireOk(data.bankAccounts.length===0,403,'bankDataExposed');}
   const foreign=(await admin!.query('select id from ab.companies where tenant_id<>$1 limit 1',[registry.tenant])).rows[0];if(foreign){const denied=await req('GET','/api/companies/'+foreign.id,undefined,cookie);const body=denied.json();requireOk([403,404,422].includes(denied.statusCode)&&Object.keys(body).length===1&&typeof body.error==='string',403,'crossTenantLeak');}
   if(user.role==='owner')ownerSession={req,cookie,csrf:data.csrfToken};
   console.log('TEST_USER: '+JSON.stringify({username:user.username,name:user.name,role:user.role,scope:'fictional-test-group; fictional-company-membership',status:'Active',login:'PASS',serverPermissions:'PASS'}));
  }
  const employee=registry.users.find(u=>u.role==='employee')!;
  const realDenied=await ownerSession.req('POST','/api/test-users/'+owner[0].id+'/password',{},ownerSession.cookie,ownerSession.csrf);requireOk(realDenied.statusCode===404,403,'realOwnerNotProtected');
  const reset=await ownerSession.req('POST','/api/test-users/'+employee.id+'/password',{},ownerSession.cookie,ownerSession.csrf);requireOk(reset.statusCode===200,502,'managedResetFailed');const oneTime=reset.json();const signed=await provider.auth.login(employee.email,oneTime.password);requireOk(signed.id===employee.authId,502,'resetVerificationFailed');await provider.auth.logout(signed.token);oneTime.password='';
  console.log('CHECK: REAL_AUTH_ALL_ROLES_BACKEND_SCOPES_FINANCE_DENIAL_OWNER_ONLY_RESET_AND_REAL_OWNER_PROTECTION=PASS');
  await transaction(runtime!,registry.tenant,registry.owner,c=>c.query('update ab.settings set value=value||$2::jsonb where key=$1',[stateKey,{backendVerifiedAt:new Date().toISOString()}]));
 };
 const result=await provisionTestUsers(admin,provider.auth,process.env.DATA_ENCRYPTION_KEY||'',{tenant:owner[0].tenant_id,id:owner[0].id},verify);
 if(!result.created){
  const r=result.registry,state=await transaction(runtime!,r.tenant,r.owner,async c=>(await c.query('select value from ab.settings where key=$1',[stateKey])).rows[0]?.value);
  if(!state?.backendVerifiedAt){
   requireOk(process.env.AB_MANAGED_TEST_RESUME==='verify-unfinished-current-suite'&&state?.suite===r.suite&&!state.disabled&&Date.now()-Date.parse(state.loginVerifiedAt)<7200000,409,'unfinishedSuiteNeedsReview');
   // Resume only a sealed, newly created unfinished fixture suite. Never infer from test_ alone.
   const rows=await transaction(runtime!,r.tenant,r.owner,async c=>(await c.query('select id,auth_id,auth_email,username,role_id,status,data from ab.users where id=any($1::uuid[])',[r.users.map(u=>u.id)])).rows);
   for(const u of r.users){const row=rows.find(x=>x.id===u.id);requireOk(row?.auth_id===u.authId&&row.auth_email===u.email&&row.username===u.username&&row.role_id===u.role&&row.status==='Active'&&row.data.managedTestSuite===r.suite&&row.data.testProject===testProjectHash&&u.id!==owner[0].id,409,'fixtureIdentityMismatch');const identity=await provider.auth.inspect!(u.authId);requireOk(identity.id===u.authId&&identity.email===u.email&&identity.confirmed,409,'fixtureIdentityMismatch');}
   const own=r.users.find(u=>u.role==='owner')!;await transaction(runtime!,r.tenant,r.owner,c=>audit(c,r.tenant,r.owner,'test_fixture_resume','test_user',own.id,['password-not-retained']));const passwords=new Map<string,string>(),password='Aa1!'+randomBytes(30).toString('base64url');await provider.auth.setPassword!(own.authId,password);passwords.set(own.authId,password);
   const req=(method:any,url:string,body?:any,cookie='',csrf='')=>app.inject({method,url,payload:body,remoteAddress:'127.0.1.1',headers:{origin:'https://ab-group-demo.onrender.com','x-ab-request':'1',cookie,'x-csrf-token':csrf}});
   try{const signed=await req('POST','/api/login',{username:own.username,password});requireOk(signed.statusCode===200,502,'testOwnerResumeFailed');const cookie=String(signed.headers['set-cookie']).split(';')[0],b=await req('GET','/api/bootstrap',undefined,cookie);requireOk(b.statusCode===200,502,'testOwnerResumeFailed');
    for(const u of r.users.filter(u=>u.id!==own.id)){const reset=await req('POST','/api/test-users/'+u.id+'/password',{},cookie,b.json().csrfToken);requireOk(reset.statusCode===200,502,'managedResumeResetFailed');const value=reset.json();passwords.set(u.authId,value.password);value.password='';}
    console.log('CHECK: UNFINISHED_NEW_FIXTURE_SUITE_RESUMED_VIA_OWNER_ONLY_RESET; REAL_OWNER_EXCLUDED');await verify(r,passwords);
   }finally{passwords.clear();}
  }
 }
 requireOk(JSON.stringify((await admin.query('select * from ab.users where id=$1',[owner[0].id])).rows[0])===before,409,'realOwnerChanged');
 console.log('RESULT: '+(result.created?'MANAGED_TEST_USERS_CREATED_AND_VERIFIED':'REGISTERED_MANAGED_SUITE_VERIFIED_OR_PRESERVED')+'; NO_ROLE_GRANT_RLS_SCHEMA_OR_REAL_OWNER_CHANGE; PASSWORDS_NOT_RETAINED');
 }finally{await app.close();}
}catch(error){const code=error instanceof Error&&/^[A-Za-z_]+$/.test(error.message)?error.message:'WITHHELD';console.log('RESULT: MANAGED_TEST_USERS_STOP; STAGE='+stage+'; CODE='+code+'; NO_AUTOMATIC_DELETION_OR_PASSWORD_LOGGING');process.exitCode=1;}finally{await runtime?.end().catch(()=>{});await admin?.end().catch(()=>{});}
