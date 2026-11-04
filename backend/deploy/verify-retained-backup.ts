// Read existing approved backup only. No hosted SQL connection or cloud mutation API.
import {Pool} from 'pg';
import {security,sha} from '../src/core.js';
import {restoreArchive} from '../src/backup.js';
import {privateBackupStore} from './private-backup-store.js';
import {docker,manifest} from './backup-restore-drill.js';
const folder='ab-group-backups/v1/20261104T064609923Z-81d364cf-42f2-4d28-905e-e21f08563405/';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
async function run(){let local:Pool|undefined,stage='GUARD';try{
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&process.env.GITHUB_EVENT_NAME==='push'&&process.env.GITHUB_REF==='refs/heads/verify/retained-backup-before-merge-20261104','RUNNER_GUARD');
 const endpoint=process.env.SUPABASE_URL||'',secret=process.env.SUPABASE_SECRET_KEY||'',key=process.env.BACKUP_ENCRYPTION_KEY||'',dataKey=process.env.DATA_ENCRYPTION_KEY||'';
 need(key&&dataKey&&key!==dataKey&&Buffer.from(key,'base64').length===32&&Buffer.from(key,'base64').toString('base64')===key&&Buffer.from(dataKey,'base64').length===32,'KEYS');
 const store=privateBackupStore(endpoint,secret);need(secret,'STORE_KEY');
 async function get(name:string,limit:number){const r=await fetch(endpoint+'/storage/v1/object/ab-private-test/'+name.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:secret},redirect:'error',signal:AbortSignal.timeout(30000)});need(r.ok&&r.body,'OBJECT_GET');let size=0;const chunks:Buffer[]=[];for await(const b of r.body as any){size+=b.length;need(size<=limit,'OBJECT_SIZE');chunks.push(Buffer.from(b));}return Buffer.concat(chunks);}
 stage='READ_PRIVATE_BUCKET';await store.verifyBucket(1);console.log('CHECK: EXISTING_BUCKET_PRIVATE=PASS');
 stage='DOWNLOAD_EXISTING_METADATA';const meta=await get(folder+'metadata.abmeta',65536);need(meta.subarray(0,'AB-BACKUP-META-1\n'.length).toString()==='AB-BACKUP-META-1\n','META_HEADER');
 const proof=security(key).open(meta.toString().slice('AB-BACKUP-META-1\n'.length));need(proof.format==='AB-RETAINED-BACKUP-1'&&proof.archivePath===folder+'database.abbackup'&&proof.restoreVerified===true&&proof.encryptedObjectsVerified===true&&/^[a-f0-9]{64}$/.test(proof.archiveSha256),'META_PROOF');
 stage='DOWNLOAD_EXISTING_ARCHIVE';const bytes=await get(proof.archivePath,50*1024*1024);need(sha(bytes)===proof.archiveSha256,'ARCHIVE_HASH');const restored=restoreArchive(bytes,key);
 const context=JSON.parse(restored.objects.get('metadata/restore-context.json')!.toString());need(context.format==='AB-DRILL-CONTEXT-1'&&context.snapshotId===proof.snapshotId&&context.ledger.length===8,'CONTEXT');
 await store.verifyNotPublic(folder+'database.abbackup');await store.verifyNotPublic(folder+'metadata.abmeta');console.log('CHECK: EXISTING_ENCRYPTED_BACKUP_METADATA_AND_PUBLIC_DENIAL=PASS');
 stage='PREPARE_LOCAL_ONLY';local=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1,statement_timeout:60000,options:'-c timezone=UTC -c search_path=pg_catalog'});local.on('error',()=>{});const c=await local.connect();try{
 need((await c.query('select current_database() d')).rows[0].d==='ab_drill','LOCAL_TARGET');need(Number((await c.query("select count(*) n from pg_namespace where nspname in('ab','auth','storage')")).rows[0].n)===0,'LOCAL_NOT_EMPTY');
 for(const r of context.roles)if(r.rolname!=='postgres')await c.query(`CREATE ROLE ${qi(r.rolname)} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`);
 need(Number((await c.query("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'")).rows[0].n)===0,'LOCAL_PUBLIC_NOT_EMPTY');await c.query('ALTER SCHEMA public RENAME TO ab_drill_initial_public');
 for(const e of context.extensions){if(e.extname==='plpgsql'||e.nspname==='public')continue;if((await c.query('select 1 from pg_available_extensions where name=$1',[e.extname])).rowCount){await c.query(`CREATE SCHEMA IF NOT EXISTS ${qi(e.nspname)}`);await c.query(`CREATE EXTENSION ${qi(e.extname)} WITH SCHEMA ${qi(e.nspname)}`);}}
 }finally{c.release();}
 stage='RESTORE_EXISTING_ARCHIVE';await docker(['exec','-i','ab-backup-drill-postgres','pg_restore','--host=127.0.0.1','--port=5432','--username=postgres','--dbname=ab_drill','--no-owner','--exit-on-error','--single-transaction'],{},restored.database);
 stage='COMPARE_EXISTING_RESTORE';const t=await local.connect();try{
 need(JSON.stringify(await manifest(t))===JSON.stringify(context.manifest),'MANIFEST');let docs=0;
 for(const table of ['document_versions','customer_files','vehicle_files']){if(!(await t.query('select to_regclass($1) t',['ab.'+table])).rows[0].t)continue;for(const r of(await t.query(`select storage_key,sha256 from ab.${qi(table)}`)).rows){const b=restored.objects.get('storage/'+r.storage_key);need(b,'MISSING_OBJECT');const payload=security(dataKey).open(b.toString());need(typeof payload.bytes==='string'&&sha(Buffer.from(payload.bytes,'base64'))===r.sha256,'DOCUMENT_HASH');docs++;}}
 await t.query('BEGIN READ ONLY');await t.query('SET LOCAL ROLE ab_runtime');need(Number((await t.query('select count(*) n from ab.companies')).rows[0].n)===0,'RUNTIME_ISOLATION');await t.query('ROLLBACK');
 console.log('CHECK: EXISTING_BACKUP_TABLES_DATA_RELATIONS_RLS_AND_DOCUMENTS=PASS; DOCUMENTS='+docs);
 }finally{await t.query('ROLLBACK').catch(()=>{});t.release();}
 console.log('RESULT: EXISTING_RETAINED_BACKUP_RESTORED_PASS; CLOUD_GET_ONLY; NO_UPLOAD_DELETE_MIGRATIONS_OR_DEPLOYMENT');
 }catch{console.log('RESULT: EXISTING_BACKUP_STOP; STAGE='+stage+'; DETAILS_WITHHELD; CLOUD_GET_ONLY');process.exitCode=1;}finally{await local?.end().catch(()=>{});}}
await run();
