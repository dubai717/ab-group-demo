import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scramVerifier} from '../actions/runtime-setup.js';
import {inspectRole} from '../actions/runtime-auth-inspect.js';
test('inspection identifies incompatible SCRAM cost without exposing credentials or mutating data',async()=>{
 const password='Synthetic_inspection_canary_123456!';const verifier=scramVerifier(password,Buffer.alloc(32,1),65536);
 const queries:string[]=[],lines:string[]=[];
 const c={connection:{stream:{encrypted:true,authorized:true}},query:async(sql:string)=>{queries.push(sql);return {rows:sql.includes('pg_authid')?[{rolcanlogin:true,expired:false,rolsuper:false,rolbypassrls:false,rolpassword:verifier}]:[{password_encryption:'scram-sha-256'}]};}};
 const original=console.log;console.log=(s:string)=>{lines.push(s);};
 try{await inspectRole(c,password);}finally{console.log=original;}
 assert(lines.includes('DIAGNOSTIC: ab_runtime LOGIN=true'));
 assert(lines.includes('DIAGNOSTIC: DATABASE_URL decoded password matches stored verifier'));
 assert(lines.includes('DIAGNOSTIC: stored SCRAM cost exceeds published Supavisor maximum 32768'));
 assert(!lines.join().includes(password));assert(!lines.join().includes(verifier));
 assert.deepEqual(queries.map(s=>s.split(' ')[0]),['BEGIN','select','SHOW','ROLLBACK']);
});
