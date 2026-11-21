import test from 'node:test';
import assert from 'node:assert/strict';
import {serviceBillingProjection,dueMonthPolicy} from '../src/vehicle-service-billing.js';
import {personnelFixture} from './personnel-fixture.js';
import {security,transaction} from '../src/core.js';
import {recurring,today} from '../src/vehicle-domain.js';
test('current-month service dues are separate from twelve nonposted forecasts and legacy contracts',()=>{
 const c={serviceBillingPolicy:dueMonthPolicy,startOn:'2027-01-01',serviceMonthly:'300'};
 const p=serviceBillingProjection(c,'2027-03-17');assert.deepEqual(p.due,[{dueOn:'2027-03-01',amount:'300',rateRevision:0,sourceKey:'service:2027-03-01',period:'2027-03'}]);
 assert.equal(p.forecast.length,12);assert.equal(p.forecast[0].dueOn,'2027-04-01');assert(p.forecast.every(r=>r.forecast&&!r.posted));
 assert.equal(serviceBillingProjection({...c,startOn:'2027-08-01'},'2027-03-17').due.length,0);
 assert.equal(serviceBillingProjection({...c,serviceMonthly:'0.000'},'2027-03-17').forecast.length,0);
 assert.equal(serviceBillingProjection({...c,serviceBillingPolicy:undefined},'2027-03-17').policy,'legacy');
 assert.equal(serviceBillingProjection(c,'2027-12-01').forecast[0].dueOn,'2028-01-01');
 const changed=serviceBillingProjection(c,'2027-03-17',[{amount:'350',effectiveOn:'2027-05-01',revision:1}]);assert.equal(changed.due[0].amount,'300');assert.equal(changed.forecast[0].amount,'300');assert.equal(changed.forecast[1].amount,'350');
});
test('new cash workflow activates only one current fee, retains forecasts, deduplicates concurrent months and stops when suspended',async()=>{
 const f=await personnelFixture();try{
  const root='/api/customers/'+f.client+'/vehicle-requests',r=await f.req('POST',root,{companyId:f.co1,vehicleType:'Bus',approximateValue:'10000',expectedFunding:'0',financeType:'cash',expectedMonthly:'0',totalObligation:'0',downPayment:'0',registrationMonthlyFee:'300',currency:'AED'}),path='/api/vehicle-requests/'+r.id;
  await f.req('POST',path+'/funding-decision',{decision:'approve',revision:1});
  const emirate=(await f.admin.query('select id from ab.emirates order by id limit 1')).rows[0].id,v=await f.register(r.id,{emirate,insuranceExpiresOn:'2030-01-01'});
  for(const kind of ['ownership','insurance','contract'])await f.file(v.id,kind);
  await f.req('POST','/api/vehicles/'+v.id+'/activate-registration',{revision:1,confirm:true});
  const current=today().slice(0,7)+'-01';
  await f.req('POST','/api/vehicles/'+v.id+'/contracts',{principal:'0',total:'0',months:1,startOn:'2026-03-01',serviceMonthly:'300',legalBasis:'Synthetic approved independent plate fee'});
  const before=await f.read(v.id);assert.equal(before.contract.serviceBillingPolicy,dueMonthPolicy);
  assert.equal(before.invoices.filter((x:any)=>x.kind==='service').length,1);assert.equal(before.invoices[0].dueOn,current);assert.equal(before.invoices[0].outstanding,'300.000');
  assert.equal(before.serviceProjection.forecast.length,12);
  const next=new Date(current+'T00:00:00Z');next.setUTCMonth(next.getUTCMonth()+1);const nextOn=next.toISOString().slice(0,10),cipher=security(f.secret.key);
  const fileId=await f.file(v.id,'contract'),amend={amount:'350',effectiveOn:nextOn,fileId,reason:'Synthetic signed prospective fee amendment',revision:0,confirmSignedAgreement:true};
  await f.req('POST','/api/vehicles/'+v.id+'/service-fee-amendments',{...amend,effectiveOn:current},422);
  await f.req('POST','/api/vehicles/'+v.id+'/service-fee-amendments',amend);
  await f.req('POST','/api/vehicles/'+v.id+'/service-fee-amendments',amend,409);
  const run=(date:string)=>transaction(f.runtime,f.org.tenant,f.org.user,(c:any)=>recurring(c,cipher,{tenant_id:f.org.tenant,user_id:f.org.user},f.co1,date));
  const result=await Promise.all([run(nextOn),run(nextOn)]);assert.equal(result.reduce((n,r)=>n+r.issued,0),1);
  const after=await f.read(v.id);assert.equal(after.invoices.filter((x:any)=>x.kind==='service').length,2);assert.equal(after.invoices.find((x:any)=>x.dueOn===nextOn).amount,'350.000');assert.equal(after.invoices.find((x:any)=>x.id===before.invoices[0].id).amount,before.invoices[0].amount);
  await f.admin.query("update ab.customers set status='Suspended' where id=$1",[f.client]);next.setUTCMonth(next.getUTCMonth()+1);
  assert.equal((await run(next.toISOString().slice(0,10))).issued,0);
 }finally{await f.close();}
});
