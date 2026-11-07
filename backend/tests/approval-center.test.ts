import test from 'node:test';
import assert from 'node:assert/strict';
import { personnelFixture } from './personnel-fixture.js';

test('Approval center reuses existing source decisions, scope, audit and terminal-state checks',async t=>{
 const f=await personnelFixture();try{
  const request=await f.request();
  await t.test('owner sees canonical pending financing and existing endpoint revision',async()=>{
   const r=(await f.req('GET','/api/approval-center')).rows.find((r:any)=>r.id===request.id);assert.ok(r);assert.equal(r.pending,true);assert.equal(r.decision.path,'vehicle-requests/'+request.id+'/funding-decision');assert.equal(r.decision.revision,1);
  });
  await t.test('nondelegated employee cannot list or decide another company approval',async()=>{
   const u=await f.employee();await f.login(u.username,u.password);assert.equal((await f.req('GET','/api/approval-center')).rows.length,0);await f.req('POST','/api/vehicle-requests/'+request.id+'/funding-decision',{approve:true,reason:'Denied',revision:1},403);await f.login();
  });
  await t.test('original decision updates central status and cannot execute twice',async()=>{
   await f.req('POST','/api/vehicle-requests/'+request.id+'/funding-decision',{approve:false,reason:'Synthetic rejection with retained original',revision:1});
   const r=(await f.req('GET','/api/approval-center')).rows.find((r:any)=>r.id===request.id);assert.equal(r.state,'Rejected');assert.equal(r.pending,false);assert.equal(r.decision,null);
   await f.req('POST','/api/vehicle-requests/'+request.id+'/funding-decision',{approve:true,reason:'Cannot approve rejected request',revision:1},409);
   const hist=(await f.admin.query('select payload_cipher from ab.vehicle_events where request_id=$1',[request.id])).rows;assert.ok(hist.length>=1);
  });
 }finally{await f.close();}
});
