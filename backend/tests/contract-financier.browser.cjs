const assert=require('node:assert/strict');
module.exports=async(p,f)=>{
 for(const locale of ['ar','en']){await p.evaluate(l=>setLocale(l),locale);for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:950});await p.evaluate(id=>ReceivablesUI.open(id),f.customerId);
  await p.locator('[data-rb=statement]').waitFor();await p.locator('[data-rb=statement]').click();
  const label=locale==='ar'?'قسط تمويل المجموعة':'Group financing installment';
  await p.locator('[data-receivables] td').filter({hasText:label}).first().waitFor();
  assert((await p.locator('[data-receivables]').innerText()).includes(label));
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Financier statement layout '+locale+' '+width);
 }}
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>setLocale('ar'));
};
