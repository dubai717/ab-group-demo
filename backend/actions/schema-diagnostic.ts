// Catalog/permission diagnosis only: no migration, GRANT, ALTER or test data writes.
import {Pool} from 'pg';
import {readFile,readdir} from 'node:fs/promises';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {sha} from '../src/core.js';
import {approvedActionsContext,checkSchema} from './supabase-check.js';
export function schemaProbeId(sql:string):string{
 if(sql==='SET LOCAL ROLE ab_runtime')return 'OPERATOR_SET_RUNTIME_ROLE';
 if(sql.includes('public.ab_schema_migrations'))return 'MIGRATION_LEDGER';
 if(sql.includes('pg_class'))return 'TABLE_RLS_FLAGS';
 if(sql.includes('pg_roles'))return 'RUNTIME_ROLE_ATTRIBUTES';
 if(sql.includes('has_table_privilege'))return 'PROTECTED_TABLE_PRIVILEGES';
 if(sql.includes('has_schema_privilege'))return 'BROWSER_SCHEMA_PRIVILEGES';
 if(sql.includes('pg_proc'))return 'PUBLIC_FUNCTION_EXECUTION';
 if(sql.includes('pg_constraint'))return 'INTEGRITY_CONSTRAINTS';
 if(sql.includes('pg_trigger'))return 'INTEGRITY_TRIGGERS';
 if(sql.includes("set_config('ab.tenant'"))return 'RUNTIME_CONTEXT';
 if(sql.includes('ab.companies'))return 'RUNTIME_COMPANIES_RLS';
 if(sql.includes('ab.bank_accounts'))return 'RUNTIME_BANKS_RLS';
 return 'TRANSACTION_CONTROL';
}
export async function diagnoseSchema(pool:Pool){
 const c=await pool.connect();let expectedCount=0;
 try{
  assertVerifiedDatabaseTls(c);
  await c.query('BEGIN READ ONLY');
  const dir=new URL('../../supabase/migrations/',import.meta.url);
  const manifest=JSON.parse(await readFile(new URL('./approved-migrations.json',import.meta.url),'utf8'));
  const files=(await readdir(dir)).filter(x=>x.endsWith('.sql')).sort();
  const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows;
  if(ledger.length!==8||files.length!==8)throw Error('migration count mismatch');
  const expectedTables:string[]=[];
  for(const entry of manifest.migrations){const sql=await readFile(new URL(entry.name,dir),'utf8');if(sha(sql)!==entry.sha256||!ledger.some(r=>r.name===entry.name&&r.sha256===entry.sha256))throw Error('checksum mismatch');for(const m of sql.matchAll(/\bCREATE TABLE ab\.([a-z_]+)/g))expectedTables.push(m[1]);}
  const tables=(await c.query("select tablename from pg_tables where schemaname='ab'")).rows.map(r=>r.tablename);
  if(expectedTables.some(t=>!tables.includes(t)))throw Error('missing application table');expectedCount=new Set(expectedTables).size;
  const fks=(await c.query("select count(*)::int total,count(*) filter(where convalidated)::int validated from pg_constraint where connamespace='ab'::regnamespace and contype='f'")).rows[0];
  if(!fks.total||fks.total!==fks.validated)throw Error('unvalidated relationships');
  const role=(await c.query("select rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname='ab_runtime'")).rows[0];
  if(!role||!role.rolcanlogin||role.rolsuper||role.rolbypassrls||role.rolcreaterole||role.rolcreatedb)throw Error('unsafe runtime role');
  const access=(await c.query("select has_schema_privilege('ab_runtime','ab','USAGE') schema_usage,has_table_privilege('ab_runtime','ab.companies','SELECT') companies_select,has_table_privilege('ab_runtime','ab.companies','INSERT') companies_insert,has_table_privilege('ab_runtime','ab.companies','UPDATE') companies_update,has_table_privilege('ab_runtime','ab.bank_accounts','SELECT') bank_select,has_table_privilege('ab_runtime','ab.bank_accounts','INSERT') bank_insert,has_table_privilege('ab_runtime','ab.bank_accounts','UPDATE') bank_update")).rows[0];
  if(Object.values(access).some(v=>v!==true))throw Error('runtime data privilege missing');
  const version=Number((await c.query("select current_setting('server_version_num') version")).rows[0].version);
  const rolePrivilege=version>=160000?'SET':'MEMBER';
  const operator=(await c.query("select current_user inspection_role,session_user connection_role,pg_has_role(session_user,'ab_runtime',$1) can_set_runtime",[rolePrivilege])).rows[0];
  const safeRole=(x:string)=>['postgres','ab_runtime','supabase_admin'].includes(x)?x:'OTHER_ROLE';
  console.log(`PASS: eight approved ledger checksums; expected_tables=${expectedCount}; validated_foreign_keys=${fks.validated}; runtime login/schema/company/bank privileges present`);
  console.log(`OPERATOR: inspection_role=${safeRole(operator.inspection_role)}; connection_role=${safeRole(operator.connection_role)}; can_set_ab_runtime=${operator.can_set_runtime===true}`);
 }finally{await c.query('ROLLBACK');c.release();}
 let failedProbe='',sqlstate='';const passed=new Set<string>();
 const instrumented={connect:async()=>{
  const client=await pool.connect();
  return {query:async(sql:string,values?:unknown[])=>{const id=schemaProbeId(sql);try{const r=await client.query(sql,values as any[]);if(id!=='TRANSACTION_CONTROL'){passed.add(id);console.log('SCHEMA_PROBE: '+id+' PASS');}return r;}catch(e:any){if(!failedProbe){failedProbe=id;sqlstate=['42501','23514','42P01','42883'].includes(e?.code)?e.code:'WITHHELD';}throw Error('schema probe failed');}},release:()=>client.release()};
 }} as unknown as Pool;
 try{await checkSchema(instrumented);console.log('PASS: catalog and runtime RLS execution checks complete');return {operatorOnly:false,verified:true};}
 catch{
  console.log(`SCHEMA_FAILURE: operation=${failedProbe||'UNKNOWN'}; sqlstate=${sqlstate||'WITHHELD'}`);
  if(failedProbe==='OPERATOR_SET_RUNTIME_ROLE'&&sqlstate==='42501'){
   console.log('DIAGNOSIS: inspection connection cannot SET ROLE ab_runtime; this requires SET-role membership, not a grant on an application table. Catalog checks passed; runtime RLS execution remains untested.');
   return {operatorOnly:true,verified:false};
  }
  throw Error('application or inspection issue requires review');
 }
}
export async function run(){
 let pool:Pool|undefined;try{
  if(!approvedActionsContext(process.env))throw Error('unauthorized context');
  if(!process.env.MIGRATION_DATABASE_URL||!process.env.SUPABASE_URL)throw Error('missing protected configuration');
  const ref=new URL(process.env.SUPABASE_URL).hostname.split('.')[0];const db=new URL(process.env.MIGRATION_DATABASE_URL);
  if(!/^[a-z0-9]{20}$/.test(ref)||db.username!=='postgres.'+ref||!db.hostname.endsWith('.pooler.supabase.com')||(db.port||'5432')!=='5432')throw Error('target mismatch');
  pool=new Pool({...databaseOptions(db.href),max:1});pool.on('error',()=>{process.exitCode=1;console.log('STOP: database connection lost; details withheld');});
  const result=await diagnoseSchema(pool);
  if(result.operatorOnly)console.log('RESULT: INSPECTOR_ROLE_SWITCH_DENIED; no privileges changed; runtime trial requires a separately authorized runtime connection.');
 }catch{console.log('STOP: read-only diagnosis failed; no provider/secret values logged');process.exitCode=1;}
 finally{if(pool)await pool.end();}
}
if(process.argv[1]?.endsWith('/schema-diagnostic.ts')||process.argv[1]?.endsWith('/schema-diagnostic.js'))await run();
