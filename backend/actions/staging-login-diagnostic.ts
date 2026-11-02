// READ ONLY account/link/provider diagnosis. Never reset/create users or sessions.
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {runtimeConfiguration} from './runtime-setup.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {supabaseKeys} from '../src/core.js';
import {connectionDiagnostic} from '../src/connection-diagnostics.js';
export async function inspectAccount(admin:any,runtime:any,username:string){
 const target=(await admin.query(`select u.id,u.tenant_id,u.auth_id,u.status,u.role_id,
 a.id is not null auth_exists,lower(a.email)=lower(u.auth_email) email_matches,
 a.email_confirmed_at is not null email_confirmed,coalesce(a.encrypted_password,'')<>'' password_configured,
 a.banned_until is not null and a.banned_until>now() auth_banned
 from ab.users u left join auth.users a on a.id=u.auth_id where u.normalized_username=lower($1)`,[username])).rows;
 console.log(target.length?'DIAGNOSTIC: requested profile exists in central database':'DIAGNOSTIC: requested profile absent from central database');
 if(!target.length)return 'PROFILE_ABSENT';
 if(target.length!==1)throw Error('ambiguous profile');const u=target[0];
 for(const [label,ok] of [['PROFILE_ACTIVE',u.status==='Active'],['PROFILE_OWNER',u.role_id==='owner'],['AUTH_ID_LINKED',u.auth_exists],['AUTH_EMAIL_MATCH',u.email_matches],['AUTH_EMAIL_CONFIRMED',u.email_confirmed],['AUTH_PASSWORD_CONFIGURED',u.password_configured],['AUTH_NOT_BANNED',!u.auth_banned]] as const)console.log('DIAGNOSTIC: '+label+'='+(!!ok));
 const identity=(await runtime.query('select ab.login_identity($1) email',[username])).rows[0]?.email;
 console.log('DIAGNOSTIC: RUNTIME_USERNAME_RESOLVES='+(!!identity));
 const p=(await runtime.query('select * from ab.principal($1)',[u.auth_id])).rows;
 console.log('DIAGNOSTIC: RUNTIME_PRINCIPAL_MATCH='+(p.length===1&&p[0].id===u.id&&p[0].tenant_id===u.tenant_id));
 return 'PROFILE_PRESENT';
}
async function run(){
 let admin:Pool|undefined,runtime:Pool|undefined;
 try{
  const branch='refs/heads/diagnose/render-staging-login';
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='dubai717/ab-group-demo'||process.env.GITHUB_EVENT_NAME!=='push'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||process.env.GITHUB_REF!==branch||process.env.GITHUB_WORKFLOW_REF!==`dubai717/ab-group-demo/.github/workflows/staging-login-diagnostic.yml@${branch}`)throw Error('unapproved context');
  const origin='https://ab-group-demo.onrender.com';
  const health=await fetch(origin+'/api/health',{redirect:'error',signal:AbortSignal.timeout(20000)});
  let h:any;try{h=await health.json();}catch{}
  console.log(health.ok&&h?.mode==='central'&&h?.database==='reachable'?'PASS: actual Render backend reports central database reachable':'STOP: Render backend health is not confirmed');
  const config=await fetch(origin+'/runtime-config.js',{redirect:'error',signal:AbortSignal.timeout(15000)});
  const source=await config.text();
  console.log(config.ok&&/central\s*:\s*true/.test(source)?'PASS: actual Render frontend uses central mode':'STOP: Render central frontend mode not confirmed');
  const cfg=runtimeConfiguration(process.env),keys=supabaseKeys();
  admin=new Pool({...databaseOptions(cfg.administratorUri),max:1});runtime=new Pool({...databaseOptions(cfg.runtimeUri),max:1});
  for(const pool of [admin,runtime])pool.on('error',()=>{process.exitCode=1;console.log('STOP: diagnostic database connection lost; details withheld');});
  const a=await admin.connect(),r=await runtime.connect();
  try{
   assertVerifiedDatabaseTls(a);assertVerifiedDatabaseTls(r);await a.query('BEGIN READ ONLY');await r.query('BEGIN READ ONLY');
   const who=(await r.query('select current_user actor,session_user authenticated_role')).rows[0];
   if(who.actor!=='ab_runtime'||who.authenticated_role!=='ab_runtime')throw Error('wrong runtime role');
   console.log('PASS: independent runtime database connection and verified TLS');
   const trial=(await a.query(`select count(*)::int total,count(*) filter(where status='Active' and role_id='owner')::int active_owners from ab.users where normalized_username ~ '^trial_[a-f0-9]{12}$'`)).rows[0];
   console.log('DIAGNOSTIC: interactive trial profiles='+trial.total+'; active trial owners='+trial.active_owners);
   const orphan=(await a.query(`select count(*)::int n from auth.users a left join ab.users u on u.auth_id=a.id where a.email ~ '^trial_[a-f0-9]{12}@example\\.test$' and u.id is null`)).rows[0];
   console.log('DIAGNOSTIC: interrupted interactive Auth-only profiles='+orphan.n);
   const username=process.env.DIAGNOSTIC_USERNAME||'owner';
   if(!/^[A-Za-z0-9_.-]{3,64}$/.test(username))throw Error('invalid diagnostic target');
   console.log(process.env.DIAGNOSTIC_USERNAME?'DIAGNOSTIC: inspecting explicitly supplied username; value withheld':'DIAGNOSTIC: no explicit username supplied; inspecting legacy demo owner only');
   await inspectAccount(a,r,username);
  }finally{await a.query('ROLLBACK').catch(()=>{});await r.query('ROLLBACK').catch(()=>{});a.release();r.release();}
  const settings=await fetch(process.env.SUPABASE_URL!+'/auth/v1/settings',{headers:{apikey:keys.publishable},redirect:'error',signal:AbortSignal.timeout(15000)});
  console.log(settings.ok?'PASS: actual Supabase Auth settings endpoint accepts configured publishable key':'STOP: Supabase Auth settings endpoint rejected request');
  if(!settings.ok)throw Error('Auth settings failed');
  const probe=await fetch(process.env.SUPABASE_URL!+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:keys.publishable,'content-type':'application/json'},body:JSON.stringify({email:'unregistered-diagnostic-'+randomUUID()+'@example.test',password:randomUUID()+randomUUID()}),redirect:'error',signal:AbortSignal.timeout(15000)});
  const body=await probe.json() as any;
  if([400,401].includes(probe.status)&&(body.error_code||body.code)==='invalid_credentials')console.log('PASS: actual Auth password endpoint rejects nonexistent synthetic identity correctly');
  else{console.log('STOP: Auth endpoint returned an unexpected safe diagnostic category');throw Error('Auth probe unexpected');}
  console.log('PASS: diagnostic finished; no account/session creation, reset, grant, migration or deployment; existing password NOT tested');
 }catch(error){console.log('STOP: read-only login diagnosis; diagnostic='+connectionDiagnostic(error)+'; details withheld');process.exitCode=1;}
 finally{if(runtime)await runtime.end().catch(()=>{});if(admin)await admin.end().catch(()=>{});}
}
if(/[/\\]staging-login-diagnostic\.(ts|js)$/.test(process.argv[1]||''))await run();
