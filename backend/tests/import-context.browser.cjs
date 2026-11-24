// Synthetic held-response contexts only; no target import, authority change or external source.
const{chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const f=JSON.parse(fs.readFileSync('work/workbench-browser-fixture.json')),b=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));let applied=0;p.on('request',r=>{if(r.method()==='POST'&&/\/api\/data-imports\/[^/]+\/run$/.test(r.url()))applied++;});try{
 await p.goto('http://127.0.0.1:3627');await p.fill('#username',f.username);await p.fill('#password',f.password);await p.locator('#login-form [type=submit]').click();await p.locator('#central-dashboard').waitFor();assert.equal(await p.evaluate(()=>typeof ABCentral.authorityVersion),'number');
 for(const kind of['customers','vehicles','companies'])for(const dimension of['page','csrf','locale','authority']){
  const context=await p.evaluate(()=>({page:app.state.currentPage,csrf:ABCentral.csrf,locale:getLocale(),authority:ABCentral.authorityVersion}));
  await p.evaluate(({kind,co})=>DataImportUI.open(kind,[{id:co,arabicName:'شركة سياق اصطناعية',englishName:'Synthetic context company'}]),{kind,co:f.companyId});
  const d=kind==='companies'?p.locator('dialog[data-company-import-preview="1"]'):p.locator('dialog').filter({has:p.locator('[data-import-status]')});await d.locator('[name=source]').selectOption('csv');const sentinel='HELD-PRIVATE-'+kind+'-'+dimension;
  await d.locator('[name=file]').setInputFiles({name:'synthetic-context.csv',mimeType:'text/csv',buffer:Buffer.from(kind==='companies'?'arabicName,englishName,tradeLicenseNumber\nشركة وهمية,'+sentinel+',SYN-'+dimension+'\n':kind==='vehicles'?'vehicleType,financeType,notes\nBus,cash,'+sentinel+'\n':'fullName\n'+sentinel+'\n')});
  let release,started;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>started=resolve),pattern='**/api/data-imports/'+kind+'/'+(kind==='companies'?'preview':'upload');
  await p.route(pattern,async route=>{const response=await route.fetch();assert.equal(response.status(),200);started();await gate;await route.fulfill({response}).catch(()=>{});});
  try{
   await d.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await ready;
   if(dimension==='page')await p.evaluate(()=>app.state.currentPage='tasks');
   if(dimension==='csrf')await p.evaluate(()=>ABCentral.csrf+='-synthetic-transition');
   if(dimension==='locale')await p.evaluate(()=>setLocale(getLocale()==='ar'?'en':'ar'));
   if(dimension==='authority'){
    await p.route('**/api/bootstrap',async route=>{const response=await route.fetch(),body=await response.json();body.actor.roleId='employee';body.actor.permissions=[];body.actor.companyIds=[];await route.fulfill({response,json:body});},{times:1});await p.evaluate(()=>ABCentral.reload(false));assert(await p.evaluate(old=>ABCentral.authorityVersion>old,context.authority));
   }
   release();await d.waitFor({state:'detached'});assert(!(await p.locator('body').innerText()).includes(sentinel),'old response must not enter current DOM');
  }finally{
   release();await p.unroute(pattern);await p.evaluate(context=>{app.state.currentPage=context.page;ABCentral.csrf=context.csrf;setLocale(context.locale);},context);if(dimension==='authority')await p.evaluate(()=>ABCentral.reload(false));await p.locator('dialog[data-center-owned]').evaluateAll(nodes=>nodes.forEach(n=>n.remove()));
  }
 }
 assert.equal(applied,0);assert.deepEqual(errors,[]);console.log('PASS original customer/vehicle shared importer and company preview held replies: actual source previews, page/CSRF/locale/original authority revision transitions, no stale DOM/late job, no target import or authority write. Synthetic context projections only.');
 }catch(e){console.error(e.stack);process.exitCode=1;}finally{await b.close();}
})();
