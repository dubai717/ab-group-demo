const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const fixture=JSON.parse(fs.readFileSync('work/forms-browser-fixture.json'));
const main=['dashboard','customers','vehicles','financialManagement','approvalCenter','tasks','reports','notifications','businessDevelopment','systemSettings'];
const marketing=['contractingCompanies','marketing'];
const settings=['users','companies','bankAccounts','investors','personnel','documentCenter'];

async function login(page,account){
 await page.goto('http://127.0.0.1:3625');
 await page.fill('#username',account.username);
 await page.fill('#password',account.password);
 await page.locator('#login-form [type=submit]').click();
 await page.locator('.sidebar-nav [data-page=dashboard]').waitFor();
}
function sidebar(page){
 const nav=page.locator('.sidebar-nav');
 return {nav,menu:page.locator('[data-ws-menu]'),link:id=>nav.locator(`[data-page="${id}"]`),
  group:id=>nav.locator(`[data-sidebar-group="${id}"]`),children:id=>nav.locator('#sidebar-'+id+' > button')};
}
const pages=list=>list.evaluateAll(nodes=>nodes.map(node=>node.dataset.page));

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const owner=await browser.newPage({viewport:{width:1440,height:1080}});
  owner.setDefaultTimeout(12000);
  await login(owner,fixture);
  const ui=sidebar(owner);
  assert.deepEqual(await ui.nav.locator(':scope > button, :scope > .sidebar-group > button').evaluateAll(nodes=>nodes.map(node=>node.dataset.page||node.dataset.sidebarGroup)),main);
  assert.deepEqual(await pages(ui.children('businessDevelopment')),marketing);
  assert.deepEqual(await pages(ui.children('systemSettings')),settings);
  assert.equal(await ui.nav.locator('button:not(:has(>svg.sidebar-icon))').count(),0);
  assert.equal(await owner.locator('.sidebar-footer [data-action=logout] > svg.sidebar-icon').count(),1);
  const output=process.env.AB_SIDEBAR_SCREENSHOTS;
  for(const locale of ['ar','en']){
   await owner.evaluate(locale=>setLocale(locale),locale);
   await ui.link('dashboard').click();
   const layout=await owner.locator('.sidebar').evaluate(node=>{
    const rect=node.getBoundingClientRect(),link=node.querySelector('.nav-item');
    return {onRight:rect.left>innerWidth/2,iconOnRight:link.querySelector('svg').getBoundingClientRect().left>link.querySelector('span').getBoundingClientRect().left};
   });
   assert.deepEqual(layout,{onRight:locale==='ar',iconOnRight:locale==='ar'});
   const business=ui.group('businessDevelopment'),system=ui.group('systemSettings');
   await business.click();
   assert.equal(await business.getAttribute('aria-expanded'),'false');
   assert.equal(await system.getAttribute('aria-expanded'),'true');
   assert.equal(await ui.link('contractingCompanies').isVisible(),false);
   await owner.evaluate(()=>{app.state.currentPage='contractingCompanies';render();});
   await owner.locator('[aria-current=page][data-page=contractingCompanies]').waitFor();
   assert.equal(await business.getAttribute('aria-expanded'),'true');
   await system.click();
   assert.equal(await system.getAttribute('aria-expanded'),'false');
   assert.equal(await business.getAttribute('aria-expanded'),'true');
   await system.click();
   for(const id of [...main.slice(0,8),...marketing,...settings]){
    await ui.link(id).click();
    await owner.waitForFunction(page=>app.state.currentPage===page,id);
    await ui.link(id).and(ui.nav.locator('[aria-current=page]')).waitFor();
   }
   await ui.link('dashboard').click();
   await owner.locator('[data-page=dashboard][aria-current=page]').waitFor();
   if(output)await owner.screenshot({path:output+'/sidebar-'+locale+'.png'});
   await owner.setViewportSize({width:390,height:850});
   assert.equal(await ui.nav.isVisible(),false);
   await ui.menu.click();
   assert.equal(await ui.menu.getAttribute('aria-expanded'),'true');
   if(output)await owner.screenshot({path:output+'/sidebar-phone-'+locale+'.png'});
   await ui.link('companies').click();
   await owner.waitForFunction(()=>app.state.currentPage==='companies');
   assert.equal(await ui.nav.isVisible(),false);
   await ui.menu.click();
   assert.equal(await ui.link('companies').getAttribute('aria-current'),'page');
   await ui.menu.click();
   await owner.setViewportSize({width:1440,height:1080});
  }
  const employee=await browser.newPage();
  await login(employee,fixture.sidebarEmployee);
  const restricted=sidebar(employee);
  assert.equal(await restricted.group('businessDevelopment').count(),0);
  assert.equal(await restricted.group('systemSettings').count(),1);
  const visibleSettings=await pages(restricted.children('systemSettings'));
  assert(visibleSettings.includes('users'));
  assert(visibleSettings.length<settings.length);
  assert.equal(await restricted.link('companies').count(),0);
  await restricted.link('users').click();
  await employee.waitForFunction(()=>app.state.currentPage==='users');
  await employee.locator('.sidebar-footer [data-action=logout]').click();
  await employee.locator('#login-form').waitFor();
  console.log('PASS sidebar ordering, eight child routes, automatic expansion, independent toggles, existing permissions, and AR/EN on desktop and phone');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
