import {approveService} from './service-request-test-helpers.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {ledgerFixture} from './ledger-fixture.js';

test('General service fees: zero, AED, audited amendment, invoice equality, immutable posted history and safe retries',async()=>{
 const f=await ledgerFixture();try{
 const root='/api/customers/'+f.client+'/requests',body={clientKey:randomUUID(),serviceTermsVersion:2,type:'general',companyId:f.co1,subject:'Synthetic general service fee',expectedAmount:'0',currency:'AED'};
 const created=await f.req('POST',root,body),path=root+'/'+created.id;
 assert.equal((await f.req('POST',root,body)).id,created.id);
 let r=await f.req('GET',path);assert.equal(r.expectedAmount,'0');assert.equal(r.finance.billed,'0.000');assert.equal(r.finance.collected,'0.000');
 await f.req('POST',root,{...body,clientKey:randomUUID(),currency:'USD'},422);
 await f.req('POST',path+'/invoice',{itemId:f.items.loan,amount:'1',issuedOn:f.date,dueOn:f.date,confirm:true},409);
 await f.req('POST',path+'/service-fee',{expectedAmount:'250',reason:'Explicit new service price agreed before billing',revision:0});
 r=await f.req('GET',path);assert.equal(r.expectedAmount,'250');assert.equal(r.history[0].before.expectedAmount,'0');assert.equal(r.history[0].reason,'Explicit new service price agreed before billing');
 await f.req('POST',path+'/service-fee',{expectedAmount:'99',reason:'Stale concurrent amendment',revision:0},409);
 await approveService(f,path,true);
 await f.req('POST',path+'/invoice',{itemId:f.items.loan,amount:'249',issuedOn:f.date,dueOn:f.date,confirm:true},422);
 const invoice=await f.req('POST',path+'/invoice',{itemId:f.items.loan,amount:'250',issuedOn:f.date,dueOn:f.date,confirm:true});
 r=await f.req('GET',path);assert.equal(r.finance.billed,'250.000');assert.equal(r.finance.collected,'0.000');
 await f.req('POST',path+'/service-fee',{expectedAmount:'99',reason:'Must not rewrite issued invoice',revision:r.history.length},409);
 await f.req('POST',path+'/invoice',{itemId:f.items.loan,amount:'250',issuedOn:f.date,dueOn:f.date,confirm:true},409);
 assert.equal((await f.req('GET',path)).finance.invoices[0].id,invoice.id);
 const listed=await f.req('GET',root);assert.equal(listed.rows.find((row:any)=>row.id===created.id).expectedAmount,'250');
 const amendment=await f.req('POST',root,{...body,clientKey:randomUUID(),type:'residence',transactionType:'amendment',description:'Synthetic residence amendment'});assert.equal((await f.req('GET',root+'/'+amendment.id)).transactionType,'amendment');
 const user=await f.employee();await f.login(user.username,user.password);await f.req('POST',path+'/service-fee',{expectedAmount:'1',reason:'Unauthorized',revision:0},403);
 }finally{await f.close();}
});
