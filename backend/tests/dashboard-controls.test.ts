import {randomUUID} from "node:crypto";
import {security} from "../src/core.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import {ledgerFixture} from './ledger-fixture.js';
import {businessCentersFixture} from './business-centers-fixture.js';

test('Dashboard counts match original registers, distinguish denied/empty, and bank balances remain scoped',async()=>{
 const f=await businessCentersFixture();try{
 const b1=await f.bank(),b2=await f.bank(f.co2),before=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
 const all=await f.req('GET','/api/central-dashboard');assert.equal(all.counts.banks,2);assert(all.counts.customers>0);assert.equal(all.counts.companies,2);
 for(const [source,register]of [['companies','companies'],['banks','banks'],['customers','customers']]){const r=await f.req('GET','/api/central-dashboard?source='+source);assert.equal(r.sources[source].length,r.counts[source]);const original=await f.req('GET','/api/registers/'+register+'?limit=100');assert.equal(original.total,r.counts[source]);}
 const filtered=await f.req('GET','/api/central-dashboard?companyId='+f.co2+'&source=banks');assert.equal(filtered.counts.banks,1);assert.equal(filtered.sources.banks[0].id,b2.id);assert.equal(filtered.postedFinancial.banks.length,1);assert.equal(filtered.postedFinancial.banks[0].balance,'0.000');
 const employee=await f.employee();await f.login(employee.username,employee.password);let own=await f.req('GET','/api/central-dashboard');assert.equal(own.counts.banks,null);assert.equal(own.counts.customers,null);assert.equal(own.counts.companies,null);await f.req('GET','/api/central-dashboard?source=banks',undefined,403);
 await f.req('GET','/api/central-dashboard?asUserId='+f.org.user,undefined,403);
 await f.req('GET','/api/central-dashboard/vehicle-movements?asUserId='+f.org.user,undefined,403);
 await f.login();
 const preview=await f.req('GET','/api/central-dashboard?asUserId='+employee.id);
 assert.equal(preview.viewAs.readOnly,true);assert.equal(preview.actor.id,employee.id);
 assert.deepEqual(preview.postedFinancial.banks,[]);assert.equal(preview.counts.banks,null);
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

test('Explicit central preview delegation is bounded and read-only, including direct requests',async()=>{
 const f=await businessCentersFixture();try{
  const reviewer=await f.employee(),target=await f.employee(),outsider=await f.employee();
  await f.req('PATCH','/api/users/'+outsider.id,{revision:1,companyIds:[f.co2]});
  await f.req('PATCH','/api/users/'+target.id,{revision:1,companyIds:[f.co1,f.co2]});
  for(const companyId of [f.co1,f.co2])await f.req('POST','/api/users/'+target.id+'/grants',{action:'customer_view',scope:{type:'company',id:companyId},delegable:false});
  const directory='/api/central-dashboard/preview-targets',preview='/api/central-dashboard?asUserId=';
  const owner=await f.req('GET',directory);
  assert(owner.rows.some((u:any)=>u.id===outsider.id));
  const key='/api/central-dashboard/security',userId=reviewer.id;
  async function grant(previewCompanyIds:string[]){
   const before=await f.req('GET',key+'?userId='+userId);
   const body={userId,version:before.version,value:{...before.value,previewCompanyIds}};
   const {planHash}=await f.req('POST',key+'-plan',body);
   await f.req('POST',key+'-apply',{...body,planHash,confirm:true});
  }
  await f.login(reviewer.username,reviewer.password);
  await f.req('GET',directory,undefined,403);await f.req('GET',preview+target.id,undefined,403);
  await f.login();await grant([f.co1,f.co2]);
  await f.login(reviewer.username,reviewer.password);
  const {rows}=await f.req('GET',directory);
  assert.deepEqual(rows.map((u:any)=>u.id),[target.id]);
  const model=await f.req('GET',preview+target.id+'&source=customers');
  assert.equal(model.actor.id,target.id);assert.equal(model.viewAs.readOnly,true);
  assert(model.sources.customers.length>0);assert(model.sources.customers.every((r:any)=>r.companyId===f.co1));
  assert(model.companies.every((r:any)=>r.id===f.co1));
  await f.req('GET',preview+target.id+'&companyId='+f.co2,undefined,403);
  await f.req('GET',preview+outsider.id,undefined,403);
  await f.req('GET','/api/central-dashboard/vehicle-movements?asUserId='+target.id+'&companyId='+f.co2,undefined,403);
  await f.req('POST','/api/central-dashboard/preferences?asUserId='+target.id,{widgets:['tasks']},403);
  await f.req('POST','/api/central-dashboard/preferences',{widgets:['tasks']});
  await f.login();await grant([]);await f.login(reviewer.username,reviewer.password);
  await f.req('GET',preview+target.id,undefined,403);
 }finally{await f.close();}
});

test('Bank monitoring and direct deposit read enforce company and reader scope independently of confirmation',async()=>{
 const f=await businessCentersFixture();try{
  const reader=await f.employee(),outsider=await f.employee(),cipher=security(f.secret.key);
  async function deposit(companyId:string){
   const bank=await f.bank(companyId),proof=await f.proof(companyId),id=randomUUID();
   await f.admin.query(`insert into ab.finance_deposits(id,tenant_id,company_id,holder_id,bank_account_id,currency,
    amount,effective_on,document_version_id,payload_cipher,created_by)values($1,$2,$3,$4,$5,'AED',200,$6,$7,$8,$4)`,
    [id,f.org.tenant,companyId,f.org.user,bank.id,f.date,proof,cipher.seal({reference:'SYN-DASHBOARD-DEPOSIT'})]);
   return {id,bank};
  }
  const inScope=await deposit(f.co1),outOfScope=await deposit(f.co2),url='/api/ledger/deposits/';
  assert.equal((await f.req('GET',url+inScope.id)).canVerify,true);
  for(const action of ['bank_view','finance_view','ledger_view','ledger_audit'])
   await f.req('POST','/api/users/'+reader.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  await f.login(reader.username,reader.password);
  const board=await f.req('GET','/api/central-dashboard'),account=board.postedFinancial.banks.find((r:any)=>r.id===inScope.bank.id);
  assert.equal(account.deposits[0].id,inScope.id);
  assert(!board.postedFinancial.banks.some((r:any)=>r.id===outOfScope.bank.id));
  const record=await f.req('GET',url+inScope.id);
  assert.equal(record.reference,'SYN-DASHBOARD-DEPOSIT');assert.equal(record.amount,'200.000');assert.equal(record.canVerify,false);
  await f.req('GET',url+outOfScope.id,undefined,403);
  await f.req('POST',url+inScope.id+'/confirm',{confirmedAmount:'200',effectiveOn:f.date,bankConfirmation:'Synthetic',accountAndDateVerified:true},403);
  await f.login(outsider.username,outsider.password);await f.req('GET',url+inScope.id,undefined,403);
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
  assert.deepEqual(dashboard.overview.items.map((row:any)=>row.amount),['500.000','100.000']);
  assert.equal(dashboard.overview.debt[0].amount,'600.000');
  const financial=dashboard.overview.financial[0];
  assert.deepEqual([financial.amount,financial.due,financial.paid,financial.overdue,financial.outstanding],
    ['800.000','600.000','200.000','600.000','600.000']);
  const interval=await f.req('GET','/api/central-dashboard?companyId='+f.co1+'&from='+f.date+'&to='+f.date);
  assert.equal(interval.overview.financial[0].paid,'200.000');
  const empty=await f.req('GET','/api/central-dashboard?companyId='+f.co2);
  assert.equal(empty.counts.invoices,0);
  assert.deepEqual(empty.overview.financial,[]);
  assert.deepEqual(empty.overview.debt,[]);
  assert.deepEqual(empty.overview.items,[]);
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
  assert.deepEqual(restricted.overview.financial,[]);
  assert.deepEqual(restricted.overview.debt,[]);
 }finally{await f.close();}
});
