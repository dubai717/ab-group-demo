import test from 'node:test';import assert from 'node:assert/strict';
import {personnelFixture} from './personnel-fixture.js';import {workbook} from './import-fixture-files.js';
import {customerSpreadsheet} from '../src/customer-spreadsheet.js';
test('Employee import preview reuses original personnel validator in a read-only snapshot without employee/Auth/payroll/receipt writes',async()=>{
 const f=await personnelFixture();try{
  const bootstrap=await f.req('GET','/api/bootstrap'),companyId=bootstrap.companies[0].id,base='/api/data-imports/employees';
  const snapshot=async()=>({employees:(await f.admin.query('select * from ab.hr_employees order by id')).rows,grants:(await f.admin.query('select * from ab.permission_grants order by id')).rows,journals:(await f.admin.query('select * from ab.finance_journals order by id')).rows,audit:(await f.admin.query('select count(*)::int n from ab.audit_events')).rows,dedup:(await f.admin.query('select count(*)::int n from ab.request_dedup')).rows});
  const template=await f.req('GET',base+'/template');assert.equal(template.canApply,false);assert.deepEqual(await customerSpreadsheet(Buffer.from(template.base64,'base64'),null),[]);assert.equal(template.fields.some((f:any)=>/salary|identity|userId|password/i.test(f.key)),false);
  const headers=['companyId','nameAr','nameEn','jobTitle','hiredOn','phone','email'];
  const source=workbook([headers,[companyId,'موظف اختبار','Synthetic import employee','Testing','2026-11-20','',''],[companyId,'موظف اختبار','Synthetic import employee','Testing','2026-11-20','',''],[companyId,'','Missing required name','Testing','2026-11-20','',''],[companyId,'تاريخ خطأ','Invalid date','Testing','2026-02-30','',''],['00000000-0000-4000-8000-000000000000','شركة غير موجودة','Unknown company','Testing','2026-11-20','',''],[companyId,'هاتف خطأ','Invalid phone','Testing','2026-11-20','abc','']]);
  const body={format:'xlsx',base64:source.toString('base64')},before=await snapshot(),review=await f.req('POST',base+'/preview',body);
  assert.deepEqual(review.counts,{total:6,valid:1,review:1,invalid:4});assert.deepEqual(review.snapshot,{isolation:'repeatable read',readOnly:true});assert.equal(review.canApply,false);assert.equal(review.reason,'employeeImportApplyNotImplemented');assert.deepEqual(review.plan[1].sourceRows,[2]);assert.equal(review.plan[2].fieldErrors.nameAr,'invalid');assert.equal(review.plan[4].code,'invalidCompany');assert.deepEqual(await snapshot(),before);assert.deepEqual(await f.req('POST',base+'/preview',body),review);
  // Only the original employee creator writes the test employee; preview never consumes a number.
  const employee=await f.req('POST','/api/personnel/employees',{companyId,nameAr:'موظف اختبار',nameEn:'Synthetic import employee',jobTitle:'Testing',hiredOn:'2026-11-20'}),after=await snapshot(),matched=await f.req('POST',base+'/preview',body);assert.equal(matched.plan[0].state,'needsReview');assert.equal(matched.plan[0].matches[0].id,employee.id);assert.equal(matched.plan[0].matches[0].number,employee.number);assert.deepEqual(await snapshot(),after);
  for(const text of ['nameAr,userId\nTest,owner','nameAr\nTest"hidden"'])await f.req('POST',base+'/preview',{format:'csv',base64:Buffer.from(text).toString('base64')},422);
  const worker=await f.employee();await f.login(worker.username,worker.password);await f.req('GET',base+'/template',undefined,403);await f.req('POST',base+'/preview',body,403);
 }finally{await f.close();}
});
