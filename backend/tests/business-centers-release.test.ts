import type {Pool} from 'pg';
import {schemaReadiness} from '../deploy/schema-readiness.js';
import {isolatedSettingsCopy} from '../deploy/drift-settings.js';
import {docker} from '../deploy/backup-restore-drill.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {sourceTableFingerprint,sourceTableFingerprints} from '../deploy/source-fingerprint.js';
import {personnelFixture} from './personnel-fixture.js';
import {manifest} from '../deploy/backup-restore-drill.js';
import {applyBusinessCenters} from '../deploy/business-centers-release.js';
import {approvedCatalog} from '../deploy/safe-staging-additives.js';
import {businessCatalog,validateBusinessLedger} from '../deploy/business-centers-catalog.mjs';
test('reviewed business ledger rejects missing, changed, unreviewed and nonsequential migrations',async()=>{
 const base=await approvedCatalog(),plan=businessCatalog();assert.equal(validateBusinessLedger(base,base,plan).length,14);assert.equal(validateBusinessLedger([...base,...plan],base,plan).length,0);
 for(const extra of [[plan[1]],[{...plan[0],sha256:'0'.repeat(64)}],[...plan,{name:'026_unknown.sql',sha256:'0'.repeat(64)}]])assert.throws(()=>validateBusinessLedger([...base,...extra],base,plan));
});
test('ordered business migration rehearsal preserves populated original finance, users, grants and relationships; faults roll back',async t=>{
 const f=await personnelFixture();try{
 // Fake Auth schema is isolated and used only for testing identity-preservation checks.
 await f.admin.query('CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz)');await f.admin.query('insert into auth.users(id,email,email_confirmed_at)select auth_id,auth_email,now()from ab.users');
 const base=await approvedCatalog();for(const m of base)await f.admin.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)on conflict(name)do nothing',[m.name,m.sha256]);
 const bill=await f.bill('100'),receipt=await f.collection('25');const context=async()=>{const c=await f.admin.connect();try{return{ledger:(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,manifest:await manifest(c)};}finally{c.release();}};
 const original=(await f.admin.query('select * from ab.vehicle_invoices where id=$1',[bill.id])).rows[0],grants=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
 await t.test('missing rehearsal permission stops without DDL',async()=>{await assert.rejects(applyBusinessCenters(f.admin,await context()),/BUSINESS_REHEARSAL_REQUIRED/);assert.equal((await f.admin.query("select to_regclass('ab.contracting_companies')x")).rows[0].x,null);});
 await t.test('login committing concurrently with the migration lock is preserved and rehearsed',async()=>{
  const ctx=await context(),writer=await f.admin.connect(),u=(await f.admin.query("select id,tenant_id from ab.users where role_id='owner' limit 1")).rows[0];
  try{await writer.query('begin');await writer.query("insert into ab.sessions values($1,$2,$3,'synthetic-token',now()+interval '1 hour')",[crypto.randomUUID(),u.tenant_id,u.id]);await writer.query("insert into ab.audit_events(id,tenant_id,actor_id,action,entity_type,request_id)values(gen_random_uuid(),$1,$2,'login','session',gen_random_uuid())",[u.tenant_id,u.id]);
   const pending=applyBusinessCenters(f.admin,ctx,{dryRun:true});await new Promise(r=>setTimeout(r,50));await writer.query('commit');const result=await pending;assert.equal(result.applied,14);assert.equal(result.access?.auditAdded,1);assert.equal(result.access?.sessionsAdded,1);
  }finally{await writer.query('rollback');writer.release();}
 });
 await t.test('logout expiry and its audit survive the migration unchanged',async()=>{
  const ctx=await context(),u=(await f.admin.query("select id,tenant_id from ab.users where role_id='owner' limit 1")).rows[0];
  await f.admin.query("with expired as(update ab.sessions set expires_at=now() where id_hash=(select id_hash from ab.sessions where token_cipher='synthetic-token' limit 1))insert into ab.audit_events(id,tenant_id,actor_id,action,entity_type,request_id)values(gen_random_uuid(),$1,$2,'logout','session',gen_random_uuid())",[u.tenant_id,u.id]);
  assert.equal((await applyBusinessCenters(f.admin,ctx,{dryRun:true})).access?.sessionsExpired,1);
 });
 await t.test('concurrent financial activity still stops before applying any migration',async()=>{const ctx=await context();await f.bill('17');await assert.rejects(applyBusinessCenters(f.admin,ctx,{dryRun:true}),/BUSINESS_SOURCE_CHANGED_SINCE_BACKUP/);assert.equal((await f.admin.query('select count(*)::int n from public.ab_schema_migrations')).rows[0].n,13);});
 await t.test('changed permission distribution still stops before DDL',async()=>{const ctx=await context(),grant=(await f.admin.query("select role_id,permission_id from ab.role_permissions where role_id<>'owner' limit 1")).rows[0];assert.ok(grant);await f.admin.query('delete from ab.role_permissions where role_id=$1 and permission_id=$2',[grant.role_id,grant.permission_id]);try{await assert.rejects(applyBusinessCenters(f.admin,ctx,{dryRun:true}),/BUSINESS_SOURCE_CHANGED_SINCE_BACKUP/);}finally{await f.admin.query('insert into ab.role_permissions(role_id,permission_id)values($1,$2)',[grant.role_id,grant.permission_id]);}});
 await t.test('batched source check is exactly equal to individual table hashes',async()=>{const c=await f.admin.connect();try{const tables=['audit_events','sessions','users','finance_entries','role_permissions'].map(t=>({s:'ab',t}));const batch=await sourceTableFingerprints(c,tables);for(const t of tables){const r=batch.find(x=>x.t===t.t)!;assert.deepEqual({n:r.n,h:r.h},await sourceTableFingerprint(c,t.s,t.t));}}finally{c.release();}});
 await t.test('read-only readiness identifies fourteen pending migrations and verifies the actual runtime connection',async()=>{assert.equal((await schemaReadiness(f.admin,f.runtime)).pending,14);});
 const backedUp=await context();
 await t.test('actual PostgreSQL archive settings extract is confined to isolated COPY data',async()=>{const bytes=await docker(['exec','-i','--env','PGPASSWORD','ab-postgres-foundation','pg_dump','--host=127.0.0.1','--username=postgres','--dbname='+f.sourceDatabase,'--format=custom','--data-only','--table=ab.settings'],{PGPASSWORD:f.secret.admin});const sql=await docker(['exec','-i','ab-postgres-foundation','pg_restore','--data-only','--schema=ab','--table=settings','--no-owner','--no-privileges','--file=-'],{},bytes);assert.ok(isolatedSettingsCopy(sql.toString()).toString().startsWith('COPY ab_drift_diagnostic.settings'));});
 await t.test('shared source fingerprint preserves the exact original restored-backup hash format',async()=>{const c=await f.admin.connect();try{for(const table of ['users','vehicle_invoices','finance_entries']){const legacy=(await c.query("select count(*)::text n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by md5(row_to_json(x)::text)),'')) h from ab.\""+table+"\" x")).rows[0];assert.deepEqual(await sourceTableFingerprint(c,'ab',table),legacy);}}finally{c.release();}});
 await t.test('changed rows since backup fail before DDL',async()=>{const bad=structuredClone(backedUp);bad.manifest.rows.find((x:any)=>x.s==='ab'&&x.t==='users').h='changed';await assert.rejects(applyBusinessCenters(f.admin,bad,{dryRun:true}),/BUSINESS_SOURCE_CHANGED_SINCE_BACKUP/);});
 await t.test('all fourteen apply and validate on isolated rehearsal then roll back',async()=>{assert.equal((await applyBusinessCenters(f.admin,backedUp,{dryRun:true})).applied,14);assert.equal((await f.admin.query("select to_regclass('ab.contracting_companies')x")).rows[0].x,null);assert.equal((await f.admin.query('select count(*)::int n from public.ab_schema_migrations')).rows[0].n,13);});
 await t.test('an added guard that would change preserved structure blocks and rolls back',async()=>{await f.admin.query("create function ab.release_fault()returns event_trigger language plpgsql as $$begin if to_regclass('ab.contracting_companies')is not null then raise exception 'synthetic migration stop';end if;end$$;create event trigger isolated_migration_fault on ddl_command_end execute function ab.release_fault()");await assert.rejects(applyBusinessCenters(f.admin,await context(),{dryRun:true}));assert.equal((await f.admin.query("select to_regclass('ab.hr_eos_estimates')x")).rows[0].x,null);await f.admin.query('drop event trigger isolated_migration_fault;drop function ab.release_fault()');});
 await t.test('approved application commits the exact catalog and leaves original rows/balances unchanged',async()=>{const ctx=await context();const operator={connect:async()=>{const c=await f.admin.connect();return{query:async(sql:string,p?:any[])=>{if(sql==='SET LOCAL ROLE ab_runtime')throw Object.assign(Error('synthetic operator denied'),{code:'42501'});return c.query(sql,p);},release:()=>c.release()};}}as unknown as Pool;assert.equal((await applyBusinessCenters(operator,ctx,{rehearsed:true,runtimePool:f.runtime})).applied,14);const after=(await f.admin.query('select * from ab.vehicle_invoices where id=$1',[bill.id])).rows[0];delete after.contracting_company_id;assert.deepEqual(after,original);assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,grants);const rows=(await f.req('GET','/api/ledger/invoices?companyId='+f.co1+'&customerId='+f.client)).rows;assert.equal(rows.find((r:any)=>r.id===bill.id).paid,'25.000');assert.ok(receipt.id||receipt.receipts.length);});
 await t.test('ordinary release fast path is read-only, recognizes the complete catalog and needs no fresh backup',async()=>{const before=await context();assert.equal((await schemaReadiness(f.admin,f.runtime)).pending,0);assert.equal((await applyBusinessCenters(f.admin,{}, {runtimePool:f.runtime})).applied,0);assert.deepEqual(await context(),before);});
 await t.test('repeated catalog application is a verified no-op, not duplicate DDL',async()=>{assert.equal((await applyBusinessCenters(f.admin,await context(),{rehearsed:true})).applied,0);assert.equal((await f.admin.query('select count(*)::int n from public.ab_schema_migrations')).rows[0].n,27);});
 }finally{await f.close();}
});

test('only reviewed 026 upgrades an existing populated 025 ledger; unexpected old guard fails closed',async()=>{
 const f=await personnelFixture();try{
 await f.admin.query('CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz)');
 await f.admin.query('insert into auth.users(id,email,email_confirmed_at)select auth_id,auth_email,now()from ab.users');
 for(const m of await approvedCatalog())await f.admin.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)on conflict(name)do nothing',[m.name,m.sha256]);
 for(const m of businessCatalog().slice(0,12)){await f.admin.query(m.sql);await f.admin.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[m.name,m.sha256]);}
 const user=await f.employee('investor'),p=await f.req('POST','/api/investors/profiles',{userId:user.id,nameAr:'مستثمر سابق',nameEn:'Legacy investor',companyId:f.co1});
 const ctx=async()=>{const c=await f.admin.connect();try{return{ledger:(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,manifest:await manifest(c)};}finally{c.release();}};
 const old=(await f.admin.query('select * from ab.investor_profiles where id=$1',[p.id])).rows[0],oldGuard=(await f.admin.query("select pg_get_functiondef('ab.investor_identity_guard()'::regprocedure)d")).rows[0].d;
 await f.admin.query("CREATE OR REPLACE FUNCTION ab.investor_identity_guard()RETURNS trigger LANGUAGE plpgsql AS $$BEGIN RETURN NEW;END$$");
 await assert.rejects(applyBusinessCenters(f.admin,await ctx(),{dryRun:true}),/INVESTOR_PRIOR_GUARD_OR_PRIVILEGES_CHANGED/);
 assert.equal((await f.admin.query("select to_regclass('ab.investor_agreement_versions')t")).rows[0].t,null);
 await f.admin.query(oldGuard);
 const backedUp=await ctx();assert.equal((await applyBusinessCenters(f.admin,backedUp,{dryRun:true})).applied,2);
 assert.equal((await f.admin.query('select * from ab.investor_profiles where id=$1',[p.id])).rows[0].identity_hash,undefined);
 assert.equal((await applyBusinessCenters(f.admin,backedUp,{rehearsed:true})).applied,2);
 const after=(await f.admin.query('select * from ab.investor_profiles where id=$1',[p.id])).rows[0];assert.equal(after.identity_hash,null);delete after.identity_hash;assert.deepEqual(after,old);
 assert.equal((await applyBusinessCenters(f.admin,await ctx(),{rehearsed:true})).applied,0);
 }finally{await f.close();}
});

test('reviewed 027 changes only the profile login guard, preserves existing rows and rejects an unknown prior trigger',async()=>{
 const f=await personnelFixture();try{
 await f.admin.query('CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz)');await f.admin.query('insert into auth.users(id,email,email_confirmed_at)select auth_id,auth_email,now()from ab.users');
 for(const m of await approvedCatalog())await f.admin.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)on conflict(name)do nothing',[m.name,m.sha256]);
 for(const m of businessCatalog().slice(0,-1)){await f.admin.query(m.sql);await f.admin.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[m.name,m.sha256]);}
 const ctx=async()=>{const c=await f.admin.connect();try{return{ledger:(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,manifest:await manifest(c)};}finally{c.release();}};
 const trigger=(await f.admin.query("select pg_get_triggerdef(oid)d from pg_trigger where tgrelid='ab.investor_profiles'::regclass and tgname='immutable_history'")).rows[0].d;
 await f.admin.query('DROP TRIGGER immutable_history ON ab.investor_profiles;CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.investor_profiles FOR EACH ROW EXECUTE FUNCTION ab.investor_identity_guard()');
 await assert.rejects(applyBusinessCenters(f.admin,await ctx(),{dryRun:true}),/INVESTOR_ORIGINAL_PROFILE_TRIGGER_CHANGED/);
 assert.equal((await f.admin.query("select to_regprocedure('ab.investor_link_login(uuid,uuid)')f")).rows[0].f,null);
 await f.admin.query('DROP TRIGGER immutable_history ON ab.investor_profiles;'+trigger);
 const backedUp=await ctx();assert.equal((await applyBusinessCenters(f.admin,backedUp,{dryRun:true})).applied,1);assert.equal((await applyBusinessCenters(f.admin,backedUp,{rehearsed:true})).applied,1);
 assert.equal((await applyBusinessCenters(f.admin,await ctx(),{rehearsed:true})).applied,0);
 }finally{await f.close();}
});
