const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
 const fixture=JSON.parse(fs.readFileSync('work/organization-security-browser-fixture.json'));
 const browser=await chromium.launch({
  executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox'],
 });
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1050}});
  await page.goto(fixture.origin);
  await page.fill('#username',fixture.username);
  await page.fill('#password',fixture.password);
  await page.locator('#login-form [type=submit]').click();
  await page.locator('#central-dashboard').waitFor();
  await page.evaluate(id=>PermissionUI.open(id),fixture.user.id);
  await page.locator('[data-user-work-scope-review]').click();
  const dialog=page.locator('[data-work-scope-review]');
  await dialog.locator('[name=kind]').selectOption('centres');
  await dialog.locator('[name=ids][value="'+fixture.operatingCentreId+'"]').check();
  await dialog.locator('[type=submit]').click();
  const button=dialog.locator('[data-scope-membership-apply]');
  await button.waitFor();
  page.once('dialog',confirm=>confirm.dismiss());
  await button.click();
  assert.equal(await dialog.count(),1);
  const calls=[];
  await page.route('**/work-scope/apply-memberships',async route=>{
   calls.push({key:route.request().headers()['idempotency-key'],payload:route.request().postDataJSON()});
   const response=await route.fetch();
   if(calls.length===1){
    assert.equal(response.status(),200);
    await route.fulfill({status:503,json:{error:'syntheticLostResponse'}});
   }else await route.fulfill({response});
  });
  page.once('dialog',confirm=>confirm.accept());
  await button.click();
  await dialog.locator('[data-scope-review-status]').filter({hasText:/تعذر تأكيد الحفظ|save could not be confirmed/}).waitFor();
  await button.click();
  await dialog.waitFor({state:'detached'});
  assert.equal(calls.length,2);
  assert.deepEqual(calls[0],calls[1]);
  const summary=await page.evaluate(id=>ABCentral.api('users/'+id+'/permission-summary'),fixture.user.id);
  assert.deepEqual([...summary.user.companyIds].sort(),[fixture.companyId,fixture.otherCompany].sort());
  console.log('PASS reviewed centre memberships save from the original dialog and retry the exact receipt.');
 } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
