const assert=require('node:assert/strict');
module.exports=async function(p,f){
 const tab=async()=>{await p.locator('[data-ld=tab][data-id="taxes"]').click();await p.locator('[data-fp=tax-edit]').waitFor();};
 await tab();await p.locator('[data-fp=tax-edit]').click();let d=p.locator('dialog[open]').last();
 await d.locator('[name=trn]').fill('100000000000001');
 for(const name of ['vatFrom','corporateFrom'])await d.locator('[name='+name+']').fill('2026-01-01');
 for(const name of ['vatTo','corporateTo'])await d.locator('[name='+name+']').fill('2026-12-31');
 await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});
 await p.locator('[data-fp=tax-mapping]').click();d=p.locator('dialog[open]').last();
 await d.locator('[name=itemId]').selectOption(f.itemId);await d.locator('[name=reason]').fill('Synthetic unresolved supply classification');
 await d.locator('[type=submit]').click();await d.waitFor({state:'detached'});
 for(const locale of ['ar','en']){
  await p.evaluate(l=>setLocale(l),locale);
  for(const width of [1440,768,390]){
   await p.setViewportSize({width,height:950});await tab();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Tax layout '+locale+' '+width);
   await p.locator('[data-fp=tax-edit]').click();d=p.locator('dialog[open]').last();
   assert.equal(await d.locator('[name=trn]').inputValue(),'100000000000001');
   await d.locator('[data-cancel]').click();
  }
 }
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>setLocale('ar'));await tab();
 await p.locator('[data-fp=tax-bridge]').click();d=p.locator('dialog[open]').last();
 await d.locator('[type=submit]').click();await p.locator('dialog[open] form').waitFor({state:'detached'});
 const preview=p.locator('dialog[open]').last();await preview.locator('[data-close]').waitFor();
 assert.match(await preview.textContent(),/ليست إقراراً/);await preview.locator('[data-close]').click();
};
