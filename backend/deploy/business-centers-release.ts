// Exact reviewed SQL only. Every change is transactional; original rows and grants are compared.
import type {Pool,PoolClient} from 'pg';
import {manifest} from './backup-restore-drill.js';
import {preserveSnapshot,assertPreserved} from './preserved-staging-release.js';
import {approvedCatalog} from './safe-staging-additives.js';
import {businessCatalog,validateBusinessLedger} from './business-centers-catalog.mjs';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
async function integrity(c:PoolClient){
 need(!(await c.query("select 1 from pg_constraint where connamespace='ab'::regnamespace and not convalidated limit 1")).rowCount,'BUSINESS_UNVALIDATED_CONSTRAINT');
 need(!(await c.query("select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab'and c.relkind in('r','p')and c.relname=any($1::text[])and not c.relrowsecurity limit 1",[businessCatalog().flatMap(m=>m.tables)])).rowCount,'BUSINESS_RLS_DISABLED');
 need(!(await c.query("select 1 from ab.finance_journals j where j.status='Posted'and(select coalesce(sum(e.debit-e.credit),0)from ab.finance_entries e where e.journal_id=j.id)<>0 limit 1")).rowCount,'BUSINESS_UNBALANCED_JOURNAL');
}
async function guardSnapshot(c:PoolClient){
 const structure=await manifest(c),roles=(await c.query("select rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolconfig from pg_roles order by rolname")).rows,members=(await c.query('select * from pg_auth_members order by roleid,member,grantor')).rows;
 const columns=(await c.query("select n.nspname s,t.relname t,a.attname n,format_type(a.atttypid,a.atttypmod)type,a.attnotnull required,pg_get_expr(d.adbin,d.adrelid)def from pg_attribute a join pg_class t on t.oid=a.attrelid join pg_namespace n on n.oid=t.relnamespace left join pg_attrdef d on d.adrelid=t.oid and d.adnum=a.attnum where n.nspname='ab'and t.relkind in('r','p')and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum")).rows;
 const schemaAcl=(await c.query("select nspname,nspacl::text from pg_namespace where nspname in('ab','public','auth','storage')order by nspname")).rows;
 const columnAcl=(await c.query("select table_schema,table_name,column_name,grantee,privilege_type,is_grantable from information_schema.column_privileges where table_schema='ab'order by 1,2,3,4,5,6")).rows;
 return {structure,roles,members,columns,schemaAcl,columnAcl};
}
async function checkGuard(c:PoolClient,before:Awaited<ReturnType<typeof guardSnapshot>>,pending:string[]){
 const after=await guardSnapshot(c),columnMap=new Map(after.columns.map(x=>[x.s+'.'+x.t+'.'+x.n,x])),aclSet=new Set(after.columnAcl.map(x=>JSON.stringify(x)));
 for(const key of ['roles','members','schemaAcl']as const)need(JSON.stringify(before[key])===JSON.stringify(after[key]),'BUSINESS_EXISTING_SECURITY_CHANGED');
 for(const old of before.columns){const actual=columnMap.get(old.s+'.'+old.t+'.'+old.n);need(actual,'BUSINESS_COLUMN_LOST');const relaxed=pending.includes('023')&&['vehicle_invoices','finance_receipt_batches'].includes(old.t)&&old.n==='customer_id'||pending.includes('025')&&old.t==='marketing_contracts'&&old.n==='prospect_id';need(JSON.stringify(actual)===JSON.stringify(relaxed?{...old,required:false}:old),'BUSINESS_COLUMN_CHANGED');}
 for(const old of before.columnAcl)need(aclSet.has(JSON.stringify(old)),'BUSINESS_COLUMN_GRANT_LOST');
 const oldColumns=new Set(before.columns.map(x=>x.t+'.'+x.n));need(after.columnAcl.filter(x=>oldColumns.has(x.table_name+'.'+x.column_name)).length===before.columnAcl.length,'BUSINESS_COLUMN_GRANT_CHANGED');
 for(const kind of ['constraints','policies','triggers']as const){const values=new Set(after.structure[kind].map((x:any)=>JSON.stringify(x)));for(const old of before.structure[kind])need(values.has(JSON.stringify(old)),'BUSINESS_ORIGINAL_'+kind.toUpperCase()+'_CHANGED');}
 for(const t of before.structure.rows){const now=after.structure.rows.find((x:any)=>x.s===t.s&&x.t===t.t);need(now&&now.r===t.r&&now.f===t.f,'BUSINESS_ORIGINAL_RLS_CHANGED');if(['auth','storage'].includes(t.s))need(now.n===t.n&&now.h===t.h,'BUSINESS_AUTH_OR_STORAGE_CHANGED');}
}
async function runtimeReads(c:PoolClient,tables:string[]){
 const owner=(await c.query("select id,tenant_id,auth_id,auth_email from ab.users where role_id='owner'and status='Active'order by id limit 1")).rows[0];need(owner,'BUSINESS_OWNER_REQUIRED');
 const identity=(await c.query('select email=$2 matching,email_confirmed_at is not null confirmed,deleted_at is null retained,banned_until is null or banned_until<=now() allowed from auth.users where id=$1',[owner.auth_id,owner.auth_email])).rows[0];need(identity?.matching&&identity.confirmed&&identity.retained&&identity.allowed,'BUSINESS_OWNER_AUTH_IDENTITY');
 const role=(await c.query("select rolsuper,rolbypassrls from pg_roles where rolname='ab_runtime'")).rows[0];need(role&&!role.rolsuper&&!role.rolbypassrls,'BUSINESS_RUNTIME_ROLE');
 await c.query('SET LOCAL ROLE ab_runtime');await c.query("select set_config('ab.tenant','',true),set_config('ab.actor','',true)");need((await c.query('select count(*)::int n from ab.companies')).rows[0].n===0,'BUSINESS_UNSCOPED_ACCESS');
 await c.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[owner.tenant_id,owner.id]);
 for(const t of new Set(['companies','bank_accounts','customers','vehicles','finance_journals','tasks',...tables]))await c.query('select count(*) from ab.'+qi(t));
 await c.query('RESET ROLE');
}
export async function applyBusinessCenters(pool:Pool,backupContext:any,options:{rehearsed?:boolean;dryRun?:boolean}={}){
 const c=await pool.connect();try{
 await c.query('BEGIN');await c.query("set local lock_timeout='10s'");await c.query("set local statement_timeout='120s'");await c.query("select pg_advisory_xact_lock(hashtext('ab-schema-migrations'))");
 const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,plan=businessCatalog(),pending=validateBusinessLedger(ledger,await approvedCatalog(),plan);
 if(!pending.length){await integrity(c);await runtimeReads(c,plan.flatMap(m=>m.tables));await c.query('ROLLBACK');return {applied:0};}
 need(options.dryRun===true||options.rehearsed===true,'BUSINESS_REHEARSAL_REQUIRED');
 need(JSON.stringify(ledger)===JSON.stringify(backupContext.ledger),'BUSINESS_BACKUP_LEDGER_CHANGED');
 const names=(await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab'and c.relkind in('r','p')order by relname")).rows.map(r=>r.relname);await c.query('LOCK TABLE '+names.map(n=>'ab.'+qi(n)).join(',')+' IN SHARE ROW EXCLUSIVE MODE');
 for(const t of backupContext.manifest.rows.filter((r:any)=>r.s==='ab')){const now=(await c.query(`select count(*)::text n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by md5(row_to_json(x)::text)),'')) h from ab.${qi(t.t)} x`)).rows[0];need(now.n===t.n&&now.h===t.h,'BUSINESS_SOURCE_CHANGED_SINCE_BACKUP');}
 const before=await preserveSnapshot(c),guard=await guardSnapshot(c);await integrity(c);
 for(const m of pending){await c.query(m.sql);await c.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[m.name,m.sha256]);}
 await c.query('SET CONSTRAINTS ALL IMMEDIATE');await assertPreserved(c,before);await checkGuard(c,guard,pending.map(m=>m.name.slice(0,3)));await integrity(c);await runtimeReads(c,plan.flatMap(m=>m.tables));
 await c.query(options.dryRun?'ROLLBACK':'COMMIT');return {applied:pending.length};
 }catch(error){await c.query('ROLLBACK').catch(()=>{});throw error;}finally{c.release();}
}
