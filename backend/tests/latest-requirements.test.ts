import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {personnelFixture} from './personnel-fixture.js';
import {vehicleFixture} from './vehicle-fixture.js';

test('registration reuses the original funding approval and one PRO task with actual source completion',async()=>{
 const f=await personnelFixture();try{
 const pro=await f.employee('pr_manager'),employee=await f.req('POST','/api/personnel/employees',{companyId:f.co1,userId:pro.id,nameAr:'مسؤول اختبار',nameEn:'Synthetic PRO',jobTitle:'Public relations',hiredOn:'2026-01-01'});
 const r=await f.request(),body={employeeId:employee.id,dueOn:'2026-11-20',note:'Synthetic explicit PRO assignment'};
 const task=await f.req('POST',`/api/vehicle-requests/${r.id}/registration-task`,body);
 assert.equal(task.created,true);assert.equal((await f.req('POST',`/api/vehicle-requests/${r.id}/registration-task`,body)).id,task.id);
 const row=(await f.req('GET','/api/personnel/tasks')).rows.find((t:any)=>t.id===task.id);assert.equal(row.source_id,r.id);assert.equal(row.source_type,'vehicle_registration');assert.equal(row.employee_id,employee.id);
 await f.req('POST','/api/personnel/tasks/'+task.id+'/action',{action:'submit',note:'Synthetic submit before registration',revision:1});
 await f.req('POST','/api/personnel/tasks/'+task.id+'/action',{action:'complete',note:'Approval alone is insufficient',revision:2},409);
 await f.login(pro.username,pro.password);
 await f.req('POST',`/api/vehicle-requests/${r.id}/funding-decision`,{approve:true,reason:'Must not bypass approval',revision:1},403);
 await f.req('POST',`/api/vehicle-requests/${r.id}/registration-task`,body,403);
 await f.login();await f.fund(r.id);
 await f.req('POST','/api/personnel/tasks/'+task.id+'/action',{action:'complete',note:'Disbursement alone is insufficient',revision:2},409);
 await f.register(r.id);await f.req('POST','/api/personnel/tasks/'+task.id+'/action',{action:'complete',note:'Verified actual registration',revision:2});
 assert.equal((await f.req('GET','/api/personnel/tasks')).rows.find((t:any)=>t.id===task.id).state,'Completed');
 await f.req('POST',`/api/vehicle-requests/${r.id}/registration-task`,body,409);
 const r2=await f.request(),outside=await f.req('POST','/api/personnel/employees',{companyId:f.co2,nameAr:'خارج النطاق',nameEn:'Other scope',jobTitle:'Synthetic',hiredOn:'2026-01-01'});
 await f.req('POST',`/api/vehicle-requests/${r2.id}/registration-task`,{...body,employeeId:outside.id},422);
 }finally{await f.close();}
});

test('vehicle status counts cover all permitted pages and honor company, licence, search and grid',async()=>{
 const f=await vehicleFixture();try{
 const request=await f.request(),first=await f.register(request.id);
 // More than one UI page, in this randomly named synthetic database only.
 for(let i=0;i<60;i++){const r=await f.request(),v=await f.register(r.id);await f.admin.query('update ab.vehicles set status=$2 where id=$1',[v.id,['Active','Pending','Terminated'][i%3]]);}
 const other=await f.request({companyId:f.co2,financeType:'cash',expectedFunding:'0'});await f.register(other.id);
 const license=(await f.req('GET','/api/companies/'+f.co1)).licenseId;
 const get=(query:any={},grid:any={})=>f.req('GET','/api/registers/vehicles?'+new URLSearchParams({query:JSON.stringify(query),grid:JSON.stringify(grid),limit:'1'}));
 const all=await get();assert.equal(all.total,62);assert.equal(all.rows.length,1);assert.deepEqual(all.statusCounts,{total:62,Active:22,Pending:20,Terminated:20});
 const scoped=await get({companies:f.co1,licenseId:license});assert.deepEqual(scoped.statusCounts,{total:61,Active:21,Pending:20,Terminated:20});
 assert.equal((await get({companies:f.co2,licenseId:license})).statusCounts.total,0);
 const filtered=await get({companies:f.co1},{values:{status:['Pending']}});assert.equal(filtered.total,20);assert.equal(filtered.statusCounts.total,61);
 assert.equal((await get({q:'not-present-anywhere'})).statusCounts.total,0);
 const user=await f.employee();await f.grant(user.id,'view');await f.login(user.username,user.password);
 assert.equal((await get()).statusCounts.total,61);assert.equal((await get({companies:f.co2})).statusCounts.total,0);
 }finally{await f.close();}
});
