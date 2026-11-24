import{isRetainedBackupPath}from'./private-backup-store.js';
// Read-only source capture. Not scheduled/enabled; no restore or cleanup operations.
import {Pool} from 'pg';
import {personnelReleasePlan,personnelReleaseGuard} from './personnel-release.js';
import {financialReleasePlan,financialReleaseGuard} from './financial-release.js';
import {releasePlan,vehicleReleaseGuard} from './vehicle-release.js';
import {spawn} from 'node:child_process';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {archive,restoreArchive} from '../src/backup.js';
import {supabaseKeys} from '../src/core.js';
export const backupLimit=64*1024*1024;
export function backupConnection(e:NodeJS.ProcessEnv){
 const endpoint=new URL(e.SUPABASE_URL||''),db=new URL(e.MIGRATION_DATABASE_URL||'');
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(endpoint.href)||!['postgres:','postgresql:'].includes(db.protocol)||!db.hostname.endsWith('.pooler.supabase.com')||(db.port||'5432')!=='5432'||db.pathname!=='/postgres'||decodeURIComponent(db.username)!=='postgres.'+endpoint.hostname.split('.')[0])throw Error('test backup target required');
 if([...db.searchParams.keys()].some(k=>k!=='sslmode')||(db.searchParams.has('sslmode')&&db.searchParams.get('sslmode')!=='verify-full'))throw Error('connection overrides rejected');
 const key=e.BACKUP_ENCRYPTION_KEY||'';
 if(Buffer.from(key,'base64').length!==32||Buffer.from(key,'base64').toString('base64')!==key||key===e.DATA_ENCRYPTION_KEY)throw Error('independent backup key required');
 return {uri:db.href,key,endpoint:endpoint.origin,pg:{PATH:e.PATH,PGHOST:db.hostname,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:decodeURIComponent(db.username),PGPASSWORD:decodeURIComponent(db.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:resolve('backend/certificates/supabase-prod-ca-2021.crt'),PGOPTIONS:'-c default_transaction_read_only=on',PGCONNECT_TIMEOUT:'15'}};
}
async function dump(env:NodeJS.ProcessEnv,snapshot:string){
 return await new Promise<Buffer>((ok,no)=>{
  const p=spawn('pg_dump',['--format=custom','--no-owner','--schema=ab','--schema=public','--schema=auth','--schema=storage','--snapshot='+snapshot],{env,stdio:['ignore','pipe','ignore']});
  const chunks:Buffer[]=[];let size=0;
  p.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>backupLimit){p.kill();no(Error('backup size limit'));}else chunks.push(b);});
  p.on('error',()=>no(Error('pg_dump unavailable')));p.on('exit',code=>code===0?ok(Buffer.concat(chunks)):no(Error('pg_dump failed')));
 });
}
async function objectBytes(endpoint:string,key:string,name:string,remaining:number){
 if(name.split('/').some(x=>x==='.'||x==='..'||!x))throw Error('invalid object key');
 const path='/storage/v1/object/ab-private-test/'+name.split('/').map(encodeURIComponent).join('/');
 const r=await fetch(endpoint+path,{headers:{apikey:key},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok||!r.body)throw Error('object read failed');
 const chunks:Buffer[]=[];let total=0;for await(const bytes of r.body as any){total+=bytes.length;if(total>remaining)throw Error('object size limit');chunks.push(Buffer.from(bytes));}
 return Buffer.concat(chunks);
}
// Shared source capture seam: bounded reads only, no upload/delete/restore operations.
export async function captureBackupStorageObjects(names:Array<{name:string}>,remainingBudget:number,read:(name:string,remaining:number)=>Promise<Buffer>){
 if(!Number.isSafeInteger(remainingBudget)||remainingBudget<0||remainingBudget>backupLimit)throw Error('backupObjectBudgetReviewRequired');
 const seen=new Set<string>();for(const row of names){if(typeof row.name!=='string'||row.name.split('/').some(s=>!s||s==='.'||s==='..')||seen.has(row.name))throw Error('backupObjectSourceReviewRequired');seen.add(row.name);}
 const objects=new Map<string,Buffer>();let bytesRead=0,excludedRetainedBackupObjects=0;
 for(const row of names){if(isRetainedBackupPath(row.name)){excludedRetainedBackupObjects++;continue;}const bytes=await read(row.name,remainingBudget-bytesRead);if(!Buffer.isBuffer(bytes)||bytes.length>remainingBudget-bytesRead)throw Error('backupObjectBudgetExceeded');bytesRead+=bytes.length;objects.set('storage/'+row.name,bytes);}
 return{objects,bytesRead,copiedObjectCount:objects.size,excludedRetainedBackupObjects,totalSourceObjectCount:names.length};
}
// This format restores original application files into one known private bucket.
// Refuse additional nonempty buckets instead of silently omitting their bytes.
export function validateBackupStorageCoverage(rows:Array<{id:string;public:boolean;object_count:string|number}>){
 if(!Array.isArray(rows)||rows.length>100)throw Error('backupStorageBucketCoverageReviewRequired');const seen=new Set<string>();let applicationObjectCount:number|null=null,emptyOtherBucketCount=0;
 for(const row of rows){const count=Number(row.object_count);if(typeof row.id!=='string'||!row.id||row.id.length>256||seen.has(row.id)||typeof row.public!=='boolean'||!/^\d+$/.test(String(row.object_count))||!Number.isSafeInteger(count)||count<0||count>100000)throw Error('backupStorageBucketCoverageReviewRequired');seen.add(row.id);
  if(row.id==='ab-private-test'){if(row.public!==false)throw Error('backupStorageApplicationBucketNotPrivate');applicationObjectCount=count;}
  else{if(count>0)throw Error('backupStorageAdditionalBucketReviewRequired');emptyOtherBucketCount++;}
 }
 if(applicationObjectCount===null)throw Error('backupStorageApplicationBucketMissing');
 return{applicationBucket:'ab-private-test',applicationObjectCount,registeredBuckets:rows.length,emptyOtherBucketCount,additionalNonemptyBuckets:0,applicationBucketCoverageVerified:true,multiBucketRestoreSupported:false};
}
export async function readBackupStorageCoverage(c:any){const rows=(await c.query("select b.id,b.public,count(o.id)::text object_count from storage.buckets b left join storage.objects o on o.bucket_id=b.id group by b.id,b.public order by b.id limit 101")).rows;return validateBackupStorageCoverage(rows);}
async function run(){
 let pool:Pool|undefined;
 try{
  if(process.env.AB_BACKUP_APPROVED!=='yes'||process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='dubai717/ab-group-demo')throw Error('approved staging runner required');
  const personnelRelease=process.env.AB_PERSONNEL_RELEASE_BACKUP_APPROVED==='yes',financialRelease=process.env.AB_FINANCIAL_RELEASE_BACKUP_APPROVED==='yes',vehicleRelease=process.env.AB_VEHICLE_RELEASE_BACKUP_APPROVED==='yes';if(process.env.GITHUB_REF!=='refs/heads/staging/ab-group-test'){if(personnelRelease)personnelReleaseGuard(process.env);else if(financialRelease)financialReleaseGuard(process.env);else{if(!vehicleRelease)throw Error('approved staging runner required');vehicleReleaseGuard(process.env);}}
  const cfg=backupConnection(process.env),keys=supabaseKeys();if(!keys.secret)throw Error('private store key required');
  pool=new Pool({...databaseOptions(cfg.uri),max:1});pool.on('error',()=>{process.exitCode=1;});
  const c=await pool.connect();
  try{
   assertVerifiedDatabaseTls(c);await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   const approved=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8'));
   const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations')).rows;
   const release=personnelRelease?await personnelReleasePlan():financialRelease?await financialReleasePlan():vehicleRelease?await releasePlan():null;if(approved.migrations.some((m:any)=>!ledger.some(r=>r.name===m.name&&r.sha256===m.sha256))||(!release&&ledger.length!==8)||ledger.some(r=>![...approved.migrations,...(release?.migrations||[])].some(m=>m.name===r.name&&m.sha256===r.sha256)))throw Error('approved schema mismatch');
   const snapshot=(await c.query('select pg_export_snapshot() id')).rows[0].id;
   if(!/^[A-Fa-f0-9-]+$/.test(snapshot))throw Error('snapshot invalid');
   const storageCoverage=await readBackupStorageCoverage(c);
   const database=await dump(cfg.pg,snapshot);
   const names=(await c.query("select name from storage.objects where bucket_id='ab-private-test' order by name")).rows;
   if(names.length!==storageCoverage.applicationObjectCount)throw Error('backupStorageSnapshotCoverageChanged');
   const captured=await captureBackupStorageObjects(names,backupLimit-database.length,(name,remaining)=>objectBytes(cfg.endpoint,keys.secret,name,remaining)),objects=captured.objects;
   const roles=(await c.query("select rolname,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls from pg_roles where rolname in('ab_runtime','ab_scanner') order by rolname")).rows;
   const policies=(await c.query("select * from pg_policies where schemaname='ab' order by tablename,policyname")).rows;
   objects.set('metadata/restore-context.json',Buffer.from(JSON.stringify({format:'AB-STAGING-CONTEXT-1',createdAt:new Date().toISOString(),ledger,roles,policies,storageCoverage,objectCount:captured.copiedObjectCount,totalSourceObjectCount:captured.totalSourceObjectCount,excludedRetainedBackupObjects:captured.excludedRetainedBackupObjects,excludedBackupArchiveBytes:true,authIncluded:true,schemas:['ab','public','auth','storage'],notes:'Isolated compatible Supabase restore only after approval; no role passwords, API keys or DATA_ENCRYPTION_KEY included. Expire restored sessions. Storage bytes are included and require the compatible Storage restoration procedure. Retained backup archive bytes are intentionally excluded. Provider configuration and separately secured encryption keys are not included.'})));
   const sealed=archive(database,objects,cfg.key),verified=restoreArchive(sealed,cfg.key);
   if(verified.objects.size!==objects.size||!verified.database.equals(database))throw Error('archive verification failed');
   await mkdir('work/backups',{recursive:true,mode:0o700});
   await writeFile('work/backups/staging.abbackup',sealed,{mode:0o600,flag:'wx'});
   console.log('PASS: encrypted source backup captured and decrypted for integrity check; isolated cloud restoration NOT tested');
  }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
 }catch{console.log('STOP: source backup failed; credentials/provider/dump details withheld; no source modifications or cleanup');process.exitCode=1;}
 finally{if(pool)await pool.end().catch(()=>{process.exitCode=1;});}
}
if(/[/\\]backup-staging\.(ts|js)$/.test(process.argv[1]||''))await run();
