const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const {resolve} = require('node:path');
const {randomUUID} = require('node:crypto');

(async () => {
  const browser = await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE || undefined,args:['--no-sandbox']});
  const companyId=randomUUID(), invoiceId=randomUUID(), reportId=randomUUID(), employee=randomUUID();
  const receivingSite={centreId:randomUUID(),centreSourceId:randomUUID(),locationSourceId:randomUUID()};
  try {
    for (const [locale,width] of [['en',1280],['ar',390]]) {
      const page=await browser.newPage({viewport:{width,height:820}});
      const origin='http://127.0.0.1:3730/';
      await page.route(origin, route=>route.fulfill({contentType:'text/html',body:
        `<!doctype html><html lang="${locale}" dir="${locale==='ar'?'rtl':'ltr'}"><main></main></html>`}));
      await page.goto(origin);
      await page.addStyleTag({path:resolve('styles.css')});
      await page.evaluate(({locale,companyId,invoiceId,reportId,employee,receivingSite})=>{
        window.getLocale=()=>locale;
        window.requests=[];
        window.ABCentral={
          actor:{id:employee},authorityVersion:1,crossBranchCollection:{canConfirm:false},
          async api(path,method,data,key){
            window.requests.push({path,method,data,key});
            if(path.includes('invoice?'))return{invoice:{id:invoiceId,companyId,number:'901',currency:'AED',outstanding:'100.000'},receivedOn:'2026-11-25',receivingSite};
            if(path.endsWith('/post'))return{id:'original-post'};
            if(path.endsWith('cross-branch-intake')){
              if(window.requests.filter(r=>r.path.endsWith('cross-branch-intake')).length===1) throw Error('requestTimeout');
              return{id:reportId};
            }
            return {id:reportId,invoiceId,companyId,reportedBy:employee,state:'reported',amount:'25.000',receivedOn:'2026-11-25'};
          },
        };
      },{locale,companyId,invoiceId,reportId,employee,receivingSite});
      await page.addScriptTag({path:resolve('cross-branch-collection-ui.js')});
      await page.evaluate(()=>{document.querySelector('main').innerHTML=CrossBranchCollectionUI.entry();document.querySelector('main button').onclick=CrossBranchCollectionUI.open;});
      await page.locator('main button').click();
      const report=page.locator('[data-report]'),lookup=page.locator('[data-lookup]');
      assert.equal(await report.isVisible(),false);
      assert.equal(await page.locator('[data-confirm]').count(),0);
      await lookup.locator('[name=companyId]').fill(companyId);
      await lookup.locator('[name=invoiceId]').fill(invoiceId);
      await lookup.locator('button').click();
      await report.locator('[name=amount]').fill('25');
      await report.locator('[name=actual]').check();
      await report.locator('button').click();
      assert.equal(await report.locator('[name=amount]').isDisabled(),true,JSON.stringify(await page.evaluate(()=>({requests:window.requests,status:document.querySelector('[role=status]').textContent,secure:isSecureContext,crypto:typeof crypto.randomUUID}))));
      await report.locator('button').click();
      assert.equal(await page.locator('[name=reportId]').inputValue(),reportId);
      const requests=await page.evaluate(()=>window.requests);
      assert.deepEqual(requests[1],requests[2]);
      assert.deepEqual(requests[2].data,{companyId,invoiceId,receivingSite,receivedOn:'2026-11-25',amount:'25',actualCashReceived:true});
      await page.locator('[data-close]').click();
      await page.evaluate(()=>{ABCentral.actor={id:'another-user'};ABCentral.authorityVersion++;ABCentral.crossBranchCollection.canConfirm=true;});
      await page.locator('main button').click();
      await page.locator('[name=reportId]').fill(reportId);
      await page.locator('[data-status] button').click();
      const confirm=page.locator('[data-confirm]');
      await confirm.locator('[name=amount]').fill('25.000');
      await confirm.locator('[name=actual]').check();
      await confirm.locator('button').click();
      const posting=await page.evaluate(()=>window.requests.at(-1));
      assert.deepEqual(posting.data,{confirmedAmount:'25.000',confirmActualCash:true});
      assert.equal(posting.path,'ledger/collections/cross-branch-intake/'+reportId+'/post');
      await page.close();
    }
  } finally { await browser.close(); }
  console.log('PASS: bilingual exact-invoice cash report, recovery and independent confirmation');
})().catch(error=>{console.error(error);process.exitCode=1;});
