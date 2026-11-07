import test from 'node:test';
import assert from 'node:assert/strict';
import {businessCentersFixture} from './business-centers-fixture.js';
import {renderMessageTemplate} from '../src/communications.js';

test('Internal communications preserve source scope, template versions and truthful delivery states',async t=>{
 const f=await businessCentersFixture();try{
  const manager=await f.employee('general_manager'),other=await f.employee(),headers={};
  const thread=await f.req('POST','/api/communications',{sourceType:'company',sourceId:f.co1,subject:'Synthetic company thread',body:'Synthetic internal message only',recipientIds:[manager.id]});
  await t.test('internal messages do not claim external delivery or recipient reading',async()=>{assert.equal(thread.externalSent,false);assert.equal(thread.delivered,null);assert.equal(thread.read,null);assert.equal(thread.inboxNotifications,1);});
  await t.test('unauthorized recipients and unavailable external providers fail without sending',async()=>{
   await f.req('POST','/api/communications',{sourceType:'company',sourceId:f.co1,subject:'Not authorized',body:'No disclosure',recipientIds:[other.id]},403);
   await f.req('POST','/api/communication-external/send',{channel:'whatsapp'},503);
  });
  await f.login(manager.username,manager.password);
  await t.test('authorized recipient opens original thread, marks own notice read and replies separately',async()=>{
   const notices=(await f.req('GET','/api/notifications')).rows,notice=notices.find((r:any)=>r.source==='communication');assert.ok(notice);assert.equal(notice.readAt,null);
   const r=await f.req('GET','/api/communications/'+thread.threadId);assert.equal(r.rows[0].body,'Synthetic internal message only');
   const read=await f.req('POST','/api/notifications/'+notice.id+'/read',{});assert.equal(read.read,true);assert.equal(read.replied,false);assert.equal(read.taskCompleted,false);
   await f.req('POST','/api/communications/'+thread.threadId+'/replies',{body:'Synthetic reply'});assert.equal((await f.req('GET','/api/communications/'+thread.threadId)).rows.length,2);
  });
  await f.login(other.username,other.password);
  await t.test('another user cannot read or reply even with a known thread ID',async()=>{
   await f.req('GET','/api/communications/'+thread.threadId,undefined,403);await f.req('POST','/api/communications/'+thread.threadId+'/replies',{body:'Denied'},403);
   assert.equal((await f.req('GET','/api/communications')).rows.length,0);
  });
  await f.login();
  await t.test('template placeholder validation and immutable locale versions prevent silent overwrites',async()=>{
   for(const locale of ['ar','en','ur','ml'])await f.req('POST','/api/communication-templates',{key:'collection',locale,title:'Synthetic template',body:'{{companyName}} — {{recordNumber}}'});
   await f.req('POST','/api/communication-templates',{key:'collection',locale:'ar',title:'Synthetic v2',body:'{{companyName}} — {{dueDate}}'});
   const rows=(await f.req('GET','/api/communication-templates')).rows;assert.equal(rows.length,4);assert.equal(rows.find((r:any)=>r.locale==='ar').version,2);
   await f.req('POST','/api/communication-templates',{key:'invalid',locale:'ar',title:'Invalid placeholder',body:'{{password}}'},422);
   assert.throws(()=>renderMessageTemplate('{{amount}}',{}));assert.equal(renderMessageTemplate('{{companyName}}',{companyName:'اختبار'}),'اختبار');
   assert.equal((await f.admin.query('select count(*)::int n from ab.communication_templates')).rows[0].n,5);
  });
 }finally{await f.close();}
});

test('Template messages resolve actual current balances, preferred locale and preview confirmation without fake delivery',async t=>{
 const f=await businessCentersFixture();try{
  const manager=await f.employee('general_manager');for(const action of ['ledger_view','customer_view'])await f.req('POST','/api/users/'+manager.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
  for(const locale of ['ar','en'])await f.req('POST','/api/communication-templates',{key:'balance',locale,title:locale+' {{recordNumber}}',body:'{{customerName}}: {{amount}} {{currency}} ({{invoiceAmount}} / {{paidAmount}}) {{link}}'});
  await f.login(manager.username,manager.password);await f.req('POST','/api/notification-preferences',{locale:'en',optionalInternal:true});await f.login();const bill=await f.bill('100'),input={sourceType:'invoice',sourceId:bill.id,templateKey:'balance',fallbackLocale:'ar',recipientIds:[manager.id]};
  const preview=await f.req('POST','/api/communications/from-template/preview',input);
  await t.test('preferred locale and actual invoice amount are used in a read-only preview',async()=>{assert.equal(preview.sent,false);assert.equal(preview.messages[0].locale,'en');assert.match(preview.messages[0].body,/100\.000 AED/);assert.equal((await f.admin.query('select count(*)::int n from ab.communication_threads')).rows[0].n,0);});
  await f.collection('25');
  await t.test('a changed balance invalidates an old preview instead of sending stale information',async()=>{await f.req('POST','/api/communications/from-template',{...input,confirmDigest:preview.confirmDigest},409);});
  const current=await f.req('POST','/api/communications/from-template/preview',input);assert.match(current.messages[0].body,/75\.000 AED/);
  await t.test('only an explicitly confirmed preview sends once and preserves version and locale',async()=>{const saved=await f.req('POST','/api/communications/from-template',{...input,confirmDigest:current.confirmDigest});assert.equal(saved.externalSent,false);const repeated=await f.req('POST','/api/communications/from-template',{...input,confirmDigest:current.confirmDigest});assert.equal(repeated.rows[0].alreadyStored,true);const thread=await f.req('GET','/api/communications/'+saved.rows[0].threadId);assert.equal(thread.rows.length,1);assert.equal(thread.rows[0].templateVersion,1);assert.equal(thread.rows[0].locale,'en');assert.equal(thread.rows[0].delivered,null);});
  await t.test('unauthorized or inactive recipients and unknown placeholders fail closed',async()=>{const other=await f.employee();await f.req('POST','/api/communications/from-template/preview',{...input,recipientIds:[other.id]},403);await f.req('POST','/api/communication-templates',{key:'invalid_title',locale:'ar',title:'{{password}}',body:'Valid body'},422);});
 }finally{await f.close();}
});
