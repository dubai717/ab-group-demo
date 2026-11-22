import test from 'node:test';
import assert from 'node:assert/strict';
import {financierLabel,contractFinanciers} from '../src/contract-financier.js';
import {ledgerFixture} from './ledger-fixture.js';
import {security} from '../src/core.js';
import {randomUUID} from 'node:crypto';
test('financier captions separate principal sources, cash and unresolved contract references',()=>{
 assert.equal(financierLabel('cash',{nameAr:'نقد',nameEn:'Cash'}),null);
 assert.match(financierLabel('group',{nameAr:'الشركة الممولة',nameEn:'Funding Company'})!.labelEn,/Group financing.*Funding Company/);
 assert.match(financierLabel('bank',{nameEn:'Contract bank'})!.labelAr,/Contract bank/);
 assert.match(financierLabel('investor',{nameAr:'المستثمر الوهمي'})!.labelEn,/Investor financing/);
 assert.match(financierLabel('investor',{nameAr:'مستثمر',profileNumber:'INV-001'})!.labelAr,/INV-001/);assert.equal(financierLabel('investor',null)!.status,'ReviewRequired');assert.equal(financierLabel('bank',{})!.status,'ReviewRequired');
});
test('contract disclosure uses original invoice contract and active allocations, never customer residence or latest contract',async()=>{
 const f=await ledgerFixture();try{
  const request=await f.request();await f.fund(request.id);const vehicle=await f.register(request.id);await f.contract(vehicle.id);
  const invoice=(await f.admin.query("select id,contract_id,amount::text from ab.vehicle_invoices where vehicle_id=$1 and kind='finance' order by invoice_number limit 1",[vehicle.id])).rows[0];
  const before=(await f.admin.query('select id,payload_cipher from ab.vehicle_contracts order by id')).rows;
  // Native financing rows need an approved item link to be collected by the ledger UI. Fixture-only link.
  await f.admin.query('insert into ab.finance_invoice_links(id,tenant_id,company_id,invoice_id,item_id,source_key,issued_on,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),f.org.tenant,f.co1,invoice.id,f.items.loan,'synthetic-contract-disclosure',f.date,f.org.user]);
  const dues=await f.req('GET','/api/ledger/receivables?customerId='+f.client+'&companies='+f.co1+'&level=invoice');assert.match(dues.rows.find((r:any)=>r.id===invoice.id).financierLabelEn,/Group financing.*Company A/);
  await f.req('POST','/api/ledger/collections/invoices',{companyId:f.co1,customerId:f.client,currency:'AED',receivedOn:f.date,invoices:[{invoiceId:invoice.id,amount:invoice.amount}],actualCashReceived:true,financierId:randomUUID()},422);
  let statement=await f.req('GET','/api/ledger/customer-statement?customerId='+f.client+'&companies='+f.co1);
  const row=statement.rows.find((r:any)=>r.id===invoice.id);assert.match(row.financierLabelEn,/Group financing.*Company A/);
  assert(statement.rows.filter((r:any)=>r.type==='Invoice'&&r.id!==invoice.id&&r.financier).every((r:any)=>r.financier.type==='group'));
  const collected=await f.req('POST','/api/ledger/collections/invoices',{companyId:f.co1,customerId:f.client,currency:'AED',receivedOn:f.date,invoices:[{invoiceId:invoice.id,amount:invoice.amount}],actualCashReceived:true});
  const receiptId=collected.receipts[0].id,source=await f.req('GET','/api/ledger/receivables/source/RV/'+receiptId);
  const receiptDocument=await f.req('GET','/api/ledger/package/documents?companyId='+f.co1+'&type=RV'),invoiceDocument=await f.req('GET','/api/ledger/package/documents?companyId='+f.co1+'&type=Invoice');assert.match(receiptDocument.rows.find((r:any)=>r.id===receiptId).financierLabelEn,/Group financing.*Company A/);assert.match(invoiceDocument.rows.find((r:any)=>r.id===invoice.id).financierLabelEn,/Group financing.*Company A/);
  const workbench=await f.req('GET','/api/ledger/workbench?companyId='+f.co1);assert.equal(workbench.receipts.find((r:any)=>r.id===receiptId).financierLabelEn,source.record.financierLabelEn);
  for(const format of ['print','excel']){const exported=await f.req('GET','/api/ledger/register-view?'+new URLSearchParams({companyId:f.co1,source:'receipts',columns:'receipt_number,financierLabelAr,financierLabelEn,amount,currency',format,full:'true'}));assert.equal(exported.rows.find((r:any)=>String(r.receipt_number)===String(source.record.number)).financierLabelEn,source.record.financierLabelEn);}
  assert.equal(source.record.financingSources.length,1);assert.equal(source.record.financingSources[0].contractId,invoice.contract_id);assert.match(source.record.financierLabelEn,/Company A/);
  statement=await f.req('GET','/api/ledger/customer-statement?customerId='+f.client+'&companies='+f.co1);assert.equal(statement.rows.find((r:any)=>r.id===receiptId).financierLabelEn,source.record.financierLabelEn);
  assert.deepEqual((await f.admin.query('select id,payload_cipher from ab.vehicle_contracts order by id')).rows,before);
  const cipher=security(f.secret.key),m={state:{companies:[{id:f.co1,arabicName:'الشركة',englishName:'Funding Company'}]},actor:{roleId:'owner',status:'Active'}};
  const legacyId=randomUUID(),legacy=await contractFinanciers(f.admin,m,cipher,[{id:legacyId,companyId:f.co1,vehicleId:vehicle.id,contractId:null,kind:'finance'}]);assert.equal(legacy.get(legacyId).status,'ReviewRequired');assert.match(legacy.get(legacyId).labelEn,/contract review/);
  // An unrelated vehicle/company cannot borrow the contract's financing caption.
  const wrong=await contractFinanciers(f.admin,m,cipher,[{id:randomUUID(),companyId:f.co1,vehicleId:randomUUID(),contractId:invoice.contract_id,kind:'finance'}]);assert.equal(wrong.size,0);
 }finally{await f.close();}
});
