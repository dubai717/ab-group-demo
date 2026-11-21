const assert=require('node:assert/strict');
module.exports=async(p,f)=>{
 for(const locale of ['ar','en']){await p.evaluate(l=>setLocale(l),locale);for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:950});const loaded=p.waitForResponse(r=>r.url().includes('/api/ledger/receivables?')&&r.request().method()==='GET');await p.evaluate(id=>ReceivablesUI.open(id),f.customerId);await loaded;await p.waitForFunction(()=>typeof document.querySelector('[data-rb=statement]')?.onclick==='function');
  await p.locator('[data-rb=statement]').waitFor();await p.locator('[data-rb=statement]').click();
  const label=locale==='ar'?'قسط تمويل المجموعة':'Group financing installment';
  await p.locator('[data-receivables] td').filter({hasText:label}).first().waitFor().catch(err=>{err.message+=' layout '+locale+' '+width;throw err;});
  assert((await p.locator('[data-receivables]').innerText()).includes(label));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Financier statement layout '+locale+' '+width);
 }}
 for(const locale of ['ar','en']){await p.evaluate(l=>setLocale(l),locale);const loaded=p.waitForResponse(r=>r.url().includes('/api/ledger/receivables?')&&r.request().method()==='GET');await p.evaluate(id=>ReceivablesUI.open(id),f.customerId);await loaded;await p.waitForFunction(()=>typeof document.querySelector('[data-rb=collect]')?.onclick==='function');await p.locator('[data-rb=collect]').click();const form=p.locator('[data-rb-collect]');await form.locator('[name=companyId]').selectOption(f.companyId);await form.locator('[data-collection-financier]').filter({hasText:locale==='ar'?'قسط تمويل المجموعة':'Group financing installment'}).first().waitFor();assert.equal(await form.locator('select[name=financierId],select[name=investorId],select[name=bankId]').count(),0);await form.locator('[data-close]').click();}
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>setLocale('ar'));
};
