// New clean project ONLY. Every database transaction is read-only; no HTTP provider calls.
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {connectionDiagnostic} from '../src/connection-diagnostics.js';
const ref='rdsqerenobigacmetrvv';
function need(ok:unknown,code:string):asserts ok {if(!ok)throw Error(code);}
let pool:Pool|undefined,stage='CONTEXT';
const codes=new Set(['RUNNER_CONTEXT','MISSING_PROTECTED_URL','TARGET_MISMATCH','CONNECTION_OVERRIDES','SCHEMA_LEDGER','SOURCE_HASH','TABLES_MISSING','RELATIONSHIPS_INVALID','RLS_POLICIES_INVALID','RUNTIME_FLAGS','RUNTIME_PRIVILEGES','OWNER_IDENTITY','OWNER_ROLE','BUCKET_PRIVATE','STORAGE_POLICY_REVIEW','BUSINESS_ROWS_PRESENT']);
try {
 const e=process.env;
 need(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&e.GITHUB_REF==='refs/heads/verify/clean-project-readonly-20261105'&&e.GITHUB_EVENT_NAME==='push','RUNNER_CONTEXT');
 need(e.MIGRATION_DATABASE_URL,'MISSING_PROTECTED_URL');
 const u=new URL(e.MIGRATION_DATABASE_URL);
 need(['postgres:','postgresql:'].includes(u.protocol)&&decodeURIComponent(u.username)==='postgres.'+ref&&u.hostname.endsWith('.pooler.supabase.com')&&(u.port||'5432')==='5432'&&u.pathname==='/postgres'&&!!u.password&&!u.hash,'TARGET_MISMATCH');
 need([...u.searchParams.keys()].every(k=>k==='sslmode'),'CONNECTION_OVERRIDES');
 stage='TLS_CONNECTION';
 pool=new Pool({...databaseOptions(u.href),max:1,options:'-c default_transaction_read_only=on'});pool.on('error',()=>{});
 const c=await pool.connect();
 try {
  assertVerifiedDatabaseTls(c);await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  need((await c.query("select current_setting('transaction_read_only') flag")).rows[0].flag==='on','RUNNER_CONTEXT');
  console.log('CHECK: NEW_PROJECT_PIN_VERIFIED_TLS_AND_READ_ONLY_CONNECTION=PASS');
  stage='SCHEMA_LEDGER';
  const first=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations;
  const plan=JSON.parse(await readFile('backend/deploy/personnel-release-plan.json','utf8'));
  const migrations=[...first.map((m:any)=>({...m,path:'supabase/migrations/'+m.name})),...plan.migrations];
  const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations')).rows;
  need(ledger.length===13&&migrations.length===13,'SCHEMA_LEDGER');
  const expected=new Set<string>();
  for(const m of migrations){const body=await readFile(m.path,'utf8');need(createHash('sha256').update(body).digest('hex')===m.sha256,'SOURCE_HASH');need(ledger.some(x=>x.name===m.name&&x.sha256===m.sha256),'SCHEMA_LEDGER');for(const match of body.matchAll(/CREATE TABLE ab\.([a-z_]+)/g))expected.add(match[1]);}
  const tables=(await c.query("select c.relname,c.relrowsecurity,c.relowner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind in('r','p')")).rows;
  need([...expected].every(t=>tables.some(r=>r.relname===t)),'TABLES_MISSING');
  const constraints=(await c.query("select count(*) filter(where contype='f')::int fks,count(*) filter(where not convalidated)::int invalid from pg_constraint where connamespace='ab'::regnamespace")).rows[0];
  need(constraints.fks>0&&constraints.invalid===0,'RELATIONSHIPS_INVALID');
  const policies=(await c.query("select tablename from pg_policies where schemaname='ab'")).rows;
  for(const t of ['organizations','users','companies','bank_accounts','audit_events',...plan.rlsTables])need(tables.some(r=>r.relname===t&&r.relrowsecurity)&&policies.some(r=>r.tablename===t),'RLS_POLICIES_INVALID');
  console.log('CHECK: MIGRATIONS_001_013_EXACT_HASHES_TABLES_RELATIONSHIPS_AND_RLS=PASS');
  stage='RUNTIME_CATALOG';
  const role=(await c.query("select oid,rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname='ab_runtime'")).rows[0];
  need(role?.rolcanlogin&&!role.rolsuper&&!role.rolbypassrls&&!role.rolcreatedb&&!role.rolcreaterole&&!role.rolreplication&&!tables.some(t=>String(t.relowner)===String(role.oid)),'RUNTIME_FLAGS');
  need((await c.query('select count(*)::int n from pg_auth_members where member=$1',[role.oid])).rows[0].n===0,'RUNTIME_FLAGS');
  const grants=(await c.query("select has_schema_privilege('ab_runtime','ab','USAGE') a,has_table_privilege('ab_runtime','ab.users','SELECT') b,has_table_privilege('ab_runtime','ab.companies','SELECT,INSERT,UPDATE') c,has_table_privilege('ab_runtime','ab.bank_accounts','SELECT,INSERT,UPDATE') d")).rows[0];
  need(Object.values(grants).every(x=>x===true),'RUNTIME_PRIVILEGES');
  console.log('CHECK: RUNTIME_RESTRICTIVE_FLAGS_OWNERSHIP_AND_CATALOG_PRIVILEGES=PASS');
  stage='OWNER';
  const owners=(await c.query("select count(*)::int total,count(*) filter(where u.role_id='owner' and u.status='Active' and u.username='owner' and r.id='owner' and a.id is not null and a.email=u.auth_email and a.email_confirmed_at is not null and a.deleted_at is null and (a.banned_until is null or a.banned_until<=now()))::int valid from ab.users u left join ab.roles r on r.id=u.role_id left join auth.users a on a.id=u.auth_id")).rows[0];
  need(owners.total===1&&owners.valid===1&&(await c.query('select count(*)::int n from auth.users')).rows[0].n===1,'OWNER_IDENTITY');
  const roleData=(await c.query("select count(*)::int n from ab.role_permissions where role_id='owner'")).rows[0].n;need(roleData>0,'OWNER_ROLE');
  console.log('CHECK: SINGLE_ACTIVE_CONFIRMED_OWNER_AUTH_MAPPING_AND_ROLE=PASS');
  stage='PRIVATE_STORAGE';
  const bucket=(await c.query('select id,public from storage.buckets where id=$1',['ab-private-test'])).rows[0];
  need(bucket&&bucket.public===false,'BUCKET_PRIVATE');
  // Conservative: flag any browser-facing storage policy for review; never grant access.
  const browserPolicies=(await c.query("select count(*)::int n from pg_policies where schemaname='storage' and tablename='objects' and roles && ARRAY['public','anon','authenticated']::name[]")).rows[0].n;
  need(browserPolicies===0,'STORAGE_POLICY_REVIEW');
  console.log('CHECK: PRIVATE_BUCKET_AND_NO_BROWSER_OBJECT_POLICIES=PASS');
  stage='CLEAN_BUSINESS_COUNTS';
  for(const t of ['companies','bank_accounts','customers','vehicles','vehicle_funds','vehicle_invoices','finance_receipts','tasks']){
   need(tables.some(r=>r.relname===t),'TABLES_MISSING');
   need((await c.query('select count(*)::int n from ab.'+t)).rows[0].n===0,'BUSINESS_ROWS_PRESENT');
  }
  console.log('CHECK: NO_COMPANIES_BANK_ACCOUNTS_CUSTOMERS_VEHICLES_FINANCINGS_INVOICES_RECEIPTS_OR_TASKS=PASS');
  await c.query('ROLLBACK');
  console.log('PENDING: INDEPENDENT_AB_RUNTIME_PASSWORD_LOGIN_AND_AUTH_API_AND_STORAGE_HTTP_NOT_TESTED');
  console.log('RESULT: NEW_CLEAN_PROJECT_READ_ONLY_AUDIT_PASS_NO_WRITES_OR_DEPLOYMENT');
 }finally {await c.query('ROLLBACK').catch(()=>{});c.release();}
}catch(error){const err=error as any;const code=codes.has(err?.message)?err.message:connectionDiagnostic(err);console.log('RESULT: CLEAN_READ_ONLY_AUDIT_STOP; STAGE='+stage+'; CODE='+code+'; DETAILS_WITHHELD');process.exitCode=1;}
finally {await pool?.end().catch(()=>{});}
