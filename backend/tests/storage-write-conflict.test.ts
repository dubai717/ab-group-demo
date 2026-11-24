import test from'node:test';import assert from'node:assert/strict';import{storageWriteConflict}from'../src/storage-write-conflict.js';
test('only exact documented Storage duplicate codes on400 or409 identify collisions; refusals and oversized/malformed bodies are not reclassified',async()=>{
 for(const code of['ResourceAlreadyExists','KeyAlreadyExists','already_exists','Duplicate'])for(const field of['code','error'])assert.equal(await storageWriteConflict(Response.json({[field]:code},{status:400})),true);
 assert.equal(await storageWriteConflict(new Response(null,{status:409})),true);for(const status of[401,402,403,404,413,429,500,503])assert.equal(await storageWriteConflict(Response.json({code:'ResourceAlreadyExists'},{status})),false);
 for(const body of['{invalid','null',JSON.stringify({message:'Asset Already Exists'}),JSON.stringify({code:'InvalidRequest'}),JSON.stringify({code:'ResourceAlreadyExists',padding:'x'.repeat(5000)})])assert.equal(await storageWriteConflict(new Response(body,{status:400})),false);
 let cancelled=false;const response=new Response(new ReadableStream({pull(c){c.enqueue(new Uint8Array(5000));},cancel(){cancelled=true;}}),{status:400});assert.equal(await storageWriteConflict(response),false);assert.equal(cancelled,true);
});
