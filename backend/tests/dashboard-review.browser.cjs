const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const fixture=JSON.parse(fs.readFileSync('work/forms-browser-fixture.json'));
const output=process.env.AB_DASHBOARD_SCREENSHOTS||'work';

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];
 page.setDefaultTimeout(9000);
 page.on('pageerror',error=>errors.push(error.message));
 try {
  await page.goto('http://127.0.0.1:3625');
  await page.fill('#username',fixture.username);
  await page.fill('#password',fixture.password);
  await page.locator('#login-form [type=submit]').click();
  await page.locator('[data-board-action=overall]').waitFor();
  assert.equal(await page.locator('.app-shell > .sidebar:visible').count(),0);
  await page.locator('[data-board-action=overall]').click();
  await page.locator('dialog [data-board-action^="company-performance:"]').first().click();
  assert.equal(await page.locator('.ab-board-dialog[open]').count(),2);
  assert.match(await page.locator('.ab-board-dialog[open]').last().innerText(),/لا توجد بيانات كافية|Insufficient data/);
  await page.locator('.ab-board-dialog[open]').last().locator('header button').click();
  assert.equal(await page.locator('.ab-board-dialog[open]').count(),1);
  await page.keyboard.press('Escape');
  await page.locator('[data-board-action^="movement:"]').first().click();
  await page.locator('dialog [data-board-action^="movement-company:"]').first().click();
  assert.match(await page.locator('.ab-board-dialog[open]').last().innerText(),/SYNTHETIC-FORMS/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('[data-dashboard=board-settings]').click();
  const visible=page.locator('.ab-board-setting input').first();
  await visible.uncheck();
  await page.locator('.ab-board-setting').first().locator('select').selectOption('medium');
  await page.locator('.ab-board-setting').first().locator('button').last().click();
  await page.locator('[data-board-save]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-board-save]'));
  await page.reload();
  await page.locator('[data-dashboard=board-settings]').click();
  assert.equal(await page.locator('.ab-board-setting input').nth(1).isChecked(),false);
  assert.equal(await page.locator('.ab-board-setting select').nth(1).inputValue(),'medium');
  await page.locator('.ab-board-setting input').nth(1).check();
  await page.locator('.ab-board-setting').nth(1).locator('button').first().click();
  await page.locator('.ab-board-setting select').first().selectOption('wide');
  await page.locator('[data-board-save]').click();
  for(const locale of ['ar','en']){
   await page.evaluate(locale=>setLocale(locale),locale);
   await page.locator('[data-board-action=overall]').waitFor();
   for(const width of [1440,768,390]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),locale+' '+width);
   }
   await page.setViewportSize({width:1440,height:1000});
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:output+'/dashboard-'+locale+'.png',fullPage:true});
   await page.locator('[data-task-filter=late]').click();
   await page.locator('[data-board-tasks] [data-board-action^="task:"]').first().waitFor();
   await page.locator('[data-board-tasks] [data-board-action^="task:"]').first().click();
   await page.locator('.ab-board-dialog[open]').waitFor();
   await page.screenshot({path:output+'/dashboard-tasks-'+locale+'.png'});
   await page.keyboard.press('Escape');
   await page.locator('[data-board-action=banks]').click();
   await page.locator('[data-bank-filter=id]').selectOption({index:1});
   await page.locator('[data-bank-table] [data-board-action^="bank:"]').first().click();
   await page.locator('.ab-board-dialog[open]').last().locator('header button').click();
   assert.notEqual(await page.locator('[data-bank-filter=id]').inputValue(),'');
   await page.screenshot({path:output+'/dashboard-banks-'+locale+'.png'});
   await page.keyboard.press('Escape');
   await page.locator('[data-dashboard=board-settings]').click();
   await page.locator('[data-board-preview]').click();
   await page.locator('[data-preview-board] .ab-board-grid').waitFor();
   assert.equal(await page.locator('[data-preview-board] .stat-card:enabled').count(),0);
   await page.locator('select[data-device]').selectOption('phone');
   await page.screenshot({path:output+'/dashboard-preview-'+locale+'.png'});
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('[data-board-save]').count(),1);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('[data-task-filter=late]').getAttribute('aria-pressed'),'true');
  }
  assert.deepEqual(errors,[]);
  console.log('PASS full-width dashboard, stacked dialogs, stored layout, bank/task drilldowns, read-only preview, AR/EN at 1440/768/390');
 }catch(error){console.error(await page.locator("[role=alert]").allTextContents(),errors);throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
