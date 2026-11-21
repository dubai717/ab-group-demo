import test from 'node:test';
import assert from 'node:assert/strict';
import {invoiceImportTemplate,invoiceImportFields} from '../src/invoice-import-template.js';
import {customerSpreadsheet} from '../src/customer-spreadsheet.js';
import {ledgerFixture} from './ledger-fixture.js';
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
