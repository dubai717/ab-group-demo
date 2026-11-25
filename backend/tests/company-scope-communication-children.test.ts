import test from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{randomUUID}from'node:crypto';import{businessCentersFixture}from'./business-centers-fixture.js';
test('FK-only communication children inherit actual company parent scope without changing grants, source messages or append-only history',async()=>{
 const f=await businessCentersFixture();try{
  assert.match(f.sourceDatabase,/^ab_backup_[a-f0-9]{32}$/);assert.equal(new URL(f.adminUrl).hostname,'127.0.0.1');const worker=await f.employee(),empty=await f.employee(),threads:string[]=[];
  for(const co of[f.co1,f.co2])threads.push((await f.req('POST','/api/communications',{sourceType:'company',sourceId:co,subject:'Synthetic scoped thread',body:'Synthetic internal message',recipientIds:[f.org.user]})).threadId);
  const snapshot=async()=>(await f.admin.query('select(select jsonb_agg(to_jsonb(x)order by id)from ab.communication_threads x)threads,(select jsonb_agg(to_jsonb(x)order by id)from ab.communication_messages x)messages,(select jsonb_agg(to_jsonb(x)order by thread_id,user_id)from ab.communication_participants x)participants,(select jsonb_agg(to_jsonb(x)order by id)from ab.permission_grants x)grants,(select jsonb_agg(to_jsonb(x)order by id)from ab.finance_journals x)journals')).rows,before=await snapshot();
  for(const file of['operating-centres.sql','company-scope-upper-bound.sql','company-scope-communication-children.sql'])await f.admin.query(await readFile('backend/review/'+file,'utf8'));
  const tx=async(actor:string,fn:any,commit=false,tenant=f.org.tenant)=>{const c=await f.runtime.connect();try{await c.query('begin');await c.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[tenant,actor]);const result=await fn(c);await c.query(commit?'commit':'rollback');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
  await tx(f.org.user,async(c:any)=>{for(const user of[worker.id,empty.id]){const version=randomUUID();await c.query("insert into ab.user_access_scope_versions(id,tenant_id,user_id,revision,selection_kind,payload_cipher,created_by)values($1,$2,$3,1,'companies','synthetic only',$4)",[version,f.org.tenant,user,f.org.user]);if(user===worker.id)await c.query('insert into ab.user_access_scope_companies values($1,$2,$3,$4)',[f.org.tenant,user,version,f.co1]);}},true);
  for(const table of['communication_messages','communication_participants']){
   assert.deepEqual((await tx(worker.id,(c:any)=>c.query('select distinct thread_id from ab.'+table))).rows.map((r:any)=>r.thread_id),[threads[0]]);
   assert.equal((await tx(f.org.user,(c:any)=>c.query('select distinct thread_id from ab.'+table))).rows.length,2);
   for(const actor of[empty.id,randomUUID()])assert.equal((await tx(actor,(c:any)=>c.query('select * from ab.'+table))).rows.length,0);
   assert.equal((await tx(worker.id,(c:any)=>c.query('select * from ab.'+table),false,randomUUID())).rows.length,0);
  }
  const message=(thread:string)=>tx(worker.id,(c:any)=>c.query("insert into ab.communication_messages(id,tenant_id,thread_id,sender_id,channel,body_cipher)values($1,$2,$3,$4,'internal','synthetic rollback only')",[randomUUID(),f.org.tenant,thread,worker.id]));
  assert.equal((await message(threads[0])).rowCount,1);await assert.rejects(message(threads[1]),(e:any)=>e.code==='42501');
  const participant=(thread:string)=>tx(worker.id,(c:any)=>c.query('insert into ab.communication_participants values($1,$2,$3)',[f.org.tenant,thread,worker.id]));assert.equal((await participant(threads[0])).rowCount,1);await assert.rejects(participant(threads[1]),(e:any)=>e.code==='42501');
  await assert.rejects(tx(worker.id,(c:any)=>c.query("update ab.communication_messages set body_cipher='forbidden'where thread_id=$1",[threads[0]])),(e:any)=>e.code==='42501');
  await assert.rejects(tx(worker.id,(c:any)=>c.query('delete from ab.communication_participants where thread_id=$1',[threads[0]])),(e:any)=>e.code==='42501');
  await f.login(worker.username,worker.password);await f.req('GET','/api/communications/'+threads[0],undefined,403);await f.req('GET','/api/communications/'+threads[1],undefined,404);assert.deepEqual((await f.req('GET','/api/communications')).rows,[]);
  assert.deepEqual(await snapshot(),before);
 }finally{await f.close();}
});
