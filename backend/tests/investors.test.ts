import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {personnelFixture} from './personnel-fixture.js';

test('Investor portal isolates identities, commitments and actual funds with immutable financing terms',async t=>{
 const f=await personnelFixture();try{
  await f.admin.query(await readFile('supabase/additive/017_investors.sql','utf8'));
  const u=await f.employee('investor'),v=await f.employee('investor'),proof=await f.proof();
  const profile=await f.req('POST','/api/investors/profiles',{userId:u.id,nameAr:'مستثمر اختبار',nameEn:'Synthetic investor',companyId:f.co1});
  const a=await f.req('POST','/api/investors/agreements',{companyId:f.co1,investorId:profile.id,mode:'committed',currency:'AED',pledged:'1000',registrationBps:1000,serviceBps:2000,feeBasis:'collected_gross',legalBasis:'Synthetic signed agreement',documentVersionId:proof});
  const r=await f.request({financeType:'investor',investorId:u.id,expectedFunding:'100'}),funding=await f.req('POST','/api/investors/agreements/'+a.id+'/funding-requests',{requestId:r.id});
  await t.test('commitment is not cash and no authentication accounts are duplicated',async()=>{
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.pledged,'1000.000');assert.equal(view.capital.received,'0.000');assert.equal(view.capital.unused,'0.000');assert.equal(view.entitlement.available,'0.000');
  });
  await f.login(u.username,u.password);
  await t.test('investor uses actual existing login and sees only own agreement without customer PII',async()=>{
   const list=await f.req('GET','/api/investors');assert.equal(list.rows.length,1);assert.equal(list.rows[0].canManage,false);
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.financings.length,1);assert.equal(JSON.stringify(view).includes('Fictional vehicle customer'),false);assert.equal(view.financings[0].customerId,undefined);
   await f.req('POST','/api/investors/agreements/'+a.id+'/terms',{pledged:'99999',registrationBps:10000,serviceBps:10000,legalBasis:'Not permitted',revision:1},404);
  });
  await t.test('acceptance does not increase cash and cannot be executed twice',async()=>{
   const response=await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:true,reason:'Synthetic promise, not transfer'});assert.equal(response.cashIncreased,false);
   await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:true,reason:'Duplicate'},409);
  });
  await t.test('investor change requests have no automatic accounting or status effect',async()=>{
   const before=await f.req('GET','/api/investors/agreements/'+a.id);const change=await f.req('POST','/api/investors/agreements/'+a.id+'/requests',{kind:'capital_increase',amount:'200',reason:'Synthetic request only'});assert.equal(change.financialEffect,false);assert.equal(change.newCapitalRecorded,false);const after=await f.req('GET','/api/investors/agreements/'+a.id);assert.deepEqual(after.capital,before.capital);assert.equal(after.state,before.state);await f.req('POST','/api/investors/agreements/'+a.id+'/requests',{kind:'termination',amount:'1',reason:'Invalid termination amount'},422);
  });
  await f.login(v.username,v.password);
  await t.test('another investor cannot view the agreement or respond',async()=>{
   assert.equal((await f.req('GET','/api/investors')).rows.length,0);await f.req('GET','/api/investors/agreements/'+a.id,undefined,404);await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:false,reason:'Not mine'},404);
  });
  await f.login();
  await t.test('PostgreSQL RLS itself limits investor reads and prevents snapshot rewriting',async()=>{
   const {transaction}=await import('../src/core.js');
   const own=await transaction(f.runtime,f.org.tenant,u.id,async c=>(await c.query('select id from ab.investor_agreements')).rows);assert.deepEqual(own.map((r:any)=>r.id),[a.id]);
   const other=await transaction(f.runtime,f.org.tenant,v.id,async c=>(await c.query('select id from ab.investor_agreements')).rows);assert.equal(other.length,0);
   await assert.rejects(transaction(f.runtime,f.org.tenant,u.id,async c=>c.query("update ab.investor_funding_requests set terms_cipher='tampered'where id=$1",[funding.id])),(e:any)=>e.code==='23514');
   await assert.rejects(transaction(f.runtime,f.org.tenant,u.id,async c=>c.query("update ab.investor_funding_requests set response_cipher='rewritten'where id=$1",[funding.id])),(e:any)=>e.code==='42501');
  });
  await t.test('management-only ratings use verified response events and owner versioned criteria',async()=>{
   assert.equal((await f.req('GET','/api/investors/agreements/'+a.id+'/rating')).available,false);const options=await f.req('GET','/api/investors/agreements/'+a.id+'/options');assert.equal(options.canConfigure,true);assert.ok(options.charts.length>0);const notifications=(await f.req('GET','/api/notifications')).rows;assert.ok(notifications.some((x:any)=>x.action==='investor:change_request'));
   const criteria=[{metric:'acceptance_percent',weight:10000,minimumSamples:1,target:'100',direction:'higher'}];
   await f.req('POST','/api/investor-rating-policy',{mode:'committed',currency:'AED',criteria});
   const rated=await f.req('GET','/api/investors/agreements/'+a.id+'/rating');assert.equal(rated.available,true);assert.equal(rated.score,10000);assert.equal(rated.policyVersion,1);
   await f.req('POST','/api/investor-rating-policy',{mode:'committed',currency:'AED',criteria:[{...criteria[0],minimumSamples:2}]});assert.equal((await f.req('GET','/api/investors/agreements/'+a.id+'/rating')).score,null);
   assert.equal((await f.admin.query("select count(*)::int n from ab.settings where key like 'investor-rating:committed:AED:version:%'")).rows[0].n,2);
   await f.login(u.username,u.password);await f.req('GET','/api/investors/agreements/'+a.id+'/rating',undefined,403);assert.equal((await f.req('GET','/api/investors/agreements/'+a.id)).rating,undefined);await f.login();
  });
  await t.test('new terms never change prior funding snapshot',async()=>{
   await f.req('POST','/api/investors/agreements/'+a.id+'/terms',{pledged:'1200',registrationBps:3000,serviceBps:4000,legalBasis:'Synthetic future terms',revision:1});
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.financings[0].termsSnapshot.registrationBps,1000);assert.equal(view.financings[0].termsSnapshot.serviceBps,2000);
  });
  await t.test('unreceived commitments cannot finance actual disbursements or withdrawals',async()=>{
   await f.req('POST','/api/vehicle-requests/'+r.id+'/funding-decision',{approve:true,reason:'Synthetic source approval',revision:1});
   await f.req('POST','/api/vehicle-requests/'+r.id+'/disburse',{receiverId:f.org.user,method:'cash',source:'Synthetic',date:'2026-01-01',evidence:'Not actual funds'},409);
   await f.req('POST','/api/investors/agreements/'+a.id+'/payouts',{kind:'capital_refund',amount:'100',issuedOn:'2026-01-01',reason:'Cannot spend commitment'},409);
   assert.equal((await f.admin.query('select count(*)::int n from ab.vehicle_funds')).rows[0].n,0);
   assert.equal((await f.admin.query('select count(*)::int n from ab.finance_vouchers')).rows[0].n,0);
  });
 }finally{await f.close();}
});

test('Investor capital refunds and return payouts use independent canonical liabilities and source-linked vouchers',async t=>{
 const f=await personnelFixture();try{
  await f.admin.query(await readFile('supabase/additive/017_investors.sql','utf8'));
  const u=await f.employee('investor'),proof=await f.proof(),bank=await f.bank(),profile=await f.req('POST','/api/investors/profiles',{userId:u.id,nameAr:'مستثمر محاسبي',nameEn:'Synthetic accounting investor',companyId:f.co1});
  const a=await f.req('POST','/api/investors/agreements',{companyId:f.co1,investorId:profile.id,mode:'prefunded',currency:'AED',pledged:'0',registrationBps:1000,serviceBps:2000,feeBasis:'collected_gross',principalRecoveryMethod:'principal_first',yieldBps:5000,capitalReturnFrom:'2026-01-01',returnsDueFrom:'2026-01-01',legalBasis:'Synthetic explicit capital and returns rules',documentVersionId:proof});
  const createAccount=async(code:string)=>{const r=await f.req('POST','/api/ledger/accounts',{code,nameAr:'التزام مستثمر وهمي',nameEn:'Synthetic investor liability',kind:'liability',companyIds:[f.co1],currency:'AED'});return r.charts[0].id;};
  const capital=await createAccount('investor-capital'),returns=await createAccount('investor-returns');
  await t.test('account mappings must be separate and explicitly selected',async()=>{
   const cfg={capitalChartId:capital,returnsChartId:capital,returnsCounterpartChartId:f.accounts.expense.charts[f.co1],capitalItemId:f.items.loan,returnsItemId:f.items.commission,accountingBasis:'Synthetic owner-approved liability separation',revision:1};
   await f.req('POST','/api/investors/agreements/'+a.id+'/accounting',cfg,422);
   await f.req('POST','/api/investors/agreements/'+a.id+'/accounting',{...cfg,returnsChartId:returns});
  });
  const contribution=await f.req('POST','/api/finance/operations',{companyId:f.co1,kind:'receipt',bankAccountId:bank.id,amount:'1000',currency:'AED',effectiveOn:'2026-01-01',reason:'Synthetic received capital',reference:crypto.randomUUID(),counterpartId:capital,documentVersionId:proof,integrationRefs:{investorAgreementId:a.id}});
  await t.test('draft contribution cannot be treated as received capital',async()=>{await f.req('POST','/api/investors/agreements/'+a.id+'/capital',{operationId:contribution.id},422);});
  await f.req('POST','/api/finance/operations/'+contribution.id+'/approve',{revision:1});
  await f.req('POST','/api/investors/agreements/'+a.id+'/capital',{operationId:contribution.id});
  let voucher='';
  await t.test('capital refund links original receipt and reserves only capital, without posting an expense',async()=>{
   const before=(await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n;
   const r=await f.req('POST','/api/investors/agreements/'+a.id+'/payouts',{kind:'capital_refund',capitalSource:'unused',amount:'100',sourceCapitalOperationId:contribution.id,issuedOn:'2026-01-01',reason:'Synthetic return of uninvested principal'});voucher=r.voucherId;assert.equal(r.paid,false);
   const row=(await f.admin.query('select * from ab.finance_vouchers where id=$1',[voucher])).rows[0],{security}=await import('../src/core.js'),payload=security(f.secret.key).open(row.payload_cipher);
   assert.equal(payload.alreadyAccrued,true);assert.equal(payload.payableOverrideId,capital);assert.equal(payload.investorPayoutKind,'capital_refund');
   assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,before);
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.received,'1000.000');assert.equal(view.capital.refunded,'0.000');assert.equal(view.capital.refundReserved,'100.000');assert.equal(view.capital.eligibleRefund,'900.000');assert.equal(view.entitlement.available,'0.000');
  });
  await t.test('missing original source, fee/principal mixing and excess amounts fail',async()=>{
   const url='/api/investors/agreements/'+a.id+'/payouts';
   await f.req('POST',url,{kind:'capital_refund',amount:'10',issuedOn:'2026-01-01',reason:'No source'},422);
   await f.req('POST',url,{kind:'capital_refund',capitalSource:'unused',amount:'901',sourceCapitalOperationId:contribution.id,issuedOn:'2026-01-01',reason:'Excess refund'},409);
   await f.req('POST',url,{kind:'returns_payout',amount:'10',issuedOn:'2026-01-01',reason:'Capital is not a fee entitlement'},409);
  });
  await t.test('cancelled pending voucher releases reservation via the original cancellation workflow',async()=>{
   await f.req('POST','/api/ledger/vouchers/'+voucher+'/cancel',{reason:'Synthetic cancellation',effectiveOn:'2026-01-01'});
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.refundReserved,'0.000');assert.equal(view.capital.eligibleRefund,'1000.000');
  });
  await t.test('actual collected principal and returns produce independent approved cheques and only bank-cleared amounts become paid',async()=>{
   const req=await f.request({financeType:'investor',investorId:u.id,expectedFunding:'100'}),funding=await f.req('POST','/api/investors/agreements/'+a.id+'/funding-requests',{requestId:req.id});await f.login(u.username,u.password);await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:true,reason:'Synthetic explicit acceptance'});await f.login();
   const operation=async(kind:string,amount:string,counterpartId:string,refs:any={})=>{const op=await f.req('POST','/api/finance/operations',{companyId:f.co1,kind,bankAccountId:bank.id,amount,currency:'AED',effectiveOn:'2026-01-05',reason:'Synthetic verified financial operation',reference:crypto.randomUUID(),counterpartId,documentVersionId:proof,integrationRefs:refs});await f.req('POST','/api/finance/operations/'+op.id+'/approve',{revision:1});return op.id;};
   const payment=await operation('payment','100',f.accounts.ar.charts[f.co1],{investorAgreementId:a.id});await f.req('POST','/api/vehicle-requests/'+req.id+'/funding-decision',{approve:true,reason:'Synthetic source approval',revision:1});const funds=await f.req('POST','/api/vehicle-requests/'+req.id+'/disburse',{receiverId:f.org.user,method:'transfer',paymentOperationId:payment,source:'Synthetic investor funded bank payment',date:'2026-01-05',evidence:'Synthetic existing posted payment'});await f.req('POST','/api/vehicle-funds/'+funds.id+'/receive',{confirm:true});const vehicle=await f.register(req.id);await f.contract(vehicle.id);
   const {V}=await import('../src/vehicle-domain.js'),principalReceipt=await operation('receipt','100',f.accounts.ar.charts[f.co1],{clientReference:f.client,vehicleReference:vehicle.id});let remaining=V.units('100');for(const i of (await f.read(vehicle.id)).invoices.filter((i:any)=>i.kind==='finance')){const amount=V.units(i.amount)<remaining?V.units(i.amount):remaining;if(amount>0n){await f.req('POST','/api/vehicles/'+vehicle.id+'/allocate',{invoiceId:i.id,operationId:principalReceipt,amount:V.money(amount)});remaining-=amount;}}
   const revenueReceipt=await operation('receipt','20',f.accounts.income.charts[f.co1],{clientReference:f.client,vehicleReference:vehicle.id}),bills=(await f.read(vehicle.id)).invoices;for(const i of bills.filter((i:any)=>i.kind==='finance'&&V.units(i.legalOutstanding)>0n))await f.req('POST','/api/vehicles/'+vehicle.id+'/allocate',{invoiceId:i.id,operationId:revenueReceipt,amount:i.legalOutstanding});const service=bills.find((i:any)=>i.kind==='service');await f.req('POST','/api/vehicles/'+vehicle.id+'/allocate',{invoiceId:service.id,operationId:revenueReceipt,amount:'10'});
   let view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.financings[0].capitalCollected,'100.000');assert.equal(view.financings[0].capitalAvailable,'100.000');assert.equal(view.entitlement.available,'7.000');
   const capitalVoucher=await f.req('POST','/api/investors/agreements/'+a.id+'/payouts',{kind:'capital_refund',capitalSource:'collected_principal',fundingRequestId:funding.id,sourceCapitalOperationId:contribution.id,amount:'100',issuedOn:'2026-01-05',reason:'Synthetic recovered principal only'}),returnsVoucher=await f.req('POST','/api/investors/agreements/'+a.id+'/payouts',{kind:'returns_payout',amount:'7',issuedOn:'2026-01-05',reason:'Synthetic earned returns only'});
   for(const r of [capitalVoucher,returnsVoucher])await f.req('POST','/api/ledger/vouchers/'+r.voucherId+'/prepare',{bankAccountId:bank.id,chequeNumber:'SYNTHETIC-'+crypto.randomUUID(),issuedOn:'2026-01-05',dueOn:'2026-01-05',documentVersionId:proof});const batch=await f.req('POST','/api/ledger/vouchers/approval-preview',{ids:[capitalVoucher.voucherId,returnsVoucher.voucherId],signedEvidence:true});await f.req('POST','/api/ledger/vouchers/approval-confirm',{batchId:batch.id,digest:batch.digest,confirm:true});
   view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.refunded,'0.000');assert.equal(view.entitlement.paid,'0.000');assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals where source_key=$1',['voucher:'+capitalVoucher.voucherId])).rows[0].n,0);assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals where source_key=$1',['voucher:'+returnsVoucher.voucherId])).rows[0].n,1);
   for(const r of [capitalVoucher,returnsVoucher])await f.req('POST','/api/ledger/vouchers/'+r.voucherId+'/settle',{effectiveOn:'2026-01-05',bankConfirmation:'Synthetic actual bank clearance confirmation'});
   view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.refunded,'100.000');assert.equal(view.capital.remainingPrincipal,'900.000');assert.equal(view.capital.unused,'900.000');assert.equal(view.entitlement.paid,'7.000');assert.equal(view.entitlement.available,'0.000');
   await f.login(u.username,u.password);assert.equal((await f.req('GET','/api/notifications')).rows.filter((r:any)=>r.action==='investor:cheque_approved').length,2);assert.equal((await f.req('GET','/api/investors/agreements/'+a.id)).payouts.filter((p:any)=>p.status!=='Cancelled').every((p:any)=>p.status==='Paid'&&p.chequeStatus==='Collected'),true);await f.login();
  });

 }finally{await f.close();}
});

test('Principal recovery policy is never inferred and uses integer allocation',async()=>{
 const {splitInvestorCollections:split}=await import('../src/investment-policy.js');
 assert.equal(split({funded:100000n,scheduledInstallments:120000n,collectedInstallments:60000n}).available,false);
 assert.deepEqual(split({funded:100000n,scheduledInstallments:120000n,collectedInstallments:60000n,method:'pro_rata',yieldBps:5000}),{available:true,principal:50000n,returns:5000n});
 assert.deepEqual(split({funded:100000n,scheduledInstallments:120000n,collectedInstallments:110000n,method:'principal_first',yieldBps:2500}),{available:true,principal:100000n,returns:2500n});
});
