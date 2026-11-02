// Targeted READ ONLY identity/status check; never tests or changes a password.
import {Pool} from 'pg';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {supabaseKeys} from '../src/core.js';
async function run(){let pool:Pool|undefined;try{
 const branch='refs/heads/diagnose/trial-password-review';
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.GITHUB_REPOSITORY!=='dubai717/ab-group-demo'||process.env.GITHUB_REF!==branch||process.env.GITHUB_EVENT_NAME!=='push'||process.env.GITHUB_WORKFLOW_REF!==`dubai717/ab-group-demo/.github/workflows/trial-password-review.yml@${branch}`)throw Error();
 pool=new Pool({...databaseOptions(process.env.MIGRATION_DATABASE_URL!),max:1});pool.on('error',()=>{process.exitCode=1;});
 const c=await pool.connect();let u:any;try{assertVerifiedDatabaseTls(c);await c.query('BEGIN READ ONLY');
 u=(await c.query(`select u.auth_id,u.auth_email,u.status,u.role_id,a.id is not null linked,lower(u.auth_email)=lower(a.email) email_match,a.email_confirmed_at is not null confirmed,coalesce(a.encrypted_password,'')<>'' has_password,a.banned_until is not null and a.banned_until>now() banned,a.deleted_at is not null deleted from ab.users u left join auth.users a on a.id=u.auth_id where u.normalized_username=$1`,['trial_4db27b82b8bf'])).rows[0];
 }finally{await c.query('ROLLBACK');c.release();}
 if(!u||!u.linked||!u.email_match)throw Error();
 const {secret}=supabaseKeys();if(!secret)throw Error();const base=new URL(process.env.SUPABASE_URL!);if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(base.href))throw Error();
 const response=await fetch(base.origin+'/auth/v1/admin/users/'+encodeURIComponent(u.auth_id),{headers:{apikey:secret},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error();const a=await response.json() as any;
 const match=a.id===u.auth_id&&a.email?.toLowerCase()===u.auth_email.toLowerCase();
 console.log('DIAGNOSTIC: SAME_AUTH_ID_AND_EMAIL='+match);
 console.log('DIAGNOSTIC: ACTIVE_OWNER='+(u.status==='Active'&&u.role_id==='owner'));
 console.log('DIAGNOSTIC: AUTH_CONFIRMED='+(u.confirmed&&!!a.email_confirmed_at));
 console.log('DIAGNOSTIC: AUTH_PASSWORD_CONFIGURED='+u.has_password);
 console.log('DIAGNOSTIC: AUTH_BANNED_OR_DELETED='+(u.banned||u.deleted||!!a.deleted_at||(!!a.banned_until&&Date.parse(a.banned_until)>Date.now())));
 console.log('RESULT: TARGET_IDENTITY_REVIEW_COMPLETE_NO_PASSWORD_READ_OR_CHANGE');
}catch{console.log('RESULT: TARGET_REVIEW_FAILED_DETAILS_WITHHELD');process.exitCode=1;}finally{if(pool)await pool.end().catch(()=>{});}}
await run();
