// Staging entry only. Never migrate, provision users or log raw startup errors.
import {connectionDiagnostic} from '../src/connection-diagnostics.js';
export function stagingOrigin(e:NodeJS.ProcessEnv){
 const configured=e.PUBLIC_ORIGIN;
 const value=configured||(e.RENDER==='true'?e.RENDER_EXTERNAL_URL:undefined);
 const u=new URL(value||'');
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||(!configured&&!u.hostname.endsWith('.onrender.com')))throw Error('HTTPS origin required');
 return u.origin;
}
async function run(){try{
 if(process.env.APP_ENV!=='staging')throw Error('staging only');
 if(['MIGRATION_DATABASE_URL','SCANNER_DATABASE_URL','BOOTSTRAP_AUTH_ID','BOOTSTRAP_USERNAME'].some(k=>process.env[k]))throw Error('administrative configuration rejected');
 process.env.PUBLIC_ORIGIN=stagingOrigin(process.env);
 const db=new URL(process.env.DATABASE_URL||'');
 const project=new URL(process.env.SUPABASE_URL||'');
 if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(project.href)||decodeURIComponent(db.username)!=='ab_runtime.'+project.hostname.split('.')[0]||!db.hostname.endsWith('.pooler.supabase.com')||(db.port||'5432')!=='5432'||db.pathname!=='/postgres')throw Error('runtime test connection required');
 if(['user','password','host','port','database','options','sslpassword'].some(k=>db.searchParams.has(k)))throw Error('database overrides rejected');
 const key=process.env.DATA_ENCRYPTION_KEY||'';
 if(Buffer.from(key,'base64').length!==32||Buffer.from(key,'base64').toString('base64')!==key)throw Error('protected encryption key required');
 await import('../src/server.js');
 console.log('PASS: staging application listening; configuration values withheld');
}catch(error){console.log('STOP: staging startup; diagnostic='+connectionDiagnostic(error)+'; details withheld');process.exitCode=1;}}
if(/[/\\]server\.(ts|js)$/.test(process.argv[1]||''))await run();
