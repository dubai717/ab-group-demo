import test from 'node:test';
import assert from 'node:assert/strict';
import {monthBounds,registrationSlice,intersectFunds,monthlyAmount} from '../src/investor-monthly-domain.js';
test('Gross investor installment is not split; fixed registration fees conserve thousandths across partial receipts',()=>{
 assert.equal(monthlyAmount('finance',1250000n,0n,{}),1250000n);
 for(const share of [50000n,100000n,150000n]){let offset=0n,total=0n;for(const amount of [1n,999n,89000n,210000n]){total+=registrationSlice(offset,amount,300000n,share);offset+=amount;}assert.equal(total,share);}
 assert.throws(()=>registrationSlice(0n,300001n,300000n,150000n));assert.throws(()=>registrationSlice(0n,1n,300000n,300001n));
});
test('Bank credit intervals retain unconfirmed/reversed holes and never allocate the same received money twice',()=>{
 const parts=intersectFunds([{id:'first',amount:1250000n},{id:'second',amount:1250000n}],[{id:'pending-bank',amount:500000n},{id:'confirmed-bank',amount:2000000n}]);
 assert.deepEqual(parts,[{allocationId:'first',bankPartId:'pending-bank',amount:500000n,allocationOffset:0n},{allocationId:'first',bankPartId:'confirmed-bank',amount:750000n,allocationOffset:500000n},{allocationId:'second',bankPartId:'confirmed-bank',amount:1250000n,allocationOffset:0n}]);
 assert.equal(parts.filter(p=>p.bankPartId==='confirmed-bank').reduce((n,p)=>n+p.amount,0n),2000000n);
 assert.equal(parts.filter(p=>p.allocationId!=='first'&&p.bankPartId==='confirmed-bank').reduce((n,p)=>n+p.amount,0n),1250000n);
});
test('Monthly period boundaries use complete real months and reject invalid input',()=>{assert.deepEqual(monthBounds('2028-02'),{from:'2028-02-01',to:'2028-02-29'});for(const invalid of ['2026-13','26-02','1999-01','2026-00','2026-01-01'])assert.throws(()=>monthBounds(invalid));});
