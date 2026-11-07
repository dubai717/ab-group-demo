// Approved 009–013 only. No generic arbitrary SQL, down migrations, deletes or grant changes.
import {Pool,PoolClient} from 'pg';
import {readFile} from 'node:fs/promises';
import {sha} from '../src/core.js';
import {personnelReleasePlan} from './personnel-release.js';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
type Snapshot={tables:{s:string;t:string;cols:string[];hashes:string[]}[];grants:any[];policies:any[];functions:any[]};
async function projectedHashes(c:PoolClient,tables:{s:string;t:string;cols:string[]}[]){
 const result=new Map(tables.map(t=>[t.s+'.'+t.t,[]as string[]]));
 for(const t of tables)need([t.s,t.t,...t.cols].every(n=>/^[a-z][a-z0-9_]*$/.test(n)),'PRESERVED_IDENTIFIER');
 if(tables.length){const rows=(await c.query(tables.map(t=>`select '${t.s}.${t.t}'::text k,row_to_json(x)::text j from(select ${t.cols.map(qi).join(',')} from ${qi(t.s)}.${qi(t.t)})x`).join(' union all '))).rows;for(const r of rows)result.get(r.k)!.push(sha(r.j));}
 for(const values of result.values())values.sort();return result;
}
export async function preserveSnapshot(c:PoolClient):Promise<Snapshot>{
 const tables=(await c.query("select n.nspname s,c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='ab' or(n.nspname='public'and c.relname='ab_schema_migrations'))and c.relkind in('r','p') order by 1,2")).rows;
 const result:Snapshot={tables:[],grants:[],policies:[],functions:[]};
 const columns=(await c.query("select n.nspname s,t.relname t,a.attname from pg_attribute a join pg_class t on t.oid=a.attrelid join pg_namespace n on n.oid=t.relnamespace where (n.nspname='ab' or(n.nspname='public' and t.relname='ab_schema_migrations'))and t.relkind in('r','p')and a.attnum>0 and not a.attisdropped order by 1,2,a.attnum")).rows;
 const projections=tables.map(t=>({...t,cols:columns.filter(a=>a.s===t.s&&a.t===t.t).map(a=>a.attname)})),hashes=await projectedHashes(c,projections);
 for(const t of projections)result.tables.push({...t,hashes:hashes.get(t.s+'.'+t.t)!});
 result.grants=(await c.query("select table_schema,table_name,grantee,privilege_type,is_grantable from information_schema.table_privileges where table_schema='ab' order by 1,2,3,4,5")).rows;
 result.policies=(await c.query("select * from pg_policies where schemaname='ab' order by tablename,policyname")).rows;
 result.functions=(await c.query("select p.oid::text id,pg_get_functiondef(p.oid) def,p.proacl::text acl,p.prosecdef sec,p.proowner::text owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ab' order by p.oid")).rows;
 return result;
}
export async function assertPreserved(c:PoolClient,before:Snapshot){
 const hashes=await projectedHashes(c,before.tables);
 for(const t of before.tables){const after=hashes.get(t.s+'.'+t.t)!;
  const additive=t.s==='public'&&t.t==='ab_schema_migrations'||t.s==='ab'&&t.t==='permissions';
  if(!additive)need(JSON.stringify(after)===JSON.stringify(t.hashes),'EXISTING_ROWS_CHANGED');else{const counts=new Map<string,number>();for(const h of after)counts.set(h,(counts.get(h)||0)+1);for(const h of t.hashes){need((counts.get(h)||0)>0,'EXISTING_CATALOG_ROW_LOST');counts.set(h,counts.get(h)!-1);}}
 }
 const grants=(await c.query("select table_schema,table_name,grantee,privilege_type,is_grantable from information_schema.table_privileges where table_schema='ab' order by 1,2,3,4,5")).rows.filter(r=>before.tables.some(t=>t.s===r.table_schema&&t.t===r.table_name));need(JSON.stringify(grants)===JSON.stringify(before.grants),'EXISTING_GRANTS_CHANGED');
 const policies=(await c.query("select * from pg_policies where schemaname='ab' order by tablename,policyname")).rows;for(const p of before.policies)need(policies.some(a=>JSON.stringify(a)===JSON.stringify(p)),'EXISTING_POLICY_CHANGED');
 const functions=new Map((await c.query('select p.oid::text id,pg_get_functiondef(p.oid) def,p.proacl::text acl,p.prosecdef sec,p.proowner::text owner from pg_proc p where p.oid=any($1::oid[])',[before.functions.map(f=>f.id)])).rows.map(f=>[f.id,f]));
 for(const f of before.functions)need(JSON.stringify(functions.get(f.id))===JSON.stringify(f),'EXISTING_FUNCTION_CHANGED');
}
export async function applyPreservingRelease(pool:Pool,backupContext:any){
 const plan=await personnelReleasePlan(),base=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations,c=await pool.connect();try{
  await c.query('BEGIN');await c.query("set local lock_timeout='10s'");await c.query("set local statement_timeout='120s'");await c.query("select pg_advisory_xact_lock(hashtext('ab-schema-migrations'))");
  const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations')).rows;need(ledger.length===8&&base.every((m:any)=>ledger.some(r=>r.name===m.name&&r.sha256===m.sha256)),'BASE_LEDGER_CHANGED');
  const names=(await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab'and c.relkind in('r','p') order by relname")).rows.map(r=>r.relname);await c.query('LOCK TABLE '+names.map(n=>'ab.'+qi(n)).join(',')+' IN SHARE ROW EXCLUSIVE MODE');
  // Match current application rows to the actually restored snapshot before any DDL.
  for(const t of backupContext.manifest.rows.filter((r:any)=>r.s==='ab')){const now=(await c.query(`select count(*)::text n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by md5(row_to_json(x)::text)),'')) h from ab.${qi(t.t)} x`)).rows[0];need(now.n===t.n&&now.h===t.h,'SOURCE_CHANGED_SINCE_BACKUP');}
  const preserved=await preserveSnapshot(c);
  for(const m of plan.migrations){need(!(await c.query('select to_regclass($1) t',[m.guardTable])).rows[0].t,'UNTRACKED_TARGET_TABLE');await c.query(await readFile(m.path,'utf8'));await c.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[m.name,m.sha256]);}
  await assertPreserved(c,preserved);
  need(Number((await c.query("select count(*)n from pg_constraint where connamespace='ab'::regnamespace and not convalidated")).rows[0].n)===0,'UNVALIDATED_RELATION');
  const states=(await c.query("select c.relname,c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind='r' and c.relname=any($1::text[])",[plan.rlsTables])).rows;need(states.length===plan.rlsTables.length&&states.every(r=>r.relrowsecurity),'RLS_NOT_READY');
  await c.query('COMMIT');return {applied:5,originalTablesPreserved:preserved.tables.length};
 }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}}
