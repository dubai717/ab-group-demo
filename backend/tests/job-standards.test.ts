import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {personnelFixture} from './personnel-fixture.js';
test('job standards reuse the original reviewed roles and position catalogue without showing members or changing any account by position',async()=>{const f=await personnelFixture();try{
 const job=await f.req('POST','/api/personnel/positions',{nameAr:'منصب قياسي معزول',nameEn:'Isolated standard position'}),staff=await f.employee();
 let directory=await f.req('GET','/api/job-standards');assert.equal(directory.enabled,false);assert(directory.positions.some((r:any)=>r.id===job.id));assert(!JSON.stringify(directory).includes(staff.username));assert(directory.rows.every((r:any)=>!Object.hasOwn(r,'members')));
 await f.req('POST','/api/security-roles/plan',{revision:0,nameAr:'معيار اختبار',nameEn:'Synthetic standard',permissions:['customer_view'],jobPositionId:job.id,version:directory.version},503);
 assert(/^ab_backup_[a-f0-9]{32}$/.test(f.sourceDatabase));await f.admin.query(await readFile('backend/review/security-roles.sql','utf8'));
 directory=await f.req('GET','/api/job-standards');const before=(await f.admin.query('select id,role_id,data,revision from ab.users order by id')).rows,grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
 const body={revision:0,nameAr:'معيار اختبار',nameEn:'Synthetic standard',permissions:['customer_view'],jobPositionId:job.id,version:directory.version};
 await f.req('POST','/api/security-roles/plan',{...body,jobPositionId:randomUUID()},422);const plan=await f.req('POST','/api/security-roles/plan',body);assert.equal(plan.after.jobPositionId,job.id);assert.equal(plan.saved,false);assert.equal((await f.req('GET','/api/job-standards')).rows.length,0);
 const key=randomUUID(),apply={...body,id:plan.after.id,confirm:true,planHash:plan.planHash},a=await f.req('POST','/api/security-roles/apply',apply,200,key),b=await f.req('POST','/api/security-roles/apply',apply,200,key);assert.equal(a.id,b.id);
 const after=await f.req('GET','/api/job-standards'),role=after.rows.find((r:any)=>r.id===a.id);assert.equal(role.jobPositionId,job.id);assert.deepEqual(role.permissions,['customer_view']);assert(!Object.hasOwn(role,'members'));
 await f.req('POST','/api/security-roles/plan',{...body,version:after.version,nameAr:'معيار آخر',nameEn:'Another standard'},409);
 assert.deepEqual((await f.admin.query('select id,role_id,data,revision from ab.users order by id')).rows,before);assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);
 await f.login(staff.username,staff.password);await f.req('GET','/api/job-standards',undefined,403);await f.req('POST','/api/security-roles/plan',{...body,version:after.version},403);
 }finally{await f.close();}});
