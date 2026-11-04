// Read-only diagnosis. No role/password/schema changes or ERP fixtures.
import {Pool} from 'pg';
import {lookup} from 'node:dns/promises';
import {scramVerifier,runtimeConfiguration} from './runtime-setup.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {connectionDiagnostic} from '../src/connection-diagnostics.js';
export async function inspectRole(c:any,password:string){
 await c.query('BEGIN READ ONLY');
 try{
  assertVerifiedDatabaseTls(c);
  const r=(await c.query("select rolcanlogin,rolvaliduntil is not null and rolvaliduntil < now() expired,rolsuper,rolbypassrls,rolpassword from pg_authid where rolname='ab_runtime'")).rows[0];
  if(!r)throw Error('role missing');
  console.log(r.rolcanlogin?'DIAGNOSTIC: ab_runtime LOGIN=true':'DIAGNOSTIC: ab_runtime LOGIN=false');
  console.log(r.expired?'DIAGNOSTIC: runtime password expired':'DIAGNOSTIC: runtime password not expired');
  console.log(!r.rolsuper&&!r.rolbypassrls?'DIAGNOSTIC: runtime superuser=false bypassrls=false':'DIAGNOSTIC: runtime elevated flags detected');
  const m=/^SCRAM-SHA-256\$(\d+):([A-Za-z0-9+/]+=*)\$/.exec(r.rolpassword||'');
  if(!m){console.log('DIAGNOSTIC: stored credential is not a supported SCRAM verifier');return;}
  const n=Number(m[1]);
  if(n<4096||n>1000000)throw Error('unexpected SCRAM cost');
  console.log('DIAGNOSTIC: stored SCRAM-SHA-256 iterations='+n);
  console.log(scramVerifier(password,Buffer.from(m[2],'base64'),n)===r.rolpassword?'DIAGNOSTIC: DATABASE_URL decoded password matches stored verifier':'DIAGNOSTIC: DATABASE_URL password mismatch');
  console.log(n>32768?'DIAGNOSTIC: stored SCRAM cost exceeds published Supavisor maximum 32768':'DIAGNOSTIC: stored SCRAM cost within published Supavisor maximum');
  const mode=(await c.query('SHOW password_encryption')).rows[0]?.password_encryption;
  console.log(mode==='scram-sha-256'?'DIAGNOSTIC: server password_encryption=scram-sha-256':'DIAGNOSTIC: server password_encryption differs from SCRAM default');
 }finally{await c.query('ROLLBACK');}
}
async function run(){
 let pool:Pool|undefined;
 try{
  const branch='refs/heads/verify/supabase-test-auth-inspect-20261102';
  if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='dubai717/ab-group-demo'||process.env.GITHUB_EVENT_NAME!=='push'||process.env.RUNNER_ENVIRONMENT!=='github-hosted'||process.env.GITHUB_REF!==branch||process.env.GITHUB_WORKFLOW_REF!==`dubai717/ab-group-demo/.github/workflows/supabase-auth-inspect.yml@${branch}`)throw Error('unapproved runner');
  const cfg=runtimeConfiguration(process.env);
  console.log('DIAGNOSTIC: session pooler username=ab_runtime.<matching-project-ref>, port=5432; driver decodes password consistently');
  console.log('DIAGNOSTIC: direct connection requires username=ab_runtime, port=5432; no project suffix');
  const hostname='db.'+new URL(process.env.SUPABASE_URL!).hostname;
  try{const a=await lookup(hostname,{all:true});console.log(a.some(x=>x.family===4)?'DIAGNOSTIC: direct endpoint has IPv4 address':'DIAGNOSTIC: direct endpoint IPv6-only; prior runner route unavailable');}catch{console.log('DIAGNOSTIC: direct endpoint DNS inspection unavailable');}
  pool=new Pool({...databaseOptions(cfg.administratorUri),max:1});
  pool.on('error',()=>{console.log('STOP: diagnostic connection lost; details withheld');process.exitCode=1;});
  const c=await pool.connect();try{await inspectRole(c,cfg.password);}finally{c.release();}
  console.log('PASS: read-only role inspection finished; no password, permission, schema or data changes');
 }catch(error){console.log('STOP: read-only authentication inspection; diagnostic='+connectionDiagnostic(error));process.exitCode=1;}
 finally{if(pool)await pool.end().catch(()=>{process.exitCode=1;});}
}
if(process.argv[1]?.endsWith('/runtime-auth-inspect.ts'))await run();
