const assert=require('node:assert/strict');
module.exports=async(p,f)=>{
 const tab=async()=>{await p.locator('[data-ld=tab][data-id=commitments]').click();await p.locator('[data-fp=commitment-new]').waitFor();};
 await tab();await p.locator('[data-fp=commitment-new]').click();let d=p.locator('dialog[open]').last();
 for(const [name,value] of Object.entries({title:'Synthetic browser commitment',beneficiary:'Synthetic browser supplier',amount:'12.001',reason:'Isolated fixture only'}))await d.locator('[name='+name+']').fill(value);
 await d.locator('[name=itemId]').selectOption(f.expenseItemId);await d.locator('[name=documentVersionId]').selectOption(f.proofId);await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});
 let record=await p.evaluate(async co=>(await ABCentral.api('ledger/commitments?companyId='+co)).rows.find(r=>r.title==='Synthetic browser commitment'),f.companyId);assert.equal(record.status,'Draft');
 for(const locale of ['ar','en']){await p.evaluate(l=>setLocale(l),locale);for(const width of [1440,768,390]){await p.setViewportSize({width,height:950});await tab();await p.locator('tr').filter({has:p.locator('[data-fp-open="'+record.id+'"]')}).click();d=p.locator('dialog[open]').last();assert.match(await d.innerText(),/Synthetic browser supplier/);await d.locator('[data-close]').click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Commitment layout '+locale+' '+width);}}
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>setLocale('ar'));await tab();
 await p.locator('[data-fp=commitment-approve][data-id="'+record.id+'"]').click();d=p.locator('dialog[open]').last();await d.locator('[name=reason]').fill('Synthetic reviewed liability');await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});
 const saved=p.waitForResponse(r=>r.url().endsWith('/api/ledger/commitments/'+record.id+'/voucher')&&r.request().method()==='POST');await p.locator('[data-fp=commitment-voucher][data-id="'+record.id+'"]').click();assert.equal((await saved).status(),200);const result=await p.evaluate(async({co,id})=>(await ABCentral.api('ledger/commitments?companyId='+co)).rows.find(r=>r.id===id),{co:f.companyId,id:record.id});assert.equal(result.voucher.status,'Pending');
};
