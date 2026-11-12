import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateMonthlySources,MonthlyAllocation,MonthlyBankPart} from '../src/investor-monthly-sources.js';
const allocation=(id:string,amount:bigint,extras:Partial<MonthlyAllocation>={}):MonthlyAllocation=>({id,receiptId:'receipt',fundingId:'funding',versionId:'version',companyId:'company',currency:'AED',kind:'installment',amount,receivedOn:'2026-10-25',...extras});
const bank=(id:string,amount:bigint,extras:Partial<MonthlyBankPart>={}):MonthlyBankPart=>({id,receiptId:'receipt',companyId:'company',currency:'AED',amount,entryId:'entry-'+id,bankAccountId:'bank',operationApproved:true,depositConfirmed:true,statementApproved:true,statementAmountMatches:true,confirmedOn:'2026-11-02',...extras});
const evaluate=(allocations:MonthlyAllocation[],bankParts:MonthlyBankPart[],extras:any={})=>evaluateMonthlySources({companyId:'company',currency:'AED',period:'2026-11',allocations,bankParts,claims:[],...extras});
test('Full 1250 installment plus 150 of a 300 registration fee reaches one 1400 investor plan only after bank reconciliation',()=>{
 const a=[allocation('installment',1250000n),allocation('registration',300000n,{kind:'registration_share',registrationBase:300000n,registrationShare:150000n})];
 const pending=evaluate(a,[bank('one',1550000n,{statementApproved:false})]);assert.equal(pending.amount,0n);assert.equal(pending.excluded.length,2);assert(pending.excluded.every(l=>l.reason==='bank_reconciliation_pending'));
 const ready=evaluate(a,[bank('one',1550000n)]);assert.equal(ready.amount,1400000n);assert(ready.eligible.every(l=>l.carriedForward));assert.equal(ready.eligible[0].amount,1250000n);
 const reserved=evaluate(a,[bank('one',1550000n)],{claims:ready.eligible.map(l=>({key:l.key,status:'Approved'}))});assert.equal(reserved.amount,0n);assert(reserved.excluded.every(l=>l.reason==='reserved_in_settlement'));
 const paid=evaluate(a,[bank('one',1550000n)],{claims:ready.eligible.map(l=>({key:l.key,status:'Paid'}))});assert.equal(paid.amount,0n);assert(paid.excluded.every(l=>l.reason==='previously_paid'));
});
test('Partial deposits and reversed holes keep original receipts and carry unconfirmed amounts forward without redistributing them',()=>{
 const a=[allocation('reversed',500000n,{reversed:true}),allocation('live',1250000n)];const b=[bank('unconfirmed',750000n,{statementAmountMatches:false}),bank('confirmed',1000000n)];
 const result=evaluate(a,b);assert.equal(result.amount,1000000n);assert.equal(result.eligible[0].allocationId,'live');assert.equal(result.excluded.find(l=>l.allocationId==='reversed')?.reason,'collection_reversed');
 const later=evaluate(a,b.map(p=>({...p,statementAmountMatches:true,confirmedOn:'2026-12-01'})));assert.equal(later.amount,0n);assert(later.excluded.some(l=>l.reason==='bank_confirmation_after_period'));
 const held=evaluate([allocation('one',1250000n)],[]);assert.equal(held.amount,0n);assert.equal(held.excluded[0].reason,'held_in_custody');
});
test('Frozen 50 and 100 registration versions remain independent; company, currency and duplicate claims cannot be mixed',()=>{
 const a=[allocation('old',300000n,{kind:'registration_share',registrationBase:300000n,registrationShare:50000n,versionId:'v1'}),allocation('new',300000n,{kind:'registration_share',registrationBase:300000n,registrationShare:100000n,versionId:'v2'})];
 const result=evaluate(a,[bank('one',600000n)]);assert.deepEqual(result.eligible.map(l=>[l.versionId,l.amount]),[['v1',50000n],['v2',100000n]]);
 assert.throws(()=>evaluate(a,[bank('one',600000n,{companyId:'another'})]));assert.throws(()=>evaluate(a,[bank('one',600000n,{currency:'USD'})]));assert.throws(()=>evaluate(a,[bank('one',600001n)]));assert.throws(()=>evaluate([a[0],a[0]],[]));
 const key=result.eligible[0].key;assert.throws(()=>evaluate(a,[bank('one',600000n)],{claims:[{key,status:'Draft'},{key,status:'Approved'}]}));
 const cancelled=evaluate(a,[bank('one',600000n)],{claims:[{key,status:'Cancelled'}]});assert.equal(cancelled.amount,150000n);
});
