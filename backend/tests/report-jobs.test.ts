import test from 'node:test';
import assert from 'node:assert/strict';
import {businessCentersFixture} from './business-centers-fixture.js';
import {nextReportDate,executeReportSchedules} from '../src/report-jobs.js';
import {transaction,security} from '../src/core.js';
import {model} from '../src/data.js';

test('Scheduled reports recheck recipients and use existing internal notifications without duplicate delivery',async()=>{
 const f=await businessCentersFixture();try{
  const report=await f.req('POST','/api/central-reports',{title:'Synthetic scheduled invoice count',definition:{source:'invoices',columns:['number'],aggregate:'count',groupBy:[]}}),due=new Date(Date.now()+60000);
  await f.req('POST','/api/central-reports/'+report.id+'/schedules',{companyId:f.co1,frequency:'once',nextAt:due.toISOString(),recipientIds:[f.org.user]});
  const cipher=security(f.secret.key),run=()=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>executeReportSchedules(c,cipher,await model(c,f.org.user,cipher),{tenant_id:f.org.tenant,user_id:f.org.user},new Date(due.getTime()+1000)));
  const result=await run();assert.equal(result.processed,1);assert.equal(result.available,1);assert.equal((await run()).processed,0);
  assert.equal((await f.admin.query('select count(*)::int n from ab.report_runs')).rows[0].n,1);
  const notices=(await f.req('GET','/api/notifications')).rows;assert.equal(notices.filter((r:any)=>r.source==='report').length,1);
 }finally{await f.close();}
});

test('Monthly schedules retain the explicitly chosen UAE calendar anchor across short months',()=>{
 const january=new Date('2026-01-31T09:00:00+04:00'),february=nextReportDate(january,'monthly',31,january)!;
 assert.equal(february.toISOString(),'2026-02-28T05:00:00.000Z');assert.equal(nextReportDate(february,'monthly',31,february)!.toISOString(),'2026-03-31T05:00:00.000Z');
 assert.equal(nextReportDate(january,'once',31,january),null);
});
