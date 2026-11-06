// Rehearsal ONLY. Deliberately refuses every hosted connection. No live reset entrypoint exists.
import {Pool,PoolClient} from 'pg';
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {requireOk,sha} from '../src/core.js';
import {build} from '../src/app.js';
import {TestAuth,TestObjects} from '../tests/fixture.js';
import {manifest} from '../deploy/backup-restore-drill.js';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
export async function rehearseReset(pool:Pool, dataKey:string){
 const c=await pool.connect();let phase='LOCAL_GUARD';
 try{
  const cp=(c as any).connectionParameters;
  requireOk(cp.host==='127.0.0.1'&&Number(cp.port)===5547&&cp.database==='ab_reset_rehearsal',403,'localResetOnly');
  requireOk((await c.query('select current_database() d')).rows[0].d==='ab_reset_rehearsal',403,'localResetOnly');
  const first=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations;
  const plan=JSON.parse(await readFile('backend/deploy/personnel-release-plan.json','utf8'));
  const migrations=[...first.map((x:any)=>({...x,path:'supabase/migrations/'+x.name})),...plan.migrations];
  requireOk(migrations.length===13,409,'migrationPlanMismatch');
  const bodies=[];for(const m of migrations){const sql=await readFile(m.path,'utf8');requireOk(sha(sql)===m.sha256,409,'approvedHashMismatch');bodies.push(sql);}
  const owners=(await c.query("select * from ab.users where username='trial_4db27b82b8bf' and role_id='owner' and status='Active'")).rows;requireOk(owners.length===1,409,'originalOwnerRequired');const owner=owners[0];requireOk(!owner.manager_id,409,'ownerManagerDependency');
  const outside=(m:any)=>({rows:m.rows.filter((x:any)=>x.s!=='ab'&&!(x.s==='public'&&x.t==='ab_schema_migrations')),constraints:m.constraints.filter((x:any)=>x.s!=='ab'),policies:m.policies.filter((x:any)=>x.schemaname!=='ab'),triggers:m.triggers.filter((x:any)=>x.s!=='ab')});
  const outsideBefore=JSON.stringify(outside(await manifest(c)));
  const keep:Record<string,any[]>={};
  for(const t of ['organizations','users','emirates','areas','area_aliases','bank_references','settings']){
   if(t==='users')keep[t]=[owner];else if(t==='emirates')keep[t]=(await c.query('select * from ab.emirates')).rows;else if(t==='organizations')keep[t]=(await c.query('select * from ab.organizations where id=$1',[owner.tenant_id])).rows;else if(t==='settings')keep[t]=(await c.query("select * from ab.settings where tenant_id=$1 and key=any($2::text[])",[owner.tenant_id,['companyDocumentAlertDays']])).rows;else keep[t]=(await c.query('select * from ab.'+t+' where tenant_id=$1',[owner.tenant_id])).rows;
  }
  // This exact ID is the synthetic bootstrap fixture, not an approved real-bank reference.
  keep.bank_references=keep.bank_references.filter(x=>!(x.kind==='bank'&&x.id==='demo-bank'));
  const catalog:Record<string,string>={};for(const t of ['roles','permissions','role_permissions'])catalog[t]=JSON.stringify((await c.query('select to_jsonb(x) j from ab.'+t+' x order by to_jsonb(x)::text')).rows);
  const authHash=(await c.query('select md5(to_jsonb(x)::text) h from auth.users x where id=$1',[owner.auth_id])).rows[0]?.h;requireOk(authHash,409,'ownerAuthRequired');
  const tables=(await c.query("select tablename from pg_tables where schemaname='ab' order by tablename")).rows;
  const counts:Record<string,number>={};for(const t of tables)counts[t.tablename]=Number((await c.query('select count(*)n from ab.'+qi(t.tablename))).rows[0].n);
  const metadata={rowsByTable:counts,totalApplicationRows:Object.values(counts).reduce((a,b)=>a+b,0),preservedRows:Object.fromEntries(Object.entries(keep).map(([k,v])=>[k,v.length])),authIdentitiesToRemove:Number((await c.query('select count(*)n from auth.users where id<>$1',[owner.auth_id])).rows[0].n),keptOwnerAuthId:owner.auth_id};
  console.log('RESET_PREVIEW_COUNTS: '+JSON.stringify({...metadata,keptOwnerAuthId:undefined}));
  phase='TRANSACTIONAL_APPLICATION_SCHEMA_REBUILD';
  await c.query('BEGIN');
  // Replacing the disposable application namespace, not bypassing row triggers or disabling RLS.
  // This operation is NOT exposed to cloud/runtime credentials by this module.
  await c.query('DROP SCHEMA ab CASCADE');
  await c.query('DELETE FROM public.ab_schema_migrations');
  for(let i=0;i<migrations.length;i++){await c.query(bodies[i]);await c.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)',[migrations[i].name,migrations[i].sha256]);}
  for(const t of ['roles','permissions','role_permissions'])requireOk(JSON.stringify((await c.query('select to_jsonb(x) j from ab.'+t+' x order by to_jsonb(x)::text')).rows)===catalog[t],409,'roleCatalogChanged');
  for(const [t,rows] of Object.entries(keep)){
   if(!rows.length)continue;
   const cols=(await c.query("select attname::text n from pg_attribute where attrelid=$1::regclass and attnum>0 and not attisdropped and attgenerated='' order by attnum",['ab.'+t])).rows.map(x=>qi(x.n)).join(',');
   await c.query('insert into ab.'+qi(t)+'('+cols+') select '+cols+' from jsonb_populate_recordset(NULL::ab.'+qi(t)+',$1::jsonb)',[JSON.stringify(rows)]);
  }
  const restoredAuthHash=(await c.query('select md5(to_jsonb(x)::text) h from auth.users x where id=$1',[owner.auth_id])).rows[0]?.h;requireOk(restoredAuthHash===authHash,409,'ownerAuthChanged');
  requireOk((await c.query('select count(*)::int n from ab.users')).rows[0].n===1,409,'ownerOnlyRequired');
  const empty=[];for(const {tablename:t} of tables){if(t in keep||['roles','permissions','role_permissions'].includes(t))continue;requireOk(Number((await c.query('select count(*)n from ab.'+qi(t))).rows[0].n)===0,409,'businessHistoryNotEmpty');empty.push(t);}
  for(const t of plan.rlsTables)requireOk((await c.query('select relrowsecurity from pg_class where oid=$1::regclass',['ab.'+t])).rows[0]?.relrowsecurity,409,'rlsLost');
  requireOk(Number((await c.query("select count(*)n from pg_constraint where connamespace='ab'::regnamespace and not convalidated")).rows[0].n)===0,409,'invalidConstraints');
  const oldOwner=JSON.stringify(owner),newOwner=JSON.stringify((await c.query('select * from ab.users where id=$1',[owner.id])).rows[0]);requireOk(oldOwner===newOwner,409,'ownerProfileChanged');
  requireOk(JSON.stringify(outside(await manifest(c)))===outsideBefore,409,'nonApplicationSchemaChanged');
  await c.query('COMMIT');
  console.log('CHECK: AUTH_STORAGE_PUBLIC_OTHER_TABLES_CONSTRAINTS_POLICIES_AND_TRIGGERS_UNCHANGED=PASS');
  console.log('CHECK: ISOLATED_SCHEMA_REPLAY_13_OWNER_AUTH_PROFILE_REFERENCE_CATALOG_RLS_AND_EMPTY_BUSINESS=PASS; EMPTY_TABLES='+empty.length);
  phase='ISOLATED_OWNER_BACKEND_LOGIN';
  const auth=new TestAuth(),password=randomBytes(40).toString('base64url');auth.accounts.set(owner.auth_email,{id:owner.auth_id,password});
  const key=dataKey,runtime=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_reset_rehearsal',ssl:false,options:'-c role=ab_runtime',max:2});
  const app=await build({pool:runtime,key,auth,objects:new TestObjects(),origin:'http://127.0.0.1:3100',secureCookies:false,serveFrontend:false,resetEnabled:true});
  try{
   const r=await app.inject({method:'POST',url:'/api/login',payload:{username:owner.username,password},headers:{origin:'http://127.0.0.1:3100','x-ab-request':'1'}});requireOk(r.statusCode===200,409,'isolatedOwnerLoginFailed');
   const cookie=String(r.headers['set-cookie']).split(';')[0],b=await app.inject({method:'GET',url:'/api/bootstrap',headers:{cookie}});requireOk(b.statusCode===200&&b.json().actor.roleId==='owner'&&b.json().companies.length===0&&b.json().bankAccounts.length===0,409,'ownerBootstrapFailed');
   const disabled=await app.inject({method:'GET',url:'/api/reset-test-database',headers:{cookie}});requireOk(disabled.statusCode===200&&disabled.json().canExecute===false,409,'unconfiguredResetMustNotExecute');
   console.log('CHECK: OWNER_LOGIN_AND_EMPTY_BOOTSTRAP_THROUGH_REAL_BACKEND_WITH_AUTH_TEST_DOUBLE=PASS');
   console.log('PENDING: REAL_SUPABASE_PASSWORD_LOGIN_AUTH_USER_REMOVAL_STORAGE_OBJECT_REMOVAL_AND_PRIVILEGED_WORKER_ACTIVATION');
  }finally{await app.close();await runtime.end();}
  return metadata;
 }catch(e){await c.query('ROLLBACK').catch(()=>{});console.log('RESET_REHEARSAL_STAGE: '+phase);throw e;}finally{c.release();}
}
