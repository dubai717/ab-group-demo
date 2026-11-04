import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {ensureTrialOwner} from '../windows/bootstrap-trial.js';
import type {AuthProvider} from '../src/core.js';
test('Windows trial creates one fictional owner and safely reuses it without resets or extra groups',async()=>{
 const {setupDatabase}=await import('./setup.js');const d=await setupDatabase();
 const username='trial_'+randomBytes(6).toString('hex'),password='Fictional-Only@1234567890',id=randomUUID();let creates=0,logouts=0;
 const auth:AuthProvider={create:async()=>{creates++;return id;},login:async(email,pw)=>{assert.equal(email,username+'@example.test');if(pw!==password)throw Error('invalid synthetic credential');return {id,token:'synthetic-token',expiresIn:3600};},verify:async()=>id,logout:async()=>{logouts++;}};
 const proxy={query:async(sql:string,args?:unknown[])=>sql.includes('from auth.users')?{rows:[]}:d.admin.query(sql,args),connect:d.admin.connect.bind(d.admin)};
 try{
  await ensureTrialOwner(proxy as any,auth,{username,password});
  await ensureTrialOwner(proxy as any,auth,{username,password});
  await assert.rejects(()=>ensureTrialOwner(proxy as any,auth,{username,password:'Wrong-Fictional@1234'}));
  assert.equal(creates,1);assert.equal(logouts,1);
  const rows=(await d.admin.query('select role_id,status from ab.users where username=$1',[username])).rows;
  assert.deepEqual(rows,[{role_id:'owner',status:'Active'}]);
 }finally{await d.admin.end();await d.runtime.end();}
});
test('Windows bootstrap refuses unsupported context without exposing a supplied secret',()=>{
 const marker='WINDOWS_SECRET_CANARY';
 const r=spawnSync(process.execPath,['--import','tsx','backend/windows/bootstrap-trial.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,DATABASE_URL:marker},input:marker});
 assert.equal(r.status,1);assert(!(r.stdout+r.stderr).includes(marker));
});
test('Windows launcher uses per-user DPAPI outside repository, isolated children and loopback only',async()=>{
 const ps=await readFile(new URL('../windows/Start-ABGroup.ps1',import.meta.url),'utf8');
 assert(ps.includes('ConvertFrom-SecureString $secret'));assert(!ps.includes('ConvertFrom-SecureString $secret -Key'));
 assert(ps.includes("GetFolderPath('LocalApplicationData')"));assert(ps.includes('SetAccessRuleProtection($true,$false)'));
 assert(ps.includes('EnvironmentVariables.Clear()'));assert(ps.includes("Read-Host $Name -AsSecureString"));
 assert(ps.includes("http://127.0.0.1:3100"));assert(!/SetEnvironmentVariable|Start-Transcript|--password|ngrok|0\.0\.0\.0/.test(ps));
 const serverMap=ps.slice(ps.indexOf('# No administrator URL'),ps.indexOf('$ready ='));
 assert(!serverMap.includes('$provision'));
});
