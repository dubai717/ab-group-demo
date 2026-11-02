// PREPARED ONLY. No execution/activation before explicit owner approval.
// Fixed existing fictional identity; uses deployed modules and hidden terminal input.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const username='trial_4db27b82b8bf';
const built=p=>import(pathToFileURL(resolve('backend-build',p)).href);
export function validateExistingTrial(profile,auth,email){
 if(!profile||profile.normalized_username!==username||profile.status!=='Active'||profile.role_id!=='owner'||profile.auth_id!==auth.id||profile.auth_email?.toLowerCase()!==email.toLowerCase()||auth.email?.toLowerCase()!==email.toLowerCase()||email!==username+'@example.test'||!auth.email_confirmed_at||auth.deleted_at||(auth.banned_until&&Date.parse(auth.banned_until)>Date.now()))throw Error('existing trial identity check failed');
}
export function resetPayload(password,confirmation){
 if(password!==confirmation||password.length<12||password.length>128||!/[A-Z]/.test(password)||!/[a-z]/.test(password)||!/[0-9]/.test(password)||! /[^A-Za-z0-9\s]/.test(password)||/\s/.test(password))throw Error('password requirements failed');
 return {password}; // Never send role, metadata, email or confirmation changes.
}
async function run(){
 let pool,client,phase='existing account validation',password='',confirmation='';
 try{
  if(process.env.RENDER!=='true'||process.env.APP_ENV!=='staging'||process.env.RENDER_EXTERNAL_URL!=='https://ab-group-demo.onrender.com')throw Error('wrong service');
  const {Pool}=createRequire(resolve('package.json'))('pg');
  const {databaseOptions}=await built('src/database.js'),{supabaseKeys}=await built('src/core.js');
  const keys=supabaseKeys();if(!keys.secret)throw Error('server admin key absent');
  const base=new URL(process.env.SUPABASE_URL||'');if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(base.href))throw Error('invalid project');
  pool=new Pool({...databaseOptions(process.env.DATABASE_URL),max:1});pool.on('error',()=>{process.exitCode=1;});client=await pool.connect();
  await client.query('BEGIN READ ONLY');
  const email=(await client.query('select ab.login_identity($1) email',[username])).rows[0]?.email;
  if(email!==username+'@example.test')throw Error('unexpected identity');
  let auth;for(let page=1;page<=100;page++){
   const r=await fetch(base.origin+'/auth/v1/admin/users?page='+page+'&per_page=100',{headers:{apikey:keys.secret},redirect:'error',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error('identity lookup failed');const data=await r.json();
   if(!Array.isArray(data.users))throw Error('unexpected identity list');
   const matches=data.users.filter(u=>u.email?.toLowerCase()===email.toLowerCase());
   if(matches.length>1)throw Error('ambiguous identity');if(matches.length===1){auth=matches[0];break;}if(data.users.length<100)break;
  }
  if(!auth)throw Error('existing Auth identity absent');
  const principal=(await client.query('select * from ab.principal($1)',[auth.id])).rows;
  if(principal.length!==1)throw Error('principal mismatch');
  await client.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[principal[0].tenant_id,principal[0].id]);
  const profile=(await client.query('select normalized_username,status,role_id,auth_id,auth_email from ab.users where id=$1',[principal[0].id])).rows[0];
  validateExistingTrial(profile,auth,email);
  await client.query('ROLLBACK');client.release();client=undefined;
  if(process.env.AB_APPROVED_TRIAL_PASSWORD_RESET!==username){console.log('RESULT: SAME_OWNER_RESET_PREPARED_NOT_EXECUTED');return;}
  phase='hidden password input';const {secretPrompt}=await built('windows/terminal-trial.js');
  password=await secretPrompt('New password for the SAME trial login (hidden)');confirmation=await secretPrompt('Confirm new password (hidden)');
  const payload=resetPayload(password,confirmation);
  phase='approved existing Auth password update';
  const response=await fetch(base.origin+'/auth/v1/admin/users/'+encodeURIComponent(auth.id),{method:'PUT',headers:{apikey:keys.secret,'content-type':'application/json'},body:JSON.stringify(payload),redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('Auth update rejected');const updated=await response.json();if(updated.id!==auth.id)throw Error('unexpected response identity');
  console.log('RESULT: SAME_AUTH_ID_PASSWORD_UPDATED; Owner profile and permission grants untouched; re-login required');
 }catch{console.log('RESULT: RESET_STOPPED; phase='+phase+'; details withheld; no automatic account creation or permission changes');process.exitCode=1;}
 finally{password='';confirmation='';if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}if(pool)await pool.end().catch(()=>{});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await run();
