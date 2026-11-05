import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';
import {fixture} from './fixture.js';import {build} from '../src/app.js';import {resetEnvironment,ResetPreview} from '../src/reset-control.js';import {security} from '../src/core.js';
test('reset is disabled for production, another origin and missing activation',()=>{assert.equal(resetEnvironment({APP_ENV:'production',RESET_TEST_DATABASE_ENABLED:'true'}),false);assert.equal(resetEnvironment({APP_ENV:'staging',RESET_TEST_DATABASE_ENABLED:'true',PUBLIC_ORIGIN:'https://other.onrender.com',SUPABASE_URL:'https://other.supabase.co'}),false);assert.equal(resetEnvironment({}),false);});
test('Owner-only fresh password approval, CSRF, backup gate, fingerprint binding, expiry and replay protection; no destructive worker',async()=>{
 const f=await fixture();const origin='http://127.0.0.1:3100';let submissions=0;
 const p:ResetPreview={ownerId:f.org.user,fingerprint:'a'.repeat(64),createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString(),target:'original-staging',counts:{companies:5},retained:['owner'],backupVerified:true,restoreVerified:true,canExecute:true,blockers:[]};
 const app=await build({pool:f.runtime,key:f.secret.key,origin,secureCookies:false,auth:f.auth,objects:f.objects,resetEnabled:true,resetWorker:{preview:async()=>p,submit:async()=>{submissions++;}}});
 const req=(method:any,url:string,payload?:any,cookie='',csrf='')=>app.inject({method,url,payload,headers:{origin,'x-ab-request':'1',cookie,'x-csrf-token':csrf}});
 const login=async(username:string,password:string)=>{const r=await req('POST','/api/login',{username,password});assert.equal(r.statusCode,200);const cookie=String(r.headers['set-cookie']).split(';')[0];const b=await req('GET','/api/bootstrap',undefined,cookie);return {cookie,csrf:b.json().csrfToken};};
 try{
  const root=await login(f.username,f.password);p.ownerId=randomUUID();assert.equal((await req('GET','/api/reset-test-database',undefined,root.cookie)).statusCode,403);p.ownerId=f.org.user;assert.equal((await req('GET','/api/reset-test-database',undefined,root.cookie)).statusCode,200);
  const employeeId=randomUUID(),password=randomBytes(32).toString('base64url'),email='reset-employee-'+randomUUID()+'@example.invalid',authId=await f.auth.create(email,password),username='reset_'+randomUUID().slice(0,8);
  await f.admin.query("insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status)values($1,$2,$3,$4,$5,'employee','Active')",[employeeId,f.org.tenant,authId,email,username]);
  const employee=await login(username,password);assert.equal((await req('GET','/api/reset-test-database',undefined,employee.cookie)).statusCode,403);
  assert.equal((await req('POST','/api/reset-test-database/confirm',{},root.cookie)).statusCode,403);
  p.backupVerified=false;assert.equal((await req('POST','/api/reset-test-database/reauth',{password:f.password},root.cookie,root.csrf)).statusCode,409);p.backupVerified=true;
  assert.equal((await req('POST','/api/reset-test-database/reauth',{password:randomUUID()},root.cookie,root.csrf)).statusCode,401);
  const a=await req('POST','/api/reset-test-database/reauth',{password:f.password},root.cookie,root.csrf);assert.equal(a.statusCode,200);const confirmation=a.json().confirmation;
  p.fingerprint='b'.repeat(64);assert.equal((await req('POST','/api/reset-test-database/confirm',{confirmation,phrase:'RESET TEST DATABASE'},root.cookie,root.csrf)).statusCode,403);p.fingerprint='a'.repeat(64);
  const cipher=security(f.secret.key),expired=cipher.open(confirmation);expired.expires=Date.now()-1;
  assert.equal((await req('POST','/api/reset-test-database/confirm',{confirmation:cipher.seal(expired),phrase:'RESET TEST DATABASE'},root.cookie,root.csrf)).statusCode,403);
  const ok=await req('POST','/api/reset-test-database/confirm',{confirmation,phrase:'RESET TEST DATABASE'},root.cookie,root.csrf);assert.equal(ok.statusCode,200);assert.equal(ok.json().resetCompleted,false);assert.equal(submissions,1);
  assert.equal((await req('POST','/api/reset-test-database/confirm',{confirmation,phrase:'RESET TEST DATABASE'},root.cookie,root.csrf)).statusCode,409);assert.equal(submissions,1);
  const second={...cipher.open(confirmation),id:randomUUID()};assert.equal((await req('POST','/api/reset-test-database/confirm',{confirmation:cipher.seal(second),phrase:'RESET TEST DATABASE'},root.cookie,root.csrf)).statusCode,409);assert.equal(submissions,1);
  const stored=JSON.stringify((await f.admin.query("select value from ab.settings where key like 'reset-request:%'")).rows)+JSON.stringify((await f.admin.query('select * from ab.audit_events')).rows);assert.equal(stored.includes(f.password),false);assert.equal(stored.includes(confirmation),false);
  assert.equal((await f.admin.query('select count(*)::int n from ab.users where id=any($1::uuid[])',[[employeeId,f.org.user]])).rows[0].n,2);
 }finally{await app.close();await f.app.close();await f.admin.end();await f.runtime.end();}
});
