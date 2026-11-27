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
  const overall=page.locator('.ab-board-metrics article').filter({has:page.locator('[data-board-action=overall]')});
  await overall.locator('.ab-board-measure-empty').getByText('لا توجد بيانات',{exact:true}).waitFor();
  assert.equal(await overall.locator('.ab-board-gauge strong').innerText(),new Intl.NumberFormat('ar',{style:'percent'}).format(0));
  await page.getByRole('heading',{name:'الوضع الحالي',exact:true}).waitFor();
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
  const employeeScores=page.locator('.ab-board-dialog[open]').last();
  assert.match(await employeeScores.innerText(),/لا توجد بيانات|No data/);
  await employeeScores.getByText(new Intl.NumberFormat('ar',{style:'percent'}).format(0),{exact:false}).first().waitFor();
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
   if(fixture.depositId){
    await page.locator('[data-bank-filter=companyId]').selectOption(fixture.companyId);
    await page.locator('[data-bank-filter=bankId]').selectOption('demo-bank');
    await page.locator('[data-bank-filter=id]').selectOption(fixture.bankId);
   }else await page.locator('[data-bank-filter=id]').selectOption({index:1});
   await page.locator('[data-bank-table] [data-board-action^="bank:"]').first().click();
   if(fixture.depositId){
    const stack=page.locator('.ab-board-dialog[open]'),details=stack.last();
    const deposit=details.locator('[data-board-action="deposit:'+fixture.depositId+'"]');
    await deposit.click();
    await stack.getByRole('heading',{name:locale==='ar'?'سجل الإيداع':'Deposit record',exact:true}).waitFor();
    assert.equal(await stack.last().getByText('SYN-DASHBOARD-200',{exact:true}).count(),1);
    assert.equal(await stack.count(),3);
    if(locale==='ar')await page.screenshot({path:output+'/deposit-from-banks-ar.png'});
    await stack.last().locator('header button').click();
    await deposit.waitFor();
    assert.equal(await stack.count(),2);
   }
   await page.locator('.ab-board-dialog[open]').last().locator('header button').click();
   assert.notEqual(await page.locator('[data-bank-filter=id]').inputValue(),'');
   if(fixture.depositId){
    assert.equal(await page.locator('[data-bank-filter=companyId]').inputValue(),fixture.companyId);
    assert.equal(await page.locator('[data-bank-filter=bankId]').inputValue(),'demo-bank');
    assert.equal(await page.locator('[data-bank-filter=id]').inputValue(),fixture.bankId);
   }
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
  await page.evaluate(()=>setLocale('ar'));
  const picker=page.locator('#preview-picker');
  const search=picker.locator('#dashboard-user-search');
  const manager=picker.locator('[data-preview-target="'+fixture.managerId+'"]');
  await picker.waitFor();
  assert.equal(await picker.locator('[data-preview-count]').innerText(),'٤ / ٤');
  assert.equal(await picker.locator('[data-preview-selected]').innerText(),'اختر مستخدماً');
  await picker.locator('#dashboard-as').click();
  const employeeNumber=(await manager.locator('span').innerText()).split(' · ')[0];
  assert.match(employeeNumber,/^\d+$/);
  for(const query of ['معاينة جزئية',employeeNumber,'Preview Department','general_manager']){
   await search.fill(query);
   await manager.waitFor();
   const count=await picker.locator('[data-preview-count]').innerText();
   assert.match(count,/^[١-٣] \/ ٤$/);
  }
  await search.fill('معاينة جزئية');
  const selection=await manager.locator('strong').innerText();
  await manager.click();
  await page.locator('[data-view-as-stop]').waitFor();
  assert(await page.evaluate(id=>ABCentral.viewAs?.readOnly&&ABCentral.actor.id===id,fixture.managerId));
  await picker.locator('[data-preview-selected]').waitFor();
  assert.equal(await picker.locator('[data-preview-selected]').innerText(),selection);
  const status=await page.evaluate(async()=>{
   const res=await fetch('/api/personnel/tasks',{method:'POST',headers:{'Content-Type':'application/json','X-AB-Request':'1','X-CSRF-Token':ABCentral.csrf},body:'{}'});
   return res.status;
  });
  assert.equal(status,403);
  await page.locator('[data-view-as-stop]').click();
  await page.waitForFunction(id=>ABCentral.actor?.id===id&&!ABCentral.viewAs,fixture.ownerId);
  await picker.waitFor();
  assert.equal(await search.inputValue(),'معاينة جزئية');
  assert.equal(await picker.locator('[data-preview-selected]').innerText(),selection);
  assert.equal(await picker.locator('[data-preview-count]').innerText(),'١ / ٤');
  await page.locator('[data-board-summary]').waitFor();
  await page.screenshot({path:output+'/dashboard-user-picker-ar.png',fullPage:true});
  await page.setViewportSize({width:390,height:850});
  const mobileMenu=sidebar.locator('[data-ws-menu]');
  const companyPage=sidebar.locator('[data-page=companies]');
  assert.equal(await companyPage.isVisible(),false);
  await mobileMenu.click();
  await companyPage.waitFor();
  await mobileMenu.click();
  assert.equal(await companyPage.isVisible(),false);
  if(fixture.depositId){
   const delegate=await browser.newPage({viewport:{width:1440,height:1000}});
   delegate.on('pageerror',error=>errors.push(error.message));
   await delegate.goto('http://127.0.0.1:3625');
   await delegate.fill('#username',fixture.managerUsername);
   await delegate.fill('#password',fixture.managerPassword);
   await delegate.locator('#login-form [type=submit]').click();
   await delegate.locator('[data-dashboard=board-settings]').click();
   const preview=delegate.locator('[data-board-preview]'),dialogs=delegate.locator('.ab-board-dialog[open]');
   await preview.click();
   await delegate.locator('[data-preview-board] .ab-board-grid').waitFor();
   const input=delegate.locator('[data-preview-search]'),select=delegate.locator('[data-user]');
   await input.fill('تجريبي');
   await select.selectOption(fixture.permissionTargetId);
   await delegate.locator('[data-preview-board] .ab-board-grid').waitFor();
   assert.equal(await select.locator('option').count(),1);
   assert.equal(await delegate.locator('[data-preview-board] .stat-card:enabled').count(),0);
   await delegate.screenshot({path:output+'/delegated-central-preview-ar.png'});
   await dialogs.last().locator('header button').click();
   await preview.waitFor();
   await preview.click();
   await input.waitFor();
   assert.equal(await input.inputValue(),'تجريبي');
   assert.equal(await select.inputValue(),fixture.permissionTargetId);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS original sidebar with adjacent dashboard, stacked dialogs, stored layout, bank/task drilldowns, read-only preview, AR/EN at 1440/768/390');
 }catch(error){console.error(await page.locator("[role=alert]").allTextContents(),errors);throw error;}finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
