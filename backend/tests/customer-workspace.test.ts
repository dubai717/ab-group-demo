import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID}from'node:crypto';import {businessCentersFixture}from'./business-centers-fixture.js';import {security}from'../src/core.js';
test('customer workspace counts actual vehicles, distinct multi-company people, finance source totals and readonly provenance',async()=>{const f=await businessCentersFixture();try{
 const before=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
 const client=await f.req('POST','/api/customers',{profile:{companyId:f.co1,fullName:'Workspace multi company',type:'driver',status:'Suspended',residencyCompanyId:f.co2}});
 const request=await f.request({financeType:'cash',companyId:f.co2});const vehicle=await f.register(request.id,{registeredOn:'2026-01-01'});await f.request();
 const summary=await f.req('GET','/api/customers/register-summary');assert.equal(summary.customers.total,3);assert.equal(summary.customers.totals.Active,2);assert.equal(summary.customers.totals.Pending,1);assert.equal(summary.customers.cells.Pending[f.co1],1);assert.equal(summary.customers.cells.Pending[f.co2],1);const vehicleSummary=await f.req('GET','/api/vehicles/register-summary');assert.equal(vehicleSummary.total,1);assert.equal(vehicleSummary.cells.Pending.cash+vehicleSummary.cells.Active.cash,1);
 for(const co of summary.companies)assert(summary.customers.cells.Active[co.id]===undefined||summary.customers.cells.Active[co.id]>=0);
 const registry=(kind:string,filters:object,paging='')=>f.req('GET','/api/registers/'+kind+'?query='+encodeURIComponent(JSON.stringify({summaryView:'1',...filters}))+paging);
 const cross=await registry('customers',{summaryCompany:f.co2,summaryStatus:'Pending'});
 assert.equal(cross.total,summary.customers.cells.Pending[f.co2]);assert.equal(cross.rows[0].id,client.id);
 const page1=await registry('customers',{},'&limit=1'),page2=await registry('customers',{},'&limit=1&offset=1');
 assert.equal(page1.total,summary.customers.total);assert.equal(page2.total,page1.total);
 assert.notEqual(page1.rows[0].id,page2.rows[0].id);
 assert.equal((await registry('customers',{},'&seek='+page1.rows[0].id)).navigation.next,page2.rows[0].id);
 assert.equal((await registry('vehicles',{summaryFinance:'cash'})).total,vehicleSummary.total);
 assert.equal((await registry('vehicles',{summaryFinance:'bank'})).total,0);
 const bill=await f.bill('100',f.items.salik),future=await f.bill('50',f.items.salik,{dueOn:'2099-01-05'});await f.collection('25',{items:[{itemId:f.items.salik,amount:'25'}]});await f.req('POST','/api/ledger/invoices/'+bill.id+'/correct',{amount:'10',effectiveOn:'2026-01-05',reason:'Approved synthetic discount'});
 const journals=Number((await f.admin.query('select count(*) n from ab.finance_journals')).rows[0].n),invoices=Number((await f.admin.query('select count(*) n from ab.vehicle_invoices')).rows[0].n);
 const o=await f.req('GET','/api/customers/'+f.client+'/overview'),money=o.financials.find((x:any)=>x.companyId===f.co1);assert.equal(o.vehicles[0].id,vehicle.id);assert.equal(o.vehicles[0].companyId,f.co2);assert.equal(o.rating.total,null);assert.equal(money.invoiced,'150.000');assert.equal(money.receipts,'25.000');assert.equal(money.discounts,'10.000');assert.equal(money.remaining,'115.000');assert.equal(money.overdue,'65.000');assert.equal(money.future,'50.000');assert.equal(Number(money.overdue)+Number(money.dueToday)+Number(money.future),Number(money.remaining));
 assert.equal(Number((await f.admin.query('select count(*) n from ab.finance_journals')).rows[0].n),journals);assert.equal(Number((await f.admin.query('select count(*) n from ab.vehicle_invoices')).rows[0].n),invoices);assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,before);
 const added=await f.req('POST','/api/companies',{arabicName:'شركة اختبار إضافية',englishName:'Dynamic summary company',tradeLicenseNumber:'DYNAMIC-'+randomUUID(),status:'Active'});const refreshed=await f.req('GET','/api/customers/register-summary');assert(refreshed.companies.some((x:any)=>x.id===added.id));assert.equal(refreshed.customers.total,summary.customers.total);
 const register=await f.req('GET','/api/registers/customers');assert.equal(register.rows.find((r:any)=>r.id===f.client).vehicles,1);assert.equal(register.rows.find((r:any)=>r.id===f.client).remaining,'115.000');assert(register.rows.find((r:any)=>r.id===client.id).companyNamesEn.includes(' · '));assert(future.id);
 await f.admin.query(`insert into ab.customers(id,tenant_id,company_id,file_number,type,status,payload_cipher,created_by)
  select gen_random_uuid(),tenant_id,company_id,10000+i,type,'Active',payload_cipher,created_by
  from ab.customers cross join generate_series(1,51) i where id=$1`,[f.client]);
 const refreshedPage1=await registry('customers',{summaryCompany:f.co1,summaryStatus:'Active'},'&limit=50');
 const refreshedPage2=await registry('customers',{summaryCompany:f.co1,summaryStatus:'Active'},'&limit=50&offset=50');
 const refreshedSummary=await f.req('GET','/api/customers/register-summary');
 assert.equal(refreshedPage1.total,refreshedSummary.customers.cells.Active[f.co1]);
 assert.equal(refreshedPage1.rows.length,50);assert(refreshedPage2.rows.length>0);
 assert.equal(new Set([...refreshedPage1.rows,...refreshedPage2.rows].map((row:any)=>row.id)).size,refreshedPage1.total);
}finally{await f.close();}});
test('official identities normalize formatting, passport country distinguishes people, potential-match review is audited, and custody retains history',async()=>{const f=await businessCentersFixture();try{
 const profile=(x:any)=>({companyId:f.co1,fullName:'Workspace '+randomUUID(),type:'owner',status:'Active',...x});
 const a=await f.req('POST','/api/customers',{profile:profile({identityDocuments:[{kind:'emiratesId',number:'784-1990-1234567-1'}]})});await f.req('POST','/api/customers',{profile:profile({identityDocuments:[{kind:'emiratesId',number:'784199012345671'}]}),duplicateReview:'Cannot override a confirmed identifier'},409);
 await f.req('POST','/api/customers',{profile:profile({identityDocuments:[{kind:'emiratesId',number:'٧٨٤-١٩٩٠-١٢٣٤٥٦٧-١'}]})},409);
 const pass={kind:'passport',number:'COUNTRY123',issuerCountry:'PK'};await f.req('POST','/api/customers',{profile:profile({identityDocuments:[pass]})});await f.req('POST','/api/customers',{profile:profile({identityDocuments:[{...pass,issuerCountry:'IN'}]})});await f.req('POST','/api/customers',{profile:profile({identityDocuments:[pass]})},409);
 const phone=[{id:'one',number:'+971501234567',primary:true,status:'valid'}];await f.req('POST','/api/customers',{profile:profile({phones:phone})});await f.req('POST','/api/customers',{profile:profile({phones:phone})},409);const reviewed=await f.req('POST','/api/customers',{profile:profile({phones:phone}),duplicateReview:'Verified different family member sharing this number'});const history=await f.req('GET','/api/customers/'+reviewed.id+'/audit');assert(history[0].after.duplicateReview);
 await f.req('POST','/api/customers',{profile:profile({identityDocuments:[{...pass,issuerCountry:'ZZ'}]})},409);
 const file=await f.req('POST','/api/customers/'+a.id+'/files',{name:'verified-identity.pdf',title:'Synthetic identity verification',kind:'emiratesId',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 Synthetic identity verification').toString('base64'),documentNumber:'784199012345671'});const record=await f.req('GET','/api/customers/'+a.id);assert(!record.identityDocuments[0].verifiedVersionId);const {id:rid,fileNumber,revision,completeness,rating,alerts,templates,timeline,financials,facilityBalances,vehicles,integrationPending,addressHistory,...plain}=record;await f.req('PATCH','/api/customers/'+a.id,{profile:{...plain,identityDocuments:[{...plain.identityDocuments[0],verifiedVersionId:file.id}]},revision},422);await f.req('POST','/api/customers/'+a.id+'/document-verification',{kind:'emiratesId',fileId:file.id,reason:'Human compared document and identity number',revision});assert.equal((await f.req('GET','/api/customers/'+a.id)).identityDocuments[0].verifiedVersionId,file.id);assert((await f.req('GET','/api/customers/'+a.id+'/audit')).some((e:any)=>e.kind==='document_verified'&&e.after.reason));assert.equal((await f.req('POST','/api/customers/duplicates?excludeId='+a.id,plain)).official,false);
 const key=randomUUID(),movement={holder:'company',occurredOn:'2026-01-01',reason:'Synthetic signed receipt',previousEventId:null,clientKey:key};const first=await f.req('POST','/api/customers/'+a.id+'/passport-custody',movement,200,key);assert.equal((await f.req('POST','/api/customers/'+a.id+'/passport-custody',movement,200,key)).id,first.id);await f.req('POST','/api/customers/'+a.id+'/passport-custody',{holder:'customer',occurredOn:'2026-02-01',reason:'Signed return',previousEventId:first.id,clientKey:randomUUID()});const o=await f.req('GET','/api/customers/'+a.id+'/overview');assert.equal(o.custody.current,'customer');assert.equal(o.custody.history.length,2);assert(o.custody.history.every((r:any)=>r.actorNameEn));
 const user=await f.employee();await f.req('POST','/api/users/'+user.id+'/grants',{action:'customer_view',scope:{type:'company',id:f.co1},delegable:false});await f.login(user.username,user.password);const own=await f.req('GET','/api/customers/'+a.id+'/overview');assert.equal(own.financials,null);await f.req('GET','/api/customers/'+a.id+'/statement',undefined,403);await f.req('GET','/api/customers/'+f.client2+'/overview',undefined,403);await f.req('GET','/api/registers/customers?query='+encodeURIComponent(JSON.stringify({summaryView:'1',summaryCompany:f.co2})),undefined,403);assert.equal(await f.req('GET','/api/vehicles/register-summary'),null);assert.equal(own.custody.history.length,0);await f.req('POST','/api/customers/'+a.id+'/passport-custody',{...movement,clientKey:randomUUID()},403);assert.equal((await f.req('GET','/api/customers/register-summary')).companies.length,1);
}finally{await f.close();}});

test('customer save returns field errors and a safe trace, accepts optional documents, and replays a committed creation once',async()=>{const f=await businessCentersFixture();try{const p={companyId:f.co1,fullName:'Save recovery '+randomUUID(),type:'owner',status:'Prospect'};const invalid=await f.req('POST','/api/customers',{profile:{...p,identityDocuments:[{kind:'emiratesId',number:'invalid'}]}},422);assert.equal(invalid.fieldErrors['emiratesId-number'],'invalidId');assert(invalid.reference);await f.req('POST','/api/customers',{profile:{...p,identityDocuments:[{kind:'emiratesId',number:'invalid'}]},preserveLegacyIdentifiers:true},422);const missing=await f.req('POST','/api/customers',{profile:{...p,fullName:''}},422);assert.equal(missing.fieldErrors.fullName,'required');const key=randomUUID(),body={profile:p},[a,b]=await Promise.all([f.req('POST','/api/customers',body,200,key),f.req('POST','/api/customers',body,200,key)]);assert.equal(a.id,b.id);assert.equal(a.fileNumber,b.fileNumber);const attachmentError=await f.req('POST','/api/customers/'+a.id+'/files',{},422);assert(attachmentError.reference);const rows=await f.req('GET','/api/customers?q='+encodeURIComponent(p.fullName));assert.equal(rows.rows.length,1);assert.equal((await f.req('GET','/api/customers/'+a.id)).identityDocuments.length,0);}finally{await f.close();}});

test('residence summary uses explicit document companies, Dubai dates, and scoped categories',async()=>{
 const f=await businessCentersFixture();try{
  const create=(status:string,company:string|null,dates:string[])=>f.req('POST','/api/customers',{profile:{
   companyId:f.co1,fullName:'Synthetic residency '+randomUUID(),status,residencyCompanyId:company,
   identityDocuments:dates.map((expiresOn,i)=>({kind:'residence',number:'SYN'+i,expiresOn}))
  }});
  await create('Prospect',f.co2,['2099-01-01','2099-02-01']);
  await create('Suspended',f.co1,['2020-01-01']);
  await create('Active',f.co1,['']);
  await create('Active',null,['2099-01-01']);
  const attached=await create('Active',null,[]);
  await f.req('POST','/api/customers/'+attached.id+'/files',{kind:'visa',residenceCompanyId:f.co2,
   expiresOn:'2099-02-01',title:'Synthetic visa',name:'visa.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 '+randomUUID()).toString('base64')});
  const employee=await f.req('POST','/api/personnel/employees',{companyId:f.co1,nameAr:'موظف اصطناعي',nameEn:'Synthetic employee',jobTitle:'Test',hiredOn:'2026-01-01'});
  const ep='/api/personnel/employees/'+employee.id+'/documents';
  for(const [kind,expiresOn,residenceCompanyId] of [['residence','2099-01-01',f.co2],['visa','2099-01-01',f.co2],['residence','2099-01-01',undefined]]){
   const r=await f.req('POST',ep,{kind,expiresOn,residenceCompanyId,title:'Synthetic permit',name:'test.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 '+randomUUID()).toString('base64')});
   await f.req('POST',ep+'/'+r.versionId+'/review',{approve:true,reason:'Synthetic recorded source'});
  }
  const empty=await f.req('POST','/api/companies',{arabicName:'شركة دون سجلات',englishName:'Empty synthetic company',tradeLicenseNumber:randomUUID(),status:'Active'});
  const url='/api/customers/register-summary',s=await f.req('GET',url);
  assert.equal(s.customers.totals.Prospect,1);assert.equal(s.customers.totals.Pending,1);
  assert.equal(s.customers.cells.Prospect[f.co1],1);assert.equal(s.customers.cells.Prospect[f.co2],1);
  for(const row of Object.values(s.customers.cells) as Record<string,number>[])assert.equal(row[empty.id],0);
  assert.deepEqual(s.residences.totals,{customers:2,employees:1});
  assert.equal(s.residences.cells.customers[f.co2],2);assert.equal(s.residences.cells.employees[f.co1],0);
  assert.equal(s.residences.cells.employees[f.co2],1);assert.equal(s.residences.cells.employees[empty.id],0);
  assert.equal(s.pendingResidenceCustomers,0);
  const reader=await f.employee();
  for(const action of ['customer_view','vehicle_view'])await f.req('POST','/api/users/'+reader.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  await f.login(reader.username,reader.password);
  const scoped=await f.req('GET',url);
  assert.deepEqual(scoped.companies.map((row:any)=>row.id),[f.co1]);
  assert.deepEqual(scoped.residences.totals,{customers:0,employees:0});
  assert.equal(scoped.pendingResidenceCustomers,0);
  await f.req('POST','/api/customer-preferences',{columns:['status','fullName','fileNumber'],filters:{},scroll:0});
  assert.deepEqual((await f.req('GET','/api/customer-preferences')).columns,['fileNumber','status','fullName']);
 }finally{await f.close();}
});

test('residence follow-up counts distinct scoped customers until their last applicable request closes',async()=>{
 const f=await businessCentersFixture();try{
  const summary=async()=>(await f.req('GET','/api/customers/register-summary')).pendingResidenceCustomers;
  const create=(customerId:string,companyId:string,transactionType:string)=>f.req('POST','/api/customers/'+customerId+'/requests',{
   clientKey:randomUUID(),type:'residence',companyId,transactionType,subject:'Synthetic residence follow-up'
  });
  const request=(customerId:string,id:string)=>'/api/customers/'+customerId+'/requests/'+id;
  const update=(url:string,state:string,revision:number)=>f.req('POST',url+'/status',{state,revision,comment:'Synthetic status change'});
  assert.equal(await summary(),0);
  await create(f.client!,f.co1,'renewal');assert.equal(await summary(),0);
  const issue=request(f.client!,(await create(f.client!,f.co1,'new')).id);
  const amend=request(f.client!,(await create(f.client!,f.co1,'amendment')).id);
  const cancel=request(f.client2!,(await create(f.client2!,f.co2,'cancellation')).id);
  assert.equal(await summary(),2);
  const reader=await f.employee();
  await f.req('POST','/api/users/'+reader.id+'/grants',{action:'customer_view',scope:{type:'company',id:f.co1},delegable:false});
  await f.login(reader.username,reader.password);assert.equal(await summary(),1);
  await f.login();await update(issue,'Cancelled',0);assert.equal(await summary(),2);
  await update(amend,'Submitted',0);
  await f.req('POST',amend+'/approval',{decision:'Approved',comment:'Synthetic approval',revision:2});
  await update(amend,'Completed',2);
  assert.equal(await summary(),2);
  await update(amend,'Closed',3);assert.equal(await summary(),1);
  await f.login(reader.username,reader.password);assert.equal(await summary(),0);
  await f.login();await update(cancel,'Cancelled',0);assert.equal(await summary(),0);
 }finally{await f.close();}
});
