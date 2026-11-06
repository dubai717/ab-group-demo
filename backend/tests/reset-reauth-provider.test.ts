import {test} from 'node:test';import assert from 'node:assert/strict';import Fastify from 'fastify';import {randomBytes} from 'node:crypto';import {supabase} from '../src/core.js';
test('Owner reset verification revokes only its temporary Auth session; normal logout contract remains unchanged',async()=>{
 const provider=Fastify(),seen:any[]=[];provider.post('/auth/v1/logout',async(req:any)=>{seen.push(req.query);return {};});await provider.listen({host:'127.0.0.1',port:0});try{
 const p=supabase('http://127.0.0.1:'+(provider.server.address() as any).port,'sb_publishable_'+randomBytes(16).toString('hex'),'sb_secret_'+randomBytes(16).toString('hex'),'test-bucket');const token=randomBytes(30).toString('base64url');await p.auth.logout(token,'local');await p.auth.logout(token);assert.equal(seen[0].scope,'local');assert.equal(seen[1].scope,undefined);
 }finally{await provider.close();}
});
