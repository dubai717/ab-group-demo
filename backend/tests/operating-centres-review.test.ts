import{test}from'node:test';import assert from'node:assert/strict';import{readFile}from'node:fs/promises';import{randomUUID}from'node:crypto';import{businessCentersFixture}from'./business-centers-fixture.js';

test('review-only physical-centre snapshots retain mapping history, serialize revisions and never grant company access',async()=>{
 const f=await businessCentersFixture();try{
  assert.match(f.sourceDatabase,/^ab_backup_[a-f0-9]{32}$/);const user=await f.employee(),before=(await f.admin.query('select * from ab.user_companies order by user_id,company_id')).rows,grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  await f.admin.query(await readFile('backend/review/operating-centres.sql','utf8'));
  const emirate=(await f.admin.query('select id from ab.emirates order by id limit 1')).rows[0].id,centre=randomUUID(),first=randomUUID(),tx=async(actor:string,fn:any)=>{const c=await f.runtime.connect();try{await c.query('begin');await c.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[f.org.tenant,actor]);const result=await fn(c);await c.query('commit');return result;}catch(error){await c.query('rollback');throw error;}finally{c.release();}};
  const save=async(c:any,id:string,revision:number,previous:string|null,date='2026-11-23',createdBy=f.org.user)=>{await c.query('insert into ab.operating_centre_versions(id,tenant_id,centre_id,revision,previous_id,effective_on,emirate_id,state,payload_cipher,created_by,created_at)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,\'1999-01-01\')',[id,f.org.tenant,centre,revision,previous,date,emirate,'Active','synthetic SQL-policy-only payload',createdBy]);};
  await tx(f.org.user,async(c:any)=>{await save(c,first,1,null);assert.equal((await c.query('select created_at=transaction_timestamp() ok from ab.operating_centre_versions where id=$1',[first])).rows[0].ok,true);for(const company of[f.co1,f.co2])await c.query('insert into ab.operating_centre_companies(tenant_id,version_id,company_id)values($1,$2,$3)',[f.org.tenant,first,company]);});
  assert.equal((await tx(user.id,(c:any)=>c.query('select * from ab.operating_centre_versions'))).rowCount,0);
  assert.equal((await tx(user.id,(c:any)=>c.query('select * from ab.operating_centre_companies'))).rowCount,0);
  await assert.rejects(tx(user.id,(c:any)=>save(c,randomUUID(),2,first)),(e:any)=>e.code==='42501');
  await assert.rejects(tx(f.org.user,(c:any)=>c.query('insert into ab.operating_centre_companies(tenant_id,version_id,company_id)values($1,$2,$3)',[f.org.tenant,first,randomUUID()])),(e:any)=>e.code==='23514');
  for(const statement of['update ab.operating_centre_versions set state=\'Inactive\'','delete from ab.operating_centre_versions','delete from ab.operating_centre_companies'])await assert.rejects(tx(f.org.user,(c:any)=>c.query(statement)),(e:any)=>e.code==='42501');
  await assert.rejects(tx(f.org.user,(c:any)=>save(c,randomUUID(),2,first,'2026-11-23',user.id)),(e:any)=>e.code==='23514');
  const ids=[randomUUID(),randomUUID()],results=await Promise.allSettled(ids.map(id=>tx(f.org.user,async(c:any)=>{await save(c,id,2,first,'2026-12-01');await c.query('insert into ab.operating_centre_companies(tenant_id,version_id,company_id)values($1,$2,$3)',[f.org.tenant,id,f.co2]);})));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&(r.reason as any).code==='23514').length,1);
  const rows=(await tx(f.org.user,(c:any)=>c.query('select id,revision from ab.operating_centre_versions order by revision'))).rows;assert.equal(rows.length,2);assert.equal(rows[0].id,first);
  const links=(await tx(f.org.user,(c:any)=>c.query('select version_id,company_id from ab.operating_centre_companies order by version_id,company_id'))).rows;assert.equal(links.length,3);assert.equal(links.filter((r:any)=>r.version_id===first).length,2);
  await assert.rejects(tx(f.org.user,(c:any)=>save(c,randomUUID(),3,rows[1].id,'2026-11-30')),(e:any)=>e.code==='23514');
  assert.deepEqual((await f.admin.query('select * from ab.user_companies order by user_id,company_id')).rows,before);assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);assert.equal((await f.admin.query('select count(*) n from ab.finance_journals')).rows[0].n,'0');
 }finally{await f.close();}
});
