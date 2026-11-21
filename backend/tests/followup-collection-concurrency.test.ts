import test from 'node:test';
import assert from 'node:assert/strict';
import {businessCentersFixture} from './business-centers-fixture.js';
import {security,transaction} from '../src/core.js';
import {model} from '../src/data.js';
import {runAdministrativeFees} from '../src/financial-package.js';
import {today} from '../src/vehicle-domain.js';

test('monthly follow-up assessment and actual principal collection serialize without stale fees, duplicate periods or changing historical invoices',async()=>{
 const f=await businessCentersFixture();let release:()=>void=()=>{},worker:Promise<any>|undefined;
 try{
  const cipher=security(f.secret.key),asOf='2026-11-01',proof=await f.proof(),fee=await f.req('POST','/api/ledger/items',{nameAr:'رسم متابعة تزامن وهمي',nameEn:'Synthetic concurrent follow-up fee',category:'collection_followup_salik',companyIds:[f.co1],invoice:true,receipt:true,payment:false,methods:['manual','automatic'],receivableId:f.accounts.ar.id,revenueId:f.accounts.income.id});
  const definition=await f.req('POST','/api/ledger/package/fees',{companyId:f.co1,itemId:f.items.salik,sourceItemIds:[f.items.salik],debtCategory:'salik',feeItemId:fee.id,amount:'10',unit:'vehicle_category',repeat:'monthly',delayMonths:2,effectiveOn:today(),contractEvidenceId:proof,confirm:true});
  // Only this newly created synthetic fixture simulates an existing approved prospective June rule.
  const key='financial-package-v1:fees:'+f.co1+':'+definition.id,original=(await f.admin.query('select value from ab.settings where key=$1',[key])).rows[0],rule=cipher.open(original.value.cipher);
  await f.admin.query('update ab.settings set value=$2 where key=$1',[key,{cipher:cipher.seal({...rule,effectiveOn:'2026-06-01',eligibleFrom:'2026-06-01',enabled:true})}]);
  await f.admin.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[f.org.tenant,'financial-package-v1:approval:'+f.co1,{cipher:cipher.seal({companyId:f.co1,features:['fees'],reviewedDigest:'isolated-concurrency-policy',reason:'Synthetic simultaneous first-of-month collection',approvedBy:f.org.user,approvedOn:'2026-06-01'})}]);
  const vehicle=async()=>{const r=await f.request();await f.fund(r.id);return f.register(r.id);},v=await vehicle(),bill=await f.bill('100',f.items.salik,{vehicleId:v.id,issuedOn:'2026-07-01',dueOn:'2026-07-01'});
  const grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  let planned!:()=>void;const reached=new Promise<void>(r=>planned=r),gate=new Promise<void>(r=>release=r);let paused=false;
  const assess=(pause=false)=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>{
   const m=await model(c,f.org.user,cipher),proxy={query:async(...args:any[])=>{if(pause&&!paused&&typeof args[0]==='string'&&args[0].startsWith('insert into ab.vehicle_invoices')){paused=true;planned();await gate;}return(c.query as any)(...args);}};
   return runAdministrativeFees(proxy,cipher,m,{tenant_id:f.org.tenant,user_id:f.org.user},f.co1,asOf);
  });
  worker=assess(true);let timer:any;try{await Promise.race([reached,worker.then(()=>{throw Error('Expected an eligible synthetic fee before the synchronization barrier');}),new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Synthetic fee plan barrier timeout')),10000))]);}finally{clearTimeout(timer);}
  let finished=false;const collection=f.req('POST','/api/ledger/collections/invoices',{companyId:f.co1,customerId:f.client,currency:'AED',receivedOn:asOf,actualCashReceived:true,invoices:[{invoiceId:bill.id,amount:'100'}]}).finally(()=>finished=true);
  // Original transaction() serializes every financial request and worker by tenant before domain locks.
  const lockKey=f.org.tenant;let waiting=false;
  for(let n=0;n<100&&!finished;n++){
   waiting=!!(await f.admin.query("select 1 from pg_locks where locktype='advisory' and database=(select oid from pg_database where datname=current_database()) and not granted and classid=((hashtext($1)::bigint>>32)&4294967295)::oid and objid=(hashtext($1)::bigint&4294967295)::oid",[lockKey])).rowCount;
   if(waiting)break;await new Promise(r=>setTimeout(r,20));
  }
  assert(waiting&&!finished,'Actual collection must wait while the fee decision is being committed');release();
  const [assessment,received]=await Promise.all([worker,collection]);assert.equal(assessment.issued,1);assert.equal(received.cashTotal,'100.000');
  const replay=await Promise.all([assess(),assess()]);assert(replay.every((r:any)=>r.issued===0));
  const v2=await vehicle(),paidFirst=await f.bill('100',f.items.salik,{vehicleId:v2.id,issuedOn:'2026-07-01',dueOn:'2026-07-01'});
  await f.req('POST','/api/ledger/collections/invoices',{companyId:f.co1,customerId:f.client,currency:'AED',receivedOn:asOf,actualCashReceived:true,invoices:[{invoiceId:paidFirst.id,amount:'100'}]});
  assert.equal((await assess()).issued,0,'A principal paid before assessment does not generate a new fee');
  const fees=(await f.admin.query("select i.amount::text,i.vehicle_id from ab.vehicle_invoices i join ab.finance_invoice_links l on l.invoice_id=i.id where l.company_id=$1 and l.source_key like 'admin-fee:%'",[f.co1])).rows;
  assert.deepEqual(fees,[{amount:'10.000',vehicle_id:v.id}]);assert.equal((await f.admin.query('select amount::text from ab.vehicle_invoices where id=$1',[bill.id])).rows[0].amount,'100.000');
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);
 }finally{release();if(worker)await worker.catch(()=>{});await f.close();}
});
