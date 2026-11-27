import test from 'node:test';
import assert from 'node:assert/strict';
import {businessCentersFixture} from './business-centers-fixture.js';
import {ledgerFixture} from './ledger-fixture.js';

test('Dashboard counts match original registers, distinguish denied/empty, and bank balances remain scoped',async()=>{
 const f=await businessCentersFixture();try{
 const b1=await f.bank(),b2=await f.bank(f.co2),before=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
 const all=await f.req('GET','/api/central-dashboard');assert.equal(all.counts.banks,2);assert(all.counts.customers>0);assert.equal(all.counts.companies,2);
 for(const [source,register]of [['companies','companies'],['banks','banks'],['customers','customers']]){const r=await f.req('GET','/api/central-dashboard?source='+source);assert.equal(r.sources[source].length,r.counts[source]);const original=await f.req('GET','/api/registers/'+register+'?limit=100');assert.equal(original.total,r.counts[source]);}
 const filtered=await f.req('GET','/api/central-dashboard?companyId='+f.co2+'&source=banks');assert.equal(filtered.counts.banks,1);assert.equal(filtered.sources.banks[0].id,b2.id);assert.equal(filtered.postedFinancial.banks.length,1);assert.equal(filtered.postedFinancial.banks[0].balance,'0.000');
 const employee=await f.employee();await f.login(employee.username,employee.password);let own=await f.req('GET','/api/central-dashboard');assert.equal(own.counts.banks,null);assert.equal(own.counts.customers,null);assert.equal(own.counts.companies,null);await f.req('GET','/api/central-dashboard?source=banks',undefined,403);await f.login();
 await f.req('POST','/api/users/'+employee.id+'/grants',{action:'bank_view',scope:{type:'company',id:f.co1},delegable:false});await f.req('POST','/api/users/'+employee.id+'/grants',{action:'customer_view',scope:{type:'company',id:f.co1},delegable:false});await f.login(employee.username,employee.password);own=await f.req('GET','/api/central-dashboard?source=banks');assert.equal(own.counts.banks,1);assert.equal(own.sources.banks[0].id,b1.id);assert(!own.sources.banks.some((r:any)=>r.id===b2.id));await f.req('GET','/api/central-dashboard?companyId='+f.co2+'&source=banks',undefined,403);await f.login();
 const empty=await f.req('GET','/api/central-dashboard?companyId='+f.co2+'&source=vehicles');assert.equal(empty.counts.vehicles,0);assert.deepEqual(empty.sources.vehicles,[]);
 assert.equal(before.length,0); // All changes above are explicit operations in this isolated fixture only.
 }finally{await f.close();}
});

test('Owner employee/role/unit appearance bounds never grant data rights and personal settings cannot widen them',async()=>{
 const f=await businessCentersFixture();try{
 const u=await f.employee(),before=(await f.admin.query('select * from ab.permission_grants order by id')).rows,roles=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
 const target='userId='+u.id,current=await f.req('GET','/api/central-dashboard/preferences?'+target),body={userId:u.id,widgets:['banks','tasks'],sections:{charts:false,alerts:false},confirm:true,version:current.version};
 await f.req('POST','/api/central-dashboard/preferences',{...body,confirm:undefined},422);await f.req('POST','/api/central-dashboard/preferences',body);await f.req('POST','/api/central-dashboard/preferences',body,409);
 const role=await f.req('GET','/api/central-dashboard/preferences?roleId=employee');await f.req('POST','/api/central-dashboard/preferences',{roleId:'employee',widgets:['tasks'],confirm:true,version:role.version});
 await f.login(u.username,u.password);await f.req('GET','/api/central-dashboard/layout-targets',undefined,403);await f.req('GET','/api/central-dashboard/preferences?'+target,undefined,403);await f.req('POST','/api/central-dashboard/preferences',{widgets:['banks','customers','tasks'],sections:{charts:true,alerts:true}});
 const effective=await f.req('GET','/api/central-dashboard/preferences');assert.deepEqual(effective.widgets,['tasks']);assert.equal(effective.sections.charts,false);assert.equal(effective.sections.alerts,false);assert.equal(effective.changesAccessRights,false);
 const own=await f.req('GET','/api/central-dashboard');assert.equal(own.counts.banks,null);assert.equal(own.layout.sections.charts,false);await f.req('GET','/api/central-dashboard?source=banks',undefined,403);
 assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,roles);
 }finally{await f.close();}
});

test('Dashboard ranks actual outstanding items and opens only a pending deposit in the authorized account',async()=>{
 const f=await ledgerFixture();
 try{
  const bank=await f.bank(),otherBank=await f.bank(f.co2);
  await f.bill('300');await f.bill('500',f.items.salik);
  await f.collection('200');
  const deposit=await f.req('POST','/api/ledger/deposits',{companyId:f.co1,bankAccountId:bank.id,currency:'AED',amount:'100',effectiveOn:f.date,documentVersionId:await f.proof(),reference:'Synthetic pending deposit'});
  const dashboard=await f.req('GET','/api/central-dashboard?companyId='+f.co1);
  assert.deepEqual(dashboard.ageing.items.map((row:any)=>row.amount),['500.000','100.000']);
  assert.equal(dashboard.ageing.debtors[0].amount,'600.000');
  const financial=dashboard.overview.financial[0];
  assert.deepEqual([financial.invoiced,financial.due,financial.collected,financial.overdue,financial.outstanding],
    ['800.000','600.000','200.000','600.000','600.000']);
  const interval=await f.req('GET','/api/central-dashboard?companyId='+f.co1+'&from='+f.date+'&to='+f.date);
  assert.equal(interval.overview.performance.rows[0].collection,25);
  assert.equal(interval.overview.financial[0].overdue,'0.000');
  const empty=await f.req('GET','/api/central-dashboard?companyId='+f.co2);
  assert.equal(empty.counts.invoices,0);
  assert.deepEqual([empty.overview.financial[0].invoiced,empty.overview.financial[0].due,empty.overview.financial[0].outstanding],
    ['0.000','0.000','0.000']);
  assert.deepEqual(empty.ageing,{debtors:[],items:[]});
  const movement=await f.req('GET','/api/central-dashboard/vehicle-movements?months=36&companyId='+f.co2);
  assert.equal(movement.months.length,36);
  assert(movement.months.every((row:any)=>row.in===0&&row.out===0));

  assert.equal(dashboard.postedFinancial.banks.find((row:any)=>row.id===bank.id).canViewDeposits,true);
  const path='/api/central-dashboard/banks/'+bank.id+'/deposits';
  assert.deepEqual((await f.req('GET',path)).rows.map((row:any)=>row.id),[deposit.id]);
  assert.equal((await f.req('GET',path+'?depositId='+deposit.id)).detail.reference,'Synthetic pending deposit');
  await f.req('GET','/api/central-dashboard/banks/'+otherBank.id+'/deposits?depositId='+deposit.id,undefined,404);
  const employee=await f.employee();
  await f.login(employee.username,employee.password);
  await f.req('GET',path,undefined,403);
  const restricted=await f.req('GET','/api/central-dashboard');
  assert.equal(restricted.overview.financial,null);
  assert.equal(restricted.ageing,null);
 }finally{await f.close();}
});
