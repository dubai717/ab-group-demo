// One-shot read-only hosted capture; restoration commands target ONLY the named ephemeral local container.
import {Pool, PoolClient} from 'pg';
import {spawn} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {archive,restoreArchive} from '../src/backup.js';
import {sha,security,supabaseKeys} from '../src/core.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {validateStagingLedger} from './safe-staging-additives.js';
import {backupConnection,backupLimit} from './backup-staging.js';
import {privateBackupStore,newBackupPaths,isRetainedBackupPath} from './private-backup-store.js';

const container='ab-backup-drill-postgres';
const schemas=['ab','public','auth','storage'];
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
function check(ok:unknown,label:string):asserts ok {if(!ok)throw Error(label);}
export function docker(args:string[],env:NodeJS.ProcessEnv={},input?:Buffer):Promise<Buffer>{
 return new Promise((resolve,reject)=>{
  const p=spawn('docker',args,{env:{PATH:process.env.PATH,...env},stdio:['pipe','pipe','pipe']});
  const out:Buffer[]=[];let size=0,failed=false,diagnostic="";
  p.stdout.on('data',(b:Buffer)=>{size+=b.length;if(size>backupLimit){failed=true;p.kill();}else out.push(b);});
  // Provider messages can contain SQL/data. Never forward or include them in errors.
  p.stderr.on('data',(b:Buffer)=>{if(diagnostic.length<32768)diagnostic+=b.toString().slice(0,32768-diagnostic.length);});p.stdin.on('error',()=>{});
  p.on('error',()=>reject(Error('LOCAL_TOOL_UNAVAILABLE')));
  p.on('close',code=>{
   if(code===0&&!failed)return resolve(Buffer.concat(out));
   const labels:[RegExp,string][]=[[/schema "public" already exists/i,'LOCAL_PUBLIC_SCHEMA_COLLISION'],[/role .* does not exist/i,'LOCAL_ROLE_DEPENDENCY'],[/extension .* (?:not available|does not exist|could not)/i,'LOCAL_EXTENSION_DEPENDENCY'],[/schema .* does not exist/i,'LOCAL_SCHEMA_DEPENDENCY'],[/function .* does not exist/i,'LOCAL_FUNCTION_DEPENDENCY'],[/type .* does not exist/i,'LOCAL_TYPE_DEPENDENCY'],[/permission denied/i,'DATABASE_PERMISSION'],[/unrecognized configuration parameter/i,'SERVER_VERSION_PARAMETER'],[/already exists/i,'LOCAL_OBJECT_COLLISION'],[/could not connect|connection .*failed|timeout expired/i,'DUMP_CONNECTION']];
   reject(Error(failed?'SIZE_LIMIT':labels.find(([pattern])=>pattern.test(diagnostic))?.[1]||'DUMP_OR_RESTORE_FAILED'));
  });
  p.stdin.end(input);
 });
}
export function drillGuard(e:NodeJS.ProcessEnv){
 check(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&e.GITHUB_EVENT_NAME==='push'&&(e.GITHUB_REF==='refs/heads/verify/backup-restore-20261104'||['refs/heads/activate/personnel-staging-approved','refs/heads/verify/staging-rehearsal-009-013-20261104','refs/heads/staging/ab-group-test','refs/heads/verify/staging-delivery-preflight-20261104','refs/heads/verify/test-data-provenance-20261105'].includes(e.GITHUB_REF||''))&&e.AB_BACKUP_DRILL_APPROVED==='read-only-source-isolated-restore','RUNNER_GUARD');
 if(['refs/heads/activate/personnel-staging-approved','refs/heads/verify/staging-rehearsal-009-013-20261104','refs/heads/staging/ab-group-test','refs/heads/verify/staging-delivery-preflight-20261104','refs/heads/verify/test-data-provenance-20261105'].includes(e.GITHUB_REF||'')){if(sha(new URL(e.SUPABASE_URL||'').origin)!=='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f'||!((e.AB_PERSONNEL_RELEASE_APPROVED==='owner-approved-staging-only'&&e.AB_SYNTHETIC_PROJECT==='yes')||(['refs/heads/staging/ab-group-test','refs/heads/verify/staging-delivery-preflight-20261104','refs/heads/verify/test-data-provenance-20261105'].includes(e.GITHUB_REF||'')&&e.AB_STAGING_AUTOMATION==='controlled-test-only')))throw Error('PINNED_APPROVED_TEST_RELEASE_REQUIRED');}
 return backupConnection(e);
}
export async function manifest(c:PoolClient){
 const tables=(await c.query("select n.nspname s,c.relname t,c.relrowsecurity r,c.relforcerowsecurity f from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname=any($1::text[]) and c.relkind in('r','p') order by 1,2",[schemas])).rows;
 const rows=[];
 for(const t of tables){
  const r=(await c.query(`select count(*)::text n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by md5(row_to_json(x)::text)),'')) h from ${qi(t.s)}.${qi(t.t)} x`)).rows[0];
  rows.push({...t,...r});
 }
 const constraints=(await c.query("select n.nspname s,t.relname t,c.conname n,c.contype y,c.convalidated v,pg_get_constraintdef(c.oid) d from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname=any($1::text[]) order by 1,2,3",[schemas])).rows;
 const policies=(await c.query('select * from pg_policies where schemaname=any($1::text[]) order by schemaname,tablename,policyname',[schemas])).rows;
 const triggers=(await c.query("select n.nspname s,t.relname t,g.tgname n,g.tgenabled e,pg_get_triggerdef(g.oid) d from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace where n.nspname=any($1::text[]) and not g.tgisinternal order by 1,2,3",[schemas])).rows;
 return {rows,constraints,policies,triggers};
}
export async function main(){
 let source:Pool|undefined,target:Pool|undefined,stage='GUARD';let retainedPath:string|undefined;
 try{
  const cfg=drillGuard(process.env),keys=supabaseKeys();check(keys.secret,'STORE_SECRET_MISSING');
  check(process.env.DATA_ENCRYPTION_KEY&&Buffer.from(process.env.DATA_ENCRYPTION_KEY,'base64').length===32,'DATA_KEY');
  console.log('CHECK: BACKUP_KEY=CANONICAL_32_BYTES_INDEPENDENT');
  const retain=process.env.AB_BACKUP_RETAIN_APPROVED==='private-bucket-no-overwrite';
  check(!process.env.AB_BACKUP_RETAIN_APPROVED||retain,'RETENTION_APPROVAL');
  const store=privateBackupStore(cfg.endpoint,keys.secret),paths=newBackupPaths();
  if(retain){stage='PRIVATE_BUCKET_PREFLIGHT';await store.verifyBucket(1);console.log('CHECK: RETENTION_BUCKET=PRIVATE_AND_EXISTING_LIMITS_ACCEPTED');}
  stage='SOURCE_READ_ONLY';
  source=new Pool({...databaseOptions(cfg.uri),max:1,statement_timeout:60000,options:'-c default_transaction_read_only=on -c timezone=UTC -c search_path=pg_catalog'});source.on('error',()=>{});
  const c=await source.connect();let before:any,dump:Buffer,objects=new Map<string,Buffer>(),snapshot='';let context:any;
  try{
   assertVerifiedDatabaseTls(c);await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
   check((await c.query('show transaction_read_only')).rows[0].transaction_read_only==='on','SOURCE_NOT_READ_ONLY');
   check(Math.floor(Number((await c.query('show server_version_num')).rows[0].server_version_num)/10000)===17,'SOURCE_VERSION');
   const expected=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations;
   const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows;
   if(process.env.AB_STAGING_AUTOMATION==='controlled-test-only'){
    await validateStagingLedger(ledger);
    const plan=JSON.parse(await readFile('backend/deploy/personnel-release-plan.json','utf8')).migrations,knownTables=new Set<string>();
    for(const m of [...expected,...plan]){const sql=await readFile(m.path||'supabase/migrations/'+m.name,'utf8');for(const match of sql.matchAll(/\bCREATE TABLE ab\.([a-z_]+)/g))knownTables.add(match[1]);}
    const actual=(await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab'and c.relkind in('r','p')")).rows;
    check(actual.length===knownTables.size&&actual.every(r=>knownTables.has(r.relname)),'UNREGISTERED_APPLICATION_TABLE');
    const production=(await c.query("select count(*)n from ab.settings where key~*'(production|live.payments|bank.feed|whatsapp|sms|smtp|gps.live)'and(value->>'enabled'='true'or value->>'environment'='production'or value->>'mode'='live')")).rows[0].n;check(Number(production)===0,'KNOWN_PRODUCTION_INTEGRATION');
   }else check(ledger.length===8&&expected.every((m:any)=>ledger.some((r:any)=>r.name===m.name&&r.sha256===m.sha256)),'BASE_LEDGER');
   snapshot=(await c.query('select pg_export_snapshot() id')).rows[0].id;check(/^[A-Fa-f0-9-]+$/.test(snapshot),'SNAPSHOT');
   before=await manifest(c);
   const roles=(await c.query("select rolname from pg_roles where rolname not like 'pg\\_%' escape '\\' order by rolname")).rows;
   const extensions=(await c.query('select e.extname,n.nspname from pg_extension e join pg_namespace n on n.oid=e.extnamespace order by e.extname')).rows;
   context={excludedBackupArchiveBytes:true,format:'AB-DRILL-CONTEXT-1',createdAt:new Date().toISOString(),snapshotId:snapshot,manifest:before,roles,extensions,ledger};
   stage='CAPTURE_DUMP';
   const pg={...cfg.pg,PGSSLROOTCERT:'/tmp/ab-ca.crt'};
   dump=await docker(['exec','-i',...Object.keys(pg).filter(k=>k!=='PATH').flatMap(k=>['--env',k]),container,'pg_dump','--format=custom','--no-owner','--lock-wait-timeout=15000',...schemas.map(s=>'--schema='+s),'--snapshot='+snapshot],pg);
   check(dump.subarray(0,5).toString()==='PGDMP','DUMP_HEADER');let size=dump.length;
   const bucket=(await fetch(cfg.endpoint+'/storage/v1/bucket/ab-private-test',{headers:{apikey:keys.secret},redirect:'error',signal:AbortSignal.timeout(30000)}));check(bucket.ok,'BUCKET_READ');check((await bucket.json() as any).public===false,'BUCKET_NOT_PRIVATE');
   const names=(await c.query("select name from storage.objects where bucket_id='ab-private-test' order by name")).rows;
   stage='PRIVATE_OBJECT_CAPTURE';
   for(const row of names){
    if(isRetainedBackupPath(row.name))continue; // Existing backups remain in place; avoid recursive archive growth.
    check(typeof row.name==='string'&&!row.name.split('/').some((s:string)=>!s||s==='.'||s==='..'),'OBJECT_NAME');
    const r=await fetch(cfg.endpoint+'/storage/v1/object/ab-private-test/'+row.name.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:keys.secret},redirect:'error',signal:AbortSignal.timeout(30000)});check(r.ok&&r.body,'OBJECT_READ');
    const chunks:Buffer[]=[];for await(const b of r.body as any){size+=b.length;check(size<=backupLimit,'OBJECT_LIMIT');chunks.push(Buffer.from(b));}objects.set('storage/'+row.name,Buffer.concat(chunks));
   }
   // Re-read objects before closing the source snapshot: concurrent object replacement invalidates this drill.
   for(const [name,bytes] of objects){const r=await fetch(cfg.endpoint+'/storage/v1/object/ab-private-test/'+name.slice(8).split('/').map(encodeURIComponent).join('/'),{headers:{apikey:keys.secret},redirect:'error',signal:AbortSignal.timeout(30000)});check(r.ok&&r.body,'OBJECT_RECHECK');const chunks:Buffer[]=[];let length=0;for await(const b of r.body as any){length+=b.length;check(length<=bytes.length,'OBJECT_CHANGED');chunks.push(Buffer.from(b));}check(sha(Buffer.concat(chunks))===sha(bytes),'OBJECT_CHANGED');}
   check(JSON.stringify(await manifest(c))===JSON.stringify(before),'SOURCE_SNAPSHOT_MISMATCH');
   await c.query('ROLLBACK');
  }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
  objects.set('metadata/restore-context.json',Buffer.from(JSON.stringify(context)));
  stage='ENCRYPT_ARCHIVE';const sealed=archive(dump!,objects,cfg.key);
  await mkdir('work/backups',{recursive:true,mode:0o700});await writeFile('work/backups/staging.abbackup',sealed,{mode:0o600,flag:'wx'});
  let archiveBytes=await readFile('work/backups/staging.abbackup');
  if(retain){
   stage='PRIVATE_ARCHIVE_UPLOAD';await store.upload(paths.archive,archiveBytes);retainedPath=paths.archive;
   console.log('CHECK: NEW_ENCRYPTED_ARCHIVE_CREATED='+paths.archive);
   stage='PRIVATE_ARCHIVE_DOWNLOAD';archiveBytes=await store.downloadVerified(paths.archive,archiveBytes);await store.verifyNotPublic(paths.archive);
   console.log('CHECK: UPLOADED_ARCHIVE_DOWNLOAD_HASH_AND_PUBLIC_DENIAL=PASS');
  }
  const restored=restoreArchive(archiveBytes,cfg.key);
  check(restored.database.equals(dump!)&&restored.objects.size===objects.size,'ARCHIVE_INTEGRITY');
  for(const [name,bytes] of objects)check(restored.objects.get(name)?.equals(bytes),'OBJECT_ARCHIVE_INTEGRITY');
  console.log('CHECK: ENCRYPTED_CAPTURE_AND_INTEGRITY=PASS');
  stage='LOCAL_PREREQUISITES';
  // This connection cannot be influenced by DATABASE_URL/MIGRATION_DATABASE_URL or URL parameters.
  target=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1,statement_timeout:60000,options:'-c timezone=UTC -c search_path=pg_catalog'});target.on('error',()=>{});
  const t=await target.connect();
  try{
   check((await t.query('select current_database() d,inet_server_port() p')).rows[0].d==='ab_drill','TARGET_GUARD');
   check(Number((await t.query("select count(*) n from pg_namespace where nspname in('ab','auth','storage')")).rows[0].n)===0,'TARGET_NOT_EMPTY');
   for(const r of context.roles){if(r.rolname!=='postgres')await t.query(`CREATE ROLE ${qi(r.rolname)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);}
   // A schema-filtered dump contains CREATE SCHEMA public. Preserve the empty template schema
   // under a different name rather than deleting it or allowing a false partial restore.
   check(Number((await t.query("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'")).rows[0].n)===0,'LOCAL_PUBLIC_NOT_EMPTY');
   await t.query('ALTER SCHEMA public RENAME TO ab_drill_initial_public');
   // Public extensions are represented in the schema-filtered dump itself.
   // Other available provider dependencies must precede restoration. Unsupported dependencies fail closed.
   for(const e of context.extensions){if(e.extname==='plpgsql'||e.nspname==='public')continue;const available=(await t.query('select 1 from pg_available_extensions where name=$1',[e.extname])).rowCount;if(available){if(e.nspname!=='public')await t.query(`CREATE SCHEMA IF NOT EXISTS ${qi(e.nspname)}`);await t.query(`CREATE EXTENSION ${qi(e.extname)} WITH SCHEMA ${qi(e.nspname)}`);}}
  }finally{t.release();}
  stage='ISOLATED_RESTORE';
  await docker(['exec','-i',container,'pg_restore','--host=127.0.0.1','--port=5432','--username=postgres','--dbname=ab_drill','--no-owner','--exit-on-error','--single-transaction'],{},restored.database);
  stage='COMPARE_RESTORED_DATA';
  const t2=await target.connect();try{
   const after=await manifest(t2);check(JSON.stringify(after)===JSON.stringify(before),'RESTORED_MANIFEST_MISMATCH');
   console.log('CHECK: RESTORED_TABLES_ROWS_CONSTRAINTS_RLS_TRIGGERS=PASS');
   const docTables=['document_versions','customer_files','vehicle_files'];let encryptedObjects=0;
   for(const table of docTables){const exists=(await t2.query('select to_regclass($1) t',['ab.'+table])).rows[0].t;if(!exists)continue;
    const digestColumn=table==='document_versions'?'sha256':'digest';
    for(const row of (await t2.query(`select storage_key,${qi(digestColumn)} as sha256 from ab.${qi(table)}`)).rows){const bytes=restored.objects.get('storage/'+row.storage_key);check(bytes,'REFERENCED_OBJECT_MISSING');const payload=security(process.env.DATA_ENCRYPTION_KEY!).open(bytes.toString());check(typeof payload.bytes==='string','DOCUMENT_CIPHER');check(sha(Buffer.from(payload.bytes,'base64'))===row.sha256,'DOCUMENT_HASH');encryptedObjects++;}}
   console.log('CHECK: PRIVATE_OBJECT_BYTES_AND_REFERENCES=PASS; ENCRYPTED_DOCUMENTS_CHECKED='+encryptedObjects);
   // Real role, on the isolated clone, with no tenant/user context must not see tenant companies.
   await t2.query('BEGIN READ ONLY');await t2.query('SET LOCAL ROLE ab_runtime');check(Number((await t2.query('select count(*) n from ab.companies')).rows[0].n)===0,'RUNTIME_ISOLATION');await t2.query('ROLLBACK');
   console.log('CHECK: RESTORED_RUNTIME_NO_CONTEXT_ACCESS_DENIED=PASS');
  }finally{await t2.query('ROLLBACK').catch(()=>{});t2.release();}
  // This is read-only; source data changes by other actors cannot be categorically ruled out.
  const final=await source.connect();try{await final.query('BEGIN READ ONLY');const ledger=(await final.query('select name,sha256 from public.ab_schema_migrations order by name')).rows;check(JSON.stringify(ledger)===JSON.stringify(context.ledger),'SOURCE_LEDGER_CHANGED');await final.query('ROLLBACK');}finally{await final.query('ROLLBACK').catch(()=>{});final.release();}
  await writeFile('work/backups/restore-proof.json',JSON.stringify({format:'AB-BACKUP-RESTORE-DRILL-1',snapshotId:snapshot,encryptedObjectsVerified:true,createdAt:new Date().toISOString(),sourceCommit:process.env.GITHUB_SHA,archiveSha256:sha(sealed),restoreVerified:true,sourceReadOnly:true,baseMigrations:context.ledger.length,tables:before.rows.length,archiveRetention:retain?'existing private bucket; create-only':'ephemeral runner only; no durable archive uploaded'},null,2),{mode:0o600,flag:'wx'});
  if(retain){
   stage='PRIVATE_METADATA_UPLOAD';
   const proof={format:'AB-RETAINED-BACKUP-1',createdAt:new Date().toISOString(),archivePath:paths.archive,archiveSha256:sha(sealed),sourceCommit:process.env.GITHUB_SHA,snapshotId:snapshot,restoreVerified:true,encryptedObjectsVerified:true,baseMigrations:context.ledger.length,backupArchiveBytesExcluded:true};
   const metadata=Buffer.from('AB-BACKUP-META-1\n'+security(cfg.key).seal(proof));
   await store.upload(paths.metadata,metadata);
   const downloaded=await store.downloadVerified(paths.metadata,metadata);await store.verifyNotPublic(paths.metadata);await store.verifyBucket(sealed.length);
   check(JSON.stringify(security(cfg.key).open(downloaded.toString().slice('AB-BACKUP-META-1\n'.length)))===JSON.stringify(proof),'BACKUP_METADATA_INTEGRITY');
   console.log('CHECK: ENCRYPTED_METADATA_DOWNLOAD_DECRYPT_AND_PUBLIC_DENIAL=PASS');
   console.log('LOCATION: BUCKET=ab-private-test; ARCHIVE='+paths.archive+'; METADATA='+paths.metadata);
   console.log('RESULT: PRIVATE_RETAINED_BACKUP_DOWNLOADED_AND_RESTORED_PASS; SOURCE_SQL_READ_ONLY; ONLY_NEW_BACKUP_OBJECTS_CREATED; NO_MIGRATIONS_OR_DEPLOYMENT');
  }else console.log('RESULT: HOSTED_BACKUP_ISOLATED_RESTORE_PASS; SOURCE_READ_ONLY; MIGRATIONS_UNCHANGED; ARCHIVE_EPHEMERAL_NOT_UPLOADED');
 }catch(error){
  const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DETAILS_WITHHELD';
  console.log('RESULT: BACKUP_RESTORE_STOP; STAGE='+stage+'; CODE='+code+'; SOURCE_SQL_READ_ONLY; NO_MIGRATIONS_OR_DEPLOYMENT');if(retainedPath)console.log('LOCATION: RETAINED_ARCHIVE='+retainedPath+'; NOT_DELETED_OR_OVERWRITTEN; VERIFICATION_INCOMPLETE');process.exitCode=1;
 }finally{await target?.end().catch(()=>{});await source?.end().catch(()=>{});}
}
if(/[/\\]backup-restore-drill\.(ts|js)$/.test(process.argv[1]||''))await main();
