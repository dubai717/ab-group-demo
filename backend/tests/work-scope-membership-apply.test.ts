import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { businessCentersFixture } from './business-centers-fixture.js';
import { build } from '../src/app.js';
import { transaction } from '../src/core.js';
import { today } from '../src/vehicle-domain.js';

test('reviewed centre membership updates original memberships and retains independent grants', async () => {
 const f=await businessCentersFixture();
 let app: Awaited<ReturnType<typeof build>> | undefined;
 try {
  const worker=await f.employee(),scope='/api/users/'+worker.id+'/work-scope/';
  await f.admin.query(await readFile('backend/review/operating-centres.sql','utf8'));
  const centreId=randomUUID(),emirateId=(await f.admin.query('select id from ab.emirates order by id limit 1')).rows[0].id;
  const draft={centreId,revision:0,effectiveOn:today(),state:'Active',emirateId,areaId:null,
   companyIds:[f.co1,f.co2],nameAr:'مركز اختباري',nameEn:'Synthetic membership centre',reason:'Synthetic source'};
  const planned=await f.req('POST','/api/operating-centres/plan',draft);
  await f.req('POST','/api/operating-centres/apply',{...draft,planHash:planned.planHash,confirm:true});
  const origin='http://127.0.0.1:3100';
  app=await build({pool:f.runtime,key:f.secret.key,origin,secureCookies:false,auth:f.auth,objects:f.objects,workScopeMembershipApplyEnabled:true});
  const headers:Record<string,string>={origin,'x-ab-request':'1'};
  const login=async(username=f.username,password=f.password)=>{
   const response=await app!.inject({method:'POST',url:'/api/login',payload:{username,password},headers:{origin,'x-ab-request':'1'}});
   assert.equal(response.statusCode,200);
   headers.cookie=String(response.headers['set-cookie']).split(';')[0];
   headers['x-csrf-token']=(await app!.inject({url:'/api/bootstrap',headers})).json().csrfToken;
  };
  const apply=async(payload:unknown,status=200,key=randomUUID())=>{
   const response=await app!.inject({method:'POST',url:scope+'apply-memberships',payload:payload as any,headers:{...headers,'idempotency-key':key}});
   assert.equal(response.statusCode,status,response.body);
   return response.json();
  };
  await f.req('POST','/api/users/'+worker.id+'/grants',{action:'bank_view',scope:{type:'company',id:f.co1},delegable:false});
  const grants=async()=>(await f.admin.query('select * from ab.permission_grants where user_id=$1 order by id',[worker.id])).rows;
  const unchanged=await grants();
  const summary=await f.req('GET','/api/users/'+worker.id+'/permission-summary');
  const input={revision:summary.user.revision,asOf:today(),selection:{kind:'centres',ids:[centreId]}};
  const preview=await f.req('POST',scope+'preview',input);
  const payload={...input,confirm:true,reviewHash:preview.reviewHash};
  await f.req('POST',scope+'apply-memberships',payload,503);
  await login(worker.username,worker.password);
  await apply(payload,403);
  await login();
  const enabledPreview=await app.inject({method:'POST',url:scope+'preview',payload:input,headers});
  assert.equal(enabledPreview.statusCode,200,enabledPreview.body);
  assert.equal(enabledPreview.json().membershipApplication.available,true);
  const reviewedUpdate=await f.req('POST','/api/operating-centres/plan',{...draft,revision:1,nameEn:'Updated synthetic centre'});
  await f.req('POST','/api/operating-centres/apply',{...draft,revision:1,nameEn:'Updated synthetic centre',planHash:reviewedUpdate.planHash,confirm:true});
  assert.equal((await apply(payload,409)).error,'workScopeReviewChanged');
  payload.reviewHash=(await f.req('POST',scope+'preview',input)).reviewHash;
  await apply({...payload,reviewHash:'0'.repeat(64)},409);
  const key=randomUUID(),saved=await apply(payload,200,key);
  assert.deepEqual(saved.companyIds,[f.co1,f.co2].sort());
  assert.deepEqual(await apply(payload,200,key),saved);
  assert.deepEqual(await grants(),unchanged);
  const rows=(await f.admin.query('select company_id,active from ab.user_companies where user_id=$1 order by company_id',[worker.id])).rows;
  assert.deepEqual(rows.map(row=>row.company_id),[f.co1,f.co2].sort());
  assert(rows.every(row=>row.active));
  const narrow={revision:saved.revision,asOf:today(),selection:{kind:'companies',ids:[f.co2]}};
  const narrowPreview=await f.req('POST',scope+'preview',narrow);
  assert.equal((await apply({...narrow,confirm:true,reviewHash:narrowPreview.reviewHash},409)).error,'workScopeOutsideRightsReviewRequired');
  assert.deepEqual(await grants(),unchanged);
  const priorGrant=(await f.req('GET','/api/users/'+worker.id+'/permission-summary')).directGrants.find((entry:any)=>entry.action==='bank_view');
  await f.req('POST','/api/users/'+worker.id+'/revoke',{grantId:priorGrant.id});
  const department=await f.req('POST','/api/personnel/departments',{companyId:f.co1,typeCode:'COL',scope:'company'});
  await f.req('POST','/api/users/'+worker.id+'/grants',{action:'edit',scope:{type:'department',id:department.id},delegable:false});
  const departmentPreview=await f.req('POST',scope+'preview',narrow);
  assert.equal((await apply({...narrow,confirm:true,reviewHash:departmentPreview.reviewHash},409)).error,'workScopeOutsideRightsReviewRequired');
  const compiledWorker=await f.employee();
  const compiledUrl='/api/users/'+compiledWorker.id+'/work-scope/';
  await f.admin.query(await readFile('backend/review/company-scope-upper-bound.sql','utf8'));
  const replaceCompiled=async(revision:number,previous:string|null)=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>{
   const id=randomUUID();
   await c.query(`insert into ab.user_access_scope_versions(id,tenant_id,user_id,revision,previous_id,selection_kind,payload_cipher,created_by)
      values($1,$2,$3,$4,$5,'companies','synthetic reviewed source',$6)`,[id,f.org.tenant,compiledWorker.id,revision,previous,f.org.user]);
   for(const company of [f.co1,f.co2])await c.query('insert into ab.user_access_scope_companies values($1,$2,$3,$4)',[f.org.tenant,compiledWorker.id,id,company]);
   return id;
  });
  const originalCompiled=await replaceCompiled(1,null);
  await transaction(f.runtime,f.org.tenant,worker.id,async c=>{
   assert.equal((await c.query('select id from ab.user_access_scope_versions where user_id=$1',[compiledWorker.id])).rowCount,0);
   assert.deepEqual((await c.query('select ab.legacy_profile_membership_edit($1) decision',[compiledWorker.id])).rows[0].decision,{allowed:false});
   assert.deepEqual((await c.query('select ab.legacy_profile_membership_edit($1) decision',[worker.id])).rows[0].decision,{allowed:true});
  });

  const compiledUser=(await f.req('GET','/api/users/'+compiledWorker.id+'/permission-summary')).user;
  const proposed={revision:compiledUser.revision,asOf:today(),selection:{kind:'centres',ids:[centreId]}};
  const genericEdit=await app.inject({method:'PATCH',url:'/api/users/'+compiledWorker.id,
   payload:{revision:compiledUser.revision,companyIds:[f.co2]},headers});
  assert.equal(genericEdit.statusCode,409,genericEdit.body);
  assert.equal(genericEdit.json().error,'workScopeCompiledMembershipReviewRequired');

  const compiledRequest=(action:string,payload:unknown)=>app!.inject({method:'POST',url:compiledUrl+action,payload:payload as any,headers:{...headers,'idempotency-key':randomUUID()}});
  const planBefore=await compiledRequest('preview',proposed);
  assert.equal(planBefore.json().membershipApplication.available,true,planBefore.body);
  const mismatch=await compiledRequest('preview',{...proposed,selection:{kind:'companies',ids:[f.co1]}});
  assert.equal(mismatch.json().membershipApplication.reason,'workScopeCompiledMembershipReviewRequired');
  const latestCompiled=await replaceCompiled(2,originalCompiled);
  const stale=await compiledRequest('apply-memberships',{...proposed,confirm:true,reviewHash:planBefore.json().reviewHash});
  assert.equal(stale.statusCode,409,stale.body);
  assert.equal(stale.json().error,'workScopeReviewChanged');
  const latest=await compiledRequest('preview',proposed);
  const synced=await compiledRequest('apply-memberships',{...proposed,confirm:true,reviewHash:latest.json().reviewHash});
  assert.equal(synced.statusCode,200,synced.body);
  assert.equal(synced.json().changed,true);
  assert.deepEqual(synced.json().companyIds,[f.co1,f.co2].sort());
  assert.equal(latest.json().compiledMembership.id,latestCompiled);
  const genericProfileEdit=await app.inject({method:'PATCH',url:'/api/users/'+compiledWorker.id,
   payload:{revision:synced.json().revision,jobTitle:'Synthetic profile edit'},headers});
  assert.equal(genericProfileEdit.statusCode,200,genericProfileEdit.body);


 }finally{
  if(app)await app.close();
  await f.close();
 }
});
