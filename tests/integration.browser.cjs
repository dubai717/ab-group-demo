const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const artifacts=path.join(__dirname,'..','work','integration-artifacts');fs.mkdirSync(artifacts,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
 await page.goto(process.env.ERP_DEMO_URL||'http://127.0.0.1:3020');
 await page.locator('[data-action="toggle-language"]').click();
 assert(await page.locator('.brand-mark img').evaluate(e=>e.complete&&e.naturalWidth>0));
 await page.locator('[data-demo-user="owner"]').click();
 const original=await page.evaluate(()=>JSON.stringify({users:app.state.users,roles:app.state.roles}));
 const originalCompany=await page.evaluate(()=>JSON.stringify(app.state.companies[0]));
 for(const name of ['AuthFlows','UserManagement','AreaReference','CompanyDocuments','BankAccounts','DemoCredentials'])assert(await page.evaluate(n=>!!window[n],name));
 // New company is immediately available to assignments and banking, using the same directory.
 await page.locator('[data-page="companies"]').click();
 for(const [key,value] of Object.entries({arabicName:'شركة تكامل وهمية',englishName:'Integration Company',companyCode:'INTEGRATION',tradeLicenseNumber:'INT-123',trafficCode:'000987',salikAccountNumber:'000654'}))await page.locator(`#company-form [name="${key}"]`).fill(value);
 await page.locator('#company-form button[type=submit]').click();
 await page.getByText('Integration Company',{exact:true}).waitFor();
 const companyId=await page.evaluate(()=>app.state.companies.find(c=>c.companyCode==='INTEGRATION').id);
 await page.locator('[data-page="bankAccounts"]').click();await page.locator('[data-bk="new"]').click();
 await page.locator('#bk-companyId').selectOption(companyId);
 const bank={accountName:'Integrated bank account',accountNumber:'000909',iban:'AE070331234567890123456',openedAt:'2026-01-01',relationshipManagerName:'Original manager',relationshipManagerPhone:'+971501234567',relationshipManagerEmail:'bank@example.test'};
 for(const [key,value] of Object.entries(bank))await page.locator(`#bk-account-form [name="${key}"]`).fill(value);
 await page.locator('#bk-account-form button[type=submit]').click();await page.locator('#bk-notice').filter({hasText:'Account saved'}).waitFor();
 const accountId=await page.evaluate(()=>app.state.bankAccounts[0].id);
 // A failed password check or storage write keeps the entire new-user draft and adds no partial profile.
 await page.locator('[data-page="users"]').click();await page.locator('[data-um="new"]').click();
 const values={nameAr:'مستخدم تكامل',nameEn:'Integration User',username:'integration_login',email:'integration@example.test',phone:'+971500000999',emiratesId:'784-2000-1234567-1',nationality:'PRIVATE-NATIONALITY',jobTitle:'Demo operator',hireDate:'2026-01-01'};
 for(const [key,value] of Object.entries(values))await page.locator('#um-'+key).fill(value);
 await page.locator('#um-companyIds').selectOption(companyId);await page.locator('#um-managerId').selectOption('u-owner');await page.locator('#um-status').selectOption('Active');
 assert(await page.locator('#um-demoPassword').isDisabled());await page.locator('#um-local-login').check();
 const password='Integration-Demo@2026';await page.locator('#um-demoPassword').fill(password);await page.locator('#um-demoConfirm').fill('Mismatch-Demo@2026');
 await page.locator('#um-profile button[type=submit]').click();await page.locator('#um-notice').filter({hasText:'do not match'}).waitFor();assert.equal(await page.locator('#um-username').inputValue(),values.username);
 await page.locator('#um-demoConfirm').fill(password);
 await page.locator('#um-file-photo').setInputFiles(path.join(__dirname,'..','assets','Untitled.png'));
 await page.evaluate(()=>{window.originalCredentialSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===DemoCredentials.KEY)throw new DOMException('test quota','QuotaExceededError');return window.originalCredentialSet.call(this,k,v);};});
 await page.locator('#um-profile button[type=submit]').click();await page.locator('#um-notice').filter({hasText:'failed'}).waitFor();
 assert.equal(await page.locator('#um-nameEn').inputValue(),values.nameEn);assert.equal(await page.evaluate(()=>UserManagement.visibleUsers().some(u=>u.username==='integration_login')),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem(DemoCredentials.KEY)),null);
 await page.evaluate(()=>{Storage.prototype.setItem=window.originalCredentialSet;delete window.originalCredentialSet;});
 await page.locator('#um-profile button[type=submit]').click();await page.locator('#um-notice').filter({hasText:'directory saved locally'}).waitFor();
 const userId=await page.evaluate(()=>UserManagement.visibleUsers().find(u=>u.username==='integration_login').id);
 await page.locator('[data-um="file"][data-slot="photo"]').click();await page.locator('#um-preview[open]').waitFor();await page.locator('[data-um="close-preview"]').click();
 const store=await page.evaluate(()=>localStorage.getItem(DemoCredentials.KEY));assert.equal(JSON.parse(store).accounts[0].verifier.algorithm,'PBKDF2-SHA256');
 const stored=await page.evaluate(()=>JSON.stringify({...localStorage}));for(const token of [password,'784-2000-1234567-1','PRIVATE-NATIONALITY','application/pdf'])assert(!stored.includes(token));
 assert.equal(await page.evaluate(()=>JSON.stringify({users:app.state.users,roles:app.state.roles})),original);
 // Grant bank rights from the real integrated users screen; do not inject user permissions in tests.
 for(const action of ['view','create','edit','view_documents','manage_documents']){
  await page.locator('#um-action').selectOption('bank_'+action);assert(await page.locator('#um-scope option[value="department"]').isDisabled());await page.locator('#um-scope').selectOption('company');await page.locator('#um-scope-id').selectOption(companyId);await page.locator('#um-grant button[type=submit]').click();await page.locator('#um-notice').filter({hasText:'Permission granted'}).waitFor();
 }
 await page.locator('[data-action="logout"]').click();await page.locator('#username').fill(values.username);await page.locator('#password').fill('Wrong-Demo@2026');await page.locator('#login-form button[type=submit]').click();await page.locator('#login-error.visible').waitFor();const generic=await page.locator('#login-error').textContent();
 await page.locator('#password').fill(password);await page.locator('#login-form button[type=submit]').click();await page.locator('.stats-grid').waitFor();
 assert.deepEqual(await page.evaluate(()=>app.state.currentUser),{id:userId});assert.equal(await page.locator('.stat-value').first().textContent(),String(JSON.parse(original).users.length+1));
 await page.locator('[data-page="bankAccounts"]').click();await page.locator(`[data-bk="open"][data-id="${accountId}"]`).click();
 assert.equal(await page.locator('#bk-companyId option').count(),1);assert.equal(await page.locator('#bk-status option[value="Closed"]').count(),0);
 await page.locator('#bk-relationshipManagerName').fill('Delegated manager edit');await page.locator('#bk-account-form button[type=submit]').click();await page.locator('#bk-notice').filter({hasText:'saved locally'}).waitFor();
 const pdf={name:'integration-contract.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.1\nDemo\n%%EOF')};
 async function addDoc(title,category,parent='',relation='related'){
  await page.locator('#bk-doc-files').setInputFiles({...pdf,name:title+'.pdf'});await page.locator('[name="title-0"]').fill(title);await page.locator('[name="date-0"]').fill('2026-01-01');await page.locator('[name="category-0"]').selectOption(category);if(parent)await page.locator('[name="parentId-0"]').selectOption(parent);await page.locator('[name="relation-0"]').selectOption(relation);await page.locator('#bk-doc-form button[type=submit]').click();
 }
 await addDoc('Integration original','original');const docId=await page.locator('[data-bk="download"]').first().getAttribute('data-doc');await addDoc('Integration annex','annex',docId);await addDoc('Integration version two','original',docId,'version');assert.equal(await page.locator('.bk-documents tbody tr').count(),3);
 // Account settings and navigation preserve the modules and session documents.
 await page.locator('.account-menu summary').click();await page.locator('[data-auth="settings"]').click();await page.locator('#auth-current').fill(password);await page.locator('#auth-new').fill('Change-Blocked@2026');await page.locator('#auth-confirm').fill('Change-Blocked@2026');await page.locator('#auth-change button[type=submit]').click();assert((await page.locator('#auth-message').textContent()).includes('was not verified'));
 await page.locator('[data-page="bankAccounts"]').click();assert.equal(await page.locator('.bk-documents tbody tr').count(),3);
 // Injecting a company option cannot bypass the service's actual company-scoped authorization.
 await page.locator('[data-bk="new"]').click();await page.locator('#bk-companyId').evaluate(select=>{select.add(new Option('Not authorized','company-ab'));select.value='company-ab';});
 for(const [key,value] of Object.entries({...bank,accountName:'Unauthorized draft',accountNumber:'000910',iban:'GB82WEST12345698765432'}))await page.locator(`#bk-account-form [name="${key}"]`).fill(value);
 await page.locator('#bk-account-form button[type=submit]').click();assert((await page.locator('#bk-editor-message').textContent()).includes('not authorized'));assert.equal(await page.locator('#bk-accountName').inputValue(),'Unauthorized draft');assert.equal(await page.evaluate(()=>app.state.bankAccounts.length),1);
 await page.locator('[data-action="logout"]').click();await page.locator('[data-demo-user="owner"]').click();await page.locator('[data-page="users"]').click();await page.locator(`[data-um="profile"][data-id="${userId}"]`).click();
 await page.locator('#um-status').selectOption('Disabled');await page.locator('#um-profile button[type=submit]').click();await page.locator('#um-notice').filter({hasText:'directory saved locally'}).waitFor();
 await page.reload();await page.locator('[data-action="logout"]').click();await page.locator('#username').fill(values.username);await page.locator('#password').fill(password);await page.locator('#login-form button[type=submit]').click();await page.locator('#login-error.visible').waitFor();assert.equal(await page.locator('#login-error').textContent(),generic);
 await page.locator('[data-demo-user="owner"]').click();await page.locator('[data-page="users"]').click();await page.locator(`[data-um="profile"][data-id="${userId}"]`).click();assert.equal(await page.locator('#um-emiratesId').inputValue(),'');assert.equal(await page.locator('[data-um="file"]').count(),0);
 await page.locator('#um-status').selectOption('Active');await page.locator('#um-username').fill('integration_renamed');await page.locator('#um-profile button[type=submit]').click();await page.locator('#um-notice').filter({hasText:'directory saved locally'}).waitFor();await page.reload();
 await page.locator('[data-action="logout"]').click();await page.locator('#username').fill('integration_renamed');await page.locator('#password').fill(password);await page.locator('#login-form button[type=submit]').click();await page.locator('.stats-grid').waitFor();assert.equal(await page.locator('[data-page="bankAccounts"]').count(),0); // grants expire on reload, not silently persisted
 assert.equal(await page.evaluate(()=>JSON.stringify({users:app.state.users,roles:app.state.roles})),original);assert.equal(await page.evaluate(()=>JSON.stringify(app.state.companies[0])),originalCompany);
 await page.locator('[data-page="users"]').click();await page.locator(`[data-um="profile"][data-id="${userId}"]`).click();assert.equal(await page.locator('#um-grant').count(),0);assert.equal(await page.locator('#um-profile button[type=submit]').count(),0);
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,'integrated-en-'+width+'.png')});}
 await page.locator('[data-action="toggle-language"]').click();assert.equal(await page.locator('body').getAttribute('dir'),'rtl');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(artifacts,'integrated-ar-mobile.png')});
 const finalStorage=await page.evaluate(()=>JSON.stringify({...localStorage}));for(const token of [password,'Change-Blocked@2026','784-2000-1234567-1','PRIVATE-NATIONALITY','Integration original.pdf','Integration annex.pdf'])assert(!finalStorage.includes(token));
 assert.deepEqual(errors,[]);
 console.log('PASS integration: linked company/bank/manager, local hashed sign-in create/failure/reload/rename/disable/reactivate, unchanged legacy users/roles, no new plaintext passwords or identity/files, scoped bank grants through users UI, document parent/version preservation, forged company denied, honest backend-gated password change, expired session grants, Arabic/English desktop/tablet/mobile, zero JS errors');
 }catch(e){await page.screenshot({path:path.join(artifacts,'failure.png'),fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
