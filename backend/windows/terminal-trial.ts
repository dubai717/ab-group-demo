// Terminal alternative: standard Node source, no CMD/PS1, policy changes or persisted secrets.
import {spawn,type ChildProcess} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {emitKeypressEvents} from 'node:readline';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {security} from '../src/core.js';
const names=['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','DATABASE_URL','DATA_ENCRYPTION_KEY'] as const;
export function isolatedEnvironment(source:NodeJS.ProcessEnv,config:Record<string,string>){
 const allowed=['PATH','SystemRoot','WINDIR','TEMP','TMP','LOCALAPPDATA','APPDATA','USERPROFILE','ProgramFiles','ProgramFiles(x86)'];
 return {...Object.fromEntries(allowed.flatMap(k=>source[k]!==undefined?[[k,source[k]!]]:[])),...config};
}
export function secretPrompt(label:string):Promise<string>{
 if(!process.stdin.isTTY||!process.stdout.isTTY)return Promise.reject(Error('interactive terminal required'));
 process.stdout.write(label+': ');emitKeypressEvents(process.stdin);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((accept,reject)=>{
  let value='';
  const finish=(cancel=false)=>{process.stdin.off('keypress',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');cancel?reject(Error('input cancelled')):accept(value);value='';};
  const handler=(text:string,key?:{name?:string;ctrl?:boolean})=>{
   if(key?.ctrl&&key.name==='c'){finish(true);return;}
   if(key?.name==='return'||key?.name==='enter'){finish();return;}
   if(key?.name==='backspace'){value=value.slice(0,-1);return;}
   if(text&&!key?.ctrl&&!/[\x00-\x1f\x7f]/.test(text)&&value.length+text.length<=8192)value+=text;
  };
  process.stdin.on('keypress',handler);
 });
}
async function question(label:string){const rl=createInterface({input:process.stdin,output:process.stdout,historySize:0});try{return await rl.question(label);}finally{rl.close();}}
async function provision(node:string,root:string,env:NodeJS.ProcessEnv,input:string){
 const child=spawn(node,[resolve(root,'backend-build/windows/bootstrap-trial.js')],{cwd:root,env,stdio:['pipe','ignore','ignore']});
 await new Promise<void>((ok,no)=>{child.once('error',()=>no(Error('setup process unavailable')));child.once('exit',code=>code===0?ok():no(Error('setup failed')));child.stdin.on('error',()=>{});child.stdin.end(input);});
}
async function run(){
 let server:ChildProcess|undefined;const config:Record<string,string>={};
 const stop=()=>{if(server&&!server.killed)server.kill();};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  if(process.platform!=='win32')throw Error('Windows required');
  await new Promise<void>((ok,no)=>{const probe=createServer();probe.once('error',()=>no(Error('port unavailable')));probe.listen(3100,'127.0.0.1',()=>probe.close(()=>ok()));});
  const root=fileURLToPath(new URL('../../',import.meta.url));
  console.log('Use original supabase-test values only. Hidden inputs; no secrets are written to disk.');
  for(const name of names){config[name]=await secretPrompt(name);if(!config[name])throw Error('missing protected input');}
  security(config.DATA_ENCRYPTION_KEY);
  if(Buffer.from(config.DATA_ENCRYPTION_KEY,'base64').toString('base64')!==config.DATA_ENCRYPTION_KEY)throw Error('invalid encryption format');
  const endpoint=new URL(config.SUPABASE_URL);
  if(!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(endpoint.href))throw Error('invalid endpoint');
  Object.assign(config,{APP_ENV:'local',PUBLIC_ORIGIN:'http://127.0.0.1:3100',PORT:'3100',SUPABASE_BUCKET:'ab-private-test',NODE_EXTRA_CA_CERTS:resolve(root,'backend/certificates/supabase-prod-ca-2021.crt')});
  let username=(await question('Existing trial username (Enter to create a NEW fictional login): ')).trim();
  if(!username){
   username='trial_'+randomBytes(6).toString('hex');console.log('New fictional username: '+username);
   const admin=await secretPrompt('MIGRATION_DATABASE_URL (not saved)');
   let password=await secretPrompt('Choose login password (12+ chars, upper/lower/digit/symbol)'),confirm=await secretPrompt('Confirm login password');
   if(password!==confirm)throw Error('password confirmation mismatch');
   await provision(process.execPath,root,isolatedEnvironment(process.env,{...config,MIGRATION_DATABASE_URL:admin,AB_SYNTHETIC_PROJECT:'yes'}),JSON.stringify({username,password}));
   password='';confirm='';console.log('PASS: fictional interactive login ready; retain your username and chosen password.');
  }
  // Only runtime secrets enter the web process; never inherit administrator/platform secrets.
  server=spawn(process.execPath,[resolve(root,'backend-build/windows/local-server.js')],{cwd:root,env:isolatedEnvironment(process.env,config),stdio:'ignore'});
  let exited=false;server.once('error',()=>{exited=true;});server.once('exit',()=>{exited=true;});
  let ready=false;
  for(let i=0;i<45&&!exited;i++){
   try{const r=await fetch('http://127.0.0.1:3100/api/health',{signal:AbortSignal.timeout(1500)});const h=await r.json() as any;if(h.mode==='central'&&h.database==='reachable'){ready=true;break;}}catch{}
   await new Promise(r=>setTimeout(r,750));
  }
  if(!ready||exited)throw Error('backend readiness failed');
  console.log('Open http://127.0.0.1:3100');console.log('Login username: '+username);
  await question('Keep this terminal open. Press Enter to stop the local backend: ');
 }catch{console.log('STOP: terminal trial failed; secret values and raw errors withheld. Do not change Windows protection settings.');process.exitCode=1;}
 finally{stop();for(const k of Object.keys(config))delete config[k];process.off('SIGINT',stop);process.off('SIGTERM',stop);}
}
if(/[/\\]terminal-trial\.(ts|js)$/.test(process.argv[1]||''))await run();
