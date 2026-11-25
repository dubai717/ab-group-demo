import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { businessCentersFixture } from './business-centers-fixture.js';
import { build } from '../src/app.js';
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
 }finally{
  if(app)await app.close();
  await f.close();
 }
});
