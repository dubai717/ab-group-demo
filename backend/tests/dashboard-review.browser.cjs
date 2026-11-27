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
  const sidebar=page.locator('.app-shell > .sidebar');
  await sidebar.waitFor();
  const navigation=await sidebar.locator('[data-page]').evaluateAll(items=>items.map(item=>item.dataset.page));
  assert.deepEqual(navigation.slice(0,4),['dashboard','users','companies','bankAccounts']);
  await page.locator('#dashboard-company').selectOption(fixture.companyId);
  await page.locator('[data-board-action=overall]:enabled').waitFor();
  await page.locator('.ab-board-gauge').first().scrollIntoViewIfNeeded();
  assert.equal(await page.locator('[data-board-module=counts]').count(),0);
  const summary=page.locator('[data-board-summary]');
  assert.deepEqual(await summary.locator('[data-summary-panel]').evaluateAll(panels=>panels.map(p=>p.dataset.summaryPanel)),['financial','debt','items','contracts','emirates','investors']);
  if(process.env.AB_DASHBOARD_RANKING_FIXTURE==='1'){
   const ranked=await page.evaluate(async(companyId)=>{
    const base='central-dashboard?companyId='+companyId+'&from=2026-01-01&to=2026-01-31';
    return (await CenterForms.api(base)).overview;
   },fixture.companyId);
   const expected=Array.from({length:12},(_,index)=>((12-index)*125).toFixed(3));
   for(const rows of [ranked.debt.filter(r=>r.name.startsWith('عميل تجريبي')),ranked.items.filter(r=>r.name.startsWith('بند محاسبي تجريبي'))])assert.deepEqual(rows.map(r=>r.amount),expected);
   for(const id of ['debt','items']){
    const list=summary.locator('[data-summary-panel='+id+'] .ab-board-ranking');
    assert.equal(await list.locator('tbody tr').count()>=12,true);
    assert(await list.evaluate(el=>el.scrollHeight>el.clientHeight));
    assert(await list.evaluate(el=>{el.scrollTop=el.scrollHeight;return el.scrollTop>0;}));
    await list.evaluate(el=>el.scrollTop=0);
   }
  }
  const dashboardScroll=await page.evaluate(()=>scrollY);
  await page.locator('.ab-board-gauge').first().click();
  await page.screenshot({path:output+'/dashboard-companies-ar.png'});
  await page.locator('dialog [data-board-action^="company-performance:"]').first().click();
  assert.equal(await page.locator('.ab-board-dialog aside, .ab-board-dialog nav').count(),0);
  await page.screenshot({path:output+'/dashboard-company-employees-ar.png'});
  assert.equal(await page.locator('.ab-board-dialog[open]').count(),2);
  assert.match(await page.locator('.ab-board-dialog[open]').last().innerText(),/لا توجد بيانات كافية|Insufficient data/);
  await page.locator('.ab-board-dialog[open]').last().locator('header button').click();
  assert.equal(await page.locator('.ab-board-dialog[open]').count(),1);
  await page.locator('.ab-board-dialog[open]').locator('header button').click();
  assert.equal(await page.locator('#dashboard-company').inputValue(),fixture.companyId);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.boardAction),"overall");
  assert(Math.abs(await page.evaluate(()=>scrollY)-dashboardScroll)<=1);
  const firstBar=page.locator('[data-board-action^="movement:"]').first();
  assert.match(await firstBar.innerText(),/^[0-9٠-٩]+$/);
  await firstBar.click();
  await page.locator('dialog [data-board-action^="movement-company:"]').first().click();
  assert.match(await page.locator('.ab-board-dialog[open]').last().innerText(),/SYNTHETIC-FORMS/);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.locator('[data-dashboard=board-settings]').click();
  const countsControl=page.locator('.ab-board-setting').filter({hasText:/أعداد السجلات|Record counts/}).locator('input');
  assert.equal(await countsControl.isChecked(),false);
  await countsControl.check();
  const visible=page.locator('.ab-board-setting input').first();
  await visible.uncheck();
  await page.locator('.ab-board-setting').first().locator('select').selectOption('medium');
  await page.locator('.ab-board-setting').first().locator('button').last().click();
  await page.locator('[data-board-save]').click();
  await page.waitForFunction(()=>!document.querySelector('[data-board-save]'));
  await page.reload();
  await page.locator('[data-board-module=counts] .stat-card').first().waitFor();
  await page.locator('[data-dashboard=board-settings]').click();
  await countsControl.uncheck();
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
    if(locale==='ar')await summary.screenshot({path:output+'/summary-'+width+'-ar.png'});
   }
   await page.setViewportSize({width:1440,height:1000});
   const menuBox=await sidebar.boundingBox(),mainBox=await page.locator('.app-shell > .main').boundingBox();
   assert(locale==='ar'?menuBox.x>=mainBox.x+mainBox.width-1:mainBox.x>=menuBox.x+menuBox.width-1);
   assert.deepEqual(await sidebar.locator('[data-page]').evaluateAll(items=>items.map(item=>item.dataset.page)),navigation);
   assert.equal(await page.locator('.ab-board-gauge').count(),4);
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
  await page.setViewportSize({width:390,height:850});
  const mobileMenu=sidebar.locator('[data-ws-menu]');
  const companyPage=sidebar.locator('[data-page=companies]');
  assert.equal(await companyPage.isVisible(),false);
  await mobileMenu.click();
  await companyPage.waitFor();
  await mobileMenu.click();
  assert.equal(await companyPage.isVisible(),false);
  assert.deepEqual(errors,[]);
  console.log('PASS original sidebar with adjacent dashboard, stacked dialogs, stored layout, bank/task drilldowns, read-only preview, AR/EN at 1440/768/390');
 }catch(error){console.error(await page.locator("[role=alert]").allTextContents(),errors);throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
