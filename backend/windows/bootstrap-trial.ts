// Creates/reuses only this local setup's NEW fictional owner; no resets or cleanup.
import {Pool} from 'pg';
import {runtimeConfiguration} from '../actions/runtime-setup.js';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {supabase,supabaseKeys,security,type AuthProvider} from '../src/core.js';
import {initializeOrganization} from '../src/bootstrap.js';
import {connectionDiagnostic} from '../src/connection-diagnostics.js';
import {z} from 'zod';
const inputSchema=z.object({username:z.string().regex(/^trial_[a-f0-9]{12}$/),password:z.string().min(12).max(128).regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/)});
export async function ensureTrialOwner(pool:Pool,auth:AuthProvider,input:unknown){
 const {username,password}=inputSchema.parse(input),email=username+'@example.test';
 const existing=(await pool.query("select u.auth_id,u.auth_email,u.role_id,u.status,o.name from ab.users u join ab.organizations o on o.id=u.tenant_id where lower(u.username)=lower($1)",[username])).rows;
 if(existing.length){
  if(existing.length!==1||existing[0].auth_email!==email||existing[0].role_id!=='owner'||existing[0].status!=='Active'||existing[0].name!=='AB Group — synthetic test environment')throw Error('existing identity is not this synthetic owner');
  const login=await auth.login(email,password);
  try{if(login.id!==existing[0].auth_id)throw Error('identity mismatch');}finally{await auth.logout(login.token);}
  return;
 }
 // Recover a previously created fictional Auth subject if group creation was interrupted.
 const subjects=(await pool.query('select id from auth.users where email=$1',[email])).rows;
 if(subjects.length>1)throw Error('ambiguous Auth identity');
 let authId:string;
 if(subjects.length){const login=await auth.login(email,password);try{if(login.id!==subjects[0].id)throw Error('identity mismatch');authId=login.id;}finally{await auth.logout(login.token);}}
 else authId=await auth.create(email,password);
 if(!z.uuid().safeParse(authId).success)throw Error('invalid Auth subject');
 await initializeOrganization(pool,{authId,email,username,name:'Fictional Windows trial owner'});
}
async function run(){
 let pool:Pool|undefined;
 try{
  if(process.platform!=='win32'||process.env.APP_ENV!=='local'||process.env.AB_SYNTHETIC_PROJECT!=='yes')throw Error('Windows synthetic local setup only');
  let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>4096)throw Error('input too large');}
  const cfg=runtimeConfiguration(process.env);security(process.env.DATA_ENCRYPTION_KEY||'');
  const keys=supabaseKeys(),provider=supabase(process.env.SUPABASE_URL!,keys.publishable,keys.secret,'ab-private-test');
  if(!keys.secret)throw Error('server key required');
  pool=new Pool({...databaseOptions(cfg.administratorUri),max:1});pool.on('error',()=>{process.exitCode=1;});
  const c=await pool.connect();try{assertVerifiedDatabaseTls(c);}finally{c.release();}
  await ensureTrialOwner(pool,provider.auth,JSON.parse(raw));
  console.log('PASS: FICTIONAL_INTERACTIVE_OWNER_READY');
 }catch(error){console.log('STOP: INTERACTIVE_OWNER_SETUP; diagnostic='+connectionDiagnostic(error)+'; details withheld; no automatic reset or cleanup');process.exitCode=1;}
 finally{if(pool)await pool.end().catch(()=>{process.exitCode=1;});}
}
if(process.argv[1]?.endsWith('/bootstrap-trial.ts')||process.argv[1]?.endsWith('\\bootstrap-trial.ts'))await run();
