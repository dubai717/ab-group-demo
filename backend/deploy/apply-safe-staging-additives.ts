import {controllerContext} from './v2/context.mjs';
import {Pool} from 'pg';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {sha} from '../src/core.js';
import {verifiedBackup} from './staging-migration-rehearsal.js';
import {preserveSnapshot,assertPreserved} from './preserved-staging-release.js';
import {validateStagingLedger} from './safe-staging-additives.js';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
async function apply(pool:Pool,context:any){const c=await pool.connect();try{
 await c.query('BEGIN');await c.query("set local lock_timeout='10s'");await c.query("set local statement_timeout='120s'");await c.query("select pg_advisory_xact_lock(hashtext('ab-schema-migrations'))");
 const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,pending=await validateStagingLedger(ledger);
 if(!pending.length){await c.query('ROLLBACK');return 0;}
 const names=(await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab'and c.relkind='r'order by relname")).rows.map(r=>r.relname);
 await c.query('LOCK TABLE '+names.map(n=>'ab."'+n.replaceAll('"','""')+'"').join(',')+' IN SHARE ROW EXCLUSIVE MODE');
 for(const t of context.manifest.rows.filter((r:any)=>r.s==='ab')){const row=(await c.query(`select count(*)::text n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by md5(row_to_json(x)::text)),'')) h from ab."${t.t.replaceAll('"','""')}" x`)).rows[0];need(row.n===t.n&&row.h===t.h,'SOURCE_CHANGED_SINCE_BACKUP');}
 const before=await preserveSnapshot(c);for(const m of pending){for(const sql of m.sql)await c.query(sql);await c.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[m.name,m.sha256]);}await assertPreserved(c,before);await c.query('COMMIT');return pending.length;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
let local:Pool|undefined,remote:Pool|undefined;try{
 need((controllerContext(process.env)||process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&process.env.GITHUB_EVENT_NAME==='push'&&(process.env.GITHUB_REF==='refs/heads/staging/ab-group-test'||process.env.GITHUB_REF==='refs/heads/verify/staging-delivery-preflight-20261104'&&process.argv.includes('--rehearse-only')))&&process.env.AB_STAGING_AUTOMATION==='controlled-test-only','CONTEXT');
 const u=new URL(process.env.SUPABASE_URL||''),d=new URL(process.env.MIGRATION_DATABASE_URL||'');need(sha(u.origin)==='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f'&&decodeURIComponent(d.username)==='postgres.'+u.hostname.split('.')[0]&&d.hostname.endsWith('.pooler.supabase.com')&&(d.port||'5432')==='5432'&&d.pathname==='/postgres'&&[...d.searchParams.keys()].every(k=>k==='sslmode'),'TARGET_PIN');
 const {context}=await verifiedBackup();
 local=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1,options:'-c timezone=UTC -c search_path=pg_catalog'});local.on('error',()=>{});const rehearsed=await apply(local,context);console.log('CHECK: DECLARATIVE_ADDITIVES_REHEARSED='+rehearsed);
 let applied=0;if(!process.argv.includes('--rehearse-only')){remote=new Pool({...databaseOptions(d.href),max:1,options:'-c timezone=UTC -c search_path=pg_catalog'});remote.on('error',()=>{});const c=await remote.connect();try{assertVerifiedDatabaseTls(c);}finally{c.release();}applied=await apply(remote,context);need(applied===rehearsed,'LEDGER_RACE');}
 console.log('RESULT: SAFE_ADDITIVE_SCHEMA_READY; REHEARSAL_ONLY='+process.argv.includes('--rehearse-only')+'; APPLIED='+applied+'; OLD_DATA_AND_PRIVILEGES_PRESERVED');
}catch(error){const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'WITHHELD';console.log('RESULT: SAFE_ADDITIVE_STOP; CODE='+code+'; INSPECT_LEDGER_BEFORE_RETRY; NO_DESTRUCTIVE_ROLLBACK');process.exitCode=1;}finally{await remote?.end().catch(()=>{});await local?.end().catch(()=>{});}
