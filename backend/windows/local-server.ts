// Avoid raw startup exceptions containing connection strings or provider data.
import {connectionDiagnostic} from '../src/connection-diagnostics.js';
try{
 if(process.platform!=='win32'||process.env.APP_ENV!=='local'||process.env.MIGRATION_DATABASE_URL)throw Error('local runtime isolation required');
 await import('../src/server.js');
 console.log('PASS: LOCAL_BACKEND_READY');
}catch(error){console.log('STOP: LOCAL_BACKEND_START; diagnostic='+connectionDiagnostic(error)+'; details withheld');process.exitCode=1;}
