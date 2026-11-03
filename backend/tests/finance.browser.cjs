const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{const f=JSON.parse(fs.readFileSync('work/finance-browser-fixture.json')),browser=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||(fs.existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
p.on('pageerror',e=>errors.push(e.message));
try{
 await p.addInitScript(()=>{const w=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(!['ab_group_demo_locale'].includes(k)&&/state|finance|bank|password|session|token/i.test(k))throw Error('Sensitive browser write: '+k);return w.call(this,k,v);};});
 await p.goto('http://127.0.0.1:3200');await p.locator('#login-form').waitFor();await p.fill('#username',f.username);await p.fill('#password',f.password);await p.locator('#login-form [type=submit]').click();await p.locator('.stats-grid').waitFor();
 const stamp=String(Date.now());
 await p.locator('[data-page="companies"]').click();assert(await p.locator('.workspace-toolbar').innerText().then(s=>!s.includes('Cheques')&&!s.includes('الشيكات')));
 for(const [k,v] of Object.entries({arabicName:'شركة اختبار الواجهة المالية',englishName:'Finance Browser Test '+stamp,companyCode:'FW-'+stamp,tradeLicenseNumber:'FW-'+stamp}))await p.locator('#company-form [name="'+k+'"]').fill(v);
 await p.locator('#company-form [type=submit]').click();await p.locator('#central-notice').waitFor();
 const company=await p.evaluate(stamp=>app.state.companies.find(c=>c.companyCode==='FW-'+stamp).id,stamp);await p.locator('[data-page="bankAccounts"]').click();
 await p.locator('[data-ws="action"][data-value="bank-new"]').click();await p.locator('#bk-companyId').selectOption(company);
 for(const [k,v] of Object.entries({accountName:'Fictional browser bank',accountNumber:'FW-'+stamp,iban:(()=>{const bban='033'+stamp.padStart(16,'0');return 'AE'+String(98-Number(BigInt(bban+'101400')%97n)).padStart(2,'0')+bban;})(),openedAt:'2026-01-01',openingBalance:'1000.125',relationshipManagerName:'Fictional relationship manager',relationshipManagerPhone:'+971500000000',relationshipManagerEmail:'manager@example.test'}))await p.locator('#bk-'+k).fill(v);
 await p.locator('#bk-account-form [type=submit]').click();await p.locator('#central-notice').waitFor();
 await p.locator('[data-ws="finance"][data-value="movements"]').click();
 if(!f.schema){await p.getByText(/الترحيل المالي المقترح|proposed financial schema/).waitFor();assert.equal(await p.locator('#fw-form').count(),0);}else{
  await p.locator('#fw-form').waitFor();await p.waitForFunction(()=>document.querySelector('#fw-company')?.value);
  await p.locator('#fw-company').selectOption(company);
  const bank=await p.evaluate(company=>app.state.bankAccounts.find(b=>b.companyId===company).id,company);
  await p.evaluate(async({company,bank})=>{const request=(path,data)=>ABCentral.api('finance/'+path,'POST',data,crypto.randomUUID());await request('chart',{companyId:company,code:'BANK',nameAr:'بنك تجريبي',nameEn:'Fictional bank ledger',kind:'bank',bankAccountId:bank,currency:'AED'});await request('chart',{companyId:company,code:'CONTROL',nameAr:'مقابل تجريبي',nameEn:'Fictional counterpart',kind:'asset',currency:'AED'});},{company,bank});
  await p.locator('[data-fw="reload"]').click();await p.locator('#fw-form').waitFor();
  await p.locator('#fw-form [name="amount"]').fill('0.125');await p.locator('#fw-form [name="effectiveOn"]').fill('2026-02-01');await p.locator('#fw-form [name="reference"]').fill('UI-EXACT');await p.locator('#fw-form [name="reason"]').fill('Test preserves draft until validation passes');
  await p.locator('#fw-form [type=submit]').click();await p.locator('#fw-notice').filter({hasText:/الحفظ|Saved/}).waitFor(); // draft need not have a configured counterpart until approval
  await p.locator('[data-fw="approve"]').click();await p.locator('#fw-approval [type=submit]').click();await p.locator('#fw-notice').filter({hasText:/دليل|ledger accounts/}).waitFor();
  // No false posting after missing chart mapping; source row and opening balance remain intact.
  const b=await p.evaluate(()=>ABCentral.api('finance/workbench'));assert.equal(b.operations.find(o=>o.company_id===company).status,'Draft');assert.equal(b.balances.find(b=>b.companyId===company).bookBalance,'1000.125');
  await p.locator('[data-ws="finance"][data-value="cheques"]').click();await p.locator('#fw-form [name="number"]').waitFor();
  for(const tab of ['custody','reconciliation','expenses','reports','chart','notifications']){await p.locator('[data-ws="finance"][data-value="'+tab+'"]').click();await p.locator('.fw-section').waitFor();}
  await p.locator('[data-ws="finance"][data-value="reports"]').click();await p.locator('#fw-report [name="reportKind"]').selectOption('operations');await p.locator('#fw-report [type=submit]').click();await p.getByText('UI-EXACT',{exact:true}).waitFor();await p.locator('[data-fw="group-report"]').click();await p.getByText(/ملخص بنوك فقط|Bank-only summary/).waitFor();
  await p.screenshot({path:'work/finance-register-desktop.png',fullPage:false});

 }
 for(const width of [1024,768,390]){await p.setViewportSize({width,height:900});for(let n=0;n<2;n++){assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal document overflow at '+width);const dir=await p.locator('body').getAttribute('dir');if(width>720){const box=await p.locator('.sidebar').boundingBox();assert(dir==='rtl'?box.x>width/2:box.x<width/2);}await p.locator('[data-action="toggle-language"]').click();}}
 await p.setViewportSize({width:390,height:900});await p.locator('[data-ws-menu]').click();await p.locator('[data-page="users"]').click();assert(await p.locator('.workspace-toolbar').innerText().then(s=>!s.includes('Cheques')&&!s.includes('الشيكات')));
 await p.emulateMedia({colorScheme:'dark'});await p.evaluate(()=>scrollTo(0,0));assert(await p.locator('.main').evaluate(e=>getComputedStyle(e).backgroundColor==='rgb(33, 28, 26)'));await p.screenshot({path:'work/finance-mobile-dark.png',fullPage:false});await p.emulateMedia({colorScheme:'light'});await p.setViewportSize({width:1440,height:1000});await p.screenshot({path:'work/finance-desktop.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS finance browser: existing company/bank/manager flow, paginated operational reports/group totals, contextual navigation, explicit schema gate, financial draft safety, Arabic/English desktop/tablet/phone, dark/light, no JS errors or sensitive browser writes.');
}catch(e){await p.screenshot({path:'work/finance-browser-failure.png',fullPage:true});console.error(e);process.exitCode=1;}finally{await browser.close();}})();
