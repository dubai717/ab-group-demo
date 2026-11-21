const assert=require('node:assert/strict');
module.exports=async function(p,f){
 const tab=async()=>{await p.locator('[data-ld=tab][data-id="cost-centres"]').click();await p.locator('[data-fp=cost-centre-new]').waitFor();};
 await tab();await p.locator('[data-fp=cost-centre-new]').click();let d=p.locator('dialog[open]').last();
 await d.locator('[name=nameAr]').fill('مركز تكلفة اختبار الواجهة');await d.locator('[name=nameEn]').fill('Browser cost centre');
 await d.locator('[name=reason]').fill('Synthetic catalogue, no historical allocation');await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});
 const centre=await p.evaluate(async co=>(await ABCentral.api('ledger/package/cost-centres?companyId='+co)).rows.find(x=>x.nameEn==='Browser cost centre'),f.companyId);assert(centre);
 for(const locale of ['ar','en']){await p.evaluate(l=>setLocale(l),locale);for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:950});await tab();
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Cost centre layout '+locale+' '+width);
  await p.locator('tr').filter({has:p.locator('[data-fp-open="'+centre.id+'"]')}).click();d=p.locator('dialog[open]').last();assert.equal(await d.locator('[name=nameEn]').inputValue(),'Browser cost centre');await d.locator('[data-cancel]').click();
 }}
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>setLocale('ar'));
 await p.locator('[data-ld=tab][data-id="journals"]').click();await p.locator('details.ld-form-section summary').first().click();await p.locator('[name=costCentreId]').selectOption(centre.id);assert.equal(await p.locator('[name=costCentreId]').inputValue(),centre.id);
 await p.locator('[data-ld=tab][data-id="reports"]').click();await p.locator('details.ld-form-section summary').first().click();await p.locator('[name=kind]').selectOption('cost-centres');
 await p.locator('[data-ld-form=report] [type=submit]').click();
 await p.waitForFunction(()=>document.querySelector('.ld-section')?.textContent.includes('explicit cost centre'));
};
