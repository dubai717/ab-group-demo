import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { businessCentersFixture } from './business-centers-fixture.js';
import { transaction } from '../src/core.js';

test('payroll decision links inherit company scope and reject a decision from another employee or month',async()=>{
 const f=await businessCentersFixture();
 try{
  const worker=await f.employee();
  const pairs=[];
  for(const companyId of [f.co1,f.co2]){
   const employee=await f.req('POST','/api/personnel/employees',{
    companyId,nameAr:'موظف اصطناعي',nameEn:'Synthetic payroll fixture',jobTitle:'Test',hiredOn:'2024-01-01',
   });
   const payroll=randomUUID(),decision=randomUUID();
   await f.admin.query("insert into ab.hr_payroll(id,tenant_id,employee_id,company_id,month,currency,net,payload_cipher,created_by) values($1,$2,$3,$4,'2026-01-01','AED',1,'synthetic',$5)",[payroll,f.org.tenant,employee.id,companyId,f.org.user]);
   await f.admin.query("insert into ab.hr_decisions(id,tenant_id,employee_id,company_id,month,kind,amount,reference,payload_cipher,created_by) values($1,$2,$3,$4,'2026-01-01','bonus',1,'synthetic','synthetic',$5)",[decision,f.org.tenant,employee.id,companyId,f.org.user]);
   await f.admin.query('insert into ab.hr_payroll_decisions(id,tenant_id,payroll_id,decision_id,created_by) values($1,$2,$3,$4,$5)',[randomUUID(),f.org.tenant,payroll,decision,f.org.user]);
   pairs.push({payroll,decision,employee:employee.id});
  }
  for(const file of ['operating-centres.sql','company-scope-upper-bound.sql','company-scope-payroll-decisions.sql']){
   await f.admin.query(await readFile('backend/review/'+file,'utf8'));
  }
  const tx=(actor:string,work:(c:any)=>Promise<any>)=>transaction(f.runtime,f.org.tenant,actor,work);
  const version=randomUUID();
  await tx(f.org.user,async c=>{
   await c.query("insert into ab.user_access_scope_versions(id,tenant_id,user_id,revision,selection_kind,payload_cipher,created_by) values($1,$2,$3,1,'companies','synthetic only',$4)",[version,f.org.tenant,worker.id,f.org.user]);
   await c.query('insert into ab.user_access_scope_companies values($1,$2,$3,$4)',[f.org.tenant,worker.id,version,f.co1]);
  });
  const [own,foreign]=pairs,wrongMonth=randomUUID();
  await f.admin.query("insert into ab.hr_decisions(id,tenant_id,employee_id,company_id,month,kind,amount,reference,payload_cipher,created_by) values($1,$2,$3,$4,'2026-02-01','bonus',1,'wrong month','synthetic',$5)",[wrongMonth,f.org.tenant,own.employee,f.co1,f.org.user]);
  const read=(actor:string)=>tx(actor,async c=>(await c.query('select payroll_id from ab.hr_payroll_decisions order by payroll_id')).rows.map((r:any)=>r.payroll_id));
  assert.deepEqual(await read(worker.id),[own.payroll]);
  assert.deepEqual(await read(f.org.user),[own.payroll,foreign.payroll].sort());
  for(const decision of [foreign.decision,wrongMonth]){
   await assert.rejects(tx(worker.id,c=>c.query('insert into ab.hr_payroll_decisions(id,tenant_id,payroll_id,decision_id,created_by) values($1,$2,$3,$4,$5)',[randomUUID(),f.org.tenant,own.payroll,decision,worker.id])),(e:any)=>e.code==='42501');
  }
  assert.deepEqual(await read(worker.id),[own.payroll]);
 }finally{await f.close();}
});
