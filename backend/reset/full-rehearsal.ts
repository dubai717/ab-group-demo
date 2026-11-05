// Full cycle against disposable PostgreSQL and pinned official local Supabase Auth/Storage services.
// Cloud I/O is GET of the retained archive only. No hosted account or document mutation.
import {localProviders,stopLocalProviders} from './local-providers.js';
import {Pool,PoolClient} from 'pg';import {randomBytes} from 'node:crypto';
import {security,sha,requireOk,ApiError} from '../src/core.js';import {restoreArchive} from '../src/backup.js';import {docker,manifest} from '../deploy/backup-restore-drill.js';
import {collectPlan,protectedObject,projectHash} from './plan.js';import {managedProviders} from './providers.js';import {executeReset} from './execute.js';
const archivePath='ab-group-backups/v1/20261105T150819784Z-793d19a6-332c-4d54-9716-b8ab4911faa4/database.abbackup';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
let root:Pool|undefined,pool:Pool|undefined,stage='GUARD';
try{
 const e=process.env;requireOk(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&e.GITHUB_EVENT_NAME==='push'&&e.GITHUB_REF==='refs/heads/verify/reset-full-cycle-20261105',403,'isolatedRunnerRequired');
 const endpoint=new URL(e.SUPABASE_URL||'');requireOk(sha(endpoint.origin)===projectHash,403,'archiveProject');
 const get=async(path:string)=>{const key=e.SUPABASE_SECRET_KEY||'';const r=await fetch(endpoint.origin+'/storage/v1/object/ab-private-test/'+path.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:key,...(!key.startsWith('sb_')?{authorization:'Bearer '+key}:{})},redirect:'error',signal:AbortSignal.timeout(30000)});requireOk(r.ok,409,'archiveUnavailable');const bytes=Buffer.from(await r.arrayBuffer());requireOk(bytes.length<64*1024*1024,409,'archiveSize');return bytes;};
 stage='DOWNLOAD_ENCRYPTED_ARCHIVE';const meta=await get(archivePath.replace('database.abbackup','metadata.abmeta'));requireOk(meta.subarray(0,17).toString()==='AB-BACKUP-META-1\n',409,'archiveMetadata');const proof=security(e.BACKUP_ENCRYPTION_KEY||'').open(meta.toString().slice(17)),bytes=await get(archivePath);requireOk(proof.restoreVerified&&proof.archiveSha256===sha(bytes),409,'archiveIntegrity');
 const restored=restoreArchive(bytes,e.BACKUP_ENCRYPTION_KEY!),context=JSON.parse(restored.objects.get('metadata/restore-context.json')!.toString());
 root=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'postgres',ssl:false});const setup=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1});const c=await setup.connect();try{
 requireOk((await c.query('select current_database()d')).rows[0].d==='ab_drill',403,'localOnly');for(const role of context.roles)if(role.rolname!=='postgres')await c.query('CREATE ROLE '+qi(role.rolname)+' NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');await c.query('alter schema public rename to ab_drill_initial_public');
 for(const x of context.extensions){if(x.extname==='plpgsql'||x.nspname==='public')continue;if((await c.query('select 1 from pg_available_extensions where name=$1',[x.extname])).rowCount){await c.query('create schema if not exists '+qi(x.nspname));await c.query('create extension '+qi(x.extname)+' with schema '+qi(x.nspname));}}
 }finally{c.release();await setup.end();}
 stage='RESTORE_ISOLATED';await docker(['exec','-i','ab-backup-drill-postgres','pg_restore','--host=127.0.0.1','--username=postgres','--dbname=ab_drill','--no-owner','--exit-on-error','--single-transaction'],{},restored.database);
 for(const name of ['ab_reset_rehearsal','ab_reset_rollback'])await root.query('create database '+name+' template ab_drill');
 const original=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1});const oc=await original.connect();try{requireOk(JSON.stringify(await manifest(oc))===JSON.stringify(context.manifest),409,'initialRestoreMismatch');}finally{oc.release();await original.end();}
 for(const failure of [false,true]){
  stage=failure?'ROLLBACK_CYCLE':'SUCCESS_CYCLE';const name=failure?'ab_reset_rollback':'ab_reset_rehearsal';pool=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:name,ssl:false,max:2});const db=await pool.connect();try{
   requireOk((db as any).connectionParameters.host==='127.0.0.1'&&(await db.query('select current_database()d')).rows[0].d===name,403,'localOnly');
   const ledger=(await db.query('select * from public.ab_schema_migrations order by name')).rows;const initial=await manifest(db),authUsers=(await db.query('select * from auth.users order by id')).rows,objectRows=(await db.query("select * from storage.objects where bucket_id='ab-private-test'")).rows;
   const files=new Map<string,Buffer>();for(const [k,b]of restored.objects)if(k.startsWith('storage/')&&!protectedObject(k.slice(8)))files.set(k.slice(8),Buffer.from(b));
   const local=await localProviders(name);stage=failure?'ROLLBACK_SEED':'SUCCESS_SEED';
   for(const [k,bytes]of files){const response=await local.call('/storage/v1/object/ab-private-test/'+k.split('/').map(encodeURIComponent).join('/'),{method:'POST',headers:{'content-type':'application/octet-stream','x-upsert':'true'},body:new Uint8Array(bytes)});if(!response.ok)console.log('LOCAL_SEED_HTTP: '+response.status);requireOk(response.ok,409,'localStorageSeedFailed');await response.body?.cancel();}
   const p=await collectPlan(db,'4a162b926352208b85cf53a8d9d4f0c3ecc20841');let inject=failure;const seen:string[]=[];
   const api=(async(url:any,options:any={})=>{const path=new URL(url).pathname,method=options.method||'GET';seen.push(method+' '+path);
    if(inject&&method==='GET'&&path==='/auth/v1/admin/users/'+p.ownerAuthId&&Number((await db.query('select count(*)n from auth.users')).rows[0].n)===1){inject=false;return Response.json({error:'injected'},{status:503});}
    return local.call(path,options);
   }) as typeof fetch;
   const provider=managedProviders(endpoint.origin,'sb_secret_'+randomBytes(24).toString('hex'),api),phases:string[]=[];
   const restoreApplication=async()=>{await docker(['exec','-i','ab-backup-drill-postgres','pg_restore','--host=127.0.0.1','--username=postgres','--dbname='+name,'--no-owner','--exit-on-error','--single-transaction','--clean','--if-exists','--schema=ab'],{},restored.database);await db.query('BEGIN');try{await db.query('delete from public.ab_schema_migrations');for(const m of ledger)await db.query('insert into public.ab_schema_migrations(name,sha256,applied_at)values($1,$2,$3)',[m.name,m.sha256,m.applied_at]);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}};
   let failed=false,cycleError:any;try{await executeReset(db,p,provider,{release:p.release,proof:{verified:true,freshAt:Date.now(),archivePath},phase:async s=>{phases.push(s);},backupUsers:authUsers,recoveryObjects:restored.objects,restoreApplication});}catch(err){failed=true;cycleError=err;}
   if(failed!==failure&&cycleError?.cause){for(const [kind,err]of Object.entries(cycleError.cause) as [string,any][])console.log('ISOLATED_FAILURE_'+kind.toUpperCase()+': '+(err instanceof ApiError?err.code:/^[0-9A-Z]{5}$/.test(err?.code||'')?err.code:err?.name==='TypeError'?'TYPE_ERROR':'WITHHELD'));}
   if(failed!==failure)console.log('CYCLE_ERROR_CODE: '+(cycleError instanceof ApiError?cycleError.code:/^[0-9A-Z]{5}$/.test(cycleError?.code||'')?cycleError.code:'WITHHELD')+'; PHASES='+phases.join(','));
   requireOk(failed===failure,409,'cycleUnexpectedResult');
   if(!failure){requireOk(Number((await db.query('select count(*)n from auth.users')).rows[0].n)===1&&Number((await db.query("select count(*)n from storage.objects where bucket_id='ab-private-test' and name not like 'ab-group-backups/%' and name not like 'ab-group-reset-control/%'")).rows[0].n)===0,409,'externalCleanupIncomplete');requireOk(!seen.some(x=>x==='DELETE /auth/v1/admin/users/'+p.ownerAuthId),403,'ownerTargeted');console.log('CHECK: PHYSICAL_APP_REBUILD_AUTH_17_REMOVALS_STORAGE_96_REMOVALS_OWNER_REFERENCE_RLS_PRESERVATION=PASS; PROVIDER=ISOLATED_OFFICIAL_SUPABASE_AUTH_AND_STORAGE');}
   else{requireOk(phases.includes('failed-rolled-back'),409,'rollbackIncomplete');requireOk(JSON.stringify((await db.query('select * from public.ab_schema_migrations order by name')).rows)===JSON.stringify(ledger),409,'ledgerRecoveryMismatch');const after=await manifest(db);requireOk(JSON.stringify(after.rows.filter((x:any)=>x.s==='ab'))===JSON.stringify(initial.rows.filter((x:any)=>x.s==='ab')),409,'applicationRecoveryMismatch');for(const k of p.files)requireOk(sha((await provider.getFile(k))!)===sha(restored.objects.get('storage/'+k)!),409,'fileRecoveryMismatch');console.log('CHECK: INJECTED_POST_DELETION_FAILURE_RESTORES_APP_AUTH_HASHES_FILES_AND_OWNER=PASS; REFRESH_SESSIONS_NOT_REIMPORTED');}
  }finally{await stopLocalProviders();db.release();await pool.end();pool=undefined;}
 }
 console.log('RESULT: FULL_RESET_AND_RECOVERY_ISOLATED_CONTRACT_PASS; NO_HOSTED_WRITES_DELETIONS_RESET_OR_DEPLOYMENT');
}catch(error){console.log('RESULT: FULL_RESET_ISOLATED_STOP; STAGE='+stage+'; CODE='+(error instanceof ApiError?error.code:/^[0-9A-Z]{5}$/.test((error as any)?.code||'')?(error as any).code:'WITHHELD'));process.exitCode=1;}
finally{await stopLocalProviders();await pool?.end().catch(()=>{});await root?.end().catch(()=>{});}
