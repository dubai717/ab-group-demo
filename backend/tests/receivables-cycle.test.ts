import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {receiptImageSize,receiptImageText} from '../src/receipt-ocr.js';
import {security} from '../src/core.js';
import {randomUUID} from 'node:crypto';
import {personnelFixture} from './personnel-fixture.js';
import {depositTextFacts} from '../src/deposit-review.js';
import {agingBucket,receivableTotals,receivableStatus} from '../src/receivables.js';
test('receipt image dimensions reject unsupported or oversized formats before decoding',async()=>{assert.equal(receiptImageSize(Buffer.from('not an image'),'image/png'),null);const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.writeUInt32BE(10000,16);b.writeUInt32BE(10000,20);assert.equal(receiptImageSize(b,'image/png')?.width,10000);assert.equal((await receiptImageText(b,'image/png')).status,'manualRequired');});
test('receipt facts never guess ambiguous amounts or treat an image as verified bank credit',()=>{const r=depositTextFacts('Amount: 1,700.00 AED 1700.00 Reference: TRX-12345 2026-11-19 AE070331234567890123456');assert.equal(r.amount,'1700.00');assert.equal(r.reference,'TRX-12345');assert.equal(depositTextFacts('Amount: 100 Amount: 200').amount,null);assert.equal(depositTextFacts('').amount,null);assert.equal(depositTextFacts('المبلغ: ٩٩٫٥٠ درهم').amount,'99.50');assert.equal(depositTextFacts('Amount: 99,50 AED').amount,null);});
test('receivable ageing uses remaining balances, exact day boundaries and excludes cancelled invoices',()=>{
 for(const [due,bucket]of [['2026-03-02','future'],['2026-03-01','dueToday'],['2026-02-28','days1to30'],['2026-01-30','days1to30'],['2026-01-29','days31to60'],['2025-12-31','days31to60'],['2025-12-30','days61to90'],['2025-11-30','over90']])assert.equal(agingBucket(due,'2026-03-01'),bucket);
 assert.equal(receivableStatus(false,'100','0','100',0n),'WrittenOff');assert.equal(receivableStatus(false,'100','0','20',80000n),'PartiallyWrittenOff');assert.equal(receivableStatus(false,'100','0','0',0n),'Settled');
 const row={amount:'1000',paid:'500',discounts:'100',settlements:'50',writtenOff:'25',outstanding:'325',dueOn:'2026-01-29'};
 const result=receivableTotals([row,{...row,cancelled:true}],'2026-03-01');assert.equal(result.invoiced,'1000.000');assert.equal(result.days31to60,'325.000');assert.equal(result.outstanding,'325.000');assert.equal(result.future,'0.000');
});
test('canonical customer invoices → separate RVs → partial custody → verified bank deposit, without historical rewrites',async t=>{
 const f=await personnelFixture();try{
 let bills:any[]=[],batch:any,employee:any,proof:string,bank:any,imageProof:string;
 await t.test('same-item invoices receive separate vouchers in one atomic collection, including partial payment',async()=>{
  bills=[await f.bill('1000'),await f.bill('300'),await f.bill('500',f.items.salik)];
  const before=(await f.admin.query('select id,amount::text from ab.vehicle_invoices order by id')).rows;
  const body={companyId:f.co1,customerId:f.client,currency:'AED',receivedOn:f.date,actualCashReceived:true,invoices:bills.map((x:any,i)=>({invoiceId:x.id,amount:['1000','200','500'][i]}))},key=randomUUID();
  const [a,b]=await Promise.all([f.req('POST','/api/ledger/collections/invoices',body,200,key),f.req('POST','/api/ledger/collections/invoices',body,200,key)]);batch=a;assert.equal(a.id,b.id);assert.equal(a.receipts.length,3);assert.equal(new Set(a.receipts.map((r:any)=>r.number)).size,3);
  assert.deepEqual((await f.admin.query('select id,amount::text from ab.vehicle_invoices order by id')).rows,before);
  const native=await f.req('GET','/api/ledger/receivables/source/RV/'+a.receipts[0].id);assert.equal(native.record.number,a.receipts[0].number);assert.equal(native.links[0].id,bills[0].id);assert.match(native.record.companyNameEn,/Synthetic/);
  assert.equal((await f.admin.query('select sum(amount)::text n from ab.finance_custody_moves where holder_id=$1',[f.org.user])).rows[0].n,'1700.000');
  await f.req('POST','/api/ledger/collections/invoices',{...body,invoices:[{invoiceId:bills[1].id,amount:'101'}]},409);
  await f.req('POST','/api/ledger/collections/invoices',{...body,actualCashReceived:false},422);
 });
 await t.test('read projections and statement reconcile, retain future balances and protect exports',async()=>{
  const r=await f.req('GET','/api/ledger/receivables?customerId='+f.client+'&asOf=2026-01-06');assert.equal(r.summary[0].invoiced,'1800.000');assert.equal(r.summary[0].applied,'1700.000');assert.equal(r.summary[0].outstanding,'100.000');assert.equal(r.summary[0].days1to30,'100.000');
  const s=await f.req('GET','/api/ledger/customer-statement?customerId='+f.client+'&from=2026-01-06&to=2026-02-01');assert.equal(s.opening[f.co1+':AED'],'100.000');assert.equal(s.closing[f.co1+':AED'],'100.000');
  const x=await f.req('GET','/api/ledger/customer-statement?customerId='+f.client+'&format=excel');assert.match(x.data,/Closing/);assert.match(x.data,/100.000/);
  await f.req('POST','/api/ledger/receivables/preferences',{filters:{customerId:f.client,level:'vehicle'}});assert.equal((await f.req('GET','/api/ledger/receivables/preferences')).filters.customerId,f.client);
 });
 await t.test('selected receipt remains with sender until recipient counts; shortage stays with sender',async()=>{
  employee=await f.employee();for(const action of ['ledger_view','ledger_receive','ledger_deposit','ledger_deposit_verify'])await f.req('POST','/api/users/'+employee.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  await f.req('POST','/api/ledger/custody/routes',{companyId:f.co1,senderId:f.org.user,receiverId:employee.id,effectiveOn:'2020-01-01'});
  const h=await f.req('POST','/api/ledger/custody/handovers',{companyId:f.co1,receiverId:employee.id,currency:'AED',amount:'1000',receipts:[{receiptId:batch.receipts[0].id,amount:'1000'}]});
  let d=await f.req('GET','/api/ledger/custody/details?companyId='+f.co1);assert.equal(d.receipts.find((x:any)=>x.receiptId===batch.receipts[0].id).amount,'1000.000');
  await f.login(employee.username,employee.password);const received=await f.req('POST','/api/ledger/custody/handovers/'+h.id+'/receive',{actual:'900',reason:'Synthetic actual count 100 short'});assert.equal(received.remaining,'100.000');
  await f.req('POST','/api/ledger/custody/handovers/'+h.id+'/receive',{actual:'900',reason:'Repeat'},409);
  await f.login();d=await f.req('GET','/api/ledger/custody/details?companyId='+f.co1);assert.equal(d.receipts.find((x:any)=>x.receiptId===batch.receipts[0].id).amount,'100.000');
 });
 await t.test('clean PDF receipt is reviewed for differences, never represented as verified bank funds',async()=>{
  const {PDFDocument}=await import('pdf-lib'),pdf=await PDFDocument.create();pdf.addPage([1200,400]).drawText('Bank: Synthetic Bank Amount: 99.00 AED 99.00 Reference: SYN-REVIEW 2026-01-05 AE070331234567890123456',{size:10});bank=await f.bank();const proof=(await f.req('POST','/api/documents',{companyId:f.co1,category:'other',title:'Synthetic receipt text',description:'Isolated fixture',date:f.date,name:'receipt.pdf',mime:'application/pdf',base64:Buffer.from(await pdf.save()).toString('base64')})).versionId;await f.admin.query("update ab.document_versions set scan_status='clean' where id=$1",[proof]);
  const r=await f.req('POST','/api/ledger/deposit-receipt-review',{companyId:f.co1,bankAccountId:bank.id,documentVersionId:proof,amount:'100',effectiveOn:f.date,reference:'SYN-REVIEW'});assert.equal(r.bankVerified,false);assert.equal(r.imageOcrAvailable,true);assert.equal(r.facts.amount,'99.00');assert(r.differences.includes('amount'));assert.equal(r.facts.account,'…3456');
 });
 await t.test('actual local Arabic/English OCR reads a synthetic PNG and flags a financial mismatch without bank approval',async()=>{
  const bytes=Buffer.from((await readFile('backend/tests/fixtures/synthetic-deposit-ocr.base64','utf8')).trim(),'base64'),proof=(await f.req('POST','/api/documents',{companyId:f.co1,category:'other',title:'Synthetic OCR receipt',description:'No real financial data',date:f.date,name:'receipt.png',mime:'image/png',base64:bytes.toString('base64')})).versionId;await f.admin.query("update ab.document_versions set scan_status='clean' where id=$1",[proof]);
  imageProof=proof;const r=await f.req('POST','/api/ledger/deposit-receipt-review',{companyId:f.co1,bankAccountId:bank.id,documentVersionId:proof,amount:'100',effectiveOn:f.date,reference:'SYN-IMAGE-1'});assert.equal(r.bankVerified,false);assert.equal(r.imageOcrAvailable,true);assert.equal(r.extraction,'localImageOcr');assert.equal(r.facts.amount,'99.00');assert(r.differences.includes('amount'));assert(r.confidence>=65);
 });
 await t.test('pending deposit reserves custody, duplicate references rejected, image alone cannot close custody',async()=>{
  bank=bank||await f.bank();proof=await f.proof();await f.admin.query("update ab.document_versions set scan_status='clean' where id=$1",[proof]);
  const body={companyId:f.co1,bankAccountId:bank.id,currency:'AED',amount:'600',effectiveOn:f.date,documentVersionId:proof,reference:'SYN-DEPOSIT-ONE'};
  const d=await f.req('POST','/api/ledger/deposits',body);await f.req('POST','/api/ledger/deposits',{...body,reference:' syn-deposit-one '},409);await f.req('POST','/api/ledger/deposits',{...body,reference:'SYN-TWO',amount:'201'},409);
  const n=(await f.admin.query('select count(*)::int n from ab.finance_receipts')).rows[0].n;
  const r=await f.req('POST','/api/ledger/deposits/'+d.id+'/confirm',{confirmedAmount:'500',effectiveOn:f.date,bankConfirmation:'Synthetic independent bank verification',accountAndDateVerified:true});assert.equal(r.remaining,'100.000');
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_receipts')).rows[0].n,n,'deposit creates no new customer receipt');
  const held=await f.req('GET','/api/ledger/custody/details?companyId='+f.co1);assert.equal(held.receipts.reduce((n:number,r:any)=>n+Number(r.amount),0),300);
 });
 await t.test('employee cannot view others custody or confirm their own deposit without owner control',async()=>{
  // A newly inserted synthetic Review request has no posting or historical movement.
  const control=randomUUID();await f.admin.query("insert into ab.finance_deposits(id,tenant_id,company_id,holder_id,bank_account_id,currency,amount,effective_on,document_version_id,payload_cipher,created_by)values($1,$2,$3,$4,$5,'AED',50,$6,$7,$8,$4)",[control,f.org.tenant,f.co1,employee.id,bank.id,f.date,proof,security(f.secret.key).seal({reference:'SYN-SELF-CONTROL'})]);
  for(const action of ['ledger_report','customer_view'])await f.req('POST','/api/users/'+employee.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  await f.login(employee.username,employee.password);await f.req('GET','/api/ledger/custody/details?companyId='+f.co1+'&holderId='+f.org.user,undefined,403);
  await f.req('GET','/api/ledger/receivables?companies='+f.co2,undefined,403);
  await f.req('POST','/api/ledger/deposits/'+control+'/confirm',{confirmedAmount:'50',effectiveOn:f.date,bankConfirmation:'Cannot verify self',accountAndDateVerified:true},403);
  await f.req('GET','/api/ledger/receivables?companies='+f.co1+'&format=excel',undefined,403);
  const report=await f.req('GET','/api/ledger/reports?companies='+f.co1+'&kind=custody&from=2026-01-01&to=2026-12-31');assert(report.rows.every((r:any)=>r.holder_id===employee.id));
 });
 await t.test('one customer is aggregated once while legal company balances and source relationships remain independent',async()=>{
  await f.login();await f.bill('50',f.items.loan,{companyId:f.co2});const r=await f.req('GET','/api/ledger/receivables?customerId='+f.client);assert.equal(r.summary.length,1);assert.equal(r.summary[0].invoiced,'1850.000');assert.equal(r.summary[0].outstanding,'150.000');assert.equal(r.summary[0].companyIds.length,2);
  const v=await f.req('GET','/api/ledger/receivables?customerId='+f.client+'&level=vehicle');assert.equal(v.summary.length,2);const st=await f.req('GET','/api/ledger/customer-statement?customerId='+f.client);assert.equal(st.closing[f.co1+':AED'],'100.000');assert.equal(st.closing[f.co2+':AED'],'50.000');
  assert.equal((await f.admin.query('select company_id from ab.customers where id=$1',[f.client])).rows[0].company_id,f.co1);
 });
 await t.test('new deposit confirmation enforces proven OCR differences and duplicate-image controls without another customer receipt',async()=>{
  const body={companyId:f.co1,bankAccountId:bank.id,currency:'AED',amount:'100',effectiveOn:f.date,documentVersionId:imageProof,reference:'SYN-IMAGE-1'},d=await f.req('POST','/api/ledger/deposits',body);
  await f.req('POST','/api/ledger/deposits/'+d.id+'/confirm',{confirmedAmount:'100',effectiveOn:f.date,bankConfirmation:'Synthetic authorized bank review',accountAndDateVerified:true},422);
  const result=await f.req('POST','/api/ledger/deposits/'+d.id+'/confirm',{confirmedAmount:'99',effectiveOn:f.date,bankConfirmation:'Synthetic actual bank credit 99',accountAndDateVerified:true});assert.equal(result.remaining,'1.000');
  await f.req('POST','/api/ledger/deposits',{...body,reference:'SYN-DUPLICATE-IMAGE'},409);const st=await f.req('GET','/api/ledger/customer-statement?customerId='+f.client);assert.equal(st.closing[f.co1+':AED'],'100.000');
 });
 }finally{await f.close();}
});
