import{security}from'../src/core.js';
import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{randomUUID}from'node:crypto';import{businessCentersFixture}from'./business-centers-fixture.js';import{pdf}from'./import-fixture-files.js';
test('Attachment scope requires actual file company and visible identity; cross-company identity does not reveal private documents, reviews or lineage',async()=>{
 const f=await businessCentersFixture();try{
  assert.match(f.sourceDatabase,/^ab_backup_[a-f0-9]{32}$/);assert.equal(new URL(f.adminUrl).hostname,'127.0.0.1');assert(f.client&&f.client2);
  const worker=await f.employee(),empty=await f.employee(),unlinked=(await f.req('POST','/api/customers',{profile:{fullName:'Unrelated fake file person',companyId:f.co2}})).id;
  const upload=(customer:string,name:string)=>f.req('POST','/api/customers/'+customer+'/files',{name,title:name,kind:'other',mime:'application/pdf',base64:pdf.toString('base64')});
  const own=await upload(f.client,'own-fake.pdf'),outside=await upload(f.client2,'outside-fake.pdf'),root=(await f.admin.query('select to_jsonb(f)row from ab.customer_files f where id=$1',[own.id])).rows[0].row;
  for(const file of[own.id,outside.id])await f.admin.query("insert into ab.customer_file_reviews values($1,$2,$3,'clean',now())",[randomUUID(),f.org.tenant,file]);
  for(const [file,customer]of[[own.id,f.client],[outside.id,f.client2]]){
   await f.admin.query("insert into ab.document_text_index(id,tenant_id,customer_file_id,status,text_cipher,search_tokens,created_by)values($1,$2,$3,'indexed',$4,ARRAY['synthetic-token'],$5)on conflict(tenant_id,customer_file_id)do nothing",[randomUUID(),f.org.tenant,file,security(f.secret.key).seal({text:'Synthetic explicit index only'}),f.org.user]);
   await f.admin.query("insert into ab.document_archive_events(id,tenant_id,customer_file_id,action,reason_cipher,created_by)values($1,$2,$3,'archive',$4,$5)",[randomUUID(),f.org.tenant,file,security(f.secret.key).seal({reason:'synthetic only'}),f.org.user]);
   await f.admin.query('insert into ab.document_links(id,tenant_id,customer_file_id,customer_id,created_by)values($1,$2,$3,$4,$5)',[randomUUID(),f.org.tenant,file,customer,f.org.user]);
  }
  const request=await f.request();await f.admin.query('update ab.vehicle_requests set customer_id=$2 where id=$1',[request.id,f.client2]);
  const snapshot=async()=>(await f.admin.query('select (select jsonb_agg(to_jsonb(f)order by id)from ab.customer_files f)files,(select jsonb_agg(to_jsonb(r)order by id)from ab.customer_file_reviews r)reviews,(select jsonb_agg(to_jsonb(g)order by id)from ab.permission_grants g)grants,(select jsonb_agg(to_jsonb(j)order by id)from ab.finance_journals j)journals, (select jsonb_agg(to_jsonb(x)order by id)from ab.document_text_index x)textindex,(select jsonb_agg(to_jsonb(x)order by id)from ab.document_links x)links,(select jsonb_agg(to_jsonb(x)order by id)from ab.document_archive_events x)archives')).rows,before=await snapshot();
  const tx=async(actor:string,fn:any,commit=false,tenant=f.org.tenant)=>{const c=await f.runtime.connect();try{await c.query('begin');await c.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[tenant,actor]);const result=await fn(c);await c.query(commit?'commit':'rollback');return result;}catch(e){await c.query('rollback');throw e;}finally{c.release();}};
  for(const name of['operating-centres.sql','company-scope-upper-bound.sql','company-scope-customers.sql','company-scope-customer-files.sql','company-scope-document-children.sql'])await f.admin.query(await readFile('backend/review/'+name,'utf8'));
  await tx(f.org.user,async(c:any)=>{for(const user of[worker.id,empty.id]){const version=randomUUID();await c.query("insert into ab.user_access_scope_versions(id,tenant_id,user_id,revision,selection_kind,payload_cipher,created_by)values($1,$2,$3,1,'companies','synthetic only',$4)",[version,f.org.tenant,user,f.org.user]);if(user===worker.id)await c.query('insert into ab.user_access_scope_companies values($1,$2,$3,$4)',[f.org.tenant,user,version,f.co1]);}},true);
  assert.equal((await tx(worker.id,(c:any)=>c.query('select id from ab.customers where id=$1',[f.client2]))).rows.length,1);
  assert.deepEqual((await tx(worker.id,(c:any)=>c.query('select id from ab.customer_files'))).rows.map((r:any)=>r.id),[own.id]);
  assert.deepEqual((await tx(worker.id,(c:any)=>c.query('select file_id from ab.customer_file_reviews'))).rows.map((r:any)=>r.file_id),[own.id]);
  for(const actor of[empty.id,randomUUID()])assert.equal((await tx(actor,(c:any)=>c.query('select id from ab.customer_files'))).rows.length,0);
  assert.equal((await tx(worker.id,(c:any)=>c.query('select id from ab.customer_files'),false,randomUUID())).rows.length,0);
  assert.equal((await tx(f.org.user,(c:any)=>c.query('select id from ab.customer_files'))).rows.length,2);
  for(const table of['document_text_index','document_links','document_archive_events']){
   const visible=await tx(worker.id,(c:any)=>c.query('select customer_file_id from ab.'+table));assert(visible.rows.length>0,table+' must preserve own source');assert(visible.rows.every((r:any)=>r.customer_file_id===own.id),table+' must hide foreign source');
   assert.equal((await tx(empty.id,(c:any)=>c.query('select id from ab.'+table))).rows.length,0);
  }
  const archive=(c:any,file:string)=>c.query("insert into ab.document_archive_events(id,tenant_id,customer_file_id,action,reason_cipher,created_by)values($1,$2,$3,'restore',$4,$5)",[randomUUID(),f.org.tenant,file,security(f.secret.key).seal({reason:'synthetic rolled-back check'}),worker.id]);
  await tx(worker.id,(c:any)=>archive(c,own.id));await assert.rejects(tx(worker.id,(c:any)=>archive(c,outside.id)),(e:any)=>e.code==='42501');
  await assert.rejects(tx(worker.id,(c:any)=>c.query('insert into ab.document_links(id,tenant_id,customer_file_id,customer_id,created_by)values($1,$2,$3,$4,$5)',[randomUUID(),f.org.tenant,own.id,unlinked,worker.id])),(e:any)=>e.code==='42501');
  assert.equal((await tx(worker.id,(c:any)=>c.query('select ab.document_source_in_scope(null,$1,null)allowed',[outside.id]))).rows[0].allowed,false);
  assert.equal((await tx(worker.id,(c:any)=>c.query('select ab.document_source_in_scope(null,$1,null)allowed',[own.id]))).rows[0].allowed,true);
  assert.equal((await tx(worker.id,(c:any)=>c.query('select ab.document_source_in_scope(null,$1,$2)allowed',[own.id,outside.id]))).rows[0].allowed,false);
  
  const insert=(c:any,patch:any)=>c.query('insert into ab.customer_files select * from jsonb_populate_record(null::ab.customer_files,$1::jsonb)',[JSON.stringify({...root,id:randomUUID(),storage_key:'synthetic-unwritten/'+randomUUID(),created_by:worker.id,...patch})]);
  await tx(worker.id,(c:any)=>insert(c,{parent_id:own.id,version:2})); // Valid lineage, rolled back; no object upload.
  for(const patch of[{company_id:f.co2},{parent_id:outside.id,version:2},{customer_id:unlinked},{customer_id:f.client2,parent_id:own.id,version:2}])await assert.rejects(tx(worker.id,(c:any)=>insert(c,patch)),(e:any)=>e.code==='42501');
  assert.equal((await tx(worker.id,(c:any)=>c.query('select ab.customer_attachment_in_scope($1)allowed',[outside.id]))).rows[0].allowed,false);
  // Existing scanner service access is not turned into employee access.
  const c=await f.admin.connect();try{await c.query('begin');await c.query('set local role ab_scanner');await c.query('select * from ab.pending_customer_files()');await c.query('rollback');}finally{c.release();}
  await f.admin.query('alter function ab.customer_attachment_in_scope(uuid,uuid,uuid)security invoker');await assert.rejects(tx(worker.id,(c:any)=>c.query('select id from ab.customer_files')),(e:any)=>e.code==='42501');await f.admin.query('alter function ab.customer_attachment_in_scope(uuid,uuid,uuid)security definer');
  assert.deepEqual(await snapshot(),before);
 }finally{await f.close();}
});
