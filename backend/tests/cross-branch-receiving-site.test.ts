import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { businessCentersFixture } from './business-centers-fixture.js';
import { security, transaction } from '../src/core.js';
import { build } from '../src/app.js';
import { today } from '../src/vehicle-domain.js';
import { model } from '../src/data.js';
import { readCrossBranchCollectionSource, readCrossBranchReceivingSite } from '../src/cross-branch-collection-source.js';

async function collectThroughBrowser(
  origin:string,companyId:string,invoiceId:string,
  worker:{username:string;password:string},owner:{username:string;password:string},
){
  const {chromium}=await import('playwright');
  const browser=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE,args:['--no-sandbox']});
  try{
    const open=async(credentials:typeof worker,locale:string,width:number)=>{
      const page=await browser.newPage({viewport:{width,height:960}});
      await page.goto(origin);
      await page.locator('#username').fill(credentials.username);
      await page.locator('#password').fill(credentials.password);
      await page.locator('#login-form [type=submit]').click();
      await page.locator('.account-menu summary').waitFor();
      await page.evaluate((language)=>{(window as any).setLocale(language);},locale);
      // The initial dashboard load replaces the account menu when it finishes.
      const dashboard = page.locator('#central-dashboard');
      await dashboard.waitFor();
      await dashboard.locator(':scope > p[role=status]:not([data-dashboard-base-only])').waitFor({state:'hidden'});
      await page.locator('.account-menu summary').click();
      await page.locator('[data-cross-branch-collection]').click();
      return page;
    };
    const reporter=await open(worker,'ar',390),lookup=reporter.locator('[data-lookup]');
    await lookup.locator('[name=companyId]').fill(companyId);
    await lookup.locator('[name=invoiceId]').fill(invoiceId);
    await lookup.locator('button').click();
    const report=reporter.locator('[data-report]');
    await report.locator('[name=amount]').fill('12.500');
    await report.locator('[name=actual]').check();
    await report.locator('button').click();
    await reporter.waitForFunction(()=>Boolean(document.querySelector<HTMLInputElement>('[name=reportId]')?.value));
    const reportId=await reporter.locator('[name=reportId]').inputValue();
    assert.match(reportId,/^[a-f0-9-]{36}$/);
    const approver=await open(owner,'en',1280);
    await approver.locator('[name=reportId]').fill(reportId);
    await approver.locator('[data-status] button').click();
    const confirm=approver.locator('[data-confirm]');
    await confirm.locator('[name=amount]').fill('12.500');
    await confirm.locator('[name=actual]').check();
    await confirm.locator('button').click();
    await approver.getByText('Report confirmed and receipt posted.').waitFor();
    await reporter.locator('[data-status] button').click();
    await reporter.locator('[data-record]').getByText(/مرحّل/).waitFor();
    return reportId;
  }finally{await browser.close();}
}

test('cross-branch receiving site uses actual dated work location and separate legal-company authority', async () => {
  const f = await businessCentersFixture();
  let app: Awaited<ReturnType<typeof build>> | undefined;
  try {
    const worker = await f.employee();
    const cipher = security(f.secret.key);
    const bill=await f.bill('100');
    for (const file of ['operating-centres.sql', 'employee-work-locations.sql', 'cross-branch-collection-source.sql', 'cross-branch-receiving-site.sql','company-scope-upper-bound.sql','company-scope-customers.sql']) {
      await f.admin.query(await readFile('backend/review/' + file, 'utf8'));
    }
    const read = (companyId = f.co1, session = {}) => transaction(f.runtime, f.org.tenant, worker.id, async c =>
      readCrossBranchReceivingSite(c, await model(c, worker.id, cipher), {
        user_id: worker.id, tenant_id: f.org.tenant, ...session,
      }, companyId), { readOnly: true, repeatableRead: true, auditActor: worker.id });
    await assert.rejects(read(), (error: any) => error.status === 403);
    await f.req('POST', '/api/users/' + worker.id + '/grants', {
      action: 'ledger_cross_branch_collect', scope: { type: 'company', id: f.co1 }, delegable: false,
    });
    assert.equal((await read() as any).reviewRequired, 'receiving_site_unassigned');
    const emirateId = (await f.admin.query('select id from ab.emirates order by id limit 1')).rows[0].id;
    const centreId = randomUUID();
    const advance = async (revision: number, state: string) => {
      const draft = {
        centreId, revision, state, emirateId, areaId: null, companyIds: [f.co2], effectiveOn: '2026-01-01',
        nameAr: 'موقع استلام اصطناعي', nameEn: 'Synthetic receiving site', reason: 'Synthetic original site evidence',
      };
      const plan = await f.req('POST', '/api/operating-centres/plan', draft);
      return f.req('POST', '/api/operating-centres/apply', { ...draft, planHash: plan.planHash, confirm: true });
    };
    await advance(0, 'Active');
    const selectSite = async (centreId: string | null, revision: number, effectiveOn: string, userId=worker.id) => {
      const draft = { userId, centreId, revision, effectiveOn, reason: 'Synthetic dated physical assignment' };
      const plan = await f.req('POST', '/api/users/work-location/plan', draft);
      return f.req('POST', '/api/users/work-location/apply', { ...draft, planHash: plan.planHash, confirm: true });
    };
    await selectSite(centreId, 0, '2026-01-01');
    await selectSite(null, 1, '2099-01-01');
    const setCompanyScope=(companyIds:string[],revision:number,previousId:string|null)=>
      transaction(f.runtime,f.org.tenant,f.org.user,async c=>{
        const version=randomUUID();
        await c.query("insert into ab.user_access_scope_versions(id,tenant_id,user_id,revision,previous_id,selection_kind,payload_cipher,created_by) values($1,$2,$3,$4,$5,'companies',$6,$7)",
          [version,f.org.tenant,worker.id,revision,previousId,cipher.seal({companyIds}),f.org.user]);
        for(const companyId of companyIds)
          await c.query('insert into ab.user_access_scope_companies values($1,$2,$3,$4)',[f.org.tenant,worker.id,version,companyId]);
        return version;
      });
    const workerScope=await setCompanyScope([f.co2],1,null);
    const readOnlySite: any = await read();
    assert.equal(readOnlySite.centreId, centreId);
    assert.equal(readOnlySite.companyId, f.co1);
    assert.equal(readOnlySite.canCollect, false);
    assert.equal(readOnlySite.financialEffect, false);
    assert.match(readOnlySite.locationSourceId, /^[a-f0-9-]{36}$/);
    assert.match(readOnlySite.centreSourceId, /^[a-f0-9-]{36}$/);
    const source = await transaction(f.runtime, f.org.tenant, worker.id, async c =>
      readCrossBranchCollectionSource(c, await model(c, worker.id, cipher), {
        user_id: worker.id, tenant_id: f.org.tenant,
      }, cipher, { companyId: f.co1, customerId: f.client }),
    { readOnly: true, repeatableRead: true, auditActor: worker.id });
    assert.equal(source.state, 'reviewed_source');
    assert.deepEqual((source as any).receivingSite, readOnlySite);
    await f.admin.query(await readFile('backend/review/cross-branch-collection-intake.sql','utf8'));
    await assert.rejects(transaction(f.runtime,f.org.tenant,worker.id,c=>
      c.query('select ab.cross_branch_collection_source($1,$2)',[f.client,f.co1])),
    (error:any)=>error.code==='42501');
    await assert.rejects(read(f.co2), (error: any) => error.status === 403);
    await assert.rejects(read(f.co1, { viewAs: true }), (error: any) => error.status === 403);
    await assert.rejects(read(f.co1, { actor_type: 'service' }), (error: any) => error.status === 403);

    await f.login(worker.username, worker.password);
    await f.req('GET', '/api/users/' + worker.id + '/work-location', undefined, 403);
    await f.req('GET', '/api/ledger/receivables', undefined, 403);
    await f.login();
    const receivingSite={centreId:readOnlySite.centreId,centreSourceId:readOnlySite.centreSourceId,locationSourceId:readOnlySite.locationSourceId};
    const path='/api/ledger/collections/invoices',payload={
      companyId:f.co1,customerId:f.client,currency:'AED',receivedOn:today(),actualCashReceived:true,
      receivingSite,invoices:[{invoiceId:bill.id,amount:'25'}],
    };
    await f.req('POST',path,payload,503);

    const origin='http://127.0.0.1:3100';
    app=await build({pool:f.runtime,key:f.secret.key,origin,secureCookies:false,auth:f.auth,objects:f.objects,crossBranchCollectionEnabled:true});
    const page=await app.inject({url:'/'});
    assert.match(page.body,/src="cross-branch-collection-ui.js"/);
    const ui=await app.inject({url:'/cross-branch-collection-ui.js'});
    assert.equal(ui.statusCode,200);
    assert.match(ui.headers['content-type']||'',/javascript/);
    const headers:Record<string,string>={origin,'x-ab-request':'1'};
    const login=async(username=f.username,password=f.password)=>{
      const r=await app!.inject({method:'POST',url:'/api/login',payload:{username,password},headers:{origin,'x-ab-request':'1'}});
      assert.equal(r.statusCode,200);
      headers.cookie=String(r.headers['set-cookie']).split(';')[0];
      const bootstrap=(await app!.inject({url:'/api/bootstrap',headers})).json();
      headers['x-csrf-token']=bootstrap.csrfToken;
      return bootstrap;
    };
    const collect=async(body:unknown,status=200,key=randomUUID())=>{
      const result=await app!.inject({method:'POST',url:path,payload:body as any,headers:{...headers,'idempotency-key':key}});
      assert.equal(result.statusCode,status,result.body);
      return result.json();
    };
    assert.deepEqual((await login(worker.username,worker.password)).crossBranchCollection,{canConfirm:false});
    await collect(payload,403);
    const previewPath='/api/ledger/collections/cross-branch-preview?companyId='+f.co1+'&customerId='+f.client;
    assert.equal((await app.inject({url:previewPath,headers})).statusCode,403);
    const invoicePath='/api/ledger/collections/cross-branch-invoice?companyId='+f.co1+'&invoiceId='+bill.id;
    const exact=await app.inject({url:invoicePath,headers});
    assert.equal(exact.statusCode,200,exact.body);
    assert.deepEqual(Object.keys(exact.json().invoice).sort(),['companyId','currency','id','number','outstanding']);
    assert.deepEqual(exact.json().receivingSite,receivingSite);
    const intakePath='/api/ledger/collections/cross-branch-intake';
    const intakeBody={invoiceId:bill.id,companyId:f.co1,receivedOn:today(),receivingSite,amount:'25',actualCashReceived:true};
    const intake=async(data:unknown,key=randomUUID())=>app!.inject({method:'POST',url:intakePath,payload:data as any,headers:{...headers,'idempotency-key':key}});
    const tables=['finance_receipts','finance_journals','finance_custody_moves','vehicle_allocations'];
    const financeCounts=async()=>Promise.all(tables.map(async table=>(await f.admin.query('select count(*) n from ab.'+table)).rows[0].n));
    const beforeIntake=await financeCounts();
    const noIntakeKey=await app.inject({method:'POST',url:intakePath,payload:intakeBody,headers});
    assert.equal(noIntakeKey.statusCode,422,noIntakeKey.body);
    assert.equal(noIntakeKey.json().error,'idempotencyRequired');
    const intakeKey=randomUUID(),intakeResult=await intake(intakeBody,intakeKey);
    assert.equal(intakeResult.statusCode,200,intakeResult.body);
    assert.deepEqual((await intake(intakeBody,intakeKey)).json(),intakeResult.json());
    assert.equal(intakeResult.json().financialEffect,false);
    assert.equal((await intake({...intakeBody,amount:'101'})).statusCode,403);
    assert.equal((await intake({...intakeBody,invoiceId:randomUUID()})).statusCode,403);
    assert.deepEqual(await financeCounts(),beforeIntake);
    const other=await f.employee();
    const rows=await transaction(f.runtime,f.org.tenant,other.id,async c=>
      (await c.query('select id from ab.cross_branch_collection_intake')).rows);
    assert.deepEqual(rows,[]);
    const approvePath=intakePath+'/'+intakeResult.json().id+'/post';
    const approveIntake=(key=randomUUID(),confirmedAmount='25')=>app!.inject({
      method:'POST',url:approvePath,payload:{confirmActualCash:true,confirmedAmount},headers:{...headers,'idempotency-key':key},
    });
    assert.equal((await approveIntake()).statusCode,403);
    assert.deepEqual((await login()).crossBranchCollection,{canConfirm:true});
    const intakeRecord=await app.inject({url:intakePath+'/'+intakeResult.json().id,headers});
    assert.equal(intakeRecord.statusCode,200,intakeRecord.body);
    assert.equal(intakeRecord.json().amount,'25.000');
    assert.equal(intakeRecord.json().state,'reported');
    const noApprovalKey=await app.inject({method:'POST',url:approvePath,payload:{confirmActualCash:true,confirmedAmount:'25'},headers});
    assert.equal(noApprovalKey.statusCode,422,noApprovalKey.body);
    assert.equal(noApprovalKey.json().error,'idempotencyRequired');
    assert.equal((await approveIntake(randomUUID(),'24')).statusCode,422);
    const confirmationKey=randomUUID();
    const confirmed=await approveIntake(confirmationKey);
    assert.equal(confirmed.statusCode,200,confirmed.body);
    assert.deepEqual((await approveIntake(confirmationKey)).json(),confirmed.json());
    assert.equal((await approveIntake()).statusCode,409);
    const confirmedReceipt=confirmed.json().receipts[0].id;
    const postedCash=(await f.admin.query('select holder_id,created_by,company_id from ab.finance_receipts where id=$1',[confirmedReceipt])).rows[0];
    assert.deepEqual(postedCash,{holder_id:worker.id,created_by:f.org.user,company_id:f.co1});
    const amount=(await f.admin.query('select sum(amount)::text total from ab.vehicle_allocations where invoice_id=$1',[bill.id])).rows[0].total;
    assert.equal(amount,'25.000');
    await login(worker.username,worker.password);
    assert.equal((await app.inject({url:intakePath+'/'+intakeResult.json().id,headers})).json().state,'posted');
    await assert.rejects(transaction(f.runtime,f.org.tenant,worker.id,c=>
      c.query('select batch_id,posted_by from ab.cross_branch_collection_posting')),
    (error:any)=>error.code==='42501');

    await transaction(f.runtime,f.org.tenant,worker.id,async c=>{
      for(const [table,key,value] of [
        ['customers','id',f.client],['vehicle_invoices','id',bill.id],
        ['finance_receipts','id',confirmedReceipt],['finance_journals','source_key','receipt:'+confirmedReceipt],
      ]){
        assert.equal((await c.query('select 1 from ab.'+table+' where '+key+'=$1',[value])).rowCount,0,table);
      }
    });
    if(process.env.AB_CROSS_BRANCH_LIVE_BROWSER==='1'){
      const browserInvoice=await f.bill('100');
      await app.listen({host:'127.0.0.1',port:3100});
      const reportId=await collectThroughBrowser(origin,f.co1,browserInvoice.id,worker,
        {username:f.username,password:f.password});
      const linked=(await f.admin.query(
        `select r.company_id,r.holder_id,r.created_by,a.amount::text from ab.cross_branch_collection_posting p
         join ab.finance_receipts r on r.tenant_id=p.tenant_id and r.batch_id=p.batch_id
         join ab.vehicle_allocations a on a.receipt_id=r.id and a.invoice_id=$2
         where p.intake_id=$1`,[reportId,browserInvoice.id],
      )).rows;
      assert.deepEqual(linked,[{company_id:f.co1,holder_id:worker.id,created_by:f.org.user,amount:'12.500'}]);
    }
    await setCompanyScope([f.co1,f.co2],2,workerScope);
    for(const action of ['ledger_collect','customer_view','ledger_hand_over']){
      await f.req('POST','/api/users/'+worker.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
    }
    const preview=await app.inject({url:previewPath,headers});
    assert.equal(preview.statusCode,410,preview.body);
    assert.equal(preview.json().error,'crossBranchExactInvoiceRequired');
    await collect({...payload,receivingSite:{...receivingSite,centreSourceId:randomUUID()}},409);
    await collect({...payload,invoices:[{invoiceId:bill.id,amount:'25',discountAmount:'1',discountReason:'Invalid cross-branch discount'}]},422);
    const key=randomUUID(),posted=await collect(payload,200,key);
    assert.equal((await collect(payload,200,key)).id,posted.id);
    const batch=(await f.admin.query('select company_id,created_by,payload_cipher from ab.finance_receipt_batches where id=$1',[posted.id])).rows[0];
    assert.equal(batch.company_id,f.co1);
    assert.equal(batch.created_by,worker.id);
    assert.deepEqual(cipher.open(batch.payload_cipher).receivingSite,{...receivingSite,receivedOn:today()});
    const receiptId=posted.receipts[0].id;
    const custody=async(holder=worker.id,receipt=receiptId)=>(await f.admin.query(
      'select coalesce(sum(amount),0)::text amount from ab.finance_custody_moves where receipt_id=$1 and company_id=$2 and holder_id=$3',
      [receipt,f.co1,holder],
    )).rows[0].amount;
    assert.equal(await custody(),'25.000');
    const allocation=(await f.admin.query('select sum(amount)::text amount from ab.vehicle_allocations where invoice_id=$1',[bill.id])).rows[0].amount;
    assert.equal(allocation,'50.000');
    const receiptJournal=(await f.admin.query('select company_id,status from ab.finance_journals where source_key=$1',['receipt:'+receiptId])).rows;
    assert.deepEqual(receiptJournal,[{company_id:f.co1,status:'Posted'}]);
    await f.req('POST','/api/ledger/custody/routes',{companyId:f.co1,senderId:worker.id,receiverId:f.org.user,effectiveOn:today()});
    await f.login(worker.username,worker.password);
    const handover=await f.req('POST','/api/ledger/custody/handovers',{companyId:f.co1,receiverId:f.org.user,currency:'AED',amount:'50',receipts:[{receiptId,amount:'25'},{receiptId:confirmedReceipt,amount:'25'}]});
    assert.equal(await custody(),'25.000');
    assert.equal(await custody(worker.id,confirmedReceipt),'25.000');
    await f.login();
    await f.req('POST','/api/ledger/custody/handovers/'+handover.id+'/receive',{actual:'50',reason:'Synthetic counted cross-branch cash'});
    assert.equal(await custody(),'0.000');
    assert.equal(await custody(f.org.user),'25.000');
    assert.equal(await custody(worker.id,confirmedReceipt),'0.000');
    assert.equal(await custody(f.org.user,confirmedReceipt),'25.000');
    const foreignBank=await f.bank(f.co2),legalBank=await f.bank(),proof=await f.proof();
    const depositBody={companyId:f.co1,bankAccountId:foreignBank.id,currency:'AED',amount:'50',effectiveOn:today(),documentVersionId:proof,reference:'Synthetic cross-branch deposit'};
    await f.req('POST','/api/ledger/deposits',depositBody,422);
    const deposit=await f.req('POST','/api/ledger/deposits',{...depositBody,bankAccountId:legalBank.id});
    assert.equal(await custody(f.org.user),'25.000');
    await f.req('POST','/api/ledger/deposits/'+deposit.id+'/confirm',{confirmedAmount:'50',effectiveOn:today(),bankConfirmation:'Synthetic actual deposit receipt',accountAndDateVerified:true});
    assert.equal(await custody(f.org.user),'0.000');
    assert.equal(await custody(f.org.user,confirmedReceipt),'0.000');

    await advance(1, 'Inactive');
    assert.equal((await read() as any).reviewRequired, 'receiving_site_unavailable');
    await collect(payload,409,key);
    const summary = await f.req('GET', '/api/users/' + worker.id + '/permission-summary');
    const grant = summary.directGrants.find((entry: any) => entry.action === 'ledger_cross_branch_collect');
    assert.ok(grant);
    await f.req('POST', '/api/users/' + worker.id + '/revoke', { grantId: grant.id });
    await assert.rejects(read(), (error: any) => error.status === 403);
    assert.equal((await app.inject({url:intakePath+'/'+intakeResult.json().id,headers})).statusCode,404);
    assert.equal((await intake(intakeBody,intakeKey)).statusCode,404);
    assert.equal((await app.inject({url:'/api/bootstrap',headers})).json().crossBranchCollection,null);
  } finally {
    if(app)await app.close();
    await f.close();
  }
});
