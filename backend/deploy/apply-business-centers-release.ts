// Privileged entry runs only from the pinned immutable protected controller.
import {Pool} from 'pg';
import {controllerContext} from './v2/context.mjs';
import {backupConnection} from './backup-staging.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {sha} from '../src/core.js';
import {verifiedBackup} from './staging-migration-rehearsal.js';
import {applyBusinessCenters} from './business-centers-release.js';
let local:Pool|undefined,remote:Pool|undefined,runtime:Pool|undefined;let stage='GUARD';
try{
 if(!controllerContext(process.env)||process.env.AB_STAGING_AUTOMATION!=='controlled-test-only'||sha(new URL(process.env.SUPABASE_URL||'').origin)!=='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f')throw Error('BUSINESS_PINNED_CONTROLLER_REQUIRED');
 const cfg=backupConnection(process.env),{context,proof}=await verifiedBackup();
 const u=new URL(process.env.DATABASE_URL||''),project=new URL(cfg.endpoint).hostname.split('.')[0];if(!['postgres:','postgresql:'].includes(u.protocol)||decodeURIComponent(u.username)!=='ab_runtime.'+project||!u.hostname.endsWith('.pooler.supabase.com')||(u.port||'5432')!=='5432'||u.pathname!=='/postgres'||[...u.searchParams.keys()].some(k=>k!=='sslmode')||u.searchParams.has('sslmode')&&u.searchParams.get('sslmode')!=='verify-full')throw Error('BUSINESS_RUNTIME_TARGET');
 runtime=new Pool({...databaseOptions(u.href),max:1,options:'-c default_transaction_read_only=on'});runtime.on('error',()=>{});const rc=await runtime.connect();try{assertVerifiedDatabaseTls(rc);const role=(await rc.query('select current_user n,rolsuper,rolbypassrls from pg_roles where rolname=current_user')).rows[0];if(role?.n!=='ab_runtime'||role.rolsuper||role.rolbypassrls||(await rc.query('select count(*)::int n from ab.companies')).rows[0].n!==0)throw Error('BUSINESS_RUNTIME_AUTH_OR_ISOLATION');}finally{rc.release();}console.log('CHECK: REAL_RUNTIME_AUTH_TLS_AND_UNSCOPED_DENIAL_PASS');
 if(proof.sourceCommit!==process.env.AB_STAGING_SOURCE_SHA||proof.sourceReadOnly!==true)throw Error('BUSINESS_CURRENT_BACKUP_REQUIRED');
 stage='RESTORED_COPY_REHEARSAL';local=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1,options:'-c timezone=UTC -c search_path=pg_catalog'});local.on('error',()=>{});
 const rehearsed=await applyBusinessCenters(local,context,{dryRun:true});console.log('CHECK: BUSINESS_MIGRATIONS_ON_RESTORED_COPY_PASS; ORIGINAL_ROWS_BALANCES_GRANTS_AUTH_STORAGE_AND_RELATIONSHIPS_PRESERVED; COUNT='+rehearsed.applied);
 stage='PINNED_STAGING_TRANSACTION';remote=new Pool({...databaseOptions(cfg.uri),max:1,options:'-c timezone=UTC -c search_path=pg_catalog'});remote.on('error',()=>{});const c=await remote.connect();try{assertVerifiedDatabaseTls(c);}finally{c.release();}
 const applied=await applyBusinessCenters(remote,context,{rehearsed:true});if(applied.applied!==rehearsed.applied)throw Error('BUSINESS_LEDGER_RACE');
 console.log('RESULT: BUSINESS_SCHEMA_READY; APPLIED='+applied.applied+'; OWNER_IDENTITY_AND_CURRENT_GRANTS_UNCHANGED; NO_RESET_OR_DATA_DELETION');
}catch(error){console.log('RESULT: BUSINESS_MIGRATION_STOP; STAGE='+stage+'; CODE='+(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DETAILS_WITHHELD')+'; NO_DESTRUCTIVE_ROLLBACK; INSPECT_LEDGER_BEFORE_RETRY');process.exitCode=1;}finally{await runtime?.end().catch(()=>{});await remote?.end().catch(()=>{});await local?.end().catch(()=>{});}
