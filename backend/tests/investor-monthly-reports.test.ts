import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyAgencyFixture} from './investor-monthly-fixture.js';
import {transaction} from '../src/core.js';
import {balance} from '../src/ledger-domain.js';

const todayYear=(date:string)=>date.slice(0,4)+'-01-01';

test('Agency operational corrections and managed receivables do not become company assets or expense; legacy invoices retain original accrual and closing rules',async()=>{
 const f=await monthlyAgencyFixture();try{
 const bills=(await f.read(f.vehicle.id)).invoices,future=bills.find((i:any)=>i.kind==='finance'&&i.outstanding==='1250.000');assert(future);
 await f.req('POST','/api/ledger/invoices/'+future.id+'/correct',{amount:'100',reason:'Synthetic owner-authorized operational agency waiver',effectiveOn:f.today});
 assert.equal(Number((await f.admin.query("select count(*)n from ab.finance_journals where payload_cipher is not null and source_key like 'credit:%'")).rows[0].n),0);assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>balance(c,f.accounts.ar.charts[f.co1])),0n);
 const legacy=await f.bill('100');await f.req('POST','/api/ledger/invoices/'+legacy.id+'/correct',{amount:'20',reason:'Synthetic original company credit note',effectiveOn:f.date});assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>balance(c,f.accounts.ar.charts[f.co1])),80000n);
 const params={companies:f.co1,from:f.bounds.from,to:f.today,full:'true'},profit=await f.req('GET','/api/ledger/reports?'+new URLSearchParams({...params,kind:'profit'}));assert.equal(profit.profitByCurrency.AED,'150.000');assert.equal(profit.unpostedInvoiceAdjustments,0);const annual=await f.req('GET','/api/ledger/reports?'+new URLSearchParams({...params,from:todayYear(f.today),kind:'profit'}));assert.equal(annual.profitByCurrency.AED,'230.000');
 const receivables=await f.req('GET','/api/ledger/reports?'+new URLSearchParams({...params,to:future.dueOn,kind:'receivables'}));assert.equal(receivables.rows.find((r:any)=>r.id===future.id).ownership,'investor_managed_right');assert.equal(receivables.rows.find((r:any)=>r.id===future.id).outstanding,'1150.000');assert.equal(receivables.rows.find((r:any)=>r.id===legacy.id).ownership,'company_receivable');assert.equal(receivables.rows.find((r:any)=>r.id===legacy.id).outstanding,'80.000');
 const closing=await f.req('GET','/api/ledger/closing-review?'+new URLSearchParams({companyId:f.co1,month:f.bounds.from}));assert.equal(closing.problems.unpostedInvoiceAdjustments||0,0);
 }finally{await f.close();}
});
