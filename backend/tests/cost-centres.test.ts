import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {costCentreSchema,reversalCostCentre} from '../src/cost-centres.js';
import {ledgerFixture} from './ledger-fixture.js';
import {security} from '../src/core.js';
test('cost centre validation and reversal retain only original same-company attribution',()=>{
 const companyId=randomUUID(),centre={format:'AB-COST-CENTRE-1',id:randomUUID(),companyId,nameAr:'تشغيل',nameEn:'Operations',revision:1};
 assert(costCentreSchema.safeParse({companyId,revision:0,nameAr:'تشغيل',nameEn:'Operations',active:true,reason:'New'}).success);
 assert(!costCentreSchema.safeParse({companyId,revision:0,nameAr:' ',nameEn:'Operations',active:true,reason:'New'}).success);
 assert.deepEqual(reversalCostCentre({costCentre:centre},companyId),{costCentre:centre});
 assert.deepEqual(reversalCostCentre({costCentre:centre},randomUUID()),{});assert.deepEqual(reversalCostCentre({},companyId),{});
});
test('native cost centres: scoped catalogue, exact journal snapshot, approval, reversal and unassigned reconciliation',async()=>{
 const f=await ledgerFixture();try{
  const before=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const body={companyId:f.co1,revision:0,nameAr:'تشغيل الاختبار',nameEn:'Test operations',active:true,reason:'Synthetic test'};
  const centre=await f.req('POST','/api/ledger/package/cost-centres',body);
  assert.equal(centre.financialEffect,false);assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,0);
  await f.req('POST','/api/ledger/package/cost-centres',{...body,nameEn:' TEST   OPERATIONS '},409);
  await f.req('POST','/api/ledger/package/cost-centres',{...body,id:centre.id},409);
  const key=randomUUID(),journal={companyId:f.co1,currency:'AED',effectiveOn:f.date,reason:'Synthetic manual entry',costCentreId:centre.id,
   lines:[{chartId:f.accounts.cash.charts[f.co1],debit:'10.001',credit:'0'},{chartId:f.accounts.income.charts[f.co1],debit:'0',credit:'10.001'}]};
  const j=await f.req('POST','/api/ledger/journals',journal,200,key);
  assert.equal((await f.req('POST','/api/ledger/journals',journal,200,key)).id,j.id);
  const report=()=>f.req('GET','/api/ledger/reports?'+new URLSearchParams({companies:f.co1,from:'2026-01-01',to:'2026-12-31',kind:'cost-centres'}));
  assert.equal((await report()).rows.length,0);
  await f.req('POST','/api/ledger/journals',{...journal,companyId:f.co2,lines:[{chartId:f.accounts.cash.charts[f.co2],debit:'10.001',credit:'0'},{chartId:f.accounts.income.charts[f.co2],debit:'0',credit:'10.001'}]},422);
  await f.req('POST','/api/ledger/journals/'+j.id+'/post',{});
  await f.bill('30',f.items.salik);
  let rows=(await report()).rows;assert.equal(rows.find((r:any)=>r.cost_centre_id===centre.id).net,'10.001');assert.equal(rows.find((r:any)=>r.cost_centre_id==='unassigned').net,'30.000');
  await f.req('POST','/api/ledger/package/cost-centres',{...body,id:centre.id,revision:1,nameEn:'Renamed operations',active:false});
  const stored=(await f.admin.query('select payload_cipher from ab.finance_journals where id=$1',[j.id])).rows[0];
  assert.equal(security(f.secret.key).open(stored.payload_cipher).costCentre.nameEn,'Test operations');
  await f.req('POST','/api/ledger/journals',journal,422);
  await f.req('POST','/api/ledger/journals/'+j.id+'/reverse',{effectiveOn:f.date,reason:'Synthetic reversal'});
  rows=(await report()).rows;assert.equal(rows.find((r:any)=>r.cost_centre_id===centre.id).net,'0.000');
  assert.equal(rows.find((r:any)=>r.cost_centre_id==='unassigned').net,'30.000');
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);
  assert.equal((await f.req('GET','/api/ledger/package/cost-centres?companyId='+f.co2)).rows.length,0);
  const exported=await f.req('GET','/api/ledger/reports?'+new URLSearchParams({companies:f.co1,from:'2026-01-01',to:'2026-12-31',kind:'cost-centres',format:'excel'}));assert.equal(exported.mime,'application/vnd.ms-excel');assert.match(exported.data,/<Workbook/);assert.match(exported.data,/Unassigned/);
  const employee=await f.employee();await f.login(employee.username,employee.password);
  await f.req('GET','/api/ledger/package/cost-centres?companyId='+f.co1,undefined,403);
  await f.req('POST','/api/ledger/package/cost-centres',body,403);
  await f.req('GET','/api/ledger/reports?'+new URLSearchParams({companies:f.co1,from:'2026-01-01',to:'2026-12-31',kind:'cost-centres'}),undefined,403);
  await f.login();
  for(const action of ['ledger_view','ledger_report'])await f.req('POST','/api/users/'+employee.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  await f.login(employee.username,employee.password);
  assert.equal((await f.req('GET','/api/ledger/package/cost-centres?companyId='+f.co1)).rows.length,1);
  await f.req('GET','/api/ledger/package/cost-centres?companyId='+f.co2,undefined,403);
  await f.req('POST','/api/ledger/package/cost-centres',body,403);
 }finally{await f.close();}
});
