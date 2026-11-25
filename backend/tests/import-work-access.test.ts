import test from'node:test';import assert from'node:assert/strict';import{requireImportWorkAccess}from'../src/import-work-access.js';
test('batch work access uses only the actual transaction guard and fails closed before any writer or receipt recovery',async()=>{
 for(const result of[null,false,undefined]){const queries:string[]=[];await assert.rejects(requireImportWorkAccess({query:async(sql:string)=>{queries.push(sql);return{rows:[{ok:result}]};}}),(e:any)=>e.status===503&&e.code==='importWorkAccessUnavailable');assert.equal(queries.length,1);}
 for(const result of[false,null,undefined,'true',1]){const queries:string[]=[];await assert.rejects(requireImportWorkAccess({query:async(sql:string)=>{queries.push(sql);return{rows:[{ok:queries.length===1?'ab.hr_actor_allowed()':result}]};}}),(e:any)=>e.status===403&&e.code==='denied');assert.equal(queries.length,2);}
 const queries:string[]=[];await requireImportWorkAccess({query:async(sql:string)=>{queries.push(sql);return{rows:[{ok:queries.length===1?'ab.hr_actor_allowed()':true}]};}});assert.equal(queries.length,2);assert(queries.every(q=>/^select /.test(q)&&!q.includes('set_config')&&!q.includes('role ')));
 const fault=Error('Synthetic unavailable guard read');await assert.rejects(requireImportWorkAccess({query:async()=>{throw fault;}}),e=>e===fault);
});
