import test from 'node:test';
import assert from 'node:assert/strict';
import {ledgerFixture} from './ledger-fixture.js';
import {obligationDates,commitmentSchema} from '../src/financial-commitments.js';
import {today} from '../src/vehicle-domain.js';
import {randomUUID} from 'node:crypto';
test('recurring commitments preserve month-end/leap anchors, bounded forecasts and disabled rules',()=>{
 const rule={enabled:true,anchorOn:'2028-01-31',untilOn:'2028-04-30',frequency:'monthly'};
 assert.deepEqual(obligationDates(rule,'2028-01-01','2028-04-30'),['2028-01-31','2028-02-29','2028-03-31','2028-04-30']);
 assert.deepEqual(obligationDates({...rule,enabled:false},'2028-01-01','2028-04-30'),[]);
 assert.deepEqual(obligationDates({...rule,anchorOn:'2028-02-29',untilOn:'2030-03-01',frequency:'annual'},'2028-01-01','2030-03-01'),['2028-02-29','2029-02-28','2030-02-28']);
 assert.throws(()=>obligationDates({...rule,untilOn:'9999-01-01'},'2028-01-01','9999-01-01'));
 assert(!commitmentSchema.safeParse({companyId:randomUUID(),amount:'0'}).success);
});
test('commitment approval accrues once; native voucher references original payable and cannot imply payment',async()=>{
 const f=await ledgerFixture();try{
  const proof=await f.proof(),body={companyId:f.co1,itemId:f.items.expense,title:'Synthetic rent',beneficiary:'Synthetic supplier',amount:'100.001',currency:'AED',dueOn:today(),documentVersionId:proof,reason:'Test only'};
  const grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const key=randomUUID(),a=await f.req('POST','/api/ledger/commitments',body,200,key);assert.equal(a.financialEffect,false);
  assert.equal((await f.req('POST','/api/ledger/commitments',body,200,key)).id,a.id);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,0);
  await f.req('POST','/api/ledger/commitments/'+a.id+'/voucher',{companyId:f.co1,confirm:true},409);
  const approve={companyId:f.co1,reason:'Explicit accrual review',confirm:true};
  await f.req('POST','/api/ledger/vouchers',{companyId:f.co1,itemId:f.items.expense,amount:'100.001',currency:'AED',issuedOn:today(),beneficiary:'Synthetic supplier',reason:'Cannot forge commitment provenance',sourceKey:'commitment-v1:'+a.id+':1'},409);
  const [x,y]=await Promise.all([f.req('POST','/api/ledger/commitments/'+a.id+'/approve',approve),f.req('POST','/api/ledger/commitments/'+a.id+'/approve',approve)]);assert.equal(x.journalId,y.journalId);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,1);
  const [v,w]=await Promise.all([f.req('POST','/api/ledger/commitments/'+a.id+'/voucher',{companyId:f.co1,confirm:true}),f.req('POST','/api/ledger/commitments/'+a.id+'/voucher',{companyId:f.co1,confirm:true})]);assert.equal(v.id,w.id);assert.equal((await f.admin.query('select status from ab.finance_vouchers where id=$1',[v.id])).rows[0].status,'Pending');
  await f.req('POST','/api/ledger/commitments/'+a.id+'/cancel',approve,409);
  await f.req('POST','/api/ledger/vouchers/'+v.id+'/cancel',{reason:'Synthetic cancelled payment request',effectiveOn:today()});const replacement=await f.req('POST','/api/ledger/commitments/'+a.id+'/voucher',{companyId:f.co1,confirm:true});assert.notEqual(replacement.id,v.id);v.id=replacement.id;
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,1);
  const draft=await f.req('POST','/api/ledger/commitments',body);await f.req('POST','/api/ledger/commitments/'+draft.id+'/approve',approve);await f.req('POST','/api/ledger/commitments/'+draft.id+'/cancel',approve);
  const sum=(await f.admin.query('select sum(e.debit-e.credit)::text amount from ab.finance_entries e join ab.finance_journals j on j.id=e.journal_id where j.status=\'Posted\' and e.chart_id=$1',[f.accounts.expense.charts[f.co1]])).rows[0];assert.equal(sum.amount,'100.001');
  const bank=await f.bank();await f.req('POST','/api/ledger/vouchers/'+v.id+'/prepare',{bankAccountId:bank.id,chequeNumber:'SYN-COMMITMENT-ONLY',issuedOn:today(),dueOn:today(),documentVersionId:proof});const review=await f.req('POST','/api/ledger/vouchers/approval-preview',{ids:[v.id],signedEvidence:true});await f.req('POST','/api/ledger/vouchers/approval-confirm',{batchId:review.id,digest:review.digest,confirm:true});
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals where source_key=$1',['voucher:'+v.id])).rows[0].n,0,'existing payable is not accrued twice');
  await f.req('POST','/api/ledger/vouchers/'+v.id+'/settle',{effectiveOn:today(),bankConfirmation:'Synthetic clearing only'});
  assert.equal((await f.admin.query('select sum(e.credit-e.debit)::text amount from ab.finance_entries e where e.chart_id=$1',[f.accounts.payable.charts[f.co1]])).rows[0].amount,'0.000');
  const rows=await f.req('GET','/api/ledger/commitments?companyId='+f.co1);assert.equal(rows.rows.find((r:any)=>r.id===a.id).voucher.status,'Paid');assert.equal((await f.req('GET','/api/ledger/commitments?companyId='+f.co2)).rows.length,0);
  await f.req('POST','/api/ledger/commitments',{...body,dueOn:'2020-01-01'},422);await f.req('POST','/api/ledger/commitments',{...body,itemId:f.items.work_amount},422);
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);
  const u=await f.employee();await f.login(u.username,u.password);await f.req('POST','/api/ledger/commitments',body,403);await f.req('GET','/api/ledger/commitments?companyId='+f.co1,undefined,403);
 }finally{await f.close();}
});
test('recurrence forecasts do not post; repeated generate creates one draft per due date, no catch-up history',async()=>{
 const f=await ledgerFixture();try{
  const proof=await f.proof(),body={companyId:f.co1,itemId:f.items.expense,title:'Synthetic subscription',beneficiary:'Synthetic supplier',amount:'10',currency:'AED',documentVersionId:proof,reason:'Test',anchorOn:today(),untilOn:today().slice(0,4)+'-12-31',frequency:'monthly',enabled:true,revision:0};
  const rule=await f.req('POST','/api/ledger/commitments/rules',body),generate={companyId:f.co1,confirm:true};
  const preview=await f.req('POST','/api/ledger/commitments/rules/'+rule.id+'/preview',{companyId:f.co1,from:today(),to:body.untilOn});assert.equal(preview.financialEffect,false);
  const [a,b]=await Promise.all([f.req('POST','/api/ledger/commitments/rules/'+rule.id+'/generate',generate),f.req('POST','/api/ledger/commitments/rules/'+rule.id+'/generate',generate)]);assert.equal(a.created.length+b.created.length,1);
  await f.req('POST','/api/ledger/commitments/rules',{...body,id:rule.id,revision:1,amount:'99'},409);
  await f.req('POST','/api/ledger/commitments/rules',{...body,id:rule.id,revision:1,enabled:false});await f.req('POST','/api/ledger/commitments/rules/'+rule.id+'/generate',generate,409);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_journals')).rows[0].n,0);assert.equal((await f.admin.query('select count(*)::int n from ab.finance_vouchers')).rows[0].n,0);
 }finally{await f.close();}
});
