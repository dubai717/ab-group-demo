const assert=require('node:assert/strict'),fs=require('node:fs/promises');
module.exports=async(p)=>{
 for(const locale of ['ar','en']){await p.evaluate(l=>setLocale(l),locale);for(const width of [1440,768,390]){
  await p.setViewportSize({width,height:950});await p.locator('[data-ld=tab][data-id=import]').click();
  const next=p.waitForEvent('download');await p.locator('[data-ld=import-template-xlsx]').click();const file=await next;assert.equal(file.suggestedFilename(),'invoice-import-template.xlsx');const bytes=await fs.readFile(await file.path());assert.equal(bytes.subarray(0,2).toString(),'PK');
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Import template layout '+locale+' '+width);
 }}
 const next=p.waitForEvent('download');await p.locator('[data-ld=import-template-csv]').click();const file=await next;assert.match(await fs.readFile(await file.path(),'utf8'),/^\uFEFFsourceKey,customerNumber/);
 await p.setViewportSize({width:1440,height:1000});await p.evaluate(()=>setLocale('ar'));
};
