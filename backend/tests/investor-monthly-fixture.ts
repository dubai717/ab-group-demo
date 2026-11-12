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

export async function monthlyAgencyFixture(){const f=await businessCentersFixture();try{
 for(const file of ['supabase/additive/026_investor_registry_versions.sql','supabase/additive/027_investor_electronic_access.sql','supabase/additive/028_investor_monthly_settlements.sql'])await f.admin.query(await readFile(file,'utf8'));
 const cipher=security(f.secret.key),today=investorToday(),yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10),period=today.slice(0,7),bounds=monthBounds(period),proof=await f.proof();
 const person=await f.req('POST','/api/investor-registry/profiles',{nameAr:'مستثمر اصطناعي',nameEn:'Synthetic monthly investor',type:'individual',identityNumber:'SYN-GROSS',identityAuthority:'Synthetic',nationality:'AE',phone:'000',address:'Isolated',bankName:'Synthetic',accountHolder:'Synthetic monthly investor',accountNumber:'SYN-GROSS-BANK',iban:'AE070331234567890123456'});
 await f.req('POST','/api/investor-registry/profiles/'+person.id+'/bank-approve',{revision:1,confirm:true});
 const account=async(code:string)=>(await f.req('POST','/api/ledger/accounts',{code,nameAr:'حساب أموال مدارة للغير',nameEn:'Dedicated synthetic agency control',kind:'liability',companyIds:[f.co1],currency:'AED'})).charts[0].id;
 const cap=await account('monthly-capital'),pay=await account('monthly-collected'),configuration=await f.req('POST','/api/investor-monthly/configurations',{companyId:f.co1,currency:'AED',capitalChartId:cap,payableChartId:pay,feeIncomeChartId:f.accounts.income.charts[f.co1],payoutItemId:f.items.commission,documentVersionId:proof,confirm:true}),cfg=configuration.id;
 const v1={collectionPolicy:monthlyPolicy,monthlyConfigurationId:cfg,effectiveOn:yesterday,registrationBaseFee:'300',registrationShareAmount:'50',documentVersionId:proof};
 const a=await f.req('POST','/api/investor-registry/agreements',{...v1,investorId:person.id,companyId:f.co1,mode:'prefunded',currency:'AED',pledged:'3000',scope:'monthly-synthetic'});
 await f.req('POST','/api/investor-registry/versions/'+a.id+'/approve',{confirm:true});
 const second=await f.req('POST','/api/investor-registry/agreements/'+a.agreementId+'/versions',{...v1,effectiveOn:today,registrationShareAmount:'150',documentVersionId:await f.proof()}),version=second.id;
 await f.req('POST','/api/investor-registry/versions/'+version+'/approve',{confirm:true});
 const path='/api/investors/agreements/'+a.agreementId;
 const bank=await f.bank(),op=async(kind:string,amount:string,counterpartId:string)=>{const o=await f.req('POST','/api/finance/operations',{companyId:f.co1,kind,bankAccountId:bank.id,amount,currency:'AED',effectiveOn:today,reason:'Synthetic monthly evidence',reference:randomUUID(),counterpartId,documentVersionId:proof,integrationRefs:{investorAgreementId:a.agreementId}});await f.req('POST','/api/finance/operations/'+o.id+'/approve',{revision:1});return o.id;};
 const capital=await op('receipt','3000',cap);await f.req('POST',path+'/capital',{operationId:capital});
 const request=await f.request({financeType:'investor',investorId:person.id,expectedFunding:'2000'}),funding=await f.req('POST',path+'/funding-requests',{requestId:request.id,confirm:true});
 await f.req('POST','/api/vehicle-requests/'+request.id+'/funding-decision',{approve:true,reason:'Synthetic owner approval',revision:1});
 const payment=await op('payment','2000',cap),funds=await f.req('POST','/api/vehicle-requests/'+request.id+'/disburse',{receiverId:f.org.user,method:'transfer',paymentOperationId:payment,source:'Synthetic bank debit',date:today,evidence:'Synthetic evidence'});await f.req('POST','/api/vehicle-funds/'+funds.id+'/receive',{confirm:true});
 const vehicle=await f.register(request.id);await f.contract(vehicle.id,{principal:'2000',total:'2500',months:2,startOn:bounds.from,serviceMonthly:'0'});
 const fee=await f.req('POST','/api/vehicles/'+vehicle.id+'/invoices',{kind:'admin',amount:'300',dueOn:today,reference:randomUUID(),reason:'Actual synthetic registration fee',fileId:await f.file(vehicle.id)});
 await f.req('POST','/api/investor-registry/funding/'+funding.id+'/registration-source',{invoiceId:fee.id,confirm:true});
 const bills=(await f.read(vehicle.id)).invoices.filter((i:any)=>['finance','admin'].includes(i.kind));assert.equal(bills.length,3);
 await f.collection('1250',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'1250'}]},409);const setup=await f.req('GET','/api/investor-monthly/invoice-setup?companyId='+f.co1+'&currency=AED');assert.equal(setup.invoices.length,3);await f.req('POST','/api/investor-monthly/invoice-setup',{companyId:f.co1,invoiceIds:setup.invoices.map((i:any)=>i.id),itemId:f.items.loan,confirm:true});
 assert.equal(Number((await f.admin.query("select count(*)n from ab.finance_journals where source_key=any($1::text[])",[bills.map((b:any)=>'invoice:'+b.id)])).rows[0].n),0);
 const collector=await f.employee();for(const action of ['ledger_collect','ledger_view','ledger_hand_over','customer_view','vehicle_view'])await f.req('POST','/api/users/'+collector.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
 await f.req('POST','/api/ledger/custody/routes',{companyId:f.co1,senderId:collector.id,receiverId:f.org.user,effectiveOn:today});await f.login(collector.username,collector.password);
 await f.req('GET','/api/investor-monthly/overview?companyId='+f.co1+'&currency=AED&period='+period,undefined,403);
 await f.collection('1250',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'1250'}]});
 const handover=await f.req('POST','/api/ledger/custody/handovers',{companyId:f.co1,receiverId:f.org.user,currency:'AED',amount:'1250',kind:'cash'});await f.login();
 await f.collection('0.002',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'0.002'}]});
 const early=(await f.admin.query('select id from ab.vehicle_allocations where invoice_id=$1 order by created_at,id',[fee.id])).rows[0];
 await f.collection('0.001',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'0.001'}]});
 // A reversal before a later frozen partial fee requires ordered documented correction, not re-rounding.
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query("insert into ab.finance_allocation_reversals(id,tenant_id,company_id,allocation_id,reason,created_by)values($1,$2,$3,$4,'Forbidden out-of-order fee reversal',$5)",[randomUUID(),f.org.tenant,f.co1,early.id,f.org.user])),(e:any)=>e.code==='23514');
 await f.collection('299.997',{vehicleId:vehicle.id,receivedOn:today,items:[{itemId:f.items.loan,amount:'299.997'}]});
 const memo=await f.req('GET',path),fin=memo.financings.find((row:any)=>row.id===funding.id);assert.equal(memo.capital.unusedAfterReservations,'1000.000');assert.equal(fin.capitalCollected,'1250.000');assert.equal(fin.capitalOutstanding,'750.000');assert.equal(fin.principalMemoOnly,true);assert.equal(fin.capitalAvailable,'0.000');
 await f.req('POST','/api/investor-registry/funding/'+funding.id+'/release',{amount:'1',effectiveOn:today,documentVersionId:proof,reason:'Must not recycle investor installments',confirm:true},409);
 const preview=()=>transaction(f.runtime,f.org.tenant,f.org.user,c=>loadMonthlySources(c,cipher,{companyId:f.co1,investorId:person.id,currency:'AED',period}));
 const held=await preview();assert.equal(held.amount,0n);assert.equal(held.excluded.length,3);
 const overview=()=>f.req('GET','/api/investor-monthly/overview?companyId='+f.co1+'&currency=AED&period='+period+'&investorId='+person.id),metric=(book:any,key:string)=>book.metrics.find((m:any)=>m.id===key).amount;
 assert.equal(metric(await overview(),'collector_custody'),'1400.000');await f.req('POST','/api/ledger/custody/handovers/'+handover.id+'/receive',{actual:'1250',reason:'Synthetic cashier accepted full collection'});const atCashier=await overview();assert.equal(metric(atCashier,'collector_custody'),'150.000');assert.equal(metric(atCashier,'deposit_pending'),'1250.000');assert.equal(metric(atCashier,'managed_responsibility'),'2400.000');

 const deposit=await f.req('POST','/api/ledger/deposits',{companyId:f.co1,bankAccountId:bank.id,currency:'AED',amount:'1550',effectiveOn:today,documentVersionId:proof,reference:'Synthetic full deposit'});await f.req('POST','/api/ledger/deposits/'+deposit.id+'/confirm',{confirmedAmount:'1550',effectiveOn:today,bankConfirmation:'Evidence without statement is insufficient',accountAndDateVerified:true});
 const deposited=await preview();assert.equal(deposited.amount,0n);assert(deposited.excluded.every((l:any)=>l.reason==='bank_reconciliation_pending'));
 const entries=(await f.admin.query("select e.*,o.effective_on,o.reference from ab.finance_entries e join ab.finance_operations o on o.id=e.operation_id where e.bank_account_id=$1 and o.status='Approved'order by e.id",[bank.id])).rows,closing=entries.reduce((n:bigint,r:any)=>n+V.units(r.debit)-V.units(r.credit),0n),csv='date,amount,reference\n'+entries.map((r:any)=>today+','+V.money(V.units(r.debit)-V.units(r.credit))+','+r.reference).join('\n');
 const statement=await f.req('POST','/api/ledger/bank-statements',{companyId:f.co1,bankAccountId:bank.id,periodFrom:bounds.from,periodTo:bounds.to,openingBalance:'0',closingBalance:V.money(closing),documentVersionId:proof,csv}),data=await f.req('GET','/api/ledger/statements/'+statement.id);
 for(let n=0;n<entries.length;n++)await f.req('POST','/api/ledger/bank-statement-lines/'+data.lines[n].id+'/match',{entryId:entries[n].id});
 assert.equal((await preview()).amount,0n);await f.req('POST','/api/ledger/bank-statements/'+statement.id+'/approve',{});
 const ready=await preview();assert.equal(ready.amount,1400000n);assert.deepEqual(ready.eligible.map((l:any)=>l.amount),[1250000n,1n,149999n]);assert.equal(ready.eligible[0].versionId,version);
 // Handover/deposit do not accrue a second liability; principal custody remains separate.
 for(const [chartId,expected]of [[cap,-1000000n],[pay,-1400000n],[f.accounts.income.charts[f.co1],-150000n],[f.accounts.ar.charts[f.co1],0n],[f.accounts.custody.charts[f.co1],0n]] as const)assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>balance(c,chartId)),expected);
 return {...f,cipher,today,period,bounds,policyProof:proof,person,cap,pay,cfg,version,a,collectionBank:bank,path,vehicle,funding,preview,overview,metric,ready,statement,collector,handover};
}catch(error){await f.close();throw error;}}
