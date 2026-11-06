// Restore only the approved application namespace; managed identities/files use supported APIs.
import {PoolClient} from 'pg';import {docker} from '../deploy/backup-restore-drill.js';import {requireOk,sha} from '../src/core.js';import {ManagedProviders} from './providers.js';import {protectedObject} from './plan.js';
export async function restoreHostedApplication(c:PoolClient,uri:string,dump:Buffer,ledger:any[]){
 const d=new URL(uri),env={PGHOST:d.hostname,PGPORT:'5432',PGDATABASE:'postgres',PGUSER:decodeURIComponent(d.username),PGPASSWORD:decodeURIComponent(d.password),PGSSLMODE:'verify-full',PGSSLROOTCERT:'/tmp/ab-ca.crt'};
 await docker(['exec','-i',...Object.keys(env).flatMap(k=>['--env',k]),'ab-backup-drill-postgres','pg_restore','--no-owner','--exit-on-error','--single-transaction','--dbname=postgres','--clean','--if-exists','--schema=ab'],env,dump);
 await c.query('BEGIN');try{await c.query('delete from public.ab_schema_migrations');for(const m of ledger)await c.query('insert into public.ab_schema_migrations(name,sha256,applied_at)values($1,$2,$3)',[m.name,m.sha256,m.applied_at]);await c.query('COMMIT');}catch(e){await c.query('ROLLBACK');throw e;}
}
export async function restoreProviders(p:ManagedProviders,users:any[],owner:string,objects:Map<string,Buffer>){
 for(const u of users){if(u.id===owner)continue;if(!(await p.inspect(u.id)))await p.restoreUser(u);}
 for(const [key,bytes] of objects){if(!key.startsWith('storage/'))continue;const name=key.slice(8);if(!protectedObject(name))await p.restoreFile(name,bytes);}
}
export async function verifyRecovery(c:PoolClient,p:ManagedProviders,users:any[],ownerBefore:any,objects:Map<string,Buffer>){
 const auth=(await c.query('select id,email,encrypted_password from auth.users order by id')).rows;requireOk(auth.length===users.length&&users.every(u=>auth.some(a=>a.id===u.id&&a.email===u.email&&a.encrypted_password===u.encrypted_password)),409,'recoveryAuthMismatch');
 requireOk(sha(JSON.stringify((await c.query('select * from auth.users where id=$1',[ownerBefore.id])).rows[0]))===sha(JSON.stringify(ownerBefore)),409,'recoveryOwnerAuthChanged');
 for(const [key,bytes]of objects){if(!key.startsWith('storage/')||protectedObject(key.slice(8)))continue;const b=await p.getFile(key.slice(8));requireOk(b&&sha(b)===sha(bytes),409,'recoveryBytesMismatch');}
}
