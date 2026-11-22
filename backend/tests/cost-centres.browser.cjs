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
 await p.locator('[data-ld=tab][data-id="journals"]').click();const journal=p.locator('[data-ld-form=journal]');await journal.waitFor({state:'attached'});if(!await journal.isVisible())await journal.locator('xpath=ancestor::details[1]').locator(':scope > summary').click();await journal.locator('[name=costCentreId]').selectOption(centre.id);assert.equal(await p.locator('[name=costCentreId]').inputValue(),centre.id);
 await p.locator('[data-ld=tab][data-id="reports"]').click();const report=p.locator('[data-ld-form=report]');await report.waitFor({state:'attached'});if(!await report.isVisible())await report.locator('xpath=ancestor::details[1]').locator(':scope > summary').click();await report.locator('[name=kind]').selectOption('cost-centres');
 const response=p.waitForResponse(r=>r.url().includes('/api/ledger/reports?')&&new URL(r.url()).searchParams.get('kind')==='cost-centres');await p.locator('[data-ld-form=report] [type=submit]').click();const source=await(await response).json();assert.equal(source.presentation,'human_statement_v1');assert.equal(source.statementLocale,'ar');assert(source.statementColumns.includes('costCentreName'));const view=p.locator('[data-ld-report-result]');await view.waitFor();await p.waitForFunction(scope=>document.querySelector('[data-ld-report-result]')?.textContent.includes(scope),source.statementScope);assert(!(await view.innerText()).includes('cost_centre_id'));
};
