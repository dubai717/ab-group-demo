import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixture.js';
import {provisionTestUsers} from '../src/test-user-provisioning.js';
import {seedIntegratedData,uploadTestObjects} from '../fixtures/integrated-test-data.js';
import {transaction} from '../src/core.js';
import {tenantKeys,fictionalIban,type DataManifest} from '../fixtures/test-data-store.js';
test('TEST_DATA uses reserved fictional bank routing and distinct identifiers',()=>{assert.equal(fictionalIban(1).length,23);assert.equal(fictionalIban(1).slice(4,7),'000');assert.notEqual(fictionalIban(1),fictionalIban(2));});
test('integrated TEST_DATA creates 5 companies, 30 customers, 50 vehicles with balanced linked finances and no duplication',async()=>{
 const f=await fixture('ab_backup_'+randomUUID().replaceAll('-',''));
 try{
  for(const name of ['009_financial_workbench.sql','010_customers.sql','011_vehicles.sql','012_financial_management.sql','013_personnel_tasks_performance.sql'])await f.admin.query(await readFile('supabase/proposed/'+name,'utf8'));
  const registry=(await provisionTestUsers(f.admin,f.auth,f.secret.key,{tenant:f.org.tenant,id:f.org.user})).registry;
  const initialUsers=JSON.stringify((await f.admin.query('select * from ab.users order by id')).rows),initialPermissions=JSON.stringify((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows);
  const r=await seedIntegratedData(f.runtime,f.secret.key,registry,f.objects);assert(r.created);const d=r.manifest;assert.equal(d.state,'ready');assert.equal(d.companies.length,5);assert.equal(d.banks.length,7);assert.equal(d.customers.length,30);assert.equal(d.vehicles.length,50);assert.equal(d.financings.length,12);assert.equal(d.tasks.length,35);assert(d.receipts.length>0);assert(Object.keys(d.objects).length>=65);
  await transaction(f.runtime,registry.tenant,registry.owner,async c=>{
   assert.equal(Number((await c.query('select count(*)n from ab.vehicles v join ab.customers c on c.id=v.customer_id where v.id=any($1::uuid[])and v.company_id<>c.company_id',[d.vehicles.map(v=>v.id)])).rows[0].n),0);
   assert.equal(Number((await c.query('select count(*)n from(select journal_id from ab.finance_entries where company_id=any($1::uuid[])and journal_id is not null group by journal_id having sum(debit)<>sum(credit))x',[d.companies.map(x=>x.id)])).rows[0].n),0);
  });
  const before=await transaction(f.runtime,registry.tenant,registry.owner,c=>tenantKeys(c));const reused=await seedIntegratedData(f.runtime,f.secret.key,registry,f.objects);assert.equal(reused.created,false);assert.deepEqual(await transaction(f.runtime,registry.tenant,registry.owner,c=>tenantKeys(c)),before);
  assert.equal(JSON.stringify((await f.admin.query('select * from ab.users order by id')).rows),initialUsers);assert.equal(JSON.stringify((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows),initialPermissions);
  console.log('CHECK: TEST_DATA_RELATIONS_BALANCED_JOURNALS_PRIVATE_OBJECTS_REPLAY_AND_USERS_PRESERVED=PASS');
 }finally{await f.app.close();await f.runtime.end();await f.admin.end();}
});

test('private fixture upload resumes with identical keys, no overwrite and no repeated puts',async()=>{
 const rows=new Map<string,Buffer>(),puts:string[]=[],manifest={objects:{'TEST_DATA/a':Buffer.from('fixture-a').toString('base64'),'TEST_DATA/b':Buffer.from('fixture-b').toString('base64')}};let fail=true;
 const store={get:async(k:string)=>{const v=rows.get(k);if(!v)throw Error('notFound');return v;},put:async(k:string,b:Buffer)=>{if(k.endsWith('/b')&&fail){fail=false;throw Error('simulated outage');}assert(!rows.has(k));rows.set(k,b);puts.push(k);}};
 await assert.rejects(uploadTestObjects(store,manifest));await uploadTestObjects(store,manifest);await uploadTestObjects(store,manifest);assert.equal(rows.size,2);assert.deepEqual(puts,['TEST_DATA/a','TEST_DATA/b']);
});
