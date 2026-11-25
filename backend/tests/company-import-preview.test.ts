import test from 'node:test';import assert from 'node:assert/strict';
import {personnelFixture} from './personnel-fixture.js';import {workbook} from './import-fixture-files.js';
import {customerSpreadsheet} from '../src/customer-spreadsheet.js';
test('Company file preview shares original create validation and preserves every source row, grant and financial record without apply',async()=>{
 const f=await personnelFixture();try{
  const snapshot=async()=>({companies:(await f.admin.query('select * from ab.companies order by id')).rows,licenses:(await f.admin.query('select * from ab.company_licenses order by id')).rows,grants:(await f.admin.query('select * from ab.permission_grants order by id')).rows,journals:(await f.admin.query('select * from ab.finance_journals order by id')).rows});
  const before=await snapshot(),base='/api/data-imports/companies';
  const tpl=await f.req('GET',base+'/template');assert.equal(tpl.canApply,false);assert.equal(tpl.previewOnly,true);assert.deepEqual(await customerSpreadsheet(Buffer.from(tpl.base64,'base64'),null),[]);
  const csv=await f.req('GET',base+'/template?source=csv');assert.match(csv.name,/\.csv$/);assert.equal(Buffer.from(csv.base64,'base64').toString().split('\r\n').length,2);
  const headers=['arabicName','englishName','tradeLicenseNumber','email','issueDate'];
  const source=workbook([headers,['شركة اصطناعية','Synthetic independent import','ONLY-FAKE-41','','2026-11-20'],['شركة اصطناعية','Synthetic independent import','ONLY-FAKE-41','','2026-11-20'],['','Invalid missing Arabic','ONLY-FAKE-42','',''],['شركة خاطئة','Bad dates','ONLY-FAKE-43','not-an-email','2026-02-30']]);
  const dedupBefore=(await f.admin.query('select count(*)::int n from ab.request_dedup')).rows[0].n;const body={format:'xlsx',base64:source.toString('base64')},review=await f.req('POST',base+'/preview',body);assert.deepEqual(review.snapshot,{isolation:'repeatable read',readOnly:true});assert.equal((await f.admin.query('select count(*)::int n from ab.request_dedup')).rows[0].n,dedupBefore);
  assert.deepEqual(review.counts,{total:4,valid:1,review:0,duplicates:1,invalid:2});assert.equal(review.canApply,false);assert.equal(review.plan[2].fieldErrors.arabicName,'required');assert.equal(review.plan[3].fieldErrors.email,'invalidEmail');assert.equal(review.plan[3].fieldErrors.issueDate,'invalidDates');assert.equal(review.plan[0].source.tradeLicenseNumber,'ONLY-FAKE-41');assert.equal(Object.hasOwn(review.plan[0],'id'),false);
  const repeat=await f.req('POST',base+'/preview',body);assert.deepEqual(repeat,review);assert.deepEqual(await snapshot(),before);
  // Actual create remains the original API. A matching name/licence is reviewable, never auto-merged.
  const id=(await f.req('POST','/api/companies',{arabicName:'شركة اصطناعية',englishName:'Synthetic independent import',tradeLicenseNumber:'ONLY-FAKE-41'})).id;
  const afterCreate=await snapshot();const matched=await f.req('POST',base+'/preview',body);assert.equal(matched.counts.review,1);assert.equal(matched.plan[0].matches[0].id,id);assert.deepEqual(await snapshot(),afterCreate);
  await f.req('POST',base+'/run',{confirmed:true},503);
  for(const text of ['arabicName,unknownGrant\nName,owner','arabicName\nName"changed"'])await f.req('POST',base+'/preview',{format:'csv',base64:Buffer.from(text).toString('base64')},422);
  const worker=await f.employee();await f.login(worker.username,worker.password);await f.req('GET',base+'/template',undefined,403);await f.req('POST',base+'/preview',body,403);
 }finally{await f.close();}
});
