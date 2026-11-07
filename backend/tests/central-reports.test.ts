import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {personnelFixture} from './personnel-fixture.js';

test('Central dashboards and typed reports enforce original record scope and safe currency aggregation',async t=>{
 const f=await personnelFixture();try{
  await f.admin.query(await readFile('supabase/additive/018_reports.sql','utf8'));
  const original=await f.bill('100');await f.bill('200');
  const dashboard=await f.req('GET','/api/central-dashboard');assert.ok(dashboard.postedFinancial.ledger.some((r:any)=>r.currency==='AED'&&r.income==='300.000'));
  const report={source:'invoices',columns:['number','currency','amount'],groupBy:[],aggregate:'sum',measure:'amount'};
  await t.test('authoritative invoice aggregate and export use the same scoped dataset',async()=>{
   const r=await f.req('POST','/api/central-reports/preview',report);assert.equal(r.rows.length,1);assert.equal(r.rows[0].currency,'AED');assert.equal(r.rows[0].value,'300.000');
   const x=await f.req('POST','/api/central-reports/export',{definition:report,format:'excel'});assert.ok(x.data.includes('300.000'));assert.equal(x.rows.length,1);
  });
  await t.test('SQL strings and nonallowlisted fields cannot become report sources or columns',async()=>{
   await f.req('POST','/api/central-reports/preview',{...report,source:'ab.users; DROP TABLE'},422);
   await f.req('POST','/api/central-reports/preview',{...report,columns:['payload_cipher']},422);
   await f.req('POST','/api/central-reports/preview',{...report,measure:'name'},422);
  });
  await t.test('typed original-record links expose current authorized values without raw SQL or storage data',async()=>{const record=await f.req('GET','/api/record-links/invoice/'+original.id);assert.equal(record.fields.amount,'100.000');assert.equal(record.fields.outstanding,'100.000');assert.equal(record.type,'invoice');assert.equal(record.fields.payload_cipher,undefined);await f.req('GET','/api/record-links/users/'+original.id,undefined,422);});
  await t.test('percentage ratios use explicit fields and show an undefined result for a zero denominator',async()=>{const empty=await f.req('POST','/api/central-reports/preview',{...report,aggregate:'ratio',measure:'amount',denominator:'paid'});assert.equal(empty.rows[0].value,null);assert.equal(empty.rows[0].calculationState,'zero_denominator');await f.collection('75');const ratio=await f.req('POST','/api/central-reports/preview',{...report,aggregate:'ratio',measure:'paid',denominator:'amount'});assert.equal(ratio.rows[0].value,'25.000');assert.equal(ratio.rows[0].currency,'AED');await f.req('POST','/api/central-reports/preview',{...report,aggregate:'ratio',denominator:'payload_cipher'},422);});
  const u=await f.employee();
  await t.test('owner preview uses target scopes without changing roles or sessions',async()=>{
   const roles=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
   const r=await f.req('GET','/api/central-dashboard?asUserId='+u.id);assert.equal(r.viewAs.readOnly,true);assert.equal(r.actor.id,u.id);assert.equal(r.counts.invoices,0);assert.deepEqual(r.financial,[]);
   assert.equal((await f.req('GET','/api/bootstrap')).actor.id,f.org.user);
   assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,roles);
   await f.login(u.username,u.password);await f.req('GET','/api/central-dashboard?asUserId='+f.org.user,undefined,403);await f.req('POST','/api/central-reports/preview',report,403);await f.req('GET','/api/record-links/invoice/'+original.id,undefined,403);await f.login();
  });
  await t.test('saved report sharing does not grant source permissions',async()=>{
   const r=await f.req('POST','/api/central-reports',{title:'Synthetic aggregate',definition:report});await f.req('POST','/api/central-reports/'+r.id+'/shares',{userId:u.id},422);
   assert.equal((await f.req('GET','/api/central-reports/'+r.id)).rows[0].value,'300.000');
  });
  await t.test('sharing can be revoked and restored without changing source permissions or erasing history',async()=>{
   const manager=await f.employee('general_manager');await f.req('POST','/api/users/'+manager.id+'/grants',{action:'ledger_view',scope:{type:'company',id:f.co1},delegable:false});const r=await f.req('POST','/api/central-reports',{title:'Revocable synthetic report',definition:report});await f.req('POST','/api/central-reports/'+r.id+'/shares',{userId:manager.id});await f.login(manager.username,manager.password);assert.equal((await f.req('GET','/api/central-reports/'+r.id)).rows[0].value,'300.000');await f.login();await f.req('POST','/api/central-reports/'+r.id+'/shares',{userId:manager.id,active:false});await f.login(manager.username,manager.password);await f.req('GET','/api/central-reports/'+r.id,undefined,403);assert.equal((await f.req('GET','/api/central-reports')).rows.some((x:any)=>x.id===r.id),false);await f.login();await f.req('POST','/api/central-reports/'+r.id+'/shares',{userId:manager.id,active:true});assert.equal((await f.admin.query('select count(*)::int n from ab.report_share_events where report_id=$1',[r.id])).rows[0].n,3);
  });

 }finally{await f.close();}
});
