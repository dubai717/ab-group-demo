// Owner-approved eight migrations only. Never print provider errors, SQL rows or secrets.
import {Pool} from 'pg';
import {spawnSync} from 'node:child_process';
import {readFile,readdir,appendFile} from 'node:fs/promises';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {migrate} from '../src/migrate.js';
import {sha} from '../src/core.js';
import {checkSchema} from './supabase-check.js';
export const migrationBranch='refs/heads/verify/supabase-test-migrate-approved-20261102';
export function approvedMigrationContext(e:NodeJS.ProcessEnv){return e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&e.GITHUB_EVENT_NAME==='push'&&e.RUNNER_ENVIRONMENT==='github-hosted'&&e.GITHUB_REF===migrationBranch&&e.GITHUB_WORKFLOW_REF===`dubai717/ab-group-demo/.github/workflows/supabase-schema.yml@${migrationBranch}`;}
export async function approvedFiles(){
 const manifest=JSON.parse(await readFile(new URL('./approved-migrations.json',import.meta.url),'utf8'));
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 const files=(await readdir(dir)).filter(x=>x.endsWith('.sql')).sort();
 if(manifest.approvedSource!=='2d3d24d2c1355d877bf38f1d4af69b276a942b1b'||files.length!==8||JSON.stringify(files)!==JSON.stringify(manifest.migrations.map((x:any)=>x.name)))throw Error('unapproved migration set');
 const tables:string[]=[];
 for(const row of manifest.migrations){const sql=await readFile(new URL(row.name,dir),'utf8');if(sha(sql)!==row.sha256)throw Error('approved checksum mismatch');if(/\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i.test(sql.replace(/--[^\n]*/g,'')))throw Error('destructive statement');for(const m of sql.matchAll(/\bCREATE TABLE ab\.([a-z_]+)/g))tables.push(m[1]);}
 return {manifest,tables:[...new Set(tables)]};
}
export async function applyApprovedSchema(pool:Pool,files:Awaited<ReturnType<typeof approvedFiles>>){
 const before=(await pool.query("select c.oid::text oid,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema'")).rows;
 const state=(await pool.query("select to_regnamespace('ab') app,to_regclass('public.ab_schema_migrations') ledger")).rows[0];
 if(state.app&&!state.ledger)throw Error('existing unmanaged schema');
 const role=(await pool.query("select rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname='ab_runtime'")).rows[0];
 if(role&&Object.values(role).some(Boolean))throw Error('existing unsafe runtime role');
 await migrate(pool);
 const after=(await pool.query("select c.oid::text oid,n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema'")).rows;
 if(before.some(b=>!after.some(a=>a.oid===b.oid&&a.nspname===b.nspname&&a.relname===b.relname)))throw Error('pre-existing table changed');
 if(files.tables.some(name=>!after.some(a=>a.nspname==='ab'&&a.relname===name)))throw Error('expected tables missing');
 const invalid=(await pool.query("select 1 from pg_constraint where connamespace='ab'::regnamespace and contype='f' and not convalidated")).rowCount;
 if(invalid)throw Error('unvalidated relationships');
 await checkSchema(pool);
 const actual=(await pool.query('select data from ab.roles order by id')).rows.map(r=>r.data);
 const expected=JSON.parse(await readFile(new URL('../fixtures/roles.json',import.meta.url),'utf8')).sort((a:any,b:any)=>a.id.localeCompare(b.id));
 const canonical=(x:any):any=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
 if(JSON.stringify(canonical(actual))!==JSON.stringify(canonical(expected)))throw Error('role catalog mismatch');
 return {tableCount:files.tables.length};
}
export async function run(){
 let pool:Pool|undefined,phase='trusted context',progress='NONE';let failed=false;
 try{
  if(!approvedMigrationContext(process.env))throw Error('context not authorized');
  phase='approved SQL manifest';const files=await approvedFiles();
  console.log('PASS: approved eight checksums; no DROP, TRUNCATE or DELETE FROM statements');
  phase='existing test project preflight';
  const preflight=spawnSync(process.execPath,['--import','tsx','backend/review/connection-check.ts'],{stdio:['ignore','pipe','pipe'],encoding:'utf8',timeout:90000,maxBuffer:65536});
  if(preflight.status!==0)throw Error('preflight failed');
  pool=new Pool({...databaseOptions(process.env.MIGRATION_DATABASE_URL!),max:1});
  pool.on('error',()=>{failed=true;process.exitCode=1;console.log('IMPACT_ERROR: database connection lost; stopped');});
  const client=await pool.connect();try{assertVerifiedDatabaseTls(client)}finally{client.release()}
  phase='approved migrations and postchecks';
  const result=await applyApprovedSchema(pool,files);
  if(failed)throw Error('connection lost');
  progress='EIGHT_APPLIED';
  console.log(`PASS: eight migrations applied/verified; ${result.tableCount} expected tables; previous tables retained; foreign keys, role catalog, RLS and append-only checks passed`);
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Approved Supabase schema\n\n- PASS: eight approved forward migrations applied/verified, no table/data deletion.\n- PASS: expected tables, validated foreign keys, original role catalog, RLS and protected append-only tables.\n- PASS: existing private bucket and API connectivity preflight.\n- NOT RUN: ERP login/company/bank/document live trials; durable DATA_ENCRYPTION_KEY is required before encrypted record creation.\n');
 }catch(e:any){
  let count='unknown',next='unknown';
  if(pool){try{const exists=(await pool.query("select to_regclass('public.ab_schema_migrations') t")).rows[0]?.t;const rows=exists?(await pool.query('select name from public.ab_schema_migrations order by name')).rows:[];const files=await approvedFiles();count=String(rows.length);next=files.manifest.migrations.find((x:any)=>!rows.some(r=>r.name===x.name))?.name||'POSTCHECK';}catch{}}
  const codes=['42501','23514','23503','23505','42P07','42710','42883','28P01'];
  const reason=/permission denied to create role/i.test(String(e?.message))?'ROLE_CREATE_PERMISSION':String(e?.message)==='existing unmanaged schema'?'UNMANAGED_SCHEMA':String(e?.message)==='existing unsafe runtime role'?'UNSAFE_EXISTING_ROLE':'STOPPED';
  console.log(`IMPACT_ERROR: ${phase}; applied=${count}/8; next=${next}; sqlstate=${codes.includes(e?.code)?e.code:'WITHHELD'}; reason=${reason}; state=${progress}. No automatic repair or deletion.`);process.exitCode=1;
 }finally{if(pool)await pool.end();}
}
if(process.argv[1]?.endsWith('/approved-schema.ts')||process.argv[1]?.endsWith('/approved-schema.js'))await run();
