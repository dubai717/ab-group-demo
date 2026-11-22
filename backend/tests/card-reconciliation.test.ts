import test from 'node:test';import assert from 'node:assert/strict';import {ledgerFixture} from './ledger-fixture.js';
test('original card reconciliation cannot approve a partially matched line; exact native sources preserve all financial entries',async()=>{const f=await ledgerFixture();try{
 const proof=await f.proof(),card=await f.req('POST','/api/ledger/cards',{companyId:f.co1,holderId:f.org.user,bankName:'Synthetic issuer',lastFour:'7531',name:'Synthetic exact reconciliation',currency:'AED',dueDay:15,liabilityId:f.accounts.payable.charts[f.co1]});
 const charges=[];for(const amount of ['30.001','19.999','50'])charges.push(await f.req('POST','/api/ledger/cards/'+card.id+'/charges',{amount,paidOn:f.date,reference:'SYN-MATCH-'+amount,beneficiary:'Synthetic supplier',documentVersionId:proof,splits:[{companyId:f.co1,itemId:f.items.expense,amount}]}));
 const st=await f.req('POST','/api/ledger/cards/'+card.id+'/statements',{periodFrom:'2026-01-01',periodTo:'2026-01-31',openingBalance:'0',closingBalance:'100',documentVersionId:proof,lines:[{date:f.date,amount:'100',reference:'SYN-COMBINED'}]}),details=await f.req('GET','/api/ledger/statements/'+st.id),lineId=details.lines[0].id;
 const before=(await f.admin.query('select id,debit::text,credit::text from ab.finance_entries order by id')).rows;
 await f.req('POST','/api/ledger/card-statements/'+st.id+'/match',{pairs:[{lineId,chargeId:charges[0].id}]});
 await f.req('POST','/api/ledger/card-statements/'+st.id+'/approve',{},409);
 assert.equal((await f.admin.query('select status from ab.finance_statements where id=$1',[st.id])).rows[0].status,'Review');
 await f.req('POST','/api/ledger/card-statements/'+st.id+'/match',{pairs:charges.slice(1).map(ch=>({lineId,chargeId:ch.id}))});
 await f.req('POST','/api/ledger/card-statements/'+st.id+'/approve',{});
 assert.equal((await f.admin.query('select status from ab.finance_statements where id=$1',[st.id])).rows[0].status,'Approved');
 assert.deepEqual((await f.admin.query('select id,debit::text,credit::text from ab.finance_entries order by id')).rows,before);
 await f.req('POST','/api/ledger/card-statements/'+st.id+'/approve',{},409);
 }finally{await f.close();}});

test('Owner unmatched report retains the precise unallocated part of a partially matched personal statement, without adding it to Owner debt',async()=>{
 const {businessCentersFixture}=await import('./business-centers-fixture.js'),{today}=await import('../src/vehicle-domain.js'),f=await businessCentersFixture();try{
 const proof=await f.proof(),payable=await f.req('POST','/api/ledger/accounts',{nameAr:'ذمة مالك مطابقة وهمية',nameEn:'Synthetic partial statement Owner payable',kind:'liability',companyIds:[f.co1],currency:'AED'}),card=await f.req('POST','/api/ledger/cards',{companyId:f.co1,holderId:f.org.user,bankName:'Synthetic issuer',lastFour:'7532',name:'Synthetic partial Owner statement',currency:'AED',dueDay:15,liabilityId:payable.charts[0].id,ownership:'personal_owner'});
 const charge=await f.req('POST','/api/ledger/cards/'+card.id+'/charges',{amount:'30.001',paidOn:today(),reference:'SYN-OWNER-PARTIAL',beneficiary:'Synthetic supplier',documentVersionId:proof,personalReview:{actualPaymentVerified:true,taxReviewReason:'Synthetic actual payment without VAT assumption'},splits:[{companyId:f.co1,itemId:f.items.expense,amount:'30.001',purpose:'business_expense'}]});
 const st=await f.req('POST','/api/ledger/cards/'+card.id+'/statements',{periodFrom:today(),periodTo:today(),openingBalance:'0',closingBalance:'100',documentVersionId:proof,lines:[{date:today(),amount:'100',reference:'SYN-PARTIAL-LINE'}]}),before=(await f.admin.query('select id,debit::text,credit::text from ab.finance_entries order by id')).rows,initial=await f.req('GET','/api/ledger/statements/'+st.id),lineId=initial.lines[0].id;
 await f.req('POST','/api/ledger/card-statements/'+st.id+'/match',{pairs:[{lineId,chargeId:charge.id}]});await f.req('POST','/api/ledger/card-statements/'+st.id+'/approve',{},409);
 const detail=await f.req('GET','/api/ledger/statements/'+st.id);assert.equal(detail.lines[0].matched_amount,'30.001');assert.equal(detail.lines[0].remaining_amount,'69.999');
 const path='/api/ledger/owner-reimbursements/report?companies='+f.co1+'&from='+today()+'&to='+today(),report=await f.req('GET',path),line=report.rows.find((r:any)=>r.type==='unmatched_statement');assert.equal(report.summary[0].unmatchedStatementAmount,'69.999');assert.equal(report.summary[0].unmatchedStatementLines,1);assert.equal(report.summary[0].closingOwnerPayable,'30.001');assert.equal(line.amount,'69.999');assert.equal(line.matchedAmount,'30.001');assert.equal(line.statementLineAmount,'100.000');assert.equal(line.state,'partially_matched');
 assert.deepEqual((await f.admin.query('select id,debit::text,credit::text from ab.finance_entries order by id')).rows,before);
 }finally{await f.close();}
});
