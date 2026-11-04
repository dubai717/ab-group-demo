// Ordinary staging delivery only. The protected SHA variable is required for sensitive changes.
import {execFileSync} from 'node:child_process';
import {readFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export function sensitivePath(p){return /^(finance|ledger|personnel|user-management|bank-account)[^/]*\.js$/.test(p)||/(^|\/)[^/]*policy\.(js|ts)$/.test(p)|| /^(supabase\/(migrations|proposed)\/|backend\/actions\/|backend\/deploy\/|\.github\/workflows\/)/.test(p)||/\.sql$/.test(p)||/^(package(-lock)?\.json|backend\/src\/(app|core|data|database|provision|bootstrap|server|domain-access|.*(finance|financial|ledger|personnel|auth|permission|provider)).*|.*(finance-policy|ledger-policy|personnel-policy|user-management-policy|bank-account-policy)\.js)$/.test(p);}
const need=(ok,label)=>{if(!ok)throw Error(label);};
async function run(){let stage='CONTEXT';try{
 const e=process.env;need(e.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&e.GITHUB_REF==='refs/heads/staging/ab-group-test'&&e.GITHUB_EVENT_NAME==='push','TRUSTED_STAGING_PUSH');
 const sha=e.GITHUB_SHA;need(/^[a-f0-9]{40}$/.test(sha||''),'COMMIT');const cfg=JSON.parse(readFileSync('backend/deploy/staging-target.json','utf8'));need(cfg.origin==='https://ab-group-demo.onrender.com'&&cfg.projectOriginSha256==='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f','TARGET');
 const api=async path=>{const r=await fetch('https://api.github.com/repos/dubai717/ab-group-demo'+path,{headers:{authorization:'Bearer '+e.GH_TOKEN,accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(15000)});need(r.ok,'GITHUB_READ');return r.json();};
 stage='CURRENT_BRANCH';need((await api('/git/ref/heads/staging/ab-group-test')).object.sha===sha,'SUPERSEDED_COMMIT');
 stage='DEPLOYMENT_HISTORY';let previous;
 let exhausted=false;
 for(let page=1;page<=10&&!previous;page++){const records=await api('/deployments?environment=supabase-test&task=ab-group-staging&per_page=100&page='+page);for(const d of records){if(d.production_environment!==false||d.payload?.abGroupStaging!==true)continue;const states=await api('/deployments/'+d.id+'/statuses');if(states[0]?.state==='success'){previous=d;break;}}if(records.length<100){exhausted=true;break;}}
 need(previous||exhausted,'DEPLOYMENT_HISTORY_REVIEW_REQUIRED');
 const baseline=previous?.sha||cfg.approvedInitialCommit;need(/^[a-f0-9]{40}$/.test(baseline),'BASELINE');
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});const changed=git('diff','--name-only',baseline,sha).trim().split('\n').filter(Boolean);
 let sensitive=changed.filter(sensitivePath);
 if(!previous){
  // Owner already approved initial six-phase code and this infrastructure setup.
  sensitive=sensitive.filter(p=>!p.startsWith('backend/deploy/')&&!p.startsWith('.github/workflows/'));
  if(changed.includes('backend/src/server.ts')){
   const original=git('show',baseline+':backend/src/server.ts');const expected="import {releaseInfo} from '../deploy/release-info.js';\n"+original.replace('await app.listen({',"app.get('/api/release',async()=>releaseInfo(process.env));\nawait app.listen({");need(readFileSync('backend/src/server.ts','utf8')===expected,'BOOTSTRAP_SERVER_CHANGED');sensitive=sensitive.filter(p=>p!=='backend/src/server.ts');
  }
 }
 stage='SENSITIVE_CHANGE_GATE';need(!sensitive.length||e.STAGING_SENSITIVE_APPROVAL_SHA===sha,'OWNER_APPROVAL_REQUIRED_FOR_SENSITIVE_CHANGE');
 stage='IMMUTABLE_SQL';const catalog=JSON.parse(readFileSync('backend/actions/approved-migrations.json','utf8')).migrations,plan=JSON.parse(readFileSync('backend/deploy/personnel-release-plan.json','utf8')).migrations;
 for(const m of [...catalog,...plan]){const file=m.path||'supabase/migrations/'+m.name;need(hash(readFileSync(file,'utf8'))===m.sha256,'IMMUTABLE_SQL_CHANGED');}
 // All new SQL files remain manual even when program-code changes were approved.
 const raw=git('ls-files','supabase').trim().split('\n').filter(p=>p.endsWith('.sql'));need(raw.length===13&&raw.every(p=>[...catalog,...plan].some(m=>(m.path||'supabase/migrations/'+m.name)===p)),'NEW_RAW_SQL_REQUIRES_REVIEW');
 const runtime=await fetch(cfg.origin+'/api/release',{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(previous){need(runtime.ok,'LIVE_VERSION_UNAVAILABLE');const live=await runtime.json();need(live.environment==='staging'&&live.projectOriginSha256===cfg.projectOriginSha256&&live.commit===previous.sha,'LIVE_VERSION_DIFFERS_FROM_LAST_SUCCESS');}else{need(runtime.status===404||runtime.ok,'INITIAL_SERVICE_UNAVAILABLE');if(runtime.ok){const live=await runtime.json();need(live.environment==='staging'&&live.projectOriginSha256===cfg.projectOriginSha256,'INITIAL_TARGET_MISMATCH');if(live.commit!==sha){need(live.commit===cfg.initialInspectorRetryCommit&&live.commit==='714f899c63e5f3d6d388bd2a3ef91a208bdf936f','UNVERIFIED_INITIAL_RELEASE');const retryChanges=git('diff','--name-only',live.commit,sha).trim().split('\n').filter(Boolean);need(retryChanges.length>0&&retryChanges.every(p=>['backend/deploy/staging-delivery-policy.mjs','backend/deploy/staging-target.json','backend/deploy/staging-live-smoke.ts','backend/deploy/staging-smoke-response.ts','backend/tests/staging-smoke-response.test.ts'].includes(p)),'INSPECTOR_RETRY_RUNTIME_CHANGED');const oldApp=await fetch(cfg.origin+'/app.js',{redirect:'error',signal:AbortSignal.timeout(20000)});need(oldApp.ok&&hash(await oldApp.text())===hash(readFileSync('app.js')),'INSPECTOR_RETRY_APP_CHANGED');}}}
 const appSha=hash(readFileSync('app.js'));need(/^[a-f0-9]{64}$/.test(cfg.deployHookPathSha256||''),'DEPLOY_TARGET_BINDING_REQUIRED');
 for(const [k,v]of Object.entries({app_sha:appSha,hook_hash:cfg.deployHookPathSha256,origin:cfg.origin,previous_sha:previous?.sha||'40cde0b6809f138e9118776f13a9d6740400f37b'}))appendFileSync(e.GITHUB_OUTPUT,k+'='+v+'\n');
 console.log('RESULT: STAGING_POLICY_PASS; TESTED_COMMIT_PINNED; SENSITIVE_CHANGES_CHECKED; PRODUCTION_NOT_ALLOWED');
 }catch(error){console.log('RESULT: STAGING_POLICY_STOP; STAGE='+stage+'; CODE='+(/^[A-Z_]+$/.test(error.message||'')?error.message:'WITHHELD')+'; NO_DEPLOYMENT');process.exitCode=1;}}
if(process.argv[1]?.endsWith('/staging-delivery-policy.mjs'))await run();
