import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{personnelFixture}from'./personnel-fixture.js';
test('expiry preview consumes only current authorized original versions, stops the old reminder after replacement and never downloads or writes',async()=>{const f=await personnelFixture();try{
 await f.admin.query(await readFile('supabase/additive/015_document_center.sql','utf8'));const staff=await f.req('POST','/api/personnel/employees',{companyId:f.co1,nameAr:'موظف مستند اصطناعي',nameEn:'Synthetic reminder staff',jobTitle:'Test',hiredOn:'2024-01-01'}),date=new Date(Date.now()+4*3600000).toISOString().slice(0,10),expiry=(n:number)=>new Date(Date.parse(date+'T00:00:00Z')+n*86400000).toISOString().slice(0,10),upload={kind:'identity',name:'synthetic.pdf',title:'Synthetic reminder source',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 Synthetic reminder only').toString('base64'),expiresOn:expiry(30)},one=await f.req('POST','/api/personnel/employees/'+staff.id+'/documents',upload);
 const first=await f.req('GET','/api/document-expiries'),old=first.rows.find((r:any)=>r.versionId===one.versionId);assert(old);assert.equal(old.reminderPlan.events[0].state,'due');assert.equal(old.reminderPlan.events[0].scheduledOn,date);assert.equal(first.externalSent,false);const two=await f.req('POST','/api/personnel/employees/'+staff.id+'/documents',{...upload,parentVersionId:one.versionId,expiresOn:expiry(60),title:'Synthetic replacement'});
 const counts=async()=>({objects:f.objects.rows.size,audits:Number((await f.admin.query('select count(*)n from ab.audit_events')).rows[0].n),notifications:Number((await f.admin.query('select count(*)n from ab.finance_notifications')).rows[0].n)}),before=await counts(),next=await f.req('GET','/api/document-expiries');assert(!next.rows.some((r:any)=>r.versionId===one.versionId));const current=next.rows.find((r:any)=>r.versionId===two.versionId);assert(current);assert.notEqual(current.reminderPlan.events[0].key,old.reminderPlan.events[0].key);assert.equal(current.reminderPlan.events[0].state,'future');await f.req('GET','/api/document-expiries');assert.deepEqual(await counts(),before);
 const u=await f.employee();await f.login(u.username,u.password);assert(!(await f.req('GET','/api/document-expiries')).rows.some((r:any)=>r.id===old.id));
}finally{await f.close();}});

test('original personnel follow-up keeps the recorded expiry date and creates one renewal task', async () => {
  const f = await personnelFixture();
  try {
    const staff = await f.req('POST', '/api/personnel/employees', {
      companyId: f.co1, nameAr: 'موظف تجديد اصطناعي', nameEn: 'Synthetic renewal employee',
      jobTitle: 'Test', hiredOn: '2024-01-01',
    });
    const today = new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
    const document = await f.req('POST', '/api/personnel/employees/' + staff.id + '/documents', {
      kind: 'passport', title: 'Synthetic original renewal', name: 'synthetic.pdf', mime: 'application/pdf',
      base64: Buffer.from('%PDF-1.4 Synthetic renewal only').toString('base64'), expiresOn: today,
    });
    await f.req('POST', '/api/personnel/employees/' + staff.id + '/documents/' + document.versionId + '/review',
      { approve: true, reason: 'Synthetic approved renewal source' });
    for (const attempt of [1, 2]) {
      await f.req('POST', '/api/personnel/followup/' + f.co1, { confirm: true });
    }
    const rows = (await f.admin.query(
      "select employee_id,to_char(due_on,'YYYY-MM-DD') due_day from ab.tasks where source_type='employee_document' and source_id=$1",
      [staff.id])).rows;
    assert.deepEqual(rows, [{ employee_id: staff.id, due_day: today }]);
  } finally {
    await f.close();
  }
});
