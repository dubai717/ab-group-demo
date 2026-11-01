const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const artifacts=path.join(__dirname,'..','work','auth-artifacts');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],authRequests=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(/\/(auth|otp|recovery|password)\//.test(request.url()))authRequests.push(request.url());});
 await page.goto(process.env.ERP_DEMO_URL||'http://127.0.0.1:3000');await page.locator('[data-action="toggle-language"]').click();
 await page.fill('#username','owner');await page.fill('#password','wrong-password');await page.locator('#login-form button[type=submit]').click();const generic=await page.locator('#login-error').textContent();
 await page.fill('#username','nonexistent');await page.locator('#login-form button[type=submit]').click();assert.equal(await page.locator('#login-error').textContent(),generic);
 await page.evaluate(()=>{app.state.users.find(u=>u.username==='gm').status='Disabled';});await page.locator('[data-demo-user="gm"]').click();assert.equal(await page.locator('#login-error').textContent(),generic);await page.evaluate(()=>{app.state.users.find(u=>u.username==='gm').status='Active';});
 await page.fill('#password','Password-Input-Test');await page.locator('#toggle-password').click();assert.equal(await page.inputValue('#password'),'Password-Input-Test');
 await page.locator('[data-auth="forgot"]').click();assert.equal(await page.locator('#password').count(),0);
 for(const channel of ['sms','email','whatsapp']){
  await page.locator(`[name="auth-channel"][value="${channel}"]`).check();await page.fill('#auth-identifier','private-test@example.com');await page.locator('#auth-recovery button[type=submit]').click();assert((await page.locator('#auth-message').textContent()).includes('No code or link was sent'));assert.equal(await page.inputValue('#auth-identifier'),'');
 }
 await page.locator('.auth-preview summary').click();assert(await page.locator('#auth-otp').isDisabled());assert(await page.locator('#auth-reset-new').isDisabled());assert(await page.locator('#auth-reset-confirm').isDisabled());
 // Even an attempted stale/invalid token has no active verification route or enabled submit action.
 assert.equal(await page.locator('.auth-preview button:not([disabled])').count(),0);
 await page.locator('[data-auth="admin"]').click();assert((await page.locator('#auth-message').textContent()).includes('No administrative request was sent'));
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,`recovery-${width}.png`)});}
 await page.locator('[data-action="toggle-language"]').click();assert.equal(await page.locator('body').getAttribute('dir'),'rtl');await page.locator('[data-auth="back"]').click();await page.locator('[data-demo-user="owner"]').click();
 const original=await page.evaluate(()=>JSON.stringify({users:app.state.users,roles:app.state.roles}));
 for(const role of ['owner','gm','employee1']){
  if(role!=='owner'){await page.locator('[data-action="logout"]').click();await page.locator(`[data-demo-user="${role}"]`).click();}
  await page.locator('.account-menu summary').click();await page.locator('[data-auth="settings"]').click();await page.locator('#auth-current').waitFor();
  assert.equal(await page.locator('#auth-change [name="userId"]').count(),0);
  for(const [newPassword,confirmation,expected] of [['Short@1','Short@1','لا تستوفي'],['Strong-New@2026','Different@2026','غير متطابقين'],['Strong-New@2026','Strong-New@2026','لم يُتحقق']]){
   await page.fill('#auth-current','Deliberately-Wrong@2026');await page.fill('#auth-new',newPassword);await page.fill('#auth-confirm',confirmation);await page.locator('#auth-change button[type=submit]').click();assert((await page.locator('#auth-message').textContent()).includes(expected));assert.equal(await page.inputValue('#auth-current'),'');assert.equal(await page.inputValue('#auth-new'),'');
  }
  assert.equal(await page.evaluate(()=>JSON.stringify({users:app.state.users,roles:app.state.roles})),original);
  const persisted=await page.evaluate(()=>JSON.stringify({...localStorage}));for(const value of ['private-test@example.com','Strong-New@2026','Deliberately-Wrong@2026','Different@2026'])assert(!persisted.includes(value));
  if(role==='owner'){await page.screenshot({path:path.join(artifacts,'settings-mobile-ar.png')});await page.locator('[data-action="toggle-language"]').click();assert.equal(await page.locator('html').getAttribute('lang'),'en');assert((await page.locator('#auth-message').textContent()).includes('Only the format checks passed'));await page.locator('[data-action="toggle-language"]').click();}
  await page.locator('[data-page="dashboard"]').click();assert.equal(await page.locator('#auth-change').count(),0);await page.locator('.stats-grid').waitFor();
 }
 await page.locator('[data-action="logout"]').click();await page.locator('[data-demo-user="owner"]').click();await page.locator('[data-page="users"]').click();await page.locator('#user-form').waitFor();await page.locator('[data-page="companies"]').click();await page.locator('#company-form').waitFor();
 assert.equal(authRequests.length,0);assert.deepEqual(errors,[]);console.log('PASS: generic login failures, unchanged demo login, recovery channels blocked honestly, disabled verification/reset, administrator guidance, own-account settings for owner/GM/employee, format validation, unchanged users/roles, no new secret storage/network sends, RTL/LTR and desktop/tablet/mobile, zero JavaScript errors');await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
