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

test('cross-branch receiving site uses actual dated work location and separate legal-company authority', async () => {
  const f = await businessCentersFixture();
  let app: Awaited<ReturnType<typeof build>> | undefined;
  try {
    const worker = await f.employee();
    const cipher = security(f.secret.key);
    const bill=await f.bill('100');
    for (const file of ['operating-centres.sql', 'employee-work-locations.sql', 'cross-branch-collection-source.sql', 'cross-branch-receiving-site.sql','cross-branch-collection-intake.sql']) {
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
    const headers:Record<string,string>={origin,'x-ab-request':'1'};
    const login=async(username=f.username,password=f.password)=>{
      const r=await app!.inject({method:'POST',url:'/api/login',payload:{username,password},headers:{origin,'x-ab-request':'1'}});
      assert.equal(r.statusCode,200);
      headers.cookie=String(r.headers['set-cookie']).split(';')[0];
      headers['x-csrf-token']=(await app!.inject({url:'/api/bootstrap',headers})).json().csrfToken;
    };
    const collect=async(body:unknown,status=200,key=randomUUID())=>{
      const result=await app!.inject({method:'POST',url:path,payload:body as any,headers:{...headers,'idempotency-key':key}});
      assert.equal(result.statusCode,status,result.body);
      return result.json();
    };
    await login(worker.username,worker.password);
    await collect(payload,403);
    const preview=await app.inject({url:'/api/ledger/collections/cross-branch-preview?companyId='+f.co1+'&customerId='+f.client,headers});
    assert.equal(preview.statusCode,200,preview.body);
    assert.equal(preview.json().rows[0].id,bill.id);
    assert.equal(preview.json().receivingSite.locationSourceId,receivingSite.locationSourceId);
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
    await login();
    const intakeRecord=await app.inject({url:intakePath+'/'+intakeResult.json().id,headers});
    assert.equal(intakeRecord.statusCode,200,intakeRecord.body);
    assert.equal(intakeRecord.json().amount,'25.000');
    assert.equal(intakeRecord.json().state,'reported');
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

    for(const action of ['ledger_collect','customer_view','ledger_hand_over']){
      await f.req('POST','/api/users/'+worker.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
    }
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
  } finally {
    if(app)await app.close();
    await f.close();
  }
});
