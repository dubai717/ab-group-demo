import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyPreservingRelease} from '../deploy/preserved-staging-release.js';
test('unknown migration ledger rolls back before executing any migration SQL',async()=>{
 const calls:string[]=[];const c={query:async(s:string)=>{calls.push(s);return {rows:[]};},release(){}};await assert.rejects(applyPreservingRelease({connect:async()=>c}as any,{manifest:{rows:[]}}),/BASE_LEDGER_CHANGED/);assert(calls.includes('ROLLBACK'));assert(!calls.includes('COMMIT'));assert(!calls.some(s=>/^ALTER|^CREATE|^INSERT/.test(s)));
});
test('changed application data since real backup stops before DDL and rolls back',async()=>{
 const ledger=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations,calls:string[]=[];
 const c={query:async(s:string)=>{calls.push(s);if(s.startsWith('select name,sha256'))return {rows:ledger};if(s.startsWith('select relname'))return {rows:[{relname:'users'}]};if(s.includes('md5(coalesce'))return {rows:[{n:'1',h:'different'}]};return{rows:[]};},release(){}};
 await assert.rejects(applyPreservingRelease({connect:async()=>c}as any,{manifest:{rows:[{s:'ab',t:'users',n:'1',h:'original'}]}}),/SOURCE_CHANGED_SINCE_BACKUP/);assert(calls.includes('ROLLBACK'));assert(!calls.includes('COMMIT'));assert(!calls.some(s=>/^ALTER|^CREATE|^INSERT/.test(s)));
});
