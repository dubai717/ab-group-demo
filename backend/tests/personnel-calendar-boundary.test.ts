import test from 'node:test';
import assert from 'node:assert/strict';
import { personnelFixture } from './personnel-fixture.js';
import { security } from '../src/core.js';
import { legalEOS, payrollPreview } from '../src/personnel-domain.js';

test('payroll cutoff and gratuity anniversary use the recorded hire calendar day', async () => {
 const f=await personnelFixture();
 try {
  const employee=await f.req('POST','/api/personnel/employees',{
   companyId:f.co1,nameAr:'موظف اصطناعي',nameEn:'Synthetic hire boundary',jobTitle:'Test',hiredOn:'2024-02-01',
  });
  await f.req('POST','/api/personnel/employees/'+employee.id+'/private',{legalRegime:'uae_private_general'});
  await f.req('POST','/api/personnel/employees/'+employee.id+'/compensation',{
   companyId:f.co1,effectiveOn:'2024-02-01',currency:'AED',basic:'300',allowances:'0',
   allocations:[{companyId:f.co1,bps:10000}],reason:'Synthetic contract',
  });
  const cipher=security(f.secret.key), row=(await f.admin.query('select * from ab.hr_employees where id=$1',[employee.id])).rows[0];
  await assert.rejects(payrollPreview(f.admin,cipher,row,'2024-01-01'),(e:any)=>e.code==='payrollBeforeHire');
  assert.equal((await payrollPreview(f.admin,cipher,row,'2024-02-01')).net,'300.000');
  const before=await legalEOS(f.admin,cipher,row,'2025-01-31');
  const anniversary=await legalEOS(f.admin,cipher,row,'2025-02-01');
  assert.equal(before.available,true);
  assert.equal(before.gross,'0.000');
  assert.equal(anniversary.gross,'210.000');
 } finally {
  await f.close();
 }
});
