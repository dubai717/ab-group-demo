// One coordinated sequence; no entrypoint/credentials here. Hosted caller validates its signed request.
import {randomUUID} from 'node:crypto';
import {PoolClient} from 'pg';import {requireOk,sha} from '../src/core.js';import {baseline,rebuild,verifyEmpty,Baseline} from './schema.js';import {ResetPlan,collectPlan,protectedObject} from './plan.js';import {ManagedProviders} from './providers.js';
export interface RecoveryProof {verified:boolean;freshAt:number;archivePath:string;}
export async function executeReset(c:PoolClient,p:ResetPlan,providers:ManagedProviders,o:{requestId?:string;release:string;proof:RecoveryProof;phase:(s:string)=>Promise<void>;backupUsers:any[];recoveryObjects:Map<string,Buffer>;restoreApplication:()=>Promise<void>}){
 requireOk(o.proof.verified&&o.proof.freshAt>Date.now()-15*60000&&/^ab-group-backups\/v1\//.test(o.proof.archivePath),409,'freshVerifiedBackupRequired');
 const actual=await collectPlan(c,o.release);requireOk(p.fingerprint===actual.fingerprint&&p.ownerId===actual.ownerId&&p.ownerAuthId===actual.ownerAuthId,409,'previewChanged');
 requireOk(p.authIds.every(id=>id!==p.ownerAuthId)&&p.files.every(k=>!protectedObject(k)),403,'protectedScope');
 const b=await baseline(c,false);let touched=false;try{
  await o.phase('rebuilding');await rebuild(c,b);touched=true;
  await o.phase('storage-cleanup');await providers.removeFiles(p.files);
  await o.phase('auth-cleanup');for(const id of p.authIds)await providers.removeUser(id,p.ownerAuthId);
  await o.phase('verification');await verifyEmpty(c,b);
  const auth=(await c.query('select * from auth.users order by id')).rows;requireOk(auth.length===1&&auth[0].id===p.ownerAuthId&&sha(JSON.stringify(auth[0]))===b.authHash,409,'ownerAuthOrCountChanged');
  const remaining=(await c.query("select name from storage.objects where bucket_id='ab-private-test'")).rows.filter(x=>!protectedObject(x.name));requireOk(remaining.length===0,409,'filesRemain');
  const identity=await providers.inspect(p.ownerAuthId);requireOk(identity?.id===p.ownerAuthId&&identity.email===b.owner.auth_email&&identity.email_confirmed_at,409,'ownerProviderUnavailable');
  await c.query("insert into ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)values($1,$2,$3,'test_reset_completed','reset_request',$4,ARRAY['owner-preserved','verified-backup'],$5)",[randomUUID(),b.owner.tenant_id,b.owner.id,o.requestId||p.id,randomUUID()]);
  await o.phase('complete-awaiting-owner-login');return {complete:true,ownerUnchanged:true};
 }catch(e){
  // Recovery is attempted once, stays fenced until its verification completes, and never overwrites differing bytes.
  if(touched){await o.phase('recovering');try{
   for(const user of o.backupUsers){if(user.id===p.ownerAuthId)continue;if(!(await providers.inspect(user.id)))await providers.restoreUser(user);}
   await o.restoreApplication();
   for(const k of p.files){const bytes=o.recoveryObjects.get('storage/'+k);requireOk(bytes,409,'recoveryObjectMissing');await providers.restoreFile(k,bytes);}
   const owner=(await c.query('select * from ab.users where id=$1',[b.owner.id])).rows[0];requireOk(JSON.stringify(owner)===JSON.stringify(b.owner),409,'recoveryOwnerChanged');
   const auth=(await c.query('select id,email,encrypted_password from auth.users order by id')).rows;requireOk(o.backupUsers.every(u=>auth.some(a=>a.id===u.id&&a.email===u.email&&a.encrypted_password===u.encrypted_password))&&auth.length===o.backupUsers.length,409,'recoveryAuthMismatch');
   for(const k of p.files){const restored=await providers.getFile(k);requireOk(restored&&sha(restored)===sha(o.recoveryObjects.get('storage/'+k)!),409,'recoveryFileMismatch');}
   await o.phase('failed-rolled-back');
  }catch(recoveryError){await o.phase('failed-recovery-required');throw Error('resetRecoveryRequired',{cause:{original:e,recovery:recoveryError}});}}
  if(!touched)await o.phase('failed-no-changes');
  throw e;
 }
}
