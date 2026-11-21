import {localTestPort} from './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {disposeSyntheticDatabase,disposeSyntheticRestoreCopy} from './dispose-synthetic-database.js';
test('fixture disposal refuses remote hosts, mismatched paths and permanent test databases before connecting',async()=>{
 const name='ab_backup_'+'a'.repeat(32);
 for(const [uri,db] of [['postgres://postgres@db.example.supabase.co:5441/'+name,name],
  ['postgres://postgres@127.0.0.1:5441/ab_test','ab_test'],
  ['postgres://postgres@127.0.0.1:5441/another',name],
  ['postgres://postgres@127.0.0.1:'+ (localTestPort===65535?65534:localTestPort+1)+'/'+name,name],
  ['postgres://postgres@127.0.0.1:'+localTestPort+'/'+name+'?host=db.example.supabase.co',name]]){
  await assert.rejects(disposeSyntheticDatabase(uri,db),/cleanup target refused/);
 }
});

test('fresh restore cleanup refuses source/permanent databases and remote or mismatched source URLs before any connection',async()=>{const source='ab_backup_'+'a'.repeat(32),target='ab_restore_'+'b'.repeat(32),uri='postgres://postgres@127.0.0.1:'+localTestPort+'/'+source;for(const args of [[uri,source,source],[uri,source,'ab_test'],['postgres://postgres@db.example.supabase.co:'+localTestPort+'/'+source,source,target],[uri,'ab_test',target],[uri+'?host=db.example.supabase.co',source,target]])await assert.rejects(disposeSyntheticRestoreCopy(...args as [string,string,string]),/cleanup target refused/);});
test('a completed test process disposes only the random database it created, without retaining a fixture for the next run',async()=>{const {execFileSync}=await import('node:child_process'),{randomUUID}=await import('node:crypto'),{readFile}=await import('node:fs/promises'),{Pool}=await import('pg'),name='ab_backup_'+randomUUID().replaceAll('-',''),secret=JSON.parse(await readFile('work/db-test-secrets.json','utf8')),root=new Pool({host:'127.0.0.1',port:localTestPort,user:'postgres',password:secret.admin,database:'ab_test'});try{execFileSync(process.execPath,['--import','tsx','--input-type=module','-e',"import {setupDatabase} from './backend/tests/setup.ts';const d=await setupDatabase('"+name+"');await d.runtime.end();await d.admin.end();"],{stdio:'pipe',timeout:30000});assert.equal((await root.query('select 1 from pg_database where datname=$1',[name])).rowCount,0);}finally{await root.query('DROP DATABASE IF EXISTS "'+name+'"');await root.end();}});
