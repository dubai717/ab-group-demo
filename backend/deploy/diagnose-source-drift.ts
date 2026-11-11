import {oldSettingsFromIsolatedCopy,classifySettingsChanges} from './drift-settings.js';
// Read-only diagnosis against the verified retained archive from failed delivery #10.
import {Pool} from 'pg';
import {writeFile,mkdir} from 'node:fs/promises';
import {controllerContext} from './v2/context.mjs';
import {backupConnection,backupLimit} from './backup-staging.js';
import {privateBackupStore,isRetainedBackupPath} from './private-backup-store.js';
import {restoreArchive} from '../src/backup.js';
import {security,sha,supabaseKeys} from '../src/core.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {manifest} from './backup-restore-drill.js';
import {businessCatalog,validateBusinessLedger} from './business-centers-catalog.mjs';
import {approvedCatalog} from './safe-staging-additives.js';
import {sourceDifference,sourceTableFingerprint} from './source-fingerprint.js';
export const driftArchive='ab-group-backups/v1/20261107T143329859Z-387ee2ab-4256-422a-b227-40a01979aee7/database.abbackup';
const need=(ok:unknown,code:string)=>{if(!ok)throw Error(code);};
const transient=new Set(['audit_events','sessions','request_dedup','finance_notifications']);
const auditedEntities:Record<string,string[]>={companies:['company'],company_licenses:['company'],bank_accounts:['bank'],customers:['customer'],customer_events:['customer'],vehicles:['vehicle'],vehicle_events:['vehicle'],tasks:['task'],hr_task_events:['task','hr_task']};
export function classifySourceDrift(changed:string[],events:{action:string;entity_type:string;events:number}[]){
 if(!changed.length)return{classification:'SOURCE_NOW_MATCHES_OLD_SNAPSHOT_CAUSE_UNPROVEN',mayRetry:false};
 if(changed.every(t=>transient.has(t)))return{classification:'ROUTINE_ACCESS_OR_NOTIFICATION_METADATA_ONLY',mayRetry:true};
 if(changed.every(t=>transient.has(t)||auditedEntities[t]?.some(kind=>events.some(e=>e.entity_type===kind&&e.events>0))))return{classification:'AUDITED_BUSINESS_ACTIVITY',mayRetry:true};
 return{classification:'UNEXPLAINED_OR_SECURITY_RELEVANT_SOURCE_CHANGE',mayRetry:false};
}
async function boundedObject(endpoint:string,key:string,path:string,max:number){
 need(isRetainedBackupPath(path),'DIAGNOSTIC_BACKUP_PATH');const r=await fetch(endpoint+'/storage/v1/object/ab-private-test/'+path.split('/').map(encodeURIComponent).join('/'),{headers:{apikey:key},redirect:'error',signal:AbortSignal.timeout(30000)});need(r.ok&&r.body,'DIAGNOSTIC_BACKUP_READ');const chunks:Buffer[]=[];let length=0;for await(const b of r.body as any){length+=b.length;need(length<=max,'DIAGNOSTIC_BACKUP_SIZE');chunks.push(Buffer.from(b));}return Buffer.concat(chunks);
}
export async function diagnoseSourceDrift(){let pool:Pool|undefined;try{
 need(controllerContext(process.env)&&process.env.AB_STAGING_AUTOMATION==='controlled-test-only','DIAGNOSTIC_PROTECTED_CONTROLLER');const cfg=backupConnection(process.env);need(sha(new URL(cfg.endpoint).origin)==='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f','DIAGNOSTIC_TEST_PROJECT');
 pool=new Pool({...databaseOptions(cfg.uri),max:1,options:'-c default_transaction_read_only=on -c timezone=UTC -c search_path=pg_catalog'});pool.on('error',()=>{});const c=await pool.connect();try{
 assertVerifiedDatabaseTls(c);await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');need((await c.query('show transaction_read_only')).rows[0].transaction_read_only==='on','DIAGNOSTIC_NOT_READ_ONLY');
 const ledger=(await c.query('select name,sha256 from public.ab_schema_migrations order by name')).rows,pending=validateBusinessLedger(ledger,await approvedCatalog(),businessCatalog());
 if(!pending.length){await c.query('ROLLBACK');console.log('RESULT: DRIFT_DIAGNOSTIC_CATALOG_ALREADY_APPLIED; NO_RETRY_OR_SOURCE_MUTATION');return;}
 if(pending.length===1&&pending[0].name==='026_investor_registry_versions.sql'){await c.query('ROLLBACK');console.log('RESULT: REVIEWED_INVESTOR_UPGRADE_REQUIRES_FRESH_BACKUP_AND_STRICT_SOURCE_COMPARISON; OLD_BOOTSTRAP_ARCHIVE_NOT_APPLICABLE; NO_SOURCE_WRITES');return;}
 need(pending.length===12,'DIAGNOSTIC_UNEXPECTED_PARTIAL_LEDGER');const keys=supabaseKeys();need(keys.secret,'DIAGNOSTIC_STORE_SECRET');const store=privateBackupStore(cfg.endpoint,keys.secret!);await store.verifyBucket(1);
 const sealedMeta=await boundedObject(cfg.endpoint,keys.secret!,driftArchive.replace('database.abbackup','metadata.abmeta'),65536),header='AB-BACKUP-META-1\n';need(sealedMeta.subarray(0,header.length).toString()===header,'DIAGNOSTIC_METADATA_FORMAT');const meta=security(cfg.key).open(sealedMeta.toString().slice(header.length));need(meta.restoreVerified===true&&meta.encryptedObjectsVerified===true&&meta.archivePath===driftArchive,'DIAGNOSTIC_OLD_RESTORE_PROOF');
 const sealed=await boundedObject(cfg.endpoint,keys.secret!,driftArchive,backupLimit);need(sha(sealed)===meta.archiveSha256,'DIAGNOSTIC_ARCHIVE_HASH');const archive=restoreArchive(sealed,cfg.key),context=JSON.parse(archive.objects.get('metadata/restore-context.json')!.toString());need(context.snapshotId===meta.snapshotId&&context.format==='AB-DRILL-CONTEXT-1','DIAGNOSTIC_SNAPSHOT_ID');need(JSON.stringify(ledger)===JSON.stringify(context.ledger),'DIAGNOSTIC_SOURCE_LEDGER_CHANGED');
 const current=await manifest(c);for(const kind of ['constraints','policies','triggers']as const){const select=(items:any[])=>items.filter(x=>kind==='policies'?x.schemaname==='ab':x.s==='ab');need(JSON.stringify(select(current[kind]))===JSON.stringify(select(context.manifest[kind])),'DIAGNOSTIC_SOURCE_SCHEMA_CHANGED');}
 const before=context.manifest.rows.filter((r:any)=>r.s==='ab'),after=current.rows.filter((r:any)=>r.s==='ab');need(before.length===after.length,'DIAGNOSTIC_TABLE_SET_CHANGED');const differences=[];
 for(const t of before){const now=after.find((a:any)=>a.t===t.t);need(now,'DIAGNOSTIC_TABLE_LOST');if(sourceDifference(t,now)){need(!sourceDifference(now,await sourceTableFingerprint(c,t.s,t.t)),'DIAGNOSTIC_HASH_NOT_REPEATABLE');differences.push({table:t.t,rowsBefore:Number(t.n),rowsAfter:Number(now.n),sameCount:t.n===now.n});}}
 need(!(await c.query("select 1 from ab.finance_journals j where j.status='Posted'and(select coalesce(sum(e.debit-e.credit),0)from ab.finance_entries e where e.journal_id=j.id)<>0 limit 1")).rowCount,'DIAGNOSTIC_UNBALANCED_JOURNAL');
 const events=(await c.query('select action,entity_type,count(*)::int events from ab.audit_events where created_at>=$1 group by action,entity_type order by 3 desc limit 30',[context.createdAt])).rows;
 let settings:any=null;if(differences.some(d=>d.table==='settings'))settings=classifySettingsChanges(await oldSettingsFromIsolatedCopy(archive.database),(await c.query('select tenant_id,key,value,value::text raw_value from ab.settings')).rows,process.env.DATA_ENCRYPTION_KEY||'');// Attribution only: settings remain in differences and in the full source guard after the fresh backup.
 const tablesNeedingAttribution=differences.map(x=>x.table).filter(t=>t!=='settings'||!settings?.mayRetry);let result=classifySourceDrift(tablesNeedingAttribution,events);if(settings?.mayRetry&&(!tablesNeedingAttribution.length||result.mayRetry))result={classification:tablesNeedingAttribution.length?'VERIFIED_UI_PREFERENCES_WITH_RECORDED_ACTIVITY':'VERIFIED_UI_PREFERENCE_ACTIVITY_ONLY',mayRetry:true};await c.query('ROLLBACK');
 if(settings)for(const change of settings.changes)console.log('CHECK: SETTING_CHANGE_KIND='+change.kind+'; SAME_LOGICAL_VALUE='+change.sameLogical+'; KEYS_USERS_AND_VALUES_WITHHELD');
 for(const d of differences)console.log('CHECK: SOURCE_DRIFT_TABLE=ab.'+d.table+'; ROWS_BEFORE='+d.rowsBefore+'; ROWS_AFTER='+d.rowsAfter+'; SAME_COUNT='+d.sameCount+'; VALUES_AND_HASHES_WITHHELD');
 const safeKinds=new Set(['session','user','company','bank','document','customer','vehicle','task','hr_task','notification']),safeActions=new Set(['login','logout','created','updated','viewed','downloaded','document_viewed','document_downloaded','granted','revoked','activated','deactivated']);for(const e of events)console.log('CHECK: AUDIT_ACTIVITY; ACTION='+(safeActions.has(e.action)?e.action:'other')+'; ENTITY='+(safeKinds.has(e.entity_type)?e.entity_type:'other')+'; COUNT='+e.events);
 await mkdir('work',{recursive:true});await writeFile('work/source-drift-diagnostic.json',JSON.stringify({format:'AB-SOURCE-DRIFT-1',readOnly:true,oldBackupRestoreVerified:true,consistentComparison:true,sourceSchemaUnchanged:true,balancedPostedJournals:true,...result,differences,settings}),{mode:0o600});console.log('RESULT: '+result.classification+'; SOURCE_READ_ONLY; NO_VALUES_CREDENTIALS_OR_HASHES_DISCLOSED');need(result.mayRetry,'DIAGNOSTIC_CAUSE_REQUIRES_REVIEW');
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
 }catch(error){console.log('RESULT: SOURCE_DIAGNOSTIC_STOP; CODE='+(error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DETAILS_WITHHELD')+'; NO_NEW_BACKUP_MIGRATION_OR_DEPLOYMENT');throw Error('SOURCE_DIAGNOSTIC_FAILED');}finally{await pool?.end().catch(()=>{});}}
if(/[/\\]diagnose-source-drift\.(ts|js)$/.test(process.argv[1]||''))await diagnoseSourceDrift().catch(()=>{process.exitCode=1;});
