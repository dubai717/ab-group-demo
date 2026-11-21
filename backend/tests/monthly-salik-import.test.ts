import test from 'node:test';
import assert from 'node:assert/strict';
import {groupMonthlySalik} from '../src/monthly-salik-import.js';
import {businessCentersFixture} from './business-centers-fixture.js';
const row=(amount:string,patch:any={})=>({line:1,data:{companyId:'company',vehicleId:'vehicle',assetId:'asset',customerId:'customer',itemId:'item',occurredOn:'2026-01-10',dueOn:'2026-02-01',sourceKey:'reference',amount,...patch}});
test('monthly toll grouping preserves exact source amounts and independent vehicles',()=>{
 const groups=groupMonthlySalik([row('0.101'),row('0.202'),row('5',{vehicleId:'other',assetId:'other'})]);assert.equal(groups.length,2);assert.equal(groups[0].amount,'0.303');assert.equal(groups[0].transactions.length,2);assert.equal(groups[1].amount,'5.000');
 assert.throws(()=>groupMonthlySalik([row('1'),row('1',{customerId:'other'})]));assert.throws(()=>groupMonthlySalik([row('1'),row('1',{dueOn:'2026-02-02'})]));assert.equal(groupMonthlySalik([{error:'duplicate'},row('1')]).length,1);
});
test('monthly Salik imports create one pass-through invoice, retain detail and reject duplicate/conflicting or late transactions',async()=>{
 const f=await businessCentersFixture();try{
  const request=await f.request();await f.fund(request.id);const vehicle=await f.register(request.id),number=(await f.admin.query('select file_number from ab.vehicles where id=$1',[vehicle.id])).rows[0].file_number,customer=(await f.admin.query('select file_number from ab.customers where id=$1',[f.client])).rows[0].file_number;
  const clearing=await f.req('POST','/api/ledger/accounts',{code:'salik_clearing',nameAr:'سالك مدفوع بالنيابة',nameEn:'Synthetic toll clearing',kind:'liability',companyIds:[f.co1],currency:'AED'});
  await f.req('POST','/api/ledger/items',{code:'monthly_tolls',nameAr:'سالك تجريبي',nameEn:'Synthetic monthly tolls',category:'salik',priority:10,companyIds:[f.co1],invoice:true,receipt:true,payment:false,methods:['bulk'],receivableId:f.accounts.ar.id,revenueId:clearing.id});
  const mapping={sourceKey:'ref',customerNumber:'customer',vehicleNumber:'vehicle',itemCode:'item',amount:'amount',currency:'currency',dueOn:'due',occurredOn:'occurred'},header='ref,customer,vehicle,item,amount,currency,due,occurred\n',line=(ref:string,amount='10',item='monthly_tolls')=>[ref,customer,number,item,amount,'AED','2026-02-01','2026-01-10'].join(','),preview=(lines:string[],status=200)=>f.req('POST','/api/ledger/invoice-imports/monthly-salik',{companyId:f.co1,name:'Synthetic tolls.csv',format:'csv',base64:Buffer.from(header+lines.join('\n')).toString('base64'),mapping,sourceResponsibilityReviewed:true},status);
  const invalid=await preview([line('bad-income','5','salik')]);assert.equal(invalid.rows[0].error,'salikPassThroughMappingReviewRequired');await f.req('POST','/api/ledger/invoice-imports/'+invalid.id+'/commit',{},422);
  const job=await preview([line('TOLL-A','0.101'),line('TOLL-B','0.202')]);assert.equal(job.groups.length,1);assert.equal(job.groups[0].amount,'0.303');const result=await f.req('POST','/api/ledger/invoice-imports/'+job.id+'/commit',{});assert.equal(result.created.length,1);assert.deepEqual(await f.req('POST','/api/ledger/invoice-imports/'+job.id+'/commit',{}),result);
  const details=await f.req('GET','/api/ledger/invoices/'+result.created[0]+'/salik-details');assert.equal(details.transactions.length,2);assert.equal(details.month,'2026-01');
  const duplicate=await preview([line('TOLL-B','0.202'),line('TOLL-A','0.101')]);assert.equal(duplicate.rows.filter((r:any)=>r.error==='duplicate').length,2);assert.equal((await f.req('POST','/api/ledger/invoice-imports/'+duplicate.id+'/commit',{})).created.length,0);
  const conflict=await preview([line('TOLL-A','1')]);assert.equal(conflict.rows[0].error,'salikTransactionConflict');const late=await preview([line('TOLL-C')]);await f.req('POST','/api/ledger/invoice-imports/'+late.id+'/commit',{},409);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_invoice_links')).rows[0].n,1);assert.equal((await f.admin.query("select count(*)::int n from ab.finance_entries e join ab.finance_chart ch on ch.id=e.chart_id where ch.kind='income'")).rows[0].n,0);
  await f.req('GET','/api/ledger/invoices/'+crypto.randomUUID()+'/salik-details',undefined,404);
  const secondRequest=await f.request();await f.fund(secondRequest.id);const second=await f.register(secondRequest.id),secondNumber=(await f.admin.query('select file_number from ab.vehicles where id=$1',[second.id])).rows[0].file_number;
  const feb=(ref:string,n:any)=>[ref,customer,n,'monthly_tolls','5','AED','2026-03-01','2026-02-10'].join(',');const batch=await preview([feb('FEB-ONE',number),feb('FEB-TWO',secondNumber)]);assert.equal(batch.groups.length,2);const committed=await f.req('POST','/api/ledger/invoice-imports/'+batch.id+'/commit',{});assert.equal(committed.created.length,2);assert.equal((await f.admin.query('select count(distinct vehicle_id)::int n from ab.vehicle_invoices where id=any($1::uuid[])',[committed.created])).rows[0].n,2);

  const employee=await f.employee();await f.login(employee.username,employee.password);await f.req('GET','/api/ledger/invoices/'+result.created[0]+'/salik-details',undefined,403);await preview([line('DENIED')],403);await f.req('POST','/api/ledger/invoice-imports/'+job.id+'/commit',{},403);
 }finally{await f.close();}
});
