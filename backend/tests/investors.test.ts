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
   await f.req('POST','/api/investors/agreements/'+a.id+'/terms',{pledged:'99999',registrationBps:10000,serviceBps:10000,legalBasis:'Not permitted',revision:1},403);
  });
  await t.test('acceptance does not increase cash and cannot be executed twice',async()=>{
   const response=await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:true,reason:'Synthetic promise, not transfer'});assert.equal(response.cashIncreased,false);
   await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:true,reason:'Duplicate'},409);
  });
  await f.login(v.username,v.password);
  await t.test('another investor cannot view the agreement or respond',async()=>{
   assert.equal((await f.req('GET','/api/investors')).rows.length,0);await f.req('GET','/api/investors/agreements/'+a.id,undefined,403);await f.req('POST','/api/investors/funding-requests/'+funding.id+'/respond',{accept:false,reason:'Not mine'},403);
  });
  await f.login();
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
  const a=await f.req('POST','/api/investors/agreements',{companyId:f.co1,investorId:profile.id,mode:'prefunded',currency:'AED',pledged:'0',registrationBps:1000,serviceBps:2000,feeBasis:'collected_gross',principalRecoveryMethod:'principal_first',yieldBps:0,capitalReturnFrom:'2026-01-01',returnsDueFrom:'2026-01-01',legalBasis:'Synthetic explicit capital and returns rules',documentVersionId:proof});
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
   const r=await f.req('POST','/api/investors/agreements/'+a.id+'/payouts',{kind:'capital_refund',amount:'100',sourceCapitalOperationId:contribution.id,issuedOn:'2026-01-01',reason:'Synthetic return of uninvested principal'});voucher=r.voucherId;assert.equal(r.paid,false);
   const row=(await f.admin.query('select * from ab.finance_vouchers where id=$1',[voucher])).rows[0],{security}=await import('../src/core.js'),payload=security(f.secret.key).open(row.payload_cipher);
   assert.equal(payload.alreadyAccrued,true);assert.equal(payload.payableOverrideId,capital);assert.equal(payload.investorPayoutKind,'capital_refund');
   assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,before);
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.received,'1000.000');assert.equal(view.capital.refunded,'0.000');assert.equal(view.capital.refundReserved,'100.000');assert.equal(view.capital.eligibleRefund,'900.000');assert.equal(view.entitlement.available,'0.000');
  });
  await t.test('missing original source, fee/principal mixing and excess amounts fail',async()=>{
   const url='/api/investors/agreements/'+a.id+'/payouts';
   await f.req('POST',url,{kind:'capital_refund',amount:'10',issuedOn:'2026-01-01',reason:'No source'},422);
   await f.req('POST',url,{kind:'capital_refund',amount:'901',sourceCapitalOperationId:contribution.id,issuedOn:'2026-01-01',reason:'Excess refund'},409);
   await f.req('POST',url,{kind:'returns_payout',amount:'10',issuedOn:'2026-01-01',reason:'Capital is not a fee entitlement'},409);
  });
  await t.test('cancelled pending voucher releases reservation via the original cancellation workflow',async()=>{
   await f.req('POST','/api/ledger/vouchers/'+voucher+'/cancel',{reason:'Synthetic cancellation',effectiveOn:'2026-01-01'});
   const view=await f.req('GET','/api/investors/agreements/'+a.id);assert.equal(view.capital.refundReserved,'0.000');assert.equal(view.capital.eligibleRefund,'1000.000');
  });
 }finally{await f.close();}
});

test('Principal recovery policy is never inferred and uses integer allocation',async()=>{
 const {splitInvestorCollections:split}=await import('../src/investment-policy.js');
 assert.equal(split({funded:100000n,scheduledInstallments:120000n,collectedInstallments:60000n}).available,false);
 assert.deepEqual(split({funded:100000n,scheduledInstallments:120000n,collectedInstallments:60000n,method:'pro_rata',yieldBps:5000}),{available:true,principal:50000n,returns:5000n});
 assert.deepEqual(split({funded:100000n,scheduledInstallments:120000n,collectedInstallments:110000n,method:'principal_first',yieldBps:2500}),{available:true,principal:100000n,returns:2500n});
});
