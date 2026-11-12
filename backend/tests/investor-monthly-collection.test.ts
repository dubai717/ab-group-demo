import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {businessCentersFixture} from './business-centers-fixture.js';
import {security,transaction} from '../src/core.js';
import {investorToday} from '../src/investor-registry.js';
import {monthlyPolicy,monthBounds} from '../src/investor-monthly-domain.js';
import {loadMonthlySources} from '../src/investor-monthly-source-loader.js';
import {V} from '../src/vehicle-domain.js';
import {balance} from '../src/ledger-domain.js';

test('Isolated gross agency collection posts investor liability once and becomes eligible only after the original bank statement is approved',async()=>{
 const f=await businessCentersFixture();try{
 for(const file of ['supabase/additive/026_investor_registry_versions.sql','supabase/additive/027_investor_electronic_access.sql','docs/proposals/028_investor_monthly_settlements.review-only.sql'])await f.admin.query(await readFile(file,'utf8'));
 const cipher=security(f.secret.key),today=investorToday(),yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10),period=today.slice(0,7),bounds=monthBounds(period),proof=await f.proof();
 const person=await f.req('POST','/api/investor-registry/profiles',{nameAr:'مستثمر اصطناعي',nameEn:'Synthetic monthly investor',type:'individual',identityNumber:'SYN-GROSS',identityAuthority:'Synthetic',nationality:'AE',phone:'000',address:'Isolated',bankName:'Synthetic',accountHolder:'Synthetic monthly investor',accountNumber:'SYN-GROSS-BANK',iban:'AE070331234567890123456'});
 await f.req('POST','/api/investor-registry/profiles/'+person.id+'/bank-approve',{revision:1,confirm:true});
 const a=await f.req('POST','/api/investor-registry/agreements',{investorId:person.id,companyId:f.co1,mode:'prefunded',currency:'AED',pledged:'3000',scope:'monthly-synthetic',effectiveOn:yesterday,registrationBaseFee:'300',registrationShareAmount:'50',documentVersionId:proof,principalRecoveryMethod:'principal_first'});
 await f.req('POST','/api/investor-registry/versions/'+a.id+'/approve',{confirm:true});
 const cap=(await f.req('POST','/api/ledger/accounts',{code:'monthly-capital',nameAr:'رأس مال مملوك للمستثمر',nameEn:'Synthetic capital custody',kind:'liability',companyIds:[f.co1],currency:'AED'})).charts[0].id,pay=f.accounts.payable.charts[f.co1],cfg=randomUUID(),version=randomUUID(),signed=await f.proof();
 await transaction(f.runtime,f.org.tenant,f.org.user,async c=>{
 await c.query("insert into ab.investor_monthly_configurations(id,tenant_id,company_id,currency,capital_chart_id,payable_chart_id,fee_income_chart_id,payout_item_id,document_version_id,accounting_basis,created_by)values($1,$2,$3,'AED',$4,$5,$6,$7,$8,'gross_agency_on_collection',$9)",[cfg,f.org.tenant,f.co1,cap,pay,f.accounts.income.charts[f.co1],f.items.commission,proof,f.org.user]);
 const old=(await c.query('select * from ab.investor_agreement_versions where id=$1',[a.id])).rows[0],terms={...cipher.open(old.terms_cipher),collectionPolicy:monthlyPolicy,monthlyConfigurationId:cfg,registrationShareAmount:'150',principalRecoveryMethod:null};
 await c.query('insert into ab.investor_agreement_versions(id,tenant_id,series_id,version,effective_on,document_version_id,terms_cipher,created_by)values($1,$2,$3,2,$4,$5,$6,$7)',[version,f.org.tenant,old.series_id,today,signed,cipher.seal(terms),f.org.user]);
 await c.query("insert into ab.investor_monthly_versions(id,tenant_id,company_id,investor_id,version_id,configuration_id,currency,created_by)values($1,$2,$3,$4,$5,$6,'AED',$7)",[randomUUID(),f.org.tenant,f.co1,person.id,version,cfg,f.org.user]);
 });
 await f.req('POST','/api/investor-registry/versions/'+version+'/approve',{confirm:true});
 const path='/api/investors/agreements/'+a.agreementId;await f.req('POST',path+'/accounting',{capitalChartId:cap,returnsChartId:pay,returnsCounterpartChartId:f.accounts.expense.charts[f.co1],capitalItemId:f.items.loan,returnsItemId:f.items.commission,accountingBasis:'Isolated proposed gross agency treatment',revision:1});
 const bank=await f.bank(),op=async(kind:string,amount:string,counterpartId:string)=>{const o=await f.req('POST','/api/finance/operations',{companyId:f.co1,kind,bankAccountId:bank.id,amount,currency:'AED',effectiveOn:today,reason:'Synthetic monthly evidence',reference:randomUUID(),counterpartId,documentVersionId:proof,integrationRefs:{investorAgreementId:a.agreementId}});await f.req('POST','/api/finance/operations/'+o.id+'/approve',{revision:1});return o.id;};
 const capital=await op('receipt','3000',cap);await f.req('POST',path+'/capital',{operationId:capital});
 const request=await f.request({financeType:'investor',investorId:person.id,expectedFunding:'1000'}),funding=await f.req('POST',path+'/funding-requests',{requestId:request.id,confirm:true});
 await f.req('POST','/api/vehicle-requests/'+request.id+'/funding-decision',{approve:true,reason:'Synthetic owner approval',revision:1});
 const payment=await op('payment','1000',cap),funds=await f.req('POST','/api/vehicle-requests/'+request.id+'/disburse',{receiverId:f.org.user,method:'transfer',paymentOperationId:payment,source:'Synthetic bank debit',date:today,evidence:'Synthetic evidence'});await f.req('POST','/api/vehicle-funds/'+funds.id+'/receive',{confirm:true});
 const vehicle=await f.register(request.id);await f.contract(vehicle.id,{principal:'1000',total:'1250',months:1,startOn:bounds.from,serviceMonthly:'0'});
 const fee=await f.req('POST','/api/vehicles/'+vehicle.id+'/invoices',{kind:'admin',amount:'300',dueOn:today,reference:randomUUID(),reason:'Actual synthetic registration fee',fileId:await f.file(vehicle.id)});
 await f.req('POST','/api/investor-registry/funding/'+funding.id+'/registration-source',{invoiceId:fee.id,confirm:true});
 const bills=(await f.read(vehicle.id)).invoices.filter((i:any)=>['finance','admin'].includes(i.kind));assert.equal(bills.length,2);
 for(const bill of bills)await f.req('POST','/api/ledger/invoices/adopt',{invoiceId:bill.id,itemId:f.items.loan,issuedOn:today,confirmHistoricalClassification:true});
 assert.equal(Number((await f.admin.query("select count(*)n from ab.finance_journals where source_key=any($1::text[])",[bills.map((b:any)=>'invoice:'+b.id)])).rows[0].n),0);
 await f.collection('1250',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'1250'}]});
 await f.collection('0.002',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'0.002'}]});
 const early=(await f.admin.query('select id from ab.vehicle_allocations where invoice_id=$1 order by created_at,id',[fee.id])).rows[0];
 await f.collection('0.001',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'0.001'}]});
 // A reversal before a later frozen partial fee requires ordered documented correction, not re-rounding.
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query("insert into ab.finance_allocation_reversals(id,tenant_id,company_id,allocation_id,reason,created_by)values($1,$2,$3,$4,'Forbidden out-of-order fee reversal',$5)",[randomUUID(),f.org.tenant,f.co1,early.id,f.org.user])),(e:any)=>e.code==='23514');
 await f.collection('299.997',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'299.997'}]});
 const preview=()=>transaction(f.runtime,f.org.tenant,f.org.user,c=>loadMonthlySources(c,cipher,{companyId:f.co1,investorId:person.id,currency:'AED',period}));
 const held=await preview();assert.equal(held.amount,0n);assert.equal(held.excluded.length,3);
 const deposit=await f.req('POST','/api/ledger/deposits',{companyId:f.co1,bankAccountId:bank.id,currency:'AED',amount:'1550',effectiveOn:today,documentVersionId:proof,reference:'Synthetic full deposit'});await f.req('POST','/api/ledger/deposits/'+deposit.id+'/confirm',{confirmedAmount:'1550',effectiveOn:today,bankConfirmation:'Evidence without statement is insufficient',accountAndDateVerified:true});
 const deposited=await preview();assert.equal(deposited.amount,0n);assert(deposited.excluded.every((l:any)=>l.reason==='bank_reconciliation_pending'));
 const entries=(await f.admin.query("select e.*,o.effective_on,o.reference from ab.finance_entries e join ab.finance_operations o on o.id=e.operation_id where e.bank_account_id=$1 and o.status='Approved'order by e.id",[bank.id])).rows,closing=entries.reduce((n:bigint,r:any)=>n+V.units(r.debit)-V.units(r.credit),0n),csv='date,amount,reference\n'+entries.map((r:any)=>today+','+V.money(V.units(r.debit)-V.units(r.credit))+','+r.reference).join('\n');
 const statement=await f.req('POST','/api/ledger/bank-statements',{companyId:f.co1,bankAccountId:bank.id,periodFrom:bounds.from,periodTo:bounds.to,openingBalance:'0',closingBalance:V.money(closing),documentVersionId:proof,csv}),data=await f.req('GET','/api/ledger/statements/'+statement.id);
 for(let n=0;n<entries.length;n++)await f.req('POST','/api/ledger/bank-statement-lines/'+data.lines[n].id+'/match',{entryId:entries[n].id});
 assert.equal((await preview()).amount,0n);await f.req('POST','/api/ledger/bank-statements/'+statement.id+'/approve',{});
 const ready=await preview();assert.equal(ready.amount,1400000n);assert.deepEqual(ready.eligible.map((l:any)=>l.amount),[1250000n,1n,149999n]);assert.equal(ready.eligible[0].versionId,version);
 // Handover/deposit do not accrue a second liability; principal custody remains separate.
 for(const [chartId,expected]of [[cap,-2000000n],[pay,-1400000n],[f.accounts.income.charts[f.co1],-150000n],[f.accounts.ar.charts[f.co1],0n],[f.accounts.custody.charts[f.co1],0n]] as const)assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>balance(c,chartId)),expected);
 const q={companyId:f.co1,investorId:person.id,currency:'AED',period},qString=new URLSearchParams(q).toString(),plan=await f.req('GET','/api/investor-monthly/preview?'+qString),key=randomUUID();
 assert.equal(plan.amount,'1400.000');const draft=await f.req('POST','/api/investor-monthly/settlements',{...q,previewHash:plan.previewHash,confirm:true},200,key),settlement=draft.id;
 assert.equal((await f.req('POST','/api/investor-monthly/settlements',{...q,previewHash:plan.previewHash,confirm:true},200,key)).id,settlement);
 await f.req('POST','/api/investor-monthly/settlements',{...q,previewHash:plan.previewHash,confirm:true},409);
 const reserved=await preview();assert.equal(reserved.amount,0n);assert(reserved.excluded.every((l:any)=>l.reason==='reserved_in_settlement'));
 const first=ready.eligible[0];await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query('insert into ab.investor_monthly_lines(id,tenant_id,company_id,investor_id,settlement_id,allocation_id,bank_entry_id,receipt_id,funding_id,version_id,kind,amount,source_amount,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)',[randomUUID(),f.org.tenant,f.co1,person.id,settlement,first.allocationId,first.bankEntryId,first.receiptId,first.fundingId,first.versionId,first.kind,V.money(first.amount),V.money(first.sourceAmount),cipher.seal({synthetic:true}),f.org.user])),(e:any)=>['23505','23514'].includes(e.code));
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query("update ab.finance_statements set status='Review'where id=$1",[statement.id])),(e:any)=>e.code==='23514');
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query("insert into ab.finance_allocation_reversals(id,tenant_id,company_id,allocation_id,reason,created_by)values($1,$2,$3,$4,'Must fail while reserved',$5)",[randomUUID(),f.org.tenant,f.co1,first.allocationId,f.org.user])),(e:any)=>e.code==='23514');
 const change=(action:string,revision:number)=>({action,revision,confirm:true,reason:'Synthetic documented '+action});
 await f.req('POST','/api/investor-monthly/settlements/'+settlement+'/state',change('review',1));
 const approved=await f.req('POST','/api/investor-monthly/settlements/'+settlement+'/state',change('approve',2));assert(approved.voucherId);assert.equal(approved.bankConfirmedPaid,false);
 await f.req('POST','/api/investor-monthly/settlements/'+settlement+'/state',change('approve',2),409);
 await f.req('POST','/api/ledger/vouchers/'+approved.voucherId+'/prepare',{bankAccountId:bank.id,chequeNumber:'SYN-MONTHLY-ONE',issuedOn:today,dueOn:today,documentVersionId:proof});
 const batch=await f.req('POST','/api/ledger/vouchers/approval-preview',{ids:[approved.voucherId],signedEvidence:true});await f.req('POST','/api/ledger/vouchers/approval-confirm',{batchId:batch.id,digest:batch.digest,confirm:true});
 // A signed, issued and approved cheque still does not make the monthly settlement paid.
 await f.req('POST','/api/investor-monthly/settlements/'+settlement+'/state',change('confirm_paid',3),409);
 assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>balance(c,pay)),-1400000n);
 await f.req('POST','/api/investor-monthly/settlements/'+settlement+'/state',change('cancel',3),409);
 const excel=await f.req('GET','/api/investor-monthly/settlements/'+settlement+'/export?format=excel');assert.match(excel.data,/<Workbook/);assert.equal(excel.total,3);
 await f.req('POST','/api/ledger/vouchers/'+approved.voucherId+'/cancel',{reason:'Synthetic bank stop',effectiveOn:today,bankStopConfirmed:true});
 await f.req('POST','/api/investor-monthly/settlements/'+settlement+'/state',change('cancel',3));assert.equal((await preview()).amount,1400000n);
 const worker=await f.employee();await assert.rejects(transaction(f.runtime,f.org.tenant,worker.id,c=>loadMonthlySources(c,cipher,{companyId:f.co1,investorId:person.id,currency:'AED',period})),(e:any)=>e.status===403||e.statusCode===403||e.code==='ownerOnly');
 }finally{await f.close();}
});
