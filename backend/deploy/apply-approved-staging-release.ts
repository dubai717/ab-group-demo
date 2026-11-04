// Existing test project only, pinned approved SQL, actual restored backup and clone rehearsal required.
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {sha} from '../src/core.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {personnelReleaseGuard} from './personnel-release.js';
import {verifiedBackup} from './staging-migration-rehearsal.js';
import {applyPreservingRelease} from './preserved-staging-release.js';
let admin:Pool|undefined,runtime:Pool|undefined,stage='GUARD';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
try{
 const uri=personnelReleaseGuard(process.env);need(sha(new URL(process.env.SUPABASE_URL||'').origin)==='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f','PROJECT_PIN');
 const {context,proof}=await verifiedBackup(),rehearsal=JSON.parse(await readFile('work/personnel-release-restore-proof.json','utf8'));
 need(rehearsal.rehearsalVerified===true&&rehearsal.archiveSha256===proof.archiveSha256&&rehearsal.snapshotId===context.snapshotId&&rehearsal.migrationsApplied===5,'REHEARSAL_REQUIRED');
 stage='RUNTIME_BEFORE_MIGRATION';const d=new URL(process.env.DATABASE_URL||'');need(decodeURIComponent(d.username)==='ab_runtime.'+new URL(process.env.SUPABASE_URL!).hostname.split('.')[0]&&d.hostname.endsWith('.pooler.supabase.com')&&(d.port||'5432')==='5432'&&d.pathname==='/postgres'&&[...d.searchParams.keys()].every(k=>k==='sslmode'),'RUNTIME_TARGET');
 runtime=new Pool({...databaseOptions(d.href),max:1,options:'-c default_transaction_read_only=on'});runtime.on('error',()=>{});const pre=await runtime.connect();try{assertVerifiedDatabaseTls(pre);const row=(await pre.query('select current_user n,rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];need(row.n==='ab_runtime'&&!row.rolsuper&&!row.rolbypassrls,'RUNTIME_ROLE');}finally{pre.release();}
 stage='APPROVED_ATOMIC_MIGRATION';admin=new Pool({...databaseOptions(uri),max:1,statement_timeout:120000,options:'-c timezone=UTC -c search_path=pg_catalog'});admin.on('error',()=>{});
 const c=await admin.connect();try{assertVerifiedDatabaseTls(c);}finally{c.release();}
 const r=await applyPreservingRelease(admin,context);console.log('CHECK: MIGRATIONS_009_013_COMMITTED; ORIGINAL_ROWS_ROLES_GRANTS_POLICIES_AND_FUNCTIONS_PRESERVED; TABLES='+r.originalTablesPreserved);
 stage='RUNTIME_AFTER_MIGRATION';const rc=await runtime.connect();
 try{
  assertVerifiedDatabaseTls(rc);await rc.query('BEGIN READ ONLY');const role=(await rc.query('select current_user n,rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];need(role.n==='ab_runtime'&&!role.rolsuper&&!role.rolbypassrls,'RUNTIME_ROLE');need(Number((await rc.query('select count(*)n from ab.companies')).rows[0].n)===0,'TENANT_ISOLATION');await rc.query('ROLLBACK');
  const owner=(await admin.query("select u.id,u.tenant_id,u.auth_id,u.auth_email from ab.users u where role_id='owner'and status='Active'and exists(select 1 from ab.companies c where c.tenant_id=u.tenant_id)order by u.created_at limit 1")).rows[0];need(owner,'OWNER_REQUIRED');
  await rc.query('BEGIN READ ONLY');await rc.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[owner.tenant_id,owner.id]);need(Number((await rc.query('select count(*)n from ab.companies')).rows[0].n)>0,'OWNER_COMPANIES_ACCESS');await rc.query('select count(*) from ab.bank_accounts');for(const table of ['customers','vehicles','finance_journals','hr_employees','tasks'])await rc.query('select count(*) from ab.'+table);await rc.query('ROLLBACK');
  console.log('CHECK: VERIFIED_RUNTIME_RLS_OWNER_COMPANIES_BANKS_AND_NEW_MODULE_READS=PASS');
  const auth=(await admin.query('select email_confirmed_at is not null confirmed,banned_until is null or banned_until<=now() allowed,deleted_at is null retained,email=$2 email_matches from auth.users where id=$1',[owner.auth_id,owner.auth_email])).rows[0];need(auth?.confirmed&&auth.allowed&&auth.retained&&auth.email_matches,'OWNER_AUTH_IDENTITY');console.log('CHECK: EXISTING_OWNER_AUTH_IDENTITY_AND_STATUS_PRESERVED=PASS; PASSWORD_NOT_CHANGED_OR_TESTED');
 }finally{await rc.query('ROLLBACK').catch(()=>{});rc.release();}
 console.log('RESULT: STAGING_SCHEMA_13_READY; NO_EXISTING_DATA_ROLE_OR_CREDENTIAL_REPLACEMENT; NO_RENDER_DEPLOYMENT');
}catch(error){const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'WITHHELD';console.log('RESULT: STAGING_RELEASE_STOP; STAGE='+stage+'; CODE='+code+'; INSPECT_LEDGER_BEFORE_ANY_RETRY; NO_DESTRUCTIVE_ROLLBACK');process.exitCode=1;}
finally{await runtime?.end().catch(()=>{});await admin?.end().catch(()=>{});}
