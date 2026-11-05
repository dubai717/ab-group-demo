import {PoolClient} from 'pg';import {randomUUID} from 'node:crypto';import {baseline} from './schema.js';import {sha,requireOk} from '../src/core.js';import {manifest} from '../deploy/backup-restore-drill.js';
export const projectHash='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f',controlPrefix='ab-group-reset-control/';
export const protectedObject=(k:string)=>k.startsWith('ab-group-backups/')||k.startsWith(controlPrefix);
export async function collectPlan(c:PoolClient,release:string){
 const b=await baseline(c,false),auth=(await c.query('select id,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,email_confirmed_at,role from auth.users order by id')).rows;
 for(const a of auth.filter(a=>a.id!==b.owner.auth_id))requireOk(a.role==='authenticated'&&/^\$2[aby]\$/.test(a.encrypted_password||'')&&(a.raw_app_meta_data?.providers||['email']).every((x:string)=>x==='email'),409,'identityRecoveryUnsupported');
 requireOk(Number((await c.query('select count(*)n from auth.mfa_factors where user_id<>$1',[b.owner.auth_id])).rows[0].n)===0,409,'mfaRecoveryUnsupported');
 requireOk(Number((await c.query("select count(*)n from auth.users where id<>$1 and coalesce(phone,'')<>''",[b.owner.auth_id])).rows[0].n)===0,409,'phoneRecoveryUnsupported');
 const users=(await c.query('select id,auth_id,username,auth_email,data from ab.users')).rows;
 requireOk(auth.length===users.length&&users.every(u=>auth.some(a=>a.id===u.auth_id&&a.email===u.auth_email)),409,'unmappedAuthIdentity');
 // A confirmed full reset includes every mapped test-environment identity, including manually created users; names never authorize or restrict deletion.
 requireOk(Number((await c.query("select count(*)n from pg_tables where schemaname='public' and tablename<>'ab_schema_migrations'")).rows[0].n)===0,409,'unrelatedPublicTables');
 const production=Number((await c.query("select count(*)n from ab.settings where key~*'(production|live.payments|bank.feed|whatsapp|sms|smtp|gps.live)'and(value->>'enabled'='true'or value->>'environment'='production'or value->>'mode'='live')")).rows[0].n);requireOk(production===0,409,'productionIntegration');
 const bucket=(await c.query('select public from storage.buckets where id=$1',['ab-private-test'])).rows[0];requireOk(bucket&&bucket.public===false,409,'privateBucketRequired');
 requireOk(Number((await c.query("select count(*)n from storage.objects where bucket_id<>'ab-private-test'")).rows[0].n)===0,409,'unreviewedStorageBucket');
 const files=(await c.query("select name from storage.objects where bucket_id='ab-private-test' order by name")).rows.map(x=>x.name).filter(k=>!protectedObject(k));
 requireOk(files.every(k=>typeof k==='string'&&k.length<1024&&!k.split('/').some((s:string)=>!s||s==='.'||s==='..')),409,'invalidObjectKey');
 const m=await manifest(c),counts=Object.fromEntries(m.rows.filter((x:any)=>x.s==='ab').map((x:any)=>[x.t,Number(x.n)]));
 // Normal login/audit/request bookkeeping cannot authorize a second reset or change business scope.
 const stable=m.rows.filter((x:any)=>x.s==='ab'&&!['sessions','audit_events','request_dedup','settings'].includes(x.t));
 const settings=(await c.query("select tenant_id,key,value from ab.settings where key not like 'reset-%' order by tenant_id,key")).rows;
 const authScope=auth.map(a=>({id:a.id,email:a.email,passwordHash:sha(a.encrypted_password||''),confirmed:!!a.email_confirmed_at}));
 const fingerprint=sha(JSON.stringify({release,stable,settings,authScope,files,owner:b.owner.id,chain:b.chain.map(m=>[m.name,m.sha256])}));
 const id=randomUUID(),now=Date.now();return {id,fingerprint,release,ownerId:b.owner.id,tenant:b.owner.tenant_id,ownerAuthId:b.owner.auth_id,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+600000).toISOString(),target:'original-staging' as const,counts,authIds:auth.filter(a=>a.id!==b.owner.auth_id).map(a=>a.id),files,retained:['original-owner','roles','permissions','approved-references'],backupVerified:false,restoreVerified:false,canExecute:false,blockers:['backup-preflight-required'],projectHash};
}
export type ResetPlan=Awaited<ReturnType<typeof collectPlan>>;
export function publicPlan(p:ResetPlan){const {id,fingerprint,release,ownerId,createdAt,expiresAt,target,counts,retained,backupVerified,restoreVerified,canExecute,blockers}=p;return {id,fingerprint,release,ownerId,createdAt,expiresAt,target,counts:{...counts,authIdentitiesToRemove:p.authIds.length,privateObjectsToRemove:p.files.length},retained,backupVerified,restoreVerified,canExecute,blockers};}
