import test from 'node:test';
import assert from 'node:assert/strict';
import {planAdministrativeFees} from '../src/financial-package.js';
const rule={id:'r',companyId:'co',itemId:'salik',feeItemId:'fee',unit:'vehicle_category',enabled:true,effectiveOn:'2027-01-01',amount:'10',revision:1};
const bill=(p:any={})=>({id:'a',company_id:'co',customer_id:'c',vehicle_id:'v',item_id:'salik',currency:'AED',outstanding:'200',dueOn:'2027-01-01',...p});
test('strict 60-day boundary, first day only and vehicle/category aggregation',()=>{
 assert.equal(planAdministrativeFees(rule,[bill()],'2027-03-01').length,0);
 assert.equal(planAdministrativeFees(rule,[bill()],'2027-03-03').length,0);
 const rows=planAdministrativeFees(rule,[bill(),bill({id:'b',outstanding:'5'}),bill({id:'c',vehicle_id:'v2'})],'2027-04-01');
 assert.equal(rows.length,2);assert.equal(rows[0].baseOutstanding,'205.000');assert.equal(rows[0].amount,'10');assert.equal(rows[0].originalDueOn,'2027-01-01');
 assert.equal(planAdministrativeFees({...rule,effectiveOn:'2026-01-01'},[bill({dueOn:'2027-01-31'})],'2027-04-01').length,0); // exactly 60 days
 assert.equal(planAdministrativeFees({...rule,effectiveOn:'2026-01-01'},[bill({dueOn:'2027-01-30'})],'2027-04-01').length,1);
});
test('settled principal, fee-on-fee, scope, ambiguous debtors and replay fail closed',()=>{
 for(const p of [{outstanding:'0'},{administrativeFee:true},{creditReviewRequired:true},{company_id:'other'},{currency:'USD'},{vehicle_id:null},{written_off:'1'},{contracting_company_id:'x'}])assert.equal(planAdministrativeFees(rule,[bill(p)],'2027-04-01').length,0);
 assert.equal(planAdministrativeFees(rule,[bill(),bill({id:'b',customer_id:'other'})],'2027-04-01').length,0);
 const a=planAdministrativeFees(rule,[bill()],'2027-04-01')[0];
 assert.equal(planAdministrativeFees({...rule,id:'new-rule',revision:2,amount:'20'},[bill()],'2027-04-01',new Set([a.sourceKey])).length,0);
 assert.equal(planAdministrativeFees(rule,[bill()],'2027-05-01',new Set([a.sourceKey])).length,1);
 assert.equal(planAdministrativeFees({...rule,enabled:false},[bill()],'2027-04-01').length,0);
 assert.equal(planAdministrativeFees({...rule,effectiveOn:'2027-04-10',eligibleFrom:'2027-01-01'},[bill()],'2027-04-01').length,0);
 assert.equal(planAdministrativeFees({...rule,effectiveOn:'2027-04-10',eligibleFrom:'2027-01-01',amount:'15'},[bill()],'2027-05-01')[0].amount,'15');
});
test('logical debt categories aggregate multiple source items once, retain all origins and honor legacy/revised monthly aliases',()=>{
 const logical={...rule,debtCategory:'salik',sourceItemIds:['salik','salik-import'],legacySourceItemIds:['salik','salik-import','salik-old'],categoryAliases:['salik']},rows=[bill(),bill({id:'b',item_id:'salik-import',outstanding:'30'}),bill({id:'c',item_id:'traffic',outstanding:'50'})];
 const plan=planAdministrativeFees(logical,rows,'2027-04-01');assert.equal(plan.length,1);assert.equal(plan[0].baseOutstanding,'230.000');assert.deepEqual(plan[0].originInvoiceIds,['a','b']);assert.equal(plan[0].sourceKey,'admin-fee:vehicle60:co:v:category-salik:2027-04');
 const traffic=planAdministrativeFees({...rule,itemId:'traffic',debtCategory:'traffic',sourceItemIds:['traffic'],feeItemId:'traffic-fee'},rows,'2027-04-01');assert.equal(traffic.length,1);assert.equal(traffic[0].baseOutstanding,'50.000');assert.notEqual(traffic[0].sourceKey,plan[0].sourceKey);
 for(const source of ['salik','salik-import','salik-old','category-salik'])assert.equal(planAdministrativeFees(logical,rows,'2027-04-01',new Set(['admin-fee:vehicle60:co:v:'+source+':2027-04'])).length,0);
 assert.equal(planAdministrativeFees({...rule,categoryAliases:['salik']},rows,'2027-04-01',new Set([plan[0].sourceKey])).length,0,'reenabling an original-item rule cannot double-charge a logical category already billed this month');
 assert.equal(planAdministrativeFees({...logical,sourceItemIds:['salik-import','salik'],amount:'12',revision:2},rows,'2027-05-01',new Set([plan[0].sourceKey]))[0].amount,'12');
 assert.equal(planAdministrativeFees(logical,rows.map(x=>({...x,outstanding:'0'})),'2027-05-01').length,0);
 assert.equal(planAdministrativeFees(logical,[bill({outstanding:'0'}),bill({id:'remaining',item_id:'salik-import',outstanding:'1'})],'2027-05-01')[0].baseOutstanding,'1.000');
});
