import test from 'node:test';import assert from 'node:assert/strict';import {isolatedPgTools} from './isolated-pg-tools.js';
test('test-only PostgreSQL adapter refuses hosted, arbitrary or source restore targets before invoking a binary',()=>{
 const source='ab_backup_'+'a'.repeat(32),url='postgres://fake:fake@127.0.0.1:5442/'+source;
 for(const bad of ['postgres://fake:fake@db.example.com/'+source,'postgres://fake:fake@127.0.0.1:5442/real_database'])assert.throws(()=>isolatedPgTools(bad,source,'synthetic'),/OWNED_LOCAL_SYNTHETIC/);
 const tools=isolatedPgTools(url,source,'synthetic');for(const name of [source,'postgres','ab_test','ab_restore_fake'])assert.throws(()=>tools.restore(name,Buffer.alloc(0)),/NEW_OWNED_RESTORE_TARGET/);
});
