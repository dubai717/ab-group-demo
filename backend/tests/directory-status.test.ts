import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {personnelFixture} from './personnel-fixture.js';
test('unit and position status changes require owner confirmation and preserve employee links, metadata and grants',async()=>{
 const f=await personnelFixture();try{
  const unit=await f.req('POST','/api/personnel/departments',{companyId:f.co1,typeCode:'OPS',description:'Original responsibilities'}),position=await f.req('POST','/api/personnel/positions',{nameAr:'منصب الحالة',nameEn:'Status position'});
  const staff=await f.req('POST','/api/personnel/employees',{companyId:f.co1,departmentId:unit.id,positionId:position.id,nameAr:'موظف مرتبط',nameEn:'Linked employee',jobTitle:'Status position',hiredOn:'2026-01-01'});
  await f.admin.query("update ab.settings set value=value||'{\"legacyMarker\":\"preserve\"}'::jsonb where key=$1",['department-profile:'+unit.id]);
  const user=await f.employee();
  const before=(await f.admin.query('select * from ab.hr_employees where id=$1',[staff.id])).rows;
  const roles=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
  const grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  for(const [kind,key]of [['departments',unit.id],['positions',position.id]]){
   const url='/api/personnel/'+kind+'/'+key+'/status';
   await f.req('POST',url,{status:'Inactive',revision:1,confirm:false},422);
   await f.req('POST',url,{status:'Inactive',revision:1,confirm:true,nameAr:'Do not overwrite'},422);
   await f.login(user.username,user.password);await f.req('POST',url,{status:'Inactive',revision:1,confirm:true},403);await f.login();
   const token=randomUUID(),body={status:'Inactive',revision:1,confirm:true};const first=await f.req('POST',url,body,200,token);assert.equal(first.revision,2);assert.deepEqual(await f.req('POST',url,body,200,token),first);
   await f.req('POST',url,{status:'Active',revision:1,confirm:true},409);
   const second=await f.req('POST',url,{status:'Active',revision:2,confirm:true});assert.equal(second.revision,3);
   const current=(await f.req('GET','/api/personnel/'+kind)).rows.find((r:any)=>r.id===key);assert.equal(current.status,'Active');assert.equal(current.revision,3);
  }
  assert.deepEqual((await f.admin.query('select * from ab.hr_employees where id=$1',[staff.id])).rows,before);
  assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,roles);
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);
  const meta=(await f.admin.query('select value from ab.settings where key=$1',['department-profile:'+unit.id])).rows[0].value;assert.equal(meta.legacyMarker,'preserve');assert.equal(meta.description,'Original responsibilities');
  const count=(await f.admin.query("select count(*) from ab.audit_events where entity_id in ($1,$2) and action in ('department_status_changed','position_status_changed')",[unit.id,position.id])).rows[0];assert.equal(Number(count.count),4);
 }finally{await f.close();}
});
