import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {businessCentersFixture} from './business-centers-fixture.js';

test('a minimal prospect has a separate distinct counter, no implicit debt, and converts in place with source/history retained',async()=>{
 const f=await businessCentersFixture();try{
  const before=await f.req('GET','/api/customers/register-summary'),grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const journals=(await f.admin.query('select id from ab.finance_journals order by id')).rows,invoices=(await f.admin.query('select id from ab.vehicle_invoices order by id')).rows;
  const profile={companyId:f.co1,fullName:'Synthetic prospect '+randomUUID(),leadSource:'Synthetic referral',responsibleUserId:f.org.user,residencyCompanyId:f.co2},key=randomUUID();
  const [a,b]=await Promise.all([f.req('POST','/api/customers',{profile},200,key),f.req('POST','/api/customers',{profile},200,key)]);assert.equal(a.id,b.id);
  const stored=await f.req('GET','/api/customers/'+a.id);assert.equal(stored.status,'Prospect');assert.equal(stored.leadSource,profile.leadSource);assert.equal(stored.responsibleUserId,f.org.user);assert.equal(stored.identityDocuments.length,0);assert(stored.completeness.missing.length>0);
  const summary=await f.req('GET','/api/customers/register-summary');assert.equal(summary.customers.total,before.customers.total+1);assert.equal(summary.customers.prospectTotal,before.customers.prospectTotal+1);assert.equal(summary.customers.actualActiveTotal,before.customers.actualActiveTotal);assert.equal(summary.customers.cells.Prospect[f.co1],1);assert.equal(summary.customers.cells.Prospect[f.co2],1);
  assert.equal(summary.customers.actualActiveTotal+summary.customers.prospectTotal+summary.customers.otherStatusTotal,summary.customers.total);
  assert.equal((await f.req('GET','/api/customers?statuses=Prospect')).rows.filter((r:any)=>r.id===a.id).length,1);
  await f.req('POST','/api/customers/'+a.id+'/status',{status:'Active',reason:'Synthetic conversion after review',revision:stored.revision});
  const converted=await f.req('GET','/api/customers/'+a.id);assert.equal(converted.fileNumber,a.fileNumber);assert.equal(converted.status,'Active');assert.equal(converted.leadSource,profile.leadSource);assert.equal(converted.responsibleUserId,f.org.user);
  const history=await f.req('GET','/api/customers/'+a.id+'/audit');assert(history.some((r:any)=>r.kind==='status_changed'&&r.before.status==='Prospect'&&r.after.reason==='Synthetic conversion after review'));
  const after=await f.req('GET','/api/customers/register-summary');assert.equal(after.customers.prospectTotal,before.customers.prospectTotal);assert.equal(after.customers.actualActiveTotal,before.customers.actualActiveTotal+1);assert.equal(after.customers.total,summary.customers.total);
  assert.deepEqual((await f.admin.query('select id from ab.finance_journals order by id')).rows,journals);assert.deepEqual((await f.admin.query('select id from ab.vehicle_invoices order by id')).rows,invoices);assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);
 }finally{await f.close();}
});

test('prospect responsibility is explicit existing view/follow-up authority, never an automatic job or company grant',async()=>{
 const f=await businessCentersFixture();try{
  const staff=await f.employee(),profile={companyId:f.co1,fullName:'Synthetic responsibility '+randomUUID(),responsibleUserId:staff.id};
  assert(!(await f.req('GET','/api/customers/capabilities')).responsibles.some((r:any)=>r.id===staff.id));await f.req('POST','/api/customers',{profile},422);
  await f.req('POST','/api/users/'+staff.id+'/grants',{action:'customer_view',scope:{type:'company',id:f.co1},delegable:false});await f.req('POST','/api/users/'+staff.id+'/grants',{action:'customer_followup',scope:{type:'company',id:f.co1},delegable:false});
  const cap=await f.req('GET','/api/customers/capabilities'),choice=cap.responsibles.find((r:any)=>r.id===staff.id);assert.deepEqual(choice.companyIds,[f.co1]);assert(choice.nameEn);
  await f.req('POST','/api/customers',{profile:{...profile,companyId:f.co2}},422);const saved=await f.req('POST','/api/customers',{profile});
  await f.login(staff.username,staff.password);const own=await f.req('GET','/api/customers/'+saved.id);assert.equal(own.responsibleUserId,staff.id);assert.equal((await f.req('GET','/api/customers/capabilities')).responsibles.length,0);await f.req('POST','/api/customers',{profile:{companyId:f.co1,fullName:'Synthetic cannot create'}},403);await f.req('GET','/api/customers/'+f.client2,undefined,403);
 }finally{await f.close();}
});
