// Disposable localhost PostgreSQL only. Never consumes environment connection strings.
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const pool=new Pool({host:'127.0.0.1',port:5548,user:'postgres',database:'ab_clean_kit',ssl:false});
const c=await pool.connect();
try {
 const sql=await readFile('/tmp/ab-clean-kit/clean-schema.sql','utf8');
 await c.query(sql);
 const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows;
 const manifest=JSON.parse(await readFile('/tmp/ab-clean-kit/manifest.json','utf8'));
 assert.equal(ledger.length,13);
 for(const m of manifest.migrations)assert(ledger.some(r=>r.name===m.name&&r.sha256===m.sha256));
 console.log('CHECK: MIGRATIONS_001_013_LEDGER_OK');
 const tables=(await c.query("select tablename from pg_tables where schemaname='ab' order by tablename")).rows;
 const reference=new Set(['roles','permissions','role_permissions']);
 for(const {tablename} of tables){
  assert.match(tablename,/^[a-z_]+$/);
  const n=(await c.query(`select count(*)::int n from ab.${tablename}`)).rows[0].n;
  if(!reference.has(tablename))assert.equal(n,0,`Unexpected initial data: ${tablename}`);
 }
 console.log('CHECK: NO_USERS_BUSINESS_DATA_OR_SETTINGS_IMPORTED');
 const plan=JSON.parse(await readFile('backend/deploy/personnel-release-plan.json','utf8'));
 for(const name of ['organizations','users','companies','bank_accounts','audit_events',...plan.rlsTables]){
  const r=(await c.query("select relrowsecurity from pg_class where oid=to_regclass($1)",['ab.'+name])).rows[0];
  assert(r?.relrowsecurity,`RLS missing: ${name}`);
  assert((await c.query('select 1 from pg_policy where polrelid=to_regclass($1)',['ab.'+name])).rowCount);
 }
 assert.equal((await c.query('select count(*)::int n from pg_constraint where connamespace=\'ab\'::regnamespace and not convalidated')).rows[0].n,0);
 const role=(await c.query("select rolsuper,rolbypassrls,rolcreatedb,rolcreaterole from pg_roles where rolname='ab_runtime'")).rows[0];
 assert(Object.values(role).every(v=>v===false));
 console.log('CHECK: RLS_POLICIES_CONSTRAINTS_AND_RUNTIME_FLAGS_OK');
 // A second invocation must abort before modifying schema or data.
 await assert.rejects(c.query(sql),/CLEAN_PROJECT_REQUIRED/);await c.query('ROLLBACK');
 assert.equal((await c.query('select count(*)::int n from public.ab_schema_migrations')).rows[0].n,13);
 console.log('CHECK: NONEMPTY_PROJECT_REJECTED_WITHOUT_CHANGE');
 // Only this isolated disposable database receives synthetic rows. Roll back everything.
 await c.query('BEGIN');
 const tenant=randomUUID(),other=randomUUID(),actor=randomUUID(),company=randomUUID();
 await c.query("insert into ab.organizations(id,name) values($1,'Isolated kit test'),($2,'Other isolated tenant')",[tenant,other]);
 await c.query("insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status) values($1,$2,$3,'kit@example.invalid','kit_owner','owner','Active')",[actor,tenant,randomUUID()]);
 await c.query('SET LOCAL ROLE ab_runtime');
 await c.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[tenant,actor]);
 await c.query("insert into ab.companies(id,tenant_id,data,created_by) values($1,$2,'{\"englishName\":\"Isolated company\"}',$3)",[company,tenant,actor]);
 assert.equal((await c.query('select id from ab.companies where id=$1',[company])).rowCount,1);
 await c.query("select set_config('ab.tenant',$1,true)",[other]);
 assert.equal((await c.query('select id from ab.companies where id=$1',[company])).rowCount,0);
 await c.query('ROLLBACK');
 assert.equal((await c.query('select count(*)::int n from ab.companies')).rows[0].n,0);
 console.log('CHECK: COMPANY_CREATE_RETRIEVE_CROSS_TENANT_DENIAL_AND_ROLLBACK_OK');

 // Minimal Auth metadata mock ONLY in disposable local PostgreSQL. No real user/provider call.
 await c.query('create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz)');
 const ownerSql=await readFile('/tmp/ab-clean-kit/owner-only.sql','utf8');
 await assert.rejects(c.query(ownerSql),/EXACTLY_ONE_AUTH_OWNER_REQUIRED/);await c.query('ROLLBACK');
 await c.query("insert into auth.users(id,email) values($1,'owner@example.invalid')",[randomUUID()]);
 await assert.rejects(c.query(ownerSql),/CONFIRMED_ACTIVE_AUTH_OWNER_REQUIRED/);await c.query('ROLLBACK');
 await c.query('update auth.users set email_confirmed_at=now()');
 await c.query(ownerSql);
 assert.equal((await c.query('select count(*)::int n from ab.users')).rows[0].n,1);
 assert.equal((await c.query("select count(*)::int n from ab.users where role_id='owner' and username='owner' and status='Active'")).rows[0].n,1);
 assert.equal((await c.query('select count(*)::int n from ab.companies')).rows[0].n,0);
 assert.equal((await c.query("select count(*)::int n from ab.bank_references where kind='bank'")).rows[0].n,0);
 await assert.rejects(c.query(ownerSql),/OWNER_OR_ORGANIZATION_ALREADY_EXISTS/);await c.query('ROLLBACK');
 assert.equal((await c.query('select count(*)::int n from ab.users')).rows[0].n,1);
 console.log('CHECK: OWNER_ONLY_CONFIRMED_IDENTITY_NO_DUPLICATE_NO_DEMO_BANK_OK');
 console.log('RESULT: CLEAN_SCHEMA_KIT_ISOLATED_TESTS_OK_NO_CLOUD_CONNECTION');
} finally {c.release();await pool.end();}
