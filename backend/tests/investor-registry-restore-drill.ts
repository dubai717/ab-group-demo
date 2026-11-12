import {assertEncryptedBackupEnvelope} from './backup-envelope-assertions.js';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {archive,restoreArchive} from '../src/backup.js';
import {transaction} from '../src/core.js';

// Exclusively synthetic local fixture databases. No hosted backup, role changes or restore-in-place.
export async function investorRegistryRestoreDrill(f:any,upgrade:boolean){
 assert.match(f.sourceDatabase,/^ab_backup_[a-f0-9]+$/);
 const env={...process.env};
 for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
 const docker=(args:string[],input?:Buffer)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,stdio:['pipe','pipe','pipe'],input,maxBuffer:64*1024*1024});
 const tables=(await f.admin.query("select tablename from pg_tables where schemaname='ab' order by tablename")).rows.map((r:any)=>r.tablename);
 assert(tables.every((t:string)=>/^[a-z_0-9]+$/.test(t)));
 const columns:any={};for(const t of tables)columns[t]=(await f.admin.query("select column_name from information_schema.columns where table_schema='ab' and table_name=$1 order by ordinal_position",[t])).rows.map((r:any)=>'"'+r.column_name.replaceAll('"','""')+'"').join(',');
 const snapshot=async(pool:Pool)=>{const rows:any={};for(const t of tables)rows[t]=(await pool.query('select to_jsonb(x) row from (select '+columns[t]+' from ab.'+t+') x order by to_jsonb(x)::text')).rows;return rows;};
 const before=await snapshot(f.admin),dump=docker(['exec','ab-postgres-foundation','pg_dump','-U','postgres','-d',f.sourceDatabase,'-Fc','--no-owner']);
 const key=randomBytes(32).toString('base64'),sealed=archive(dump,new Map(f.objects.rows),key);
 assertEncryptedBackupEnvelope(sealed,key,dump);
 assert.throws(()=>restoreArchive(sealed,randomBytes(32).toString('base64')));
 const corrupt=Buffer.from(sealed);corrupt[corrupt.length-12]^=1;assert.throws(()=>restoreArchive(corrupt,key));
 const restored=restoreArchive(sealed,key);
 assert.deepEqual(restored.database,dump);assert.deepEqual(restored.objects,new Map(f.objects.rows));
 const name='ab_restore_'+randomUUID().replaceAll('-','');let target:Pool|undefined,runtime:Pool|undefined,created=false;
 try{
  docker(['exec','ab-postgres-foundation','createdb','-U','postgres',name]);created=true;
  docker(['exec','-i','ab-postgres-foundation','pg_restore','-U','postgres','-d',name,'--no-owner','--exit-on-error'],restored.database);
  target=new Pool({host:'127.0.0.1',port:5441,user:'postgres',password:f.secret.admin,database:name});
  assert.deepEqual(await snapshot(target),before);
  if(upgrade){
   const sql=await readFile('docs/proposals/investor-registry-versions.review-only.sql','utf8');
   // A deliberate failure must roll back DDL and the final activation marker together.
   await target.query('BEGIN');await target.query(sql);await assert.rejects(target.query('select 1/0'));await target.query('ROLLBACK');
   assert.equal((await target.query("select to_regclass('ab.investor_agreement_versions') marker")).rows[0].marker,null);
   assert.deepEqual(await snapshot(target),before);
   await target.query('BEGIN');await target.query(sql);await target.query('COMMIT');
   assert.equal((await target.query('select count(*)::int n from ab.investor_profiles where identity_hash is not null')).rows[0].n,0);
   assert.deepEqual(await snapshot(target),before); // Every legacy table, encrypted row and grant is unchanged.
   assert.equal((await f.admin.query("select to_regclass('ab.investor_agreement_versions') marker")).rows[0].marker,null);
  }
  assert.equal((await target.query('select ab.investor_registry_schema_version() v')).rows[0].v,'INVESTOR-REGISTRY-REVIEW-1');
  runtime=new Pool({host:'127.0.0.1',port:5441,user:'ab_runtime',password:f.secret.runtime,database:name});
  assert.equal((await runtime.query('select * from ab.investor_profiles')).rowCount,0);
  await transaction(runtime,f.org.tenant,f.org.user,async c=>assert((await c.query('select * from ab.investor_profiles')).rowCount!>0));
  await assert.rejects(runtime.query('update ab.investor_agreement_versions set version=999'),(e:any)=>e.code==='42501');
  await assert.rejects(runtime.query('delete from ab.investor_principal_releases'),(e:any)=>e.code==='42501');
  assert.deepEqual(await snapshot(f.admin),before); // Restore never mutates the original synthetic database.
  console.log('PASS investor restore drill: '+(upgrade?'legacy backup restored, atomic rollback and upgrade preserved all legacy rows':'versioned agreements, financial movements and private object bytes restored exactly')+'; RLS and immutable grants retained.');
 }finally{
  if(runtime)await runtime.end();if(target)await target.end();
  // Only the random database this drill created; never the source or any hosted database.
  if(created)docker(['exec','ab-postgres-foundation','dropdb','-U','postgres',name]);
 }
}
