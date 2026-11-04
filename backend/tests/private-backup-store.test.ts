import {test} from 'node:test';
import assert from 'node:assert/strict';
import {security} from '../src/core.js';
import {randomBytes} from 'node:crypto';
import {checkBackupBucket,newBackupPaths,isRetainedBackupPath,privateBackupStore} from '../deploy/private-backup-store.js';
const endpoint='https://abcdefghijklmnopqrst.supabase.co';
const bucket={id:'ab-private-test',name:'ab-private-test',public:false,file_size_limit:null,allowed_mime_types:null};
const bytes=Buffer.from('AB-BACKUP-1\n'+security(randomBytes(32).toString('base64')).seal({test:true}));
test('retained backup refuses public/wrong bucket and existing MIME/size restrictions without settings changes',()=>{
 checkBackupBucket(bucket,bytes.length);
 for(const value of [{...bucket,public:true},{...bucket,id:'other'},{...bucket,public:undefined},{...bucket,file_size_limit:bytes.length-1},{...bucket,allowed_mime_types:['application/pdf']}])assert.throws(()=>checkBackupBucket(value,bytes.length));
 assert.throws(()=>checkBackupBucket(bucket,51*1024*1024));
});
test('new backup paths are unique, bounded and distinguish backups from application documents',()=>{
 const a=newBackupPaths(),b=newBackupPaths();assert.notEqual(a.archive,b.archive);assert(isRetainedBackupPath(a.archive));assert(isRetainedBackupPath(a.metadata));assert(!isRetainedBackupPath('tenant/document.pdf'));assert(!isRetainedBackupPath(a.archive+'/../bad'));assert(!isRetainedBackupPath('ab-group-backups/v1/unknown.pdf'));
});
test('storage uploads only ciphertext with create-only POST and verifies exact downloaded bytes and anonymous denial',async()=>{
 const calls:any[]=[],saved=new Map<string,Buffer>();
 const mock:typeof fetch=async(input,init)=>{
  const url=String(input),method=init?.method||'GET',headers=init?.headers as any;calls.push({url,method,headers});
  if(url.includes('/storage/v1/bucket/'))return Response.json(bucket);
  if(url.includes('/object/public/'))return new Response('',{status:404});
  if(method==='POST'){assert.equal(headers['x-upsert'],'false');assert.equal(headers['content-type'],'application/octet-stream');saved.set(url,Buffer.from(init?.body as Uint8Array));return Response.json({},{status:200});}
  return new Response(new Uint8Array(saved.get(url)!));
 };
 const store=privateBackupStore(endpoint,'test-only',mock),paths=newBackupPaths();await store.upload(paths.archive,bytes);assert((await store.downloadVerified(paths.archive,bytes)).equals(bytes));await store.verifyNotPublic(paths.archive);
 assert(calls.every(c=>['GET','POST'].includes(c.method)));assert(!calls.some(c=>/object\/public/.test(c.url)&&c.headers?.apikey));
 await assert.rejects(()=>store.upload(paths.metadata,Buffer.from('plain metadata')));await assert.rejects(()=>store.upload('../outside',bytes));
});
test('duplicate uploads stop without replacing/deleting, and incorrect downloads or public access never pass',async()=>{
 let posts=0;
 const store=privateBackupStore(endpoint,'test-only',async(input,init)=>{
  if(String(input).includes('/bucket/'))return Response.json(bucket);
  if(init?.method==='POST'){posts++;return new Response('',{status:409});}
  return new Response('wrong bytes');
 });
 const p=newBackupPaths();await assert.rejects(()=>store.upload(p.archive,bytes),/BACKUP_PATH_CONFLICT/);assert.equal(posts,1);
 await assert.rejects(()=>store.downloadVerified(p.archive,bytes),/BACKUP_DOWNLOAD_HASH/);await assert.rejects(()=>store.verifyNotPublic(p.archive),/BACKUP_PUBLIC_ACCESS/);
});
test('public bucket prevents any upload attempt',async()=>{
 let writes=0;const store=privateBackupStore(endpoint,'test-only',async(_input,init)=>{if(init?.method==='POST')writes++;return Response.json({...bucket,public:true});});
 await assert.rejects(()=>store.upload(newBackupPaths().archive,bytes),/BACKUP_BUCKET_NOT_PRIVATE/);assert.equal(writes,0);
});
