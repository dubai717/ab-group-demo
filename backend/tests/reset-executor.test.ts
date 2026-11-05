import {test} from 'node:test';import assert from 'node:assert/strict';import {randomUUID,randomBytes} from 'node:crypto';import Fastify from 'fastify';
import {trustedResetContext} from '../reset/context.js';import {executeReset} from '../reset/execute.js';import {protectedObject,projectHash} from '../reset/plan.js';import {installMaintenance,actionsGateway} from '../reset/gateway.js';import {configureMaintenance,transaction,security} from '../src/core.js';
const context={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'dubai717/ab-group-demo',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/staging/ab-group-test',GITHUB_WORKFLOW_REF:'dubai717/ab-group-demo/.github/workflows/reset-test-database.yml@refs/heads/staging/ab-group-test',APP_ENV:'staging',RESET_EXECUTION_ARMED:'owner-confirmed-test-only-v1'};
test('privileged reset rejects production, unarmed execution, push events, other refs/workflows and repositories',()=>{
 assert(trustedResetContext(context));for(const patch of [{APP_ENV:'production'},{RESET_EXECUTION_ARMED:''},{GITHUB_EVENT_NAME:'push'},{GITHUB_REF:'refs/heads/main'},{GITHUB_WORKFLOW_REF:'untrusted'},{GITHUB_REPOSITORY:'other/repo'}])assert.equal(trustedResetContext({...context,...patch}),false);
 assert(protectedObject('ab-group-backups/v1/archive'));assert(protectedObject('ab-group-reset-control/maintenance.enc'));assert(!protectedObject('tenant/document'));
});
test('unverified/stale backup never reaches any SQL or managed provider operation',async()=>{let sql=0;await assert.rejects(executeReset({query:async()=>{sql++;}} as any,{} as any,{} as any,{proof:{verified:false,freshAt:Date.now(),archivePath:'ab-group-backups/v1/x'},phase:async()=>{}} as any));assert.equal(sql,0);});
test('maintenance is durable/fail-closed and blocks a business transaction before connecting',async()=>{
 let connected=false;configureMaintenance(async()=>true);try{await assert.rejects(transaction({connect:async()=>{connected=true;}} as any,randomUUID(),randomUUID(),async()=>1));assert.equal(connected,false);}finally{configureMaintenance();}
 const app=Fastify();app.setErrorHandler((err:any,_,reply)=>reply.code(err.status||500).send({error:'unavailable'}));app.get('/api/business',async()=>({value:1}));app.get('/api/health',async()=>({ok:true}));let fail=false;installMaintenance(app,{get:async()=>{if(fail)throw Error('offline');return {format:'AB-RESET-CONTROL-1',project:projectHash,active:true};}} as any);
 try{assert.equal((await app.inject('/api/business')).statusCode,503);assert.equal((await app.inject('/api/health')).statusCode,200);fail=true;assert.equal((await app.inject('/api/business')).statusCode,503);}finally{await app.close();}
});
test('web gateway dispatch is fixed to reviewed workflow/staging and never contains database credentials',async()=>{
 const key=randomBytes(32).toString('base64'),owner=randomUUID(),tenant=randomUUID(),id=randomUUID();let observed:any;
 const gw=actionsGateway({} as any,key,randomBytes(32).toString('hex'),{} as any,(async(url:any,opts:any)=>{observed={url,body:JSON.parse(opts.body)};return new Response(null,{status:204});}) as typeof fetch);
 await gw.submit({id,owner,tenant,fingerprint:'a'.repeat(64),approvedAt:new Date().toISOString()});assert.equal(observed.url,'https://api.github.com/repos/dubai717/ab-group-demo/actions/workflows/reset-test-database.yml/dispatches');assert.deepEqual(observed.body,{ref:'staging/ab-group-test',inputs:{mode:'execute',request_id:id}});assert(!JSON.stringify(observed).includes('DATABASE_URL'));
 const rejected=actionsGateway({} as any,key,'test-only',{} as any,(async()=>new Response(null,{status:403})) as typeof fetch);await assert.rejects(rejected.submit({id,owner,tenant,fingerprint:'a'.repeat(64),approvedAt:''}),(e:any)=>e.code==='resetDispatchRejected');
});
