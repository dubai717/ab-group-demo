const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const fixture=JSON.parse(fs.readFileSync('work/customer-workspace-fixture.json'));
const output=process.env.AB_REGISTER_SCREENSHOTS;
const drilldownOnly=process.env.AB_DRILLDOWN_ONLY==='1';
const url='http://127.0.0.1:3635';
async function login(p,username,password){
 await p.goto(url);await p.fill('#username',username);await p.fill('#password',password);
 await p.locator('#login-form [type=submit]').click();await p.locator('[data-page=customers]').waitFor({state:'attached'});
}
async function go(p,id){
 const button=p.locator('[data-page="'+id+'"]');
 await button.waitFor({state:"attached"});
 const menu=p.locator('[data-ws-menu]');
 if(await p.evaluate(()=>matchMedia('(max-width:720px)').matches)&&await menu.getAttribute('aria-expanded')==='false')await menu.click();
 await button.click();
}
const headings=p=>p.locator('[data-cu-heading]').evaluateAll(rows=>rows.map(x=>x.dataset.cuHeading));
async function press(p,key,target){
 const heading=p.locator('[data-cu-heading="'+key+'"] summary');
 await heading.scrollIntoViewIfNeeded();
 const box=await heading.boundingBox();
 await p.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await p.mouse.down();await p.locator('[data-cu-heading-tools]').waitFor();
 if(target){
  const targetBox=await p.locator('[data-cu-heading="'+target+'"] summary').boundingBox();
  await p.mouse.move(targetBox.x+targetBox.width/2,targetBox.y+targetBox.height/2,{steps:8});
 }
 await p.mouse.up();
}
async function pinned(p,locale){
 const wrap=p.locator('[data-cu-register]');
 await wrap.evaluate((el,rtl)=>{el.scrollLeft=rtl?-el.scrollWidth:el.scrollWidth;},locale==='ar');
 const result=await wrap.evaluate((el,rtl)=>{
  const context=el.getBoundingClientRect(),head=el.querySelector('[data-cu-heading=fileNumber]'),cell=el.querySelector('[data-cu-file-number]');
  const edge=rtl?'right':'left',label=head.querySelector('summary span'),number=cell.querySelector('bdi');
  return {scrolled:Math.abs(el.scrollLeft)>100,offset:Math.abs(head.getBoundingClientRect()[edge]-context[edge]),label:label.scrollWidth<=label.clientWidth+1,number:number.getBoundingClientRect().width<cell.clientWidth&&/^\d+$/.test(number.textContent)};
 },locale==='ar');
 assert(result.scrolled&&result.offset<4&&result.label&&result.number,JSON.stringify(result));
 await wrap.evaluate(el=>{el.scrollLeft=0;});
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try{
  const p=await browser.newPage({viewport:{width:1440,height:1080}});p.setDefaultTimeout(15000);
  const errors=[];p.on('pageerror',error=>errors.push(error.message));
  await login(p,fixture.username,fixture.password);await go(p,'customers');
  const summaries=p.locator('.customer-register-summaries');
  await summaries.locator('table').first().waitFor();
  const models=await p.evaluate(()=>ABCentral.api('customers/register-summary')),empty=models.companies.find(x=>x.nameEn==='Empty synthetic company');
  assert(empty);assert.equal(models.customers.cells.Prospect[empty.id],0);
  assert.equal(models.customers.totals.Prospect,1);assert.equal(models.customers.totals.Pending,1);
  assert.equal(models.residences.cells.customers[fixture.companyId],1);
  assert.equal(await p.locator('.vehicle-register-summary').count(),0);
  if(!drilldownOnly){
  await p.evaluate(()=>setLocale('ar'));
  await press(p,'nationality');
  await p.locator('[data-cu-add]').click();
  await p.locator('[data-cu-add-choice]').selectOption('phone');
  await p.locator('[data-cu-heading=phone]').waitFor();
  await press(p,'nationality');
  await p.locator('[data-cu-hide]').click();
  await p.locator('[data-cu-heading=nationality]').waitFor({state:'detached'});
  await press(p,'phone','type');
  await p.waitForFunction(()=>[...document.querySelectorAll('[data-cu-heading]')].map(el=>el.dataset.cuHeading).slice(0,4).join(',')==='fileNumber,fullName,type,phone');
  await p.reload();await go(p,'customers');await p.locator('[data-cu-heading=phone]').waitFor();
  assert.deepEqual((await headings(p)).slice(0,4),['fileNumber','fullName','type','phone']);
  await p.locator('[data-cu-column-tools] summary').click();
  assert(await p.locator('[data-cu-column=fileNumber]').isDisabled());
  assert.equal(await p.locator('[data-cu^=column-][data-id=fileNumber]').count(),0);
  await p.locator('[data-cu-column-tools] summary').click();
  await p.locator('[data-cu-heading=fileNumber] summary').click();
  await p.locator('[data-rg-sort=fileNumber][data-direction=desc]').click();
  await p.locator('[data-cu-heading=fileNumber] [data-rg-order=descending]').waitFor();
  const sorted=await p.locator('[data-cu-file-number]').allTextContents();
  assert.deepEqual(sorted,[...sorted].sort((a,b)=>Number(b)-Number(a)));
  await p.locator('[data-cu-heading=fullName] summary').click();
  const filter=p.locator('[data-rg-panel=fullName]');
  await filter.locator('[data-rg-op]').selectOption('contains');
  await filter.locator('[data-rg-bound]').fill('Synthetic permit holder');
  await filter.locator('[data-rg-apply]').click();
  await p.locator('[data-cu-file-number]').nth(1).waitFor({state:'detached'});
  assert.equal(await p.locator('[data-cu-file-number]').count(),1);
  await p.locator('[data-rg-clear-all]').click();
  await p.locator('[data-cu-file-number]').nth(1).waitFor();
  for(const locale of ['ar','en']){
   await p.evaluate(locale=>setLocale(locale),locale);
   for(const width of [1440,390]){
    await p.setViewportSize({width,height:width===390?900:1080});
    await pinned(p,locale);
    const followup=p.locator('.residency-followup');
    await followup.getByText(locale==='ar'?'العملاء بانتظار متابعة الإقامة':'Customers awaiting residence follow-up',{exact:false}).waitFor();
    assert.equal(await followup.locator('[data-residency-followup]').innerText(),new Intl.NumberFormat(locale).format(0));
    if(output)await p.screenshot({path:output+'/customers-'+locale+'-'+width+'.png',fullPage:true});
    await go(p,'vehicles');
    await p.locator('.vehicle-register-summary .customer-matrix').waitFor();
    assert.equal(await p.locator('.vehicle-register-summary thead th').count(),6);
    if(output)await p.screenshot({path:output+'/vehicles-'+locale+'-'+width+'.png',fullPage:true});
    await go(p,'customers');
    await summaries.locator('.customer-matrix').first().waitFor();
   }
  }
  const service=await p.evaluate(({customerId,companyId})=>ABCentral.api('customers/'+customerId+'/requests','POST',{
   clientKey:crypto.randomUUID(),type:'residence',transactionType:'new',companyId,subject:'Synthetic residence follow-up'
  },crypto.randomUUID()),fixture);
  await go(p,'customers');
  await p.waitForFunction(()=>document.querySelector('[data-residency-followup]')?.textContent===new Intl.NumberFormat(getLocale()).format(1));
  for(const locale of ['ar','en']){
   await p.evaluate(locale=>setLocale(locale),locale);
   const followup=p.locator('.residency-followup');
   assert.match(await followup.innerText(),locale==='ar'?/العملاء بانتظار متابعة الإقامة/:/Customers awaiting residence follow-up/);
   assert.equal(await followup.locator('[data-residency-followup]').innerText(),new Intl.NumberFormat(locale).format(1));
  }
  await p.evaluate(({customerId,id})=>ABCentral.api('customers/'+customerId+'/requests/'+id+'/status','POST',{
   state:'Cancelled',revision:0,comment:'Synthetic cancellation'
  },crypto.randomUUID()),{customerId:fixture.customerId,id:service.id});
  await go(p,'customers');
  await p.waitForFunction(()=>document.querySelector('[data-residency-followup]')?.textContent==='0');
  const phone=await browser.newPage({viewport:{width:390,height:900},isMobile:true,hasTouch:true});
  await login(phone,fixture.viewerUsername,fixture.viewerPassword);await go(phone,'customers');
  const scoped=await phone.evaluate(()=>ABCentral.api('customers/register-summary'));
  assert.deepEqual(scoped.companies.map(x=>x.id),[fixture.companyId]);
  const title=phone.locator('[data-cu-heading=fullName] summary');
  await title.scrollIntoViewIfNeeded();const b=await title.boundingBox();
  const cdp=await phone.context().newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});
  await phone.locator('[data-cu-add]').waitFor();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await phone.close();
  }
  const customerMatrix=p.locator('.customer-register-summaries section').first(),vehicleMatrix=p.locator('.vehicle-register-summary');
  async function selectCell(table,status,dimension,expected,locale){
   const button=table.locator(`[data-summary-status="${status}"][data-summary-dimension="${dimension}"]`);
   await button.waitFor();
   assert.equal(await button.innerText(),new Intl.NumberFormat(locale).format(expected));
   const register=table===customerMatrix?'customers':'vehicles';
   const response=p.waitForResponse(r=>{
    const url=new URL(r.url()),query=JSON.parse(url.searchParams.get('query')||'{}');
    return url.pathname==='/api/registers/'+register&&query.summaryView==='1'&&
     (query.summaryStatus||'')===status&&(query.summaryCompany||query.summaryFinance||'')===dimension&&url.searchParams.get('offset')==='0';
   });
   await button.click();const result=await response;const body=await result.json();assert.equal(result.status(),200,JSON.stringify(body));assert.equal(body.total,expected);
   await p.locator('.summary-filter').waitFor();
   if(!expected)await p.getByText(locale==='ar'?'لا توجد نتائج':'No results',{exact:true}).waitFor();
   return p.locator('.summary-filter');
  }
  if(drilldownOnly){
  for(const [locale,width] of [['ar',1440],['en',390]]){
   await p.setViewportSize({width,height:950});
   await p.evaluate(locale=>setLocale(locale),locale);
   await go(p,'customers');
   const s=await p.evaluate(()=>ABCentral.api('customers/register-summary'));
   const labels=s.companies.find(co=>co.id===fixture.companyId);
   await selectCell(customerMatrix,'Active',fixture.companyId,s.customers.cells.Active[fixture.companyId],locale);
   assert.match(await p.locator('.summary-filter').innerText(),locale==='ar'?/بولحية للنقل/:/Boulahia Transport/);
   assert.deepEqual((await headings(p)).slice(0,4),['fileNumber','fullName','nationality','type']);
   await pinned(p,locale);
   if(output&&locale==='ar'){
    await p.locator('.summary-filter').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await p.screenshot({path:output+'/customers-filter-applied.png'});
   }
   const pages=await p.evaluate(async companyId=>{
    const query=JSON.stringify({summaryView:'1',summaryStatus:'Active',summaryCompany:companyId});
    const page=offset=>ABCentral.api('registers/customers?'+new URLSearchParams({query,offset:String(offset),limit:'1'}));
    return [await page(0),await page(1)];
   },fixture.companyId);
   assert.equal(pages[0].rows.length,1);assert(pages[1].rows.length>0);
   assert.equal(new Set([...pages[0].rows,...pages[1].rows].map(row=>row.id)).size,pages[0].total);
   await selectCell(customerMatrix,'Ended',fixture.otherCompany,1,locale);
   await selectCell(customerMatrix,'Ended',labels.id,1,locale);
   await selectCell(customerMatrix,'Ended','',1,locale);
   await selectCell(customerMatrix,'',labels.id,Object.values(s.customers.cells).reduce((total,row)=>total+row[labels.id],0),locale);
   await selectCell(customerMatrix,'','',s.customers.total,locale);
   await selectCell(customerMatrix,'Active',empty.id,0,locale);
   await p.locator('[data-summary-clear]').click();
   await p.locator('.summary-filter').waitFor({state:'detached'});
   await go(p,'vehicles');
   const v=await p.evaluate(()=>ABCentral.api('vehicles/register-summary'));
   await selectCell(vehicleMatrix,'Active','group',1,locale);
   if(output&&locale==='ar'){
    await p.locator('.summary-filter').evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
    await p.screenshot({path:output+'/vehicles-filter-applied.png'});
   }
   await selectCell(vehicleMatrix,'','group',1,locale);
   await selectCell(vehicleMatrix,'Active','',Object.values(v.cells.Active).reduce((total,n)=>total+n,0),locale);
   await selectCell(vehicleMatrix,'','',v.total,locale);
   await selectCell(vehicleMatrix,'Ended','bank',0,locale);
   await p.locator('[data-summary-clear]').click();
   await p.locator('.summary-filter').waitFor({state:'detached'});
  }
  }
  assert.deepEqual(errors,[]);
  console.log(drilldownOnly?'PASS summary cells, totals, zero, pagination and applied filters in AR/EN':'PASS scoped summaries, residence follow-up, sticky file numbers, saved drag order and mobile long press in AR/EN');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
