// Shared reviewed schema constructor. Administrative caller must validate target/approval and fence writes.
import {PoolClient} from 'pg';import {readFile} from 'node:fs/promises';import {sha,requireOk} from '../src/core.js';import {manifest} from '../deploy/backup-restore-drill.js';
export const primaryOwner='trial_4db27b82b8bf';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
export async function approvedChain(){const a=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')),b=JSON.parse(await readFile('backend/deploy/personnel-release-plan.json','utf8'));const rows=[...a.migrations.map((x:any)=>({...x,path:'supabase/migrations/'+x.name})),...b.migrations];requireOk(rows.length===b.targetMigrations,409,'migrationManifestMismatch');for(const m of rows){m.sql=await readFile(m.path,'utf8');requireOk(sha(m.sql)===m.sha256,409,'migrationChecksum');}return rows;}
const outside=(m:any)=>({rows:m.rows.filter((x:any)=>x.s!=='ab'&&!(x.s==='public'&&x.t==='ab_schema_migrations')),constraints:m.constraints.filter((x:any)=>x.s!=='ab'),policies:m.policies.filter((x:any)=>x.schemaname!=='ab'),triggers:m.triggers.filter((x:any)=>x.s!=='ab')});
async function appDefinition(c:PoolClient){const m=await manifest(c);return JSON.stringify({grants:(await c.query("select table_name,grantee,privilege_type,is_grantable from information_schema.table_privileges where table_schema='ab' order by table_name,grantee,privilege_type,is_grantable")).rows,columns:(await c.query("select c.relname,a.attname,a.attnotnull,a.attgenerated,format_type(a.atttypid,a.atttypmod) type,pg_get_expr(d.adbin,d.adrelid) expr from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname='ab' and c.relkind in('r','p') and a.attnum>0 and not a.attisdropped order by c.relname,a.attnum")).rows,indexes:(await c.query("select tablename,indexname,indexdef from pg_indexes where schemaname='ab' order by tablename,indexname")).rows,tables:m.rows.filter((r:any)=>r.s==='ab').map((r:any)=>({s:r.s,t:r.t,r:r.r,f:r.f})),constraints:m.constraints.filter((r:any)=>r.s==='ab'),policies:m.policies.filter((r:any)=>r.schemaname==='ab'),triggers:m.triggers.filter((r:any)=>r.s==='ab'),functions:(await c.query("select p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) def,p.prosecdef,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='ab' and p.prokind in('f','p') order by p.proname,pg_get_function_identity_arguments(p.oid)")).rows});}
export async function baseline(c:PoolClient,strictOutside=true){
 const rows=(await c.query("select * from ab.users where username=$1 and role_id='owner' and status='Active'",[primaryOwner])).rows;requireOk(rows.length===1&&!rows[0].manager_id,409,'primaryOwnerRequired');const owner=rows[0],chain=await approvedChain(),ledger=(await c.query('select name,sha256 from public.ab_schema_migrations')).rows;
 requireOk(ledger.length===chain.length&&chain.every(m=>ledger.some(r=>r.name===m.name&&r.sha256===m.sha256)),409,'ledgerMismatch');
 const keep:Record<string,any[]>={users:[owner]};for(const t of ['organizations','emirates','areas','area_aliases','bank_references','settings']){
  if(t==='organizations')keep[t]=(await c.query('select * from ab.organizations where id=$1',[owner.tenant_id])).rows;else if(t==='emirates')keep[t]=(await c.query('select * from ab.emirates')).rows;else if(t==='settings')keep[t]=(await c.query("select * from ab.settings where tenant_id=$1 and key=any($2::text[])",[owner.tenant_id,['companyDocumentAlertDays']])).rows;else keep[t]=(await c.query('select * from ab.'+t+' where tenant_id=$1',[owner.tenant_id])).rows;
 }keep.bank_references=keep.bank_references.filter(x=>!(x.kind==='bank'&&x.id==='demo-bank'));
 const catalog:Record<string,string>={};for(const t of ['roles','permissions','role_permissions'])catalog[t]=JSON.stringify((await c.query('select to_jsonb(x) j from ab.'+t+' x order by to_jsonb(x)::text')).rows);
 const auth=(await c.query('select * from auth.users where id=$1',[owner.auth_id])).rows[0];requireOk(auth?.email===owner.auth_email&&auth.email_confirmed_at&&!auth.deleted_at&&(!auth.banned_until||Date.parse(auth.banned_until)<=Date.now()),409,'ownerAuthInvalid');
 const tables=(await c.query("select tablename from pg_tables where schemaname='ab' order by tablename")).rows.map(x=>x.tablename);
 const external=outside(await manifest(c));if(!strictOutside)external.rows=external.rows.map((r:any)=>({s:r.s,t:r.t,r:r.r,f:r.f}));return {appDefinition:await appDefinition(c),owner,keep,catalog,chain,tables,authHash:sha(JSON.stringify(auth)),outside:JSON.stringify(external),strictOutside};
}
export type Baseline=Awaited<ReturnType<typeof baseline>>;
export async function rebuild(c:PoolClient,b:Baseline){
 await c.query('BEGIN');try{
  await c.query('DROP SCHEMA ab CASCADE');await c.query('DELETE FROM public.ab_schema_migrations');
  for(const m of b.chain){await c.query(m.sql);await c.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[m.name,m.sha256]);}
  for(const t of ['roles','permissions','role_permissions'])requireOk(JSON.stringify((await c.query('select to_jsonb(x) j from ab.'+t+' x order by to_jsonb(x)::text')).rows)===b.catalog[t],409,'catalogChanged');
  for(const t of ['organizations','users','emirates','areas','area_aliases','bank_references','settings']){const rows=b.keep[t];if(!rows.length)continue;const cols=(await c.query("select attname::text n from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum",['ab.'+t])).rows.map(x=>qi(x.n)).join(',');await c.query('insert into ab.'+qi(t)+'('+cols+') select '+cols+' from jsonb_populate_recordset(NULL::ab.'+qi(t)+',$1::jsonb)',[JSON.stringify(rows)]);}
  requireOk(sha(JSON.stringify((await c.query('select * from auth.users where id=$1',[b.owner.auth_id])).rows[0]))===b.authHash,409,'ownerAuthChanged');
  requireOk(JSON.stringify((await c.query('select * from ab.users where id=$1',[b.owner.id])).rows[0])===JSON.stringify(b.owner),409,'ownerProfileChanged');
  const external=outside(await manifest(c));if(!b.strictOutside)external.rows=external.rows.map((r:any)=>({s:r.s,t:r.t,r:r.r,f:r.f}));requireOk(JSON.stringify(external)===b.outside,409,'externalSchemaChanged');
  requireOk(await appDefinition(c)===b.appDefinition,409,'approvedSchemaDefinitionChanged');
  await verifyEmpty(c,b);await c.query('COMMIT');
 }catch(e){await c.query('ROLLBACK');throw e;}
}
export async function verifyEmpty(c:PoolClient,b:Baseline){
 for(const t of b.tables){if(t in b.keep||['roles','permissions','role_permissions'].includes(t))continue;requireOk(Number((await c.query('select count(*)n from ab.'+qi(t))).rows[0].n)===0,409,'businessRowsRemain');}
 requireOk((await c.query('select count(*)::int n from ab.users')).rows[0].n===1,409,'ownerCount');
 requireOk(Number((await c.query("select count(*)n from pg_constraint where connamespace='ab'::regnamespace and not convalidated")).rows[0].n)===0,409,'invalidConstraint');
 const plan=JSON.parse(await readFile('backend/deploy/personnel-release-plan.json','utf8'));for(const t of ['organizations','users','companies','bank_accounts',...plan.rlsTables])requireOk((await c.query('select relrowsecurity from pg_class where oid=$1::regclass',['ab.'+t])).rows[0]?.relrowsecurity,409,'rlsMissing');
}
