const {chromium}=require('playwright'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const f=JSON.parse(fs.readFileSync('work/financial-package-fixture.json')),
 b=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),
 owner=await b.newPage({viewport:{width:1440,height:1000}}),reviewer=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
 for(const p of [owner,reviewer]){p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());p.setDefaultTimeout(20000);}
 const login=async(p,u,w)=>{await p.goto('http://127.0.0.1:3646');await p.fill('#username',u);await p.fill('#password',w);await p.locator('#login-form [type=submit]').click();await p.locator('.stats-grid').waitFor();};
 try{
  await login(owner,f.username,f.password);
  const setup=await owner.evaluate(async f=>{
   const post=(p,d)=>ABCentral.api(p,'POST',d,crypto.randomUUID()),username='petty_reviewer_'+crypto.randomUUID().slice(0,8),password='Synthetic-Petty@2026';
   const u=await post('users',{nameAr:'مراجع نثريات وهمي',nameEn:'Synthetic petty reviewer',username,email:username+'@example.test',phone:'',status:'Active',jobTitle:'Synthetic reviewer',hireDate:'2026-01-01',managerId:ABCentral.actor.id,companyIds:[f.companyId],departmentIds:[],password,baseRole:'general_manager'});
   const employee=await post('personnel/employees',{companyId:f.companyId,userId:u.id,nameAr:'مراجع نثريات وهمي',nameEn:'Synthetic petty reviewer',jobTitle:'Synthetic reviewer',hiredOn:'2024-01-01'});
   for(const action of ['ledger_view','ledger_fund_manage','ledger_journal_approve'])await post('users/'+u.id+'/grants',{action,scope:{type:'company',id:f.companyId},delegable:false});
   const account=await post('ledger/accounts',{nameAr:'عهدة مراجعة متصفح وهمية',nameEn:'Synthetic petty browser reviewed fund',kind:'asset',companyIds:[f.companyId],currency:'AED'}),book=await ABCentral.api('ledger/workbench?companyId='+f.companyId),equity=book.finance_chart.find(a=>a.kind==='equity'&&a.active).id;
   const fund=await post('ledger/funds',{companyId:f.companyId,name:'Synthetic independent petty browser',kind:'petty',holderId:ABCentral.actor.id,chartId:account.charts[0].id,currency:'AED',openingBalance:'50',openingEquityId:equity,effectiveOn:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date())});
   return{username,password,employeeId:employee.id,fundId:fund.id};
  },f);
  await owner.locator('[data-page=financialManagement]').click();await owner.locator('#ld-company').selectOption(f.companyId);await owner.locator('[data-ld=tab][data-id=funds]').click();
  await owner.locator('[data-ld=fund-review-config][data-id="'+setup.fundId+'"]').click();
  let dialog=owner.locator('dialog[open]').last();await dialog.locator('[name=reviewerEmployeeId]').selectOption(setup.employeeId);await dialog.locator('[name=reason]').fill('Explicit prospective isolated browser review');await dialog.locator('[name=confirm]').check();
  const configured=owner.waitForResponse(r=>r.url().endsWith('/expense-review-configuration')&&r.request().method()==='POST');await dialog.locator('[type=submit]').click();assert.equal((await configured).status(),200);await dialog.waitFor({state:'detached'});
  await owner.locator('[data-ld=fund-spend][data-id="'+setup.fundId+'"]').click();let form=owner.locator('[data-ld-form=fund-spend]');await form.locator('[data-request-review]').waitFor();
  await form.locator('[name=itemId]').selectOption(f.expenseItemId);await form.locator('[name=amount]').fill('11.000');await form.locator('[name=reason]').fill('Synthetic document difference requires independent review');await form.locator('[name=documentVersionId]').selectOption(f.pettyProofId);
  const submitted=owner.waitForResponse(r=>r.url().endsWith('/expense-reviews')&&r.request().method()==='POST');await form.locator('[data-request-review]').click();const response=await submitted;assert.equal(response.status(),200,await response.text());const request=await response.json();await form.waitFor({state:'detached'});
  await login(reviewer,setup.username,setup.password);await reviewer.locator('[data-page=tasks]').click();await reviewer.locator('tr').filter({has:reviewer.locator('[data-work-open="'+request.taskId+'"]')}).click();
  dialog=reviewer.locator('dialog[open]').last();assert.match(await dialog.innerText(),/11.000/);assert.match(await dialog.innerText(),/12.500/);await dialog.locator('[data-proof]').click();await reviewer.locator('.attachment-preview canvas').waitFor();await reviewer.locator('[data-preview=close]').click();
  await dialog.locator('[data-decision]').click();const edit=reviewer.locator('dialog[open]').filter({has:reviewer.locator('[name=discrepancyReviewed]')});await edit.locator('[name=reason]').fill('Reviewed exact price difference; no input tax inferred');await edit.locator('[name=discrepancyReviewed]').check();await edit.locator('[name=taxTreatmentNotInferred]').check();
  const decided=reviewer.waitForResponse(r=>r.url().includes('/petty-expense-reviews/'+request.id+'/decision')&&r.request().method()==='POST');await edit.locator('[type=submit]').click();const decision=await decided;assert.equal(decision.status(),200,await decision.text());await edit.waitFor({state:'detached'});assert.equal((await decision.json()).financialEffect,false);
  await owner.locator('[data-ld=fund-spend][data-id="'+setup.fundId+'"]').click();form=owner.locator('[data-ld-form=fund-spend]');await form.locator('[name=reviewId]').selectOption(request.id);await form.locator('[name=amount]').fill('11.001');
  let saved=owner.waitForResponse(r=>r.url().endsWith('/funds/'+setup.fundId+'/spend')&&r.request().method()==='POST');await form.locator('[type=submit]').click();let result=await saved;assert.equal(result.status(),409);assert.equal(await form.locator('[name=amount]').inputValue(),'11.001');
  await form.locator('[name=reviewId]').selectOption(request.id);saved=owner.waitForResponse(r=>r.url().endsWith('/funds/'+setup.fundId+'/spend')&&r.request().method()==='POST');await form.locator('[type=submit]').click();result=await saved;assert.equal(result.status(),200,await result.text());assert.equal((await result.json()).balance,'39.000');await form.waitFor({state:'detached'});
  const source=await owner.evaluate(id=>ABCentral.api('ledger/petty-expense-reviews/'+id),request.id);assert.equal(source.state,'Posted');
  await reviewer.locator('dialog[open] [data-close]').last().click();
  for(const locale of ['ar','en']){await reviewer.evaluate(l=>setLocale(l),locale);for(const width of [1440,768,390]){await reviewer.setViewportSize({width,height:1000});await reviewer.evaluate(id=>PettyExpenseUI.open(id),request.id);dialog=reviewer.locator('dialog[open]').last();assert.match(await dialog.innerText(),/11.000/);assert.equal(await dialog.locator('[data-decision]').isVisible(),false);await dialog.locator('[data-close]').click();assert(await reviewer.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));}}
  assert.deepEqual(errors,[]);console.log('PASS independent petty review task, scanned evidence preview, no payment on decision, retained mismatch inputs, one matching native voucher and AR/EN responsive source history');
 }catch(err){console.error(err.stack);console.error({errors,ownerAlerts:await owner.locator('[role=alert],#ld-notice').allTextContents(),reviewerAlerts:await reviewer.locator('[role=alert]').allTextContents()});await owner.screenshot({path:'work/petty-expense-approval-failure.png'}).catch(()=>{});process.exitCode=1;}
 finally{await b.close();}
})();
