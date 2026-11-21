import {localTestPort} from './setup.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {disposeSyntheticDatabase} from './dispose-synthetic-database.js';
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
