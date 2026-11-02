// Browser Render Shell only. Verified diagnostic, not an application deployment.
// No account reset/create, role/schema changes, plaintext files or raw error logging.
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const req=createRequire(resolve('package.json'));
const built=p=>import(pathToFileURL(resolve('backend-build',p)).href);
let pool,client,password='',token='',phase='runtime configuration';
const allowed=new Set(['invalid_credentials','email_not_confirmed','user_banned','email_provider_disabled','over_request_rate_limit','captcha_failed','unexpected_failure']);
try{
 const origin='https://ab-group-demo.onrender.com',username='trial_4db27b82b8bf';
 if(process.env.APP_ENV!=='staging'||process.env.RENDER!=='true'||process.env.RENDER_EXTERNAL_URL!==origin)throw Error('wrong service');
 const {Pool}=req('pg'),{databaseOptions,assertVerifiedDatabaseTls}=await built('src/database.js'),{supabaseKeys,supabase}=await built('src/core.js'),{secretPrompt}=await built('windows/terminal-trial.js');
 const keys=supabaseKeys(),endpoint=new URL(process.env.SUPABASE_URL||'');
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(endpoint.href))throw Error('invalid project');
 const settings=await fetch(endpoint.origin+'/auth/v1/settings',{headers:{apikey:keys.publishable},redirect:'error',signal:AbortSignal.timeout(15000)});
 console.log('DIAGNOSTIC: RENDER_AUTH_SETTINGS_HTTP='+settings.status);
 if(!settings.ok){console.log('RESULT: RENDER_AUTH_CONFIGURATION_REJECTED');throw Error('Auth config');}
 const flags=await settings.json();
 if(flags.external?.email===false){console.log('RESULT: RENDER_EMAIL_PASSWORD_PROVIDER_DISABLED');throw Error('provider disabled');}
 pool=new Pool({...databaseOptions(process.env.DATABASE_URL||''),max:1});pool.on('error',()=>{process.exitCode=1;});client=await pool.connect();assertVerifiedDatabaseTls(client);
 await client.query('BEGIN READ ONLY');
 const role=(await client.query('select current_user actor,session_user authenticated_role')).rows[0];
 if(role.actor!=='ab_runtime'||role.authenticated_role!=='ab_runtime')throw Error('unexpected role');
 const email=(await client.query('select ab.login_identity($1) email',[username])).rows[0]?.email;
 console.log('DIAGNOSTIC: RENDER_PROFILE_RESOLVES='+(!!email));
 if(!email){console.log('RESULT: RENDER_PROFILE_NOT_FOUND_OR_INACTIVE_CHECK_PROJECT_TARGET');throw Error('profile absent');}
 phase='hidden credential input';password=await secretPrompt('Enter this trial login password (hidden; never the DB password)');
 phase='direct Auth password validation';
 const auth=await fetch(endpoint.origin+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:keys.publishable,'content-type':'application/json'},body:JSON.stringify({email,password}),redirect:'error',signal:AbortSignal.timeout(15000)});
 const body=await auth.json();
 if(!auth.ok){const code=body.error_code||body.code;console.log('RESULT: AUTH_PASSWORD_REQUEST_REJECTED; category='+(allowed.has(code)?code:'OTHER_WITHHELD'));throw Error('Auth refused');}
 token=body.access_token;if(typeof token!=='string'||!body.user?.id)throw Error('invalid Auth response');
 const provider=supabase(endpoint.origin,keys.publishable,keys.secret,process.env.SUPABASE_BUCKET||'ab-private-test');
 const actual=await provider.auth.verify(token);
 if(actual!==body.user.id)throw Error('Auth token mismatch');
 const principal=(await client.query('select * from ab.principal($1)',[actual])).rows;
 console.log('DIAGNOSTIC: AUTH_PASSWORD_ACCEPTED=true');
 console.log('DIAGNOSTIC: RENDER_PRINCIPAL_RESOLVES='+(principal.length===1));
 if(principal.length!==1){console.log('RESULT: RENDER_PRINCIPAL_LINK_REJECTED');throw Error('principal missing');}
 await client.query('ROLLBACK');client.release();client=undefined;
 phase='real Backend login';
 const login=await fetch(origin+'/api/login',{method:'POST',headers:{origin,'x-ab-request':'1','content-type':'application/json'},body:JSON.stringify({username,password}),redirect:'error',signal:AbortSignal.timeout(20000)});
 password='';console.log('DIAGNOSTIC: RENDER_LOGIN_HTTP='+login.status);
 if(!login.ok){console.log('RESULT: BACKEND_LOGIN_REJECTED_AFTER_DIRECT_AUTH_SUCCESS');throw Error('backend refused');}
 const cookie=login.headers.getSetCookie()[0]?.split(';')[0];if(!cookie)throw Error('session cookie absent');
 phase='real Backend bootstrap';
 const bootstrap=await fetch(origin+'/api/bootstrap',{headers:{cookie},redirect:'error',signal:AbortSignal.timeout(20000)});
 console.log('DIAGNOSTIC: RENDER_BOOTSTRAP_HTTP='+bootstrap.status);
 console.log(bootstrap.ok?'RESULT: LOGIN_AND_CENTRAL_BOOTSTRAP_SUCCEED':'RESULT: LOGIN_SUCCEEDS_BUT_BOOTSTRAP_FAILS');
 if(!bootstrap.ok)process.exitCode=1;
}catch{console.log('STOP: '+phase+'; raw values withheld; no account reset, new owner or deployment');process.exitCode=1;}
finally{
 password='';
 // Revoke only the temporary direct-Auth probe session, never other user sessions.
 if(token){try{const {supabaseKeys}=await built('src/core.js');await fetch(process.env.SUPABASE_URL+'/auth/v1/logout?scope=local',{method:'POST',headers:{apikey:supabaseKeys().publishable,Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(10000)});}catch{}}
 if(client){await client.query('ROLLBACK').catch(()=>{});client.release();}if(pool)await pool.end().catch(()=>{});
}
