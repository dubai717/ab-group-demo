// Rehearse the five approved files against the decrypted hosted snapshot on the local runner only.
import {Pool} from 'pg';
import {readFile,writeFile} from 'node:fs/promises';
import {restoreArchive} from '../src/backup.js';
import {sha} from '../src/core.js';
import {applyPreservingRelease} from './preserved-staging-release.js';
import {personnelReleaseGuard} from './personnel-release.js';
export async function verifiedBackup(){
 const bytes=await readFile('work/backups/staging.abbackup'),proof=JSON.parse(await readFile('work/backups/restore-proof.json','utf8'));
 if(proof.restoreVerified!==true||proof.encryptedObjectsVerified!==true||proof.archiveSha256!==sha(bytes)||!proof.snapshotId||Date.now()-Date.parse(proof.createdAt)>3600000)throw Error('fresh restored backup required');
 const restored=restoreArchive(bytes,process.env.BACKUP_ENCRYPTION_KEY||''),context=JSON.parse(restored.objects.get('metadata/restore-context.json')!.toString());if(context.snapshotId!==proof.snapshotId)throw Error('snapshot mismatch');return {context,proof};
}
async function run(){let pool:Pool|undefined;try{
 personnelReleaseGuard(process.env);const {context,proof}=await verifiedBackup();
 pool=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1,statement_timeout:120000,options:'-c timezone=UTC -c search_path=pg_catalog'});pool.on('error',()=>{});
 const r=await applyPreservingRelease(pool,context);
 await writeFile('work/personnel-release-restore-proof.json',JSON.stringify({...proof,format:'AB-PERSONNEL-RESTORE-PROOF-1',rehearsalVerified:true,migrationsApplied:r.applied}),{mode:0o600,flag:'wx'});
 console.log('RESULT: HOSTED_SNAPSHOT_MIGRATIONS_009_013_REHEARSED; OLD_ROWS_ROLES_GRANTS_POLICIES_AND_FUNCTIONS_PRESERVED; FK_AND_RLS_PASS; SOURCE_SCHEMA_UNCHANGED');
}catch(error){const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'WITHHELD';console.log('RESULT: REHEARSAL_STOP; CODE='+code+'; NO_SOURCE_SCHEMA_CHANGES');process.exitCode=1;}finally{await pool?.end().catch(()=>{});}}
if(/[/\\]staging-migration-rehearsal\.(ts|js)$/.test(process.argv[1]||''))await run();
