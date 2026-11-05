// Read-only preview. This file deliberately has no deletion or source-mutation path.
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {restoreArchive} from '../src/backup.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {requireOk,security,sha,supabaseKeys} from '../src/core.js';
import {registryKey,registrySchema,testProjectHash} from '../src/test-users.js';
import {TEST_DATA_KEY,DataManifest} from '../src/test-data-manifest.js';
import {verifiedBackup} from '../deploy/staging-migration-rehearsal.js';
import {privateBackupStore,newBackupPaths} from '../deploy/private-backup-store.js';
import {cleanupPreview} from './test-data-cleanup-plan.js';
let pool:Pool|undefined,stage='GUARD';
try{
 const e=process.env;requireOk(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&e.GITHUB_EVENT_NAME==='push'&&e.GITHUB_REF==='refs/heads/verify/test-data-cleanup-preview-20261105'&&e.AB_TEST_DATA_PREVIEW==='read-only-no-deletion',403,'trustedPreviewRunnerRequired');
 const endpoint=new URL(e.SUPABASE_URL||''),db=new URL(e.MIGRATION_DATABASE_URL||'');requireOk(sha(endpoint.origin)===testProjectHash&&decodeURIComponent(db.username)==='postgres.'+endpoint.hostname.split('.')[0]&&db.hostname.endsWith('.pooler.supabase.com')&&(db.port||'5432')==='5432'&&db.pathname==='/postgres',403,'testTargetMismatch');
 stage='VERIFIED_BACKUP';const backup=await verifiedBackup(),snapshotObjects=restoreArchive(await readFile('work/backups/staging.abbackup'),e.BACKUP_ENCRYPTION_KEY||'').objects;const cipher=security(e.DATA_ENCRYPTION_KEY||'');pool=new Pool({...databaseOptions(db.href),max:1,statement_timeout:60000});pool.on('error',()=>{});const c=await pool.connect();let plan:any;
 try{
  assertVerifiedDatabaseTls(c);await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');requireOk((await c.query('show transaction_read_only')).rows[0].transaction_read_only==='on',403,'readOnlyRequired');
  requireOk((await c.query('show session_replication_role')).rows[0].session_replication_role==='origin',403,'normalTriggersRequired');stage='SEALED_DATASET_IDENTITY';const controllers=(await c.query("select id,tenant_id,md5(row_to_json(u)::text) hash from ab.users u where username='trial_4db27b82b8bf'and role_id='owner'and status='Active'")).rows;requireOk(controllers.length===1,409,'originalOwnerNeedsReview');const root=controllers[0];
  const reg=(await c.query('select value from ab.settings where tenant_id=$1 and key=$2',[root.tenant_id,registryKey])).rows[0];requireOk(reg,409,'managedSuiteRequired');const r=registrySchema.parse(cipher.open(reg.value.sealed));requireOk(!r.users.some(u=>u.id===root.id),409,'originalOwnerExcluded');
  const value=(await c.query('select value from ab.settings where tenant_id=$1 and key=$2',[r.tenant,TEST_DATA_KEY])).rows[0];requireOk(value?.value.marker==='TEST_DATA',409,'testManifestRequired');const d=cipher.open(value.value.cipher)as DataManifest;
  stage='EXACT_ROW_AND_RELATION_INSPECTION';plan=await cleanupPreview(c,cipher,d,r);plan.protectedOriginalOwner=root;plan.fingerprint=sha(JSON.stringify({scope:plan.fingerprint,originalOwner:root}));plan.backup={archiveSha256:backup.proof.archiveSha256,snapshotId:backup.proof.snapshotId,restoreVerified:true};
  for(const object of plan.privateObjects){const b=snapshotObjects.get('storage/'+object.key);requireOk(b&&sha(b)===object.sha,409,'objectManifestMismatch');}
  await c.query('ROLLBACK');
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
 stage='RETAIN_ENCRYPTED_PREVIEW';const paths=newBackupPaths(),bytes=Buffer.from('AB-BACKUP-META-1\n'+security(e.BACKUP_ENCRYPTION_KEY||'').seal(plan)),store=privateBackupStore(endpoint.origin,supabaseKeys().secret);await store.upload(paths.metadata,bytes);await store.downloadVerified(paths.metadata,bytes);await store.verifyNotPublic(paths.metadata);
 console.log('PREVIEW_COUNTS: '+JSON.stringify(plan.originalCounts));console.log('PREVIEW_TABLES: '+JSON.stringify(plan.tableCounts));console.log('PREVIEW_PROTECTED: '+JSON.stringify(plan.protectedCounts));console.log('PREVIEW_BLOCKERS: '+JSON.stringify(plan.blockers));console.log('PREVIEW_DELETE_GUARDS: '+JSON.stringify(plan.deleteGuards.map((x:any)=>({table:x.table_name,trigger:x.name,function:x.function_name}))));
 console.log('PREVIEW_RELATIONS: '+JSON.stringify(plan.externalFK.map((x:any)=>({child:x.child,parent:x.parent,count:x.count}))));console.log('PREVIEW_JSON_REFERENCES: '+JSON.stringify(plan.externalJSON.reduce((a:any,r:any)=>(a[r.table]=(a[r.table]||0)+1,a),{})));console.log('PREVIEW_FILES: '+plan.privateObjects.length);console.log('PREVIEW_FINGERPRINT: '+plan.fingerprint);console.log('PREVIEW_PRIVATE_PATH: '+paths.metadata);console.log('RESULT: ENCRYPTED_CLEANUP_PREVIEW_RETAINED; SOURCE_READ_ONLY; NO_DELETION_DEPLOYMENT_MIGRATION_PERMISSION_OR_ACCOUNT_CHANGE; FINAL_USER_APPROVAL_REQUIRED');
}catch(error){const e=error as any;console.log('RESULT: CLEANUP_PREVIEW_STOP; STAGE='+stage+'; CODE='+(/^[a-zA-Z0-9_]+$/.test(e?.message||'')?e.message:/^[0-9A-Z]{5}$/.test(e?.code||'')?e.code:'WITHHELD')+'; NO_DELETION');process.exitCode=1;}finally{await pool?.end().catch(()=>{});}
