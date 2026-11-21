import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {companyTaxSchema,taxBridge} from '../src/company-tax-preparation.js';
import {businessCentersFixture} from './business-centers-fixture.js';
const period={from:'2026-01-01',to:'2026-12-31'};
const data=(co:string)=>({companyId:co,revision:0,trn:'100000000000001',vatPeriods:[period],corporatePeriods:[period],mappings:[],adjustments:[],notes:'Draft only',confirm:true});
test('tax drafts reject overlapping periods and inconsistent classifications without inventing tax rates',()=>{
 const d=data(randomUUID());assert(companyTaxSchema.safeParse(d).success);
 assert(!companyTaxSchema.safeParse({...d,trn:'123'}).success);
 assert(!companyTaxSchema.safeParse({...d,vatPeriods:[period,{from:'2026-12-31',to:'2027-03-31'}]}).success);
 const m={itemId:randomUUID(),category:'exempt',rateBasisPoints:500,inputRecovery:'review',reason:'Review'};
 assert(!companyTaxSchema.safeParse({...d,mappings:[m]}).success);
 assert(companyTaxSchema.safeParse({...d,mappings:[{...m,rateBasisPoints:0}]}).success);
 assert(!companyTaxSchema.safeParse({...d,mappings:[{...m,category:'review',rateBasisPoints:0}]}).success);
 const r=taxBridge('100.001',[{...period,direction:'add',amount:'20.002'},{...period,direction:'deduct',amount:'5.003'},{from:'2025-01-01',to:'2025-12-31',direction:'add',amount:'999'}],period.from,period.to);
 assert.equal(r.proposedTaxableIncome,'115.000');assert.equal(r.taxDue,null);assert.equal(r.taxableIncome,null);assert.equal(r.filingReady,false);
 assert.equal(taxBridge('-100.000',[],period.from,period.to).proposedTaxableIncome,'-100.000');
});
test('company tax draft save/read/revision, scoped profit bridge and no financial or permission mutations',async()=>{
 const f=await businessCentersFixture();try{
  const before=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const a=await f.bill('100',f.items.salik),b=await f.bill('900',f.items.salik,{companyId:f.co2,customerId:f.client2});
  const beforeInvoices=(await f.admin.query('select * from ab.vehicle_invoices order by id')).rows;
  const beforeJournals=(await f.admin.query('select * from ab.finance_journals order by id')).rows;
  const initial=await f.req('GET','/api/ledger/package/tax-config?companyId='+f.co1);assert.equal(initial.configuration,null);assert.equal(initial.automaticTaxPosting,false);
  const adjustment={id:randomUUID(),...period,direction:'add',amount:'15',reason:'Proposed disallowance for review',evidenceVersionId:null};
  const body={...data(f.co1),adjustments:[adjustment],mappings:[{itemId:f.items.salik,category:'review',rateBasisPoints:null,inputRecovery:'review',reason:'Contract classification unresolved'}]};
  const saved=await f.req('POST','/api/ledger/package/tax-config',body);assert.equal(saved.financialEffect,false);assert.equal(saved.revision,1);
  await f.req('POST','/api/ledger/package/tax-config',body,409);
  const cfg=await f.req('GET','/api/ledger/package/tax-config?companyId='+f.co1);assert.equal(cfg.configuration.trn,body.trn);assert.equal(cfg.filingReady,false);
  assert.equal((await f.req('GET','/api/ledger/package/tax-config?companyId='+f.co2)).configuration,null);
  const bridge=await f.req('GET','/api/ledger/package/tax-bridge?'+new URLSearchParams({companyId:f.co1,...period}));
  assert.equal(bridge.accountingProfit,'100.000');assert.equal(bridge.proposedTaxableIncome,'115.000');assert.equal(bridge.taxDue,null);assert.equal(bridge.registeredPeriod,true);
  assert.deepEqual((await f.admin.query('select * from ab.vehicle_invoices order by id')).rows,beforeInvoices);
  assert.deepEqual((await f.admin.query('select * from ab.finance_journals order by id')).rows,beforeJournals);
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,before);
  const employee=await f.employee('employee');await f.login(employee.username,employee.password);
  await f.req('POST','/api/ledger/package/tax-config',{...body,revision:1},403);
  await f.req('GET','/api/ledger/package/tax-bridge?'+new URLSearchParams({companyId:f.co1,...period}),undefined,403);
 }finally{await f.close();}
});
