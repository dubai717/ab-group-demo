import test from 'node:test';
import assert from 'node:assert/strict';
import {businessCentersFixture} from './business-centers-fixture.js';
import {nextReportDate,executeReportSchedules} from '../src/report-jobs.js';
import {transaction,security} from '../src/core.js';
import {model} from '../src/data.js';

test('Scheduled reports recheck recipients and use existing internal notifications without duplicate delivery',async()=>{
 const f=await businessCentersFixture();try{
  await f.bill('100');const report=await f.req('POST','/api/central-reports',{title:'Synthetic scheduled invoice count',definition:{source:'invoices',columns:['number'],aggregate:'count',groupBy:[]}}),due=new Date(Date.now()+60000);
  await f.req('POST','/api/central-reports/'+report.id+'/schedules',{companyId:f.co1,frequency:'once',nextAt:due.toISOString(),recipientIds:[f.org.user]});
  const cipher=security(f.secret.key),run=()=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>executeReportSchedules(c,cipher,await model(c,f.org.user,cipher),{tenant_id:f.org.tenant,user_id:f.org.user},new Date(due.getTime()+1000)));
  const result=await run();assert.equal(result.processed,1);assert.equal(result.available,1);assert.equal((await run()).processed,0);
  assert.equal((await f.admin.query('select count(*)::int n from ab.report_runs')).rows[0].n,1);const runId=(await f.admin.query('select id from ab.report_runs')).rows[0].id,view=await f.req('GET','/api/central-reports/runs/'+runId);assert.equal(view.status,'available');assert.equal(view.rows[0].count,1);const exported=await f.req('POST','/api/central-reports/runs/'+runId+'/export',{format:'excel'});assert.ok(exported.data.includes('count'));assert.equal((await f.admin.query('select result_cipher from ab.report_runs')).rows[0].result_cipher.includes('recordIds'),false);
  const notices=(await f.req('GET','/api/notifications')).rows;assert.equal(notices.filter((r:any)=>r.source==='report').length,1);
 }finally{await f.close();}
});

test('Monthly schedules retain the explicitly chosen UAE calendar anchor across short months',()=>{
 const january=new Date('2026-01-31T09:00:00+04:00'),february=nextReportDate(january,'monthly',31,january)!;
 assert.equal(february.toISOString(),'2026-02-28T05:00:00.000Z');assert.equal(nextReportDate(february,'monthly',31,february)!.toISOString(),'2026-03-31T05:00:00.000Z');
 assert.equal(nextReportDate(january,'once',31,january),null);
});

test('Scheduled snapshots reject revoked permissions on joined fields, not only source row IDs',async()=>{
 const f=await businessCentersFixture();try{await f.bill('100');const manager=await f.employee('general_manager');for(const action of ['ledger_view','customer_view'])await f.req('POST','/api/users/'+manager.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});const report=await f.req('POST','/api/central-reports',{title:'Scoped joined snapshot',definition:{source:'invoices',columns:['number','customerName','amount']}});await f.req('POST','/api/central-reports/'+report.id+'/shares',{userId:manager.id});const due=new Date(Date.now()+60000);await f.req('POST','/api/central-reports/'+report.id+'/schedules',{companyId:f.co1,frequency:'once',nextAt:due.toISOString(),recipientIds:[manager.id]});const cipher=security(f.secret.key);await transaction(f.runtime,f.org.tenant,f.org.user,async c=>executeReportSchedules(c,cipher,await model(c,f.org.user,cipher),{tenant_id:f.org.tenant,user_id:f.org.user},new Date(due.getTime()+1000)));const run=(await f.admin.query('select id from ab.report_runs where user_id=$1',[manager.id])).rows[0];await f.login(manager.username,manager.password);assert.ok((await f.req('GET','/api/central-reports/runs/'+run.id)).rows[0].customerName);await f.login();const grant=(await f.admin.query("select id from ab.permission_grants where user_id=$1 and permission_id='customer_view'and revoked_at is null",[manager.id])).rows[0];await f.req('POST','/api/users/'+manager.id+'/revoke',{grantId:grant.id});await f.login(manager.username,manager.password);const current=await f.req('GET','/api/central-reports/'+report.id);assert.equal(current.rows.length,1);assert.equal(current.rows[0].customerName,'');await f.req('GET','/api/central-reports/runs/'+run.id,undefined,403);
 }finally{await f.close();}
});

test('Explicit report thresholds suppress notices when unmet without pretending access failure or financial execution',async()=>{
 const f=await businessCentersFixture();try{await f.bill('100');const report=await f.req('POST','/api/central-reports',{title:'Synthetic threshold',definition:{source:'invoices',columns:['number'],aggregate:'count'}}),due=new Date(Date.now()+60000);await f.req('POST','/api/central-reports/'+report.id+'/schedules',{companyId:f.co1,frequency:'once',nextAt:due.toISOString(),recipientIds:[f.org.user],alert:{operator:'gte',threshold:'2'}});const cipher=security(f.secret.key),result=await transaction(f.runtime,f.org.tenant,f.org.user,async c=>executeReportSchedules(c,cipher,await model(c,f.org.user,cipher),{tenant_id:f.org.tenant,user_id:f.org.user},new Date(due.getTime()+1000)));assert.equal(result.available,0);assert.equal(result.denied,0);assert.equal(result.thresholdNotMet,1);assert.equal((await f.admin.query('select status from ab.report_runs')).rows[0].status,'threshold_not_met');assert.equal((await f.req('GET','/api/notifications')).rows.filter((r:any)=>r.source==='report').length,0);
 }finally{await f.close();}
});
