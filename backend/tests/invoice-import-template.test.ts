import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceImportTemplate,invoiceImportFields} from '../src/invoice-import-template.js';
import {customerSpreadsheet} from '../src/customer-spreadsheet.js';
import {ledgerFixture} from './ledger-fixture.js';
import {today} from '../src/vehicle-domain.js';
import {randomUUID} from 'node:crypto';
test('the actual generated UTF-8 BOM invoice template can be filled, previewed, committed once and retained byte-for-byte by the original import engine',async()=>{
 const f=await ledgerFixture();try{
  const template=await f.req('GET','/api/ledger/invoice-imports/template?companyId='+f.co1+'&format=csv'),item=await f.req('POST','/api/ledger/items',{nameAr:'خدمة اختبار قالب الاستيراد',nameEn:'Synthetic template service',category:'general',companyIds:[f.co1],invoice:true,receipt:true,payment:false,methods:['manual','bulk'],receivableId:f.accounts.ar.id,revenueId:f.accounts.income.id}),code=(await f.admin.query('select code from ab.finance_items where id=$1',[item.id])).rows[0].code,customer=String((await f.admin.query('select file_number from ab.customers where id=$1',[f.client])).rows[0].file_number),sourceKey='SYN-TEMPLATE-BOM-'+randomUUID();
  const bytes=Buffer.concat([Buffer.from(template.base64,'base64'),Buffer.from([sourceKey,customer,'','',code,'1.001','AED',today()].join(',')+'\r\n')]);
  const preview=await f.req('POST','/api/ledger/invoice-imports',{companyId:f.co1,name:template.filename,format:'csv',base64:bytes.toString('base64'),mapping:{sourceKey:'sourceKey',customerNumber:'customerNumber',vehicleNumber:'vehicleNumber',plate:'plate',itemCode:'itemCode',amount:'amount',currency:'currency',dueOn:'dueOn'}});
  assert.equal(preview.rows.length,1);assert(!preview.rows[0].error);
  const result=await f.req('POST','/api/ledger/invoice-imports/'+preview.id+'/commit',{});
  assert.equal(result.created.length,1);
  const savedInvoice=await f.admin.query('select amount::text from ab.vehicle_invoices where id=$1',[result.created[0].id]);
  assert.equal(savedInvoice.rows[0].amount,'1.001');
  await f.req('POST','/api/ledger/invoice-imports/'+preview.id+'/commit',{},409);
  assert.equal((await f.req('GET','/api/ledger/invoice-imports/'+preview.id+'/source')).base64,bytes.toString('base64'));
 }finally{await f.close();}
});
test('invoice templates are empty compatible CSV/XLSX, examples cannot become invoices',async()=>{
 const csv=invoiceImportTemplate('csv'),xlsx=invoiceImportTemplate('xlsx');
 assert.equal(Buffer.from(csv.base64,'base64').toString(),'\uFEFF'+invoiceImportFields.map(f=>f.key).join(',')+'\r\n');
 assert.deepEqual(await customerSpreadsheet(Buffer.from(xlsx.base64,'base64'),'sourceKey'),[]);
 assert.equal(xlsx.financialEffect,false);assert.equal(xlsx.previewRequired,true);assert.equal(xlsx.filename,'invoice-import-template.xlsx');
});
test('template download uses existing import authority without changing financial records or grants',async()=>{
 const f=await ledgerFixture();try{
  const before=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const template=await f.req('GET','/api/ledger/invoice-imports/template?companyId='+f.co1);assert.equal(template.filename,'invoice-import-template.xlsx');
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_invoice_imports')).rows[0].n,0);
  assert.equal((await f.admin.query('select count(*)::int n from ab.vehicle_invoices')).rows[0].n,0);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,0);
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);
  const employee=await f.employee();await f.login(employee.username,employee.password);
  await f.req('GET','/api/ledger/invoice-imports/template?companyId='+f.co1,undefined,403);
  await f.login();await f.req('POST','/api/users/'+employee.id+'/grants',{action:'ledger_invoice_import',scope:{type:'company',id:f.co1},delegable:false});await f.login(employee.username,employee.password);
  assert.equal((await f.req('GET','/api/ledger/invoice-imports/template?companyId='+f.co1+'&format=csv')).filename,'invoice-import-template.csv');
  await f.req('GET','/api/ledger/invoice-imports/template?companyId='+f.co2,undefined,403);
 }finally{await f.close();}
});

test('monthly Salik templates are empty and require each original transaction date',async()=>{const csv=invoiceImportTemplate('csv',true),xlsx=invoiceImportTemplate('xlsx',true);assert.equal(csv.filename,'monthly-salik-template.csv');assert.equal(csv.fields.find(f=>f.key==='vehicleNumber')?.required,true);assert.ok(csv.fields.some(f=>f.key==='occurredOn'&&f.required));assert.ok(!csv.fields.some(f=>f.key==='plate'));assert.deepEqual(await customerSpreadsheet(Buffer.from(xlsx.base64,'base64'),'sourceKey'),[]);});
