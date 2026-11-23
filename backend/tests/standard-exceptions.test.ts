import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
import {personnelFixture} from './personnel-fixture.js';
import {standardExceptionImpact} from '../src/standard-exceptions.js';
test('selected exception preview never cascades to unselected or inherited sources',()=>{
 const user=randomUUID(),actor=randomUUID(),a=randomUUID(),b=randomUUID(),outside=randomUUID();
 const m:any={state:{users:[{id:user,roleId:'standard',revision:1}]},initialGrants:[{userId:user,entry:{id:a,action:'customer_view',scope:{type:'company',id:'x'}}},{userId:user,entry:{id:b,action:'vehicle_view',scope:{type:'company',id:'x'}}}],grants:[]};
 const keep=standardExceptionImpact(m,actor,'standard','retain_all',[]);assert.equal(keep.affectedUsers[0].retainedAdditionCount,2);
 const selected=standardExceptionImpact(m,actor,'standard','remove_selected',[a]);assert.equal(selected.affectedUsers[0].retainedAdditionCount,1);assert.equal(selected.affectedUsers[0].selectedRemovalCount,1);assert.equal(selected.individualDenySupported,false);
 for(const ids of [[],[a,a],[outside]])assert.throws(()=>standardExceptionImpact(m,actor,'standard','remove_selected',ids));
 assert.throws(()=>standardExceptionImpact(m,actor,'standard','retain_all',[a]));
 m.grants=[{issuer_id:user,user_id:outside}];assert.throws(()=>standardExceptionImpact(m,actor,'standard','remove_selected',[a]),/reviewDownstreamGrantsFirst/);assert.equal(standardExceptionImpact(m,actor,'standard','retain_all',[]).affectedUsers[0].individualAdditionCount,2);
 assert.throws(()=>standardExceptionImpact({...m,grants:[]},user,'standard','remove_selected',[a]),/ownerProtected/);
});
test('reviewed selected removal is atomic, scoped, deduplicated and retains every unselected original grant',async()=>{const f=await personnelFixture();try{
 assert(/^ab_backup_[a-f0-9]{32}$/.test(f.sourceDatabase));await f.admin.query(await readFile('backend/review/security-roles.sql','utf8'));
 const staff=await f.employee(),other=await f.employee();let dir=await f.req('GET','/api/security-roles');
 const create={revision:0,nameAr:'معيار إزالة اصطناعي',nameEn:'Synthetic selected exception standard',permissions:['customer_view'],version:dir.version};const p=await f.req('POST','/api/security-roles/plan',create);await f.req('POST','/api/security-roles/apply',{...create,id:p.after.id,confirm:true,planHash:p.planHash});
 for(const user of [staff,other])for(const action of ['customer_followup','vehicle_view'])await f.req('POST','/api/users/'+user.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
 dir=await f.req('GET','/api/security-roles');const scope=(await f.req('GET','/api/users/'+staff.id+'/permission-summary')).user,as={userId:staff.id,roleId:p.after.id,revision:scope.revision,version:dir.version},ap=await f.req('POST','/api/security-roles/assignment-plan',as);await f.req('POST','/api/security-roles/assignment-apply',{...as,confirm:true,planHash:ap.planHash});
 const before=(await f.admin.query('select * from ab.permission_grants order by id')).rows,selected=before.find((g:any)=>g.user_id===staff.id&&g.permission_id==='vehicle_view').id,foreign=before.find((g:any)=>g.user_id===other.id).id;
 dir=await f.req('GET','/api/security-roles');const r=dir.rows.find((r:any)=>r.id===p.after.id),body={id:r.id,revision:r.revision,nameAr:r.nameAr,nameEn:r.nameEn,permissions:['customer_view','customer_edit'],version:dir.version,exceptionPolicy:'remove_selected',selectedGrantIds:[selected]};
 await f.req('POST','/api/security-roles/plan',body,503);await f.admin.query(await readFile('backend/review/security-role-exceptions.sql','utf8'));
 await f.req('POST','/api/security-roles/plan',{...body,selectedGrantIds:[foreign]},422);await f.req('POST','/api/security-roles/plan',{...body,selectedGrantIds:[selected,selected]},422);
 const plan=await f.req('POST','/api/security-roles/plan',body);assert.equal(plan.saved,false);assert.equal(plan.selectiveRemovalEnabled,true);assert.equal(plan.affectedUsers[0].selectedRemovalCount,1);assert.equal(plan.affectedUsers[0].retainedAdditionCount,1);assert(!Object.hasOwn(plan.after,'selectedGrantIds'));
 const keep=await f.req('POST','/api/security-roles/plan',{...body,exceptionPolicy:'retain_all',selectedGrantIds:[]});assert.notEqual(keep.planHash,plan.planHash);
 await f.req('POST','/api/security-roles/apply',{...body,exceptionPolicy:'retain_all',selectedGrantIds:[],confirm:true,planHash:plan.planHash},409);
 assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);
 // Independently exercise DB guards before a valid write, rolling back only this random fixture.
 for(const mode of ['downstream','revision','actor']){await f.admin.query('begin');try{
  await f.admin.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[f.org.tenant,mode==='actor'?staff.id:f.org.user]);
  if(mode==='downstream')await f.admin.query("insert into ab.permission_grants(id,tenant_id,user_id,issuer_id,permission_id,scope_type,company_id,delegable)values($1,$2,$3,$4,'vehicle_view','company',$5,false)",[randomUUID(),f.org.tenant,other.id,staff.id,f.co1]);
  await assert.rejects(f.admin.query('select ab.save_security_role_with_exceptions($1,$2,$3,$4::uuid[])',[r.id,JSON.stringify(plan.after),mode==='revision'?999:1,[selected]]),mode==='downstream'?/reviewDownstreamGrantsFirst/:mode==='actor'?/ownerOnly/:/revisionConflict/);
 }finally{await f.admin.query('rollback');}}
 assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);
 const key=randomUUID(),apply={...body,confirm:true,planHash:plan.planHash};await f.req('POST','/api/security-roles/apply',apply,200,key);await f.req('POST','/api/security-roles/apply',apply,200,key);
 const after=(await f.admin.query('select * from ab.permission_grants order by id')).rows;assert.equal(after.length,before.length);
 for(let i=0;i<after.length;i++){if(after[i].id===selected){assert(after[i].revoked_at);assert.deepEqual({...after[i],revoked_at:null},before[i]);}else assert.deepEqual(after[i],before[i]);}
 const summary=await f.req('GET','/api/users/'+staff.id+'/permission-summary');assert(summary.rolePermissions.includes('customer_edit'));assert.deepEqual(summary.user.companyIds,scope.companyIds);assert.deepEqual(summary.user.departmentIds,scope.departmentIds);assert.deepEqual(summary.user.companyPermissions,scope.companyPermissions);
 assert.equal((await f.admin.query("select count(*)::int n from ab.audit_events where action='security_standard_exceptions_removed'")).rows[0].n,1);
 await f.login(staff.username,staff.password);await f.req('POST','/api/security-roles/plan',body,403);await f.login();
 // DB boundary independently validates the role, selected membership and full transaction rollback.
 const rows=(await f.admin.query('select id,data from ab.roles where id=$1',[r.id])).rows;await f.admin.query('begin');try{
 await f.admin.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[f.org.tenant,f.org.user]);
 await assert.rejects(f.admin.query('select ab.save_security_role_with_exceptions($1,$2,$3,$4::uuid[])',[r.id,JSON.stringify(plan.after),2,[foreign]]),/exceptionOutsideStandard/);
 }finally{await f.admin.query('rollback');}assert.deepEqual((await f.admin.query('select id,data from ab.roles where id=$1',[r.id])).rows,rows);
 }finally{await f.close();}});
