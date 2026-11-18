import {vehicleWorkMetadata} from '../src/vehicle-work-metadata.js';
import {catalogueWith} from '../src/vehicle-catalog.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {customerFinancingTerms,customerFinancingSchedule} from '../src/customer-financing-terms.js';
import {normalizeWorkflowTerms,requestWorkflow} from '../src/vehicle-request-workflow.js';
const base={workflowVersion:3,financeType:'group',expectedFunding:'20000',downPayment:'0',months:15,expectedMonthly:'1333.33',totalObligation:'20000'};
test('Explicit obligation, first and last installment settle exactly without altering historical policy',()=>{
 const p=normalizeWorkflowTerms({...base});assert.equal(p.lastInstallment,'1333.380');const rows=customerFinancingSchedule(p,'2027-01-01');assert.equal(rows.length,15);assert.equal(rows[0].amount,'1333.330');assert.equal(rows.at(-1)?.amount,'1333.380');
 const mixed={...base,expectedFunding:'18000',downPayment:'2000',expectedMonthly:'1200',firstInstallment:'1000',installmentAdjustmentReason:'Unequal first and last payments explicitly proposed'};const terms=customerFinancingTerms(mixed);assert.equal(terms.installmentTotal,'18000.000');assert.equal(terms.lastInstallment,'1400.000');assert.equal(terms.contractualSpread,'0.000');assert.equal(customerFinancingSchedule(mixed,'2027-01-01').at(-1)?.amount,'1400.000');
 assert.throws(()=>customerFinancingTerms({...mixed,installmentAdjustmentReason:''}));assert.throws(()=>customerFinancingTerms({...base,expectedMonthly:'2000'}));assert.throws(()=>customerFinancingTerms({...base,totalObligation:'19000'}));
 const profitable=customerFinancingTerms({...base,totalObligation:'21000',expectedMonthly:'1400'});assert.equal(profitable.contractualSpread,'1000.000');assert.equal(profitable.totalObligation,'21000.000');
 assert.equal(customerFinancingSchedule({...base,months:1,expectedMonthly:'20000'},'2027-01-01')[0].amount,'20000.000');
 const old:any={workflowVersion:2,expectedFunding:'10000',months:3,expectedMonthly:'3333.333'};assert.equal(normalizeWorkflowTerms(old).installmentTotal,'10000.000');
 const r={funding_state:'Approved'},v={id:'v',status:'Active',contract:true};assert.equal(requestWorkflow(r,base,[],[],v).stage,'closure_review');assert.equal(requestWorkflow(r,base,[{kind:'request_closed'}],[],v).stage,'completed');assert.equal(requestWorkflow(r,old,[],[],v).stage,'completed');
});

test('Catalogue additions treat reserved JavaScript property names as plain data',()=>{const result=catalogueWith([{make:'constructor',model:'Safe model'},{make:'__proto__',model:'Another model'}]);assert.deepEqual(result.constructor,['Safe model']);assert.deepEqual(result.__proto__,['Another model']);assert.equal(Object.getPrototypeOf(result),null);assert.equal(({} as any)['Safe model'],undefined);});

test('Historical work details use the canonical financing source when the old display payload lacks it',async()=>{const id='00000000-0000-4000-8000-000000000001',rows=[{id,finance_type:'cash',funding_state:'Approved',request_number:1,file_number:2,payload_cipher:{},customer_cipher:{fullName:'Synthetic customer'},events:[],funds:[]}],metadata=await vehicleWorkMetadata({query:async()=>({rows})},{open:(value:any)=>value},[id]);assert.equal(metadata.get(id).requestSubtype,'cash');assert.equal(metadata.get(id).requestStage,'registration');});
