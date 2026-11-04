import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from './fixture.js';
import {build} from '../src/app.js';
import {provisionTestUsers} from '../src/test-user-provisioning.js';
import {registryKey,stateKey,testUsersEnvironment,testProjectHash} from '../src/test-users.js';
import {sha} from '../src/core.js';
test('test environment gate rejects production and a different project',()=>{
 assert.equal(testUsersEnvironment({APP_ENV:'production',PUBLIC_ORIGIN:'https://ab-group-demo.onrender.com',SUPABASE_URL:'https://other.supabase.co'}),false);
 assert.equal(testUsersEnvironment({APP_ENV:'staging',PUBLIC_ORIGIN:'https://other.onrender.com',SUPABASE_URL:'https://other.supabase.co'}),false);
});
test('managed registry, owner-only reset, RLS scope, one-time secret handling, expiration and bulk suspension preserve real accounts',async()=>{
 const f=await fixture(),app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3100',secureCookies:false,auth:f.auth,objects:f.objects,testUsersEnabled:true});await app.ready();
 const original=JSON.stringify((await f.admin.query('select * from ab.users where id=$1',[f.org.user])).rows[0]);
 const catalog=JSON.stringify((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows);
 const request=(method:any,url:string,body:any,cookie='',csrf='')=>app.inject({method,url,payload:body,headers:{cookie,origin:'http://127.0.0.1:3100','x-ab-request':'1','x-csrf-token':csrf}});
 const login=async(username:string,password:string)=>{const r=await request('POST','/api/login',{username,password});assert.equal(r.statusCode,200);const cookie=String(r.headers['set-cookie']).split(';')[0],b=await request('GET','/api/bootstrap',undefined,cookie);assert.equal(b.statusCode,200);return {cookie,csrf:b.json().csrfToken,bootstrap:b.json()};};
 try{
  const provisioned=await provisionTestUsers(f.admin,f.auth,f.secret.key,{tenant:f.org.tenant,id:f.org.user});const r=provisioned.registry;assert(provisioned.created);assert.equal(r.users.length,10);assert.notEqual(r.tenant,f.org.tenant);
  assert.equal((await provisionTestUsers(f.admin,f.auth,f.secret.key,{tenant:f.org.tenant,id:f.org.user})).created,false);
  const root=await login(f.username,f.password);assert(root.bootstrap.testUsersAvailable);
  const list=await request('GET','/api/test-users',undefined,root.cookie);assert.equal(list.statusCode,200);assert.equal(list.json().users.length,10);assert(list.json().users.every((u:any)=>u.passwordAvailable===false&&!('password'in u)));
  const employee=r.users.find(u=>u.role==='employee')!,ep=f.auth.accounts.get(employee.email)!.password;
  const actor=await login(employee.username,ep);assert.equal(actor.bootstrap.testUsersAvailable,false);assert.equal((await request('GET','/api/test-users',undefined,actor.cookie)).statusCode,403);
  assert.equal((await request('POST','/api/test-users/'+employee.id+'/password',{},actor.cookie,actor.csrf)).statusCode,403);
  assert.equal((await request('POST','/api/test-users/'+f.org.user+'/password',{},root.cookie,root.csrf)).statusCode,404);
  assert.equal((await request('POST','/api/test-users/'+employee.id+'/password',{},root.cookie)).statusCode,403);
  const inspect=f.auth.inspect.bind(f.auth);f.auth.inspect=async id=>({...await inspect(id),id:f.org.user});
  assert.equal((await request('POST','/api/test-users/'+employee.id+'/password',{},root.cookie,root.csrf)).statusCode,409);
  assert.equal(f.auth.accounts.get(employee.email)?.password===ep,true);f.auth.inspect=inspect;
  const reset=await request('POST','/api/test-users/'+employee.id+'/password',{},root.cookie,root.csrf);assert.equal(reset.statusCode,200);const password=reset.json().password;assert(password.length>=32);assert.equal(reset.json().oneTime,true);assert.match(String(reset.headers['cache-control']),/no-store/);
  assert.equal((await request('GET','/api/bootstrap',undefined,actor.cookie)).statusCode,401);
  assert.equal((await f.app.inject({method:'POST',url:'/api/login',payload:{username:employee.username,password},headers:{origin:'http://127.0.0.1:3100','x-ab-request':'1'}})).statusCode,401); // Feature off rejects the managed tenant.
  const fresh=await login(employee.username,password);assert.equal(fresh.bootstrap.actor.roleId,'employee');assert(fresh.bootstrap.companies.every((co:any)=>co.id===r.company));
  const body=JSON.stringify((await f.admin.query("select data,private_cipher from ab.users where tenant_id=$1",[r.tenant])).rows)+JSON.stringify((await f.admin.query('select value from ab.settings')).rows)+JSON.stringify((await f.admin.query('select * from ab.audit_events')).rows);assert.equal(body.includes(password),false);
  assert.equal(Number((await f.admin.query('select count(*)n from ab.request_dedup where tenant_id=any($1::uuid[])',[ [r.tenant,f.org.tenant] ])).rows[0].n),0);
  assert.equal((await request('POST','/api/test-users/state',{disabled:true},root.cookie,root.csrf)).statusCode,200);
  assert.equal((await request('GET','/api/bootstrap',undefined,fresh.cookie)).statusCode,401);
  assert.equal((await request('POST','/api/test-users/state',{disabled:false},root.cookie,root.csrf)).statusCode,200);
  // Expiry uses only metadata, never a stored password.
  await f.admin.query("update ab.settings set value=jsonb_set(value,'{passwordExpiresAt}',jsonb_build_object($3::text,'2000-01-01T00:00:00Z'))where tenant_id=$1 and key=$2",[r.tenant,stateKey,employee.id]);
  assert.equal((await request('GET','/api/test-users',undefined,root.cookie)).statusCode,200);
  assert.equal((await request('POST','/api/login',{username:employee.username,password})).statusCode,401);
  assert.equal(JSON.stringify((await f.admin.query('select * from ab.users where id=$1',[f.org.user])).rows[0]),original);
  assert.equal(JSON.stringify((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows),catalog);
  assert.equal(Number((await f.admin.query("select count(*)n from ab.users where tenant_id=$1 and role_id='owner'",[r.tenant])).rows[0].n),1);
 }finally{await app.close();await f.app.close();await f.runtime.end();await f.admin.end();}
});
