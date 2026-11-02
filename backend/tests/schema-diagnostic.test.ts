import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {schemaProbeId} from '../actions/schema-diagnostic.js';
test('42501 diagnosis identifies role switching independently of table privileges',()=>{
 assert.equal(schemaProbeId('SET LOCAL ROLE ab_runtime'),'OPERATOR_SET_RUNTIME_ROLE');
 assert.equal(schemaProbeId('select has_table_privilege($1,$2,$3) allowed'),'PROTECTED_TABLE_PRIVILEGES');
 assert.equal(schemaProbeId('ROLLBACK'),'TRANSACTION_CONTROL');
});
test('diagnostic entrypoint contains no migration invocation or permission mutation and hides unknown secrets',async()=>{
 const source=await readFile(new URL('../actions/schema-diagnostic.ts',import.meta.url),'utf8');
 assert(!source.includes('await migrate('));assert(!source.includes('applyApprovedSchema('));assert(!/\.query\(["'`]\s*(GRANT|ALTER|CREATE|DROP|DELETE|INSERT|UPDATE|TRUNCATE)\b/i.test(source));
 const marker='SCHEMA_DIAGNOSTIC_SECRET_CANARY';const run=spawnSync(process.execPath,['--import','tsx','backend/actions/schema-diagnostic.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,MIGRATION_DATABASE_URL:marker}});assert.equal(run.status,1);assert((run.stdout+run.stderr).includes('read-only diagnosis failed'));assert(!(run.stdout+run.stderr).includes(marker));
});

test('corrected inspector catalog mode never requests role switching',async()=>{
 const {fixture}=await import('./fixture.js');const {checkSchema}=await import('../actions/supabase-check.js');
 const f=await fixture();let switched=false;
 try{const pool={connect:async()=>{const c=await f.admin.connect();return {query:async(sql:string,values?:any[])=>{if(sql==='SET LOCAL ROLE ab_runtime'){switched=true;throw Error('must not impersonate');}return c.query(sql,values);},release:()=>c.release()};}};
 const result=await checkSchema(pool as any,{catalogOnly:true});assert.equal(result.runtimeVerified,false);assert.equal(switched,false);
 }finally{await f.app.close();await f.runtime.end();await f.admin.end();}
});
