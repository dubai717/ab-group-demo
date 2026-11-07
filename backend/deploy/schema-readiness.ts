// Read-only fast path. No backup/DDL on releases with no pending approved SQL.
import {Pool} from 'pg';
import {appendFileSync} from 'node:fs';
import {controllerContext} from './v2/context.mjs';
import {backupDatabaseTarget} from './backup-staging.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {sha} from '../src/core.js';
import {businessCatalog,validateBusinessLedger} from './business-centers-catalog.mjs';
import {approvedCatalog} from './safe-staging-additives.js';
import {actualRuntimeReads,runtimeOwner} from './business-centers-release.js';
const need=(v:unknown,c:string)=>{if(!v)throw Error(c);};
export async function schemaReadiness(admin:Pool,runtime:Pool){
 const c=await admin.connect();try{await c.query('BEGIN READ ONLY');
  const plan=businessCatalog(),ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,pending=validateBusinessLedger(ledger,await approvedCatalog(),plan);
  const canSet=(await c.query("select pg_has_role(session_user,'ab_runtime','SET') ok")).rows[0].ok===true;
  const owner=await runtimeOwner(c);await actualRuntimeReads(runtime,owner,pending.length?[]:plan.flatMap(m=>m.tables));
  need(!(await c.query("select 1 from pg_constraint where connamespace='ab'::regnamespace and not convalidated limit 1")).rowCount,'READINESS_INVALID_RELATION');
  need(!(await c.query("select 1 from ab.finance_journals j where j.status='Posted'and(select coalesce(sum(e.debit-e.credit),0)from ab.finance_entries e where e.journal_id=j.id)<>0 limit 1")).rowCount,'READINESS_UNBALANCED_JOURNAL');
  await c.query('ROLLBACK');return {pending:pending.length,canSet};
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
}
export async function runSchemaReadiness(){let admin:Pool|undefined,runtime:Pool|undefined;try{
 need(controllerContext(process.env),'READINESS_CONTEXT');const target=backupDatabaseTarget(process.env),cfg={uri:target.db.href,endpoint:target.endpoint.origin};need(sha(new URL(cfg.endpoint).origin)==='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f','READINESS_TARGET');
 const u=new URL(process.env.DATABASE_URL||''),a=new URL(cfg.uri);need(decodeURIComponent(u.username)==='ab_runtime.'+new URL(cfg.endpoint).hostname.split('.')[0]&&u.hostname===a.hostname&&u.port===a.port&&u.pathname===a.pathname&&[...u.searchParams.keys()].every(k=>k==='sslmode'),'READINESS_RUNTIME_TARGET');
 admin=new Pool({...databaseOptions(cfg.uri),max:1,options:'-c default_transaction_read_only=on -c timezone=UTC -c search_path=pg_catalog'});runtime=new Pool({...databaseOptions(u.href),max:1,options:'-c default_transaction_read_only=on'});
 for(const p of[admin,runtime]){p.on('error',()=>{});const c=await p.connect();try{assertVerifiedDatabaseTls(c);}finally{c.release();}}
 const r=await schemaReadiness(admin,runtime);need(process.env.GITHUB_OUTPUT,'READINESS_OUTPUT');appendFileSync(process.env.GITHUB_OUTPUT!,'pending='+r.pending+'\n');
 console.log('CHECK: OPERATOR_CAN_SET_RUNTIME='+r.canSet+'; ACTUAL_RUNTIME_AUTH_AND_SCOPED_READS_PASS');
 console.log('RESULT: '+(r.pending?'APPROVED_MIGRATIONS_REQUIRE_FRESH_RESTORED_BACKUP':'ORDINARY_STAGING_SCHEMA_READ_ONLY_READY')+'; PENDING='+r.pending+'; NO_SOURCE_WRITES');
 }catch(e){console.log('RESULT: READINESS_STOP; CODE='+(e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'DETAILS_WITHHELD'));process.exitCode=1;}finally{await admin?.end().catch(()=>{});await runtime?.end().catch(()=>{});}}
if(/[/\\]schema-readiness\.(ts|js)$/.test(process.argv[1]||''))await runSchemaReadiness();
