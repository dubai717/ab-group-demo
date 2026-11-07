import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {personnelFixture} from './personnel-fixture.js';

test('Opt-in marketing uses existing scope, immutable history and real resource availability',async t=>{
 const f=await personnelFixture();try{
  await f.admin.query(await readFile('supabase/additive/016_marketing.sql','utf8'));await f.admin.query(await readFile('supabase/additive/021_marketing_operations.sql','utf8'));
  await t.test('disabled by default and only owner can enable',async()=>{
   assert.equal((await f.req('GET','/api/marketing/capabilities')).enabled,false);await f.req('GET','/api/marketing/registers',undefined,409);
   const u=await f.employee();await f.login(u.username,u.password);await f.req('POST','/api/marketing/enable',{enabled:true},403);await f.login();await f.req('POST','/api/marketing/enable',{enabled:true});
  });
  const profile={companyId:f.co1,nameAr:'منشأة محتملة معزولة',nameEn:'Isolated prospect',license:'SYNTHETIC-LICENSE',phone:'',email:'',contactName:'Synthetic contact',notes:''};
  const p=await f.req('POST','/api/marketing/prospects',profile);
  await t.test('prospects do not become official companies and duplicates are rejected',async()=>{
   assert.equal(p.officialCompanyCreated,false);await f.req('POST','/api/marketing/prospects',profile,409);assert.equal((await f.admin.query('select count(*)::int n from ab.companies')).rows[0].n,2);
  });
  const o=await f.req('POST','/api/marketing/opportunities',{prospectId:p.id,title:'Synthetic lead',assignedUserId:f.org.user,estimatedValue:'1000',currency:'AED'});
  await t.test('contracted stage requires an actual active contract',async()=>{
   await f.req('POST','/api/marketing/opportunities/'+o.id+'/stage',{stage:'contracted',reason:'Not signed',revision:1},409);
  });
  await f.req('POST','/api/marketing/prospects/'+p.id+'/link',{companyId:f.co1,revision:1});
  const proof=await f.proof(),c=await f.req('POST','/api/marketing/contracts',{prospectId:p.id,title:'Synthetic transport contract',kind:'customer',startsOn:'2026-01-01',endsOn:'2026-12-31',period:'month',paymentSchedule:[{dueOn:'2026-01-01',amount:'1000'}],value:'1000',currency:'AED',driverService:true,prices:[],documentVersionId:proof,commission:{beneficiaryId:f.org.user,bps:500,basis:'actual_collected',reason:'Synthetic signed terms'}});
  await f.req('POST','/api/marketing/contracts/'+c.id+'/state',{state:'Active',reason:'Synthetic signed contract',revision:1});
  const employee=(await f.req('POST','/api/personnel/employees',{companyId:f.co1,nameAr:'سائق اختبار',nameEn:'Synthetic driver',jobTitle:'Driver',hiredOn:'2024-01-01'})).id;
  await f.req('POST','/api/marketing/drivers/enroll',{companyId:f.co1,employeeId:employee,active:true,consentVersionId:proof});
  await t.test('active contract prevents conflicting driver allocations',async()=>{
   const d={employeeId:employee,startsAt:'2026-03-01T08:00:00+04:00',endsAt:'2026-03-01T12:00:00+04:00',reason:'Synthetic shift'};
   await f.req('POST','/api/marketing/contracts/'+c.id+'/allocations',d);
   await f.req('POST','/api/marketing/contracts/'+c.id+'/allocations',{...d,startsAt:'2026-03-01T10:00:00+04:00'},409);
   await f.req('POST','/api/marketing/contracts/'+c.id+'/allocations',{...d,startsAt:'2026-03-01T12:00:00+04:00',endsAt:'2026-03-01T14:00:00+04:00'});
  });
  await t.test('contract history and commission snapshot are retained without automatic payments',async()=>{
   const data=await f.req('GET','/api/marketing/registers');assert.equal(data.contracts[0].payload.commissionSnapshot.bps,500);
   await f.req('POST','/api/marketing/contracts/'+c.id+'/state',{state:'Terminated',reason:'Synthetic retained termination',revision:2});
   assert.ok((await f.req('GET','/api/marketing/history/'+c.id)).rows.length>=4);
   assert.equal((await f.admin.query('select count(*)::int n from ab.finance_vouchers')).rows[0].n,0);
   assert.equal((await f.req('GET','/api/marketing/registers')).allocations.every((r:any)=>r.state==='Cancelled'),true);
  });
 }finally{await f.close();}
});
