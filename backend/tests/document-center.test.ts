import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { personnelFixture } from './personnel-fixture.js';

test('Unified document index preserves original storage, ACLs, versions and reversible archive',async t=>{
 const f=await personnelFixture();try{
  await f.admin.query(await readFile('supabase/additive/015_document_center.sql','utf8'));
  const version=await f.proof(), original=(await f.admin.query('select document_id from ab.document_versions where id=$1',[version])).rows[0].document_id;
  const count=()=>f.objects.rows.size, before=count();
  await t.test('index references the authoritative version endpoint and never returns storage keys',async()=>{
   const r=await f.req('GET','/api/document-center?q=Synthetic');const item=r.rows.find((r:any)=>r.versionId===version);assert.equal(item.id,original);assert.equal(item.endpoint,'documents/'+version+'/file');assert.equal(item.archived,false);assert.equal(r.contentSearch,false);assert.equal(JSON.stringify(r).includes('storage_key'),false);
  });
  await t.test('link is deduplicated, scoped to a real target and does not copy a file',async()=>{
   const url='/api/document-center/document/'+original+'/links';const options=await f.req('GET','/api/document-center/document/'+original+'/link-options');assert.ok(options.options.some((x:any)=>x.type==='customer'&&x.id===f.client));
   assert.equal((await f.req('POST',url,{customerId:f.client})).created,true);
   assert.equal((await f.req('POST',url,{customerId:f.client})).created,false);
   const r=await f.req('GET','/api/document-center?customerId='+f.client);assert.ok(r.rows.some((r:any)=>r.id===original));assert.equal(count(),before);
   await f.req('POST',url,{companyId:'00000000-0000-4000-8000-000000000099'},404);
  });
  await t.test('archive and restore preserve bytes, versions and append-only audit history',async()=>{
   const url='/api/document-center/document/'+original+'/archive';
   await f.req('POST',url,{action:'archive',reason:'Synthetic archive test'});
   assert.equal((await f.req('GET','/api/document-center')).rows.some((r:any)=>r.id===original),false);
   assert.ok((await f.req('GET','/api/document-center?archive=archived')).rows.some((r:any)=>r.id===original));
   await f.req('POST',url,{action:'archive',reason:'Duplicate should fail'},409);
   await f.req('POST',url,{action:'restore',reason:'Synthetic archive retrieval'});
   assert.ok((await f.req('GET','/api/document-center')).rows.some((r:any)=>r.id===original));assert.equal(count(),before);
   const login=await f.app.inject({method:'POST',url:'/api/login',headers:{origin:'http://127.0.0.1:3100','x-ab-request':'1'},payload:{username:f.username,password:f.password}});const file=await f.app.inject({method:'GET',url:'/api/documents/'+version+'/file',headers:{cookie:String(login.headers['set-cookie']).split(';')[0],'x-ab-request':'1'}});assert.equal(file.statusCode,200);assert.equal(file.headers['content-type'],'application/pdf');assert.ok(file.rawPayload.subarray(0,5).toString()==='%PDF-');
   assert.equal((await f.admin.query('select count(*)::int n from ab.document_archive_events where document_id=$1',[original])).rows[0].n,2);
   await assert.rejects(f.admin.query('delete from ab.document_archive_events where document_id=$1',[original]));
  });
  await t.test('a link never grants source access to another user',async()=>{
   const u=await f.employee();await f.login(u.username,u.password);assert.equal((await f.req('GET','/api/document-center')).rows.length,0);
   await f.req('POST','/api/document-center/document/'+original+'/archive',{action:'archive',reason:'Unauthorized'},403);
   await f.req('GET','/api/documents/'+version+'/file',undefined,403);await f.login();
  });
 }finally{await f.close();}
});
