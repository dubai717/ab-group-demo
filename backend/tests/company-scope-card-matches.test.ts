import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { businessCentersFixture } from './business-centers-fixture.js';
import { transaction } from '../src/core.js';

test('card reconciliation links follow the exact statement line and card within company scope', async () => {
 const f=await businessCentersFixture();
 try {
  const worker=await f.employee();
  const fixtures=[];
  for(const companyId of [f.co1,f.co2]){
   const proof=await f.proof(companyId);
   const card=await f.req('POST','/api/ledger/cards',{
    companyId,holderId:f.org.user,bankName:'Synthetic issuer',lastFour:'7531',
    name:'Synthetic review card',currency:'AED',dueDay:15,liabilityId:f.accounts.payable.charts[companyId],
   });
   const charge=await f.req('POST','/api/ledger/cards/'+card.id+'/charges',{
    amount:'15',paidOn:f.date,reference:randomUUID(),beneficiary:'Synthetic company expense',
    documentVersionId:proof,splits:[{companyId,itemId:f.items.expense,amount:'15'}],
   });
   const statement=await f.req('POST','/api/ledger/cards/'+card.id+'/statements',{
    periodFrom:'2026-01-01',periodTo:'2026-01-31',openingBalance:'0',closingBalance:'15',documentVersionId:proof,
    lines:[{date:f.date,amount:'15',reference:'Synthetic review line'}],
   });
   const line=(await f.req('GET','/api/ledger/statements/'+statement.id)).lines[0];
   await f.req('POST','/api/ledger/card-statements/'+statement.id+'/match',{pairs:[{lineId:line.id,chargeId:charge.id}]});
   fixtures.push({statement:statement.id,line:line.id,charge:charge.id});
  }
  for(const file of ['operating-centres.sql','company-scope-upper-bound.sql','company-scope-statement-lines.sql','company-scope-card-matches.sql']){
   await f.admin.query(await readFile('backend/review/'+file,'utf8'));
  }
  const tx=(actor:string,work:(c:any)=>Promise<any>)=>transaction(f.runtime,f.org.tenant,actor,work);
  const version=randomUUID();
  await tx(f.org.user,async c=>{
   await c.query("insert into ab.user_access_scope_versions(id,tenant_id,user_id,revision,selection_kind,payload_cipher,created_by) values($1,$2,$3,1,'companies','synthetic only',$4)",[version,f.org.tenant,worker.id,f.org.user]);
   await c.query('insert into ab.user_access_scope_companies values($1,$2,$3,$4)',[f.org.tenant,worker.id,version,f.co1]);
  });
  const [own,foreign]=fixtures;
  const read=(actor:string)=>tx(actor,async c=>(await c.query('select statement_id from ab.finance_card_matches order by statement_id')).rows.map((r:any)=>r.statement_id));
  assert.deepEqual(await read(worker.id),[own.statement]);
  assert.deepEqual(await read(f.org.user),[own.statement,foreign.statement].sort());
  await assert.rejects(tx(worker.id,c=>c.query(`insert into ab.finance_card_matches
    (id,tenant_id,statement_id,line_id,charge_id,created_by) values($1,$2,$3,$4,$5,$6)`,
    [randomUUID(),f.org.tenant,own.statement,foreign.line,foreign.charge,worker.id])),(e:any)=>e.code==='42501');
  assert.deepEqual(await read(worker.id),[own.statement]);
 } finally {await f.close();}
});
