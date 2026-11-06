// Post-deployment GET-only checks. Never provision Auth identities or business fixtures.
import {readFile} from 'node:fs/promises';import {sha} from '../src/core.js';
const origin='https://ab-group-demo.onrender.com',projectHash='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f';
const need=(ok:unknown,code:string)=>{if(!ok)throw Error(code);};
export async function readOnlySmoke(expectedSha:string,appHash:string,request:typeof fetch=fetch){
 need(/^[a-f0-9]{40}$/.test(expectedSha)&&/^[a-f0-9]{64}$/.test(appHash),'EXPECTED_RELEASE_REQUIRED');
 const get=(path:string)=>request(origin+path,{method:'GET',redirect:'error',signal:AbortSignal.timeout(20000)});
 const version=await get('/api/release');need(version.ok,'RELEASE_UNAVAILABLE');const r=await version.json() as any;
 need(r.environment==='staging'&&r.commit===expectedSha&&r.projectOriginSha256===projectHash,'RELEASE_TARGET_MISMATCH');
 need((await get('/api/health')).ok,'HEALTH_FAILED');const app=await get('/app.js');need(app.ok&&sha(await app.text())===appHash,'APP_BYTES_MISMATCH');
 for(const path of ['/api/bootstrap','/api/companies/00000000-0000-4000-8000-000000000000','/api/bank-accounts/00000000-0000-4000-8000-000000000000','/api/registers/customers','/api/registers/vehicles','/api/customers/capabilities','/api/vehicles/capabilities','/api/documents']){const denied=await get(path);need(!denied.ok,'UNAUTHENTICATED_DATA_EXPOSURE');need(denied.status===401,'AUTH_BOUNDARY_STATUS_UNEXPECTED');await denied.body?.cancel();}
 const capability=await get('/api/reset-capability');need(capability.ok,'RESET_CAPABILITY_UNAVAILABLE');const reset=await capability.json() as any;need(reset.enabled===false&&reset.workerConfigured===false,'RESET_EXECUTION_MUST_REMAIN_DISABLED');console.log('CHECK: HOSTED_RESET_DISABLED_AND_WORKER_UNCONFIGURED_GET_ONLY=PASS');
 console.log('CHECK: EXACT_STAGING_RELEASE_HEALTH_APP_BYTES_AND_UNAUTHENTICATED_DENIAL_GET_ONLY=PASS');
}
async function main(){try{
 const e=process.env;need(e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY==='dubai717/ab-group-demo','RUNNER_CONTEXT');
 let expected=e.GITHUB_SHA||'';
 if(e.GITHUB_REF==='refs/heads/verify/reset-readonly-smoke-20261105')expected='4a162b926352208b85cf53a8d9d4f0c3ecc20841';else need(e.GITHUB_REF==='refs/heads/staging/ab-group-test'&&e.GITHUB_EVENT_NAME==='push','STAGING_CONTEXT');
 await readOnlySmoke(expected,sha(await readFile('app.js','utf8')));
 const {chromium}=await import('playwright');const browser=await chromium.launch({headless:true,executablePath:e.AB_BROWSER_EXECUTABLE||undefined,args:['--no-sandbox']});try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900}}),errors:string[]=[];page.on('pageerror',()=>errors.push('javascript-error'));await page.goto(origin,{waitUntil:'domcontentloaded'});await page.locator('#login-form').waitFor();need(await page.locator('[data-demo-user]').count()===0,'CENTRAL_MODE_REQUIRED');need((await page.locator('#username').count())===1&&(await page.locator('#password').count())===1,'LOGIN_FORM_REQUIRED');const toggle=page.locator('[data-action="toggle-language"]');if(await toggle.count()){await toggle.first().click();await page.locator('#login-form').waitFor();}need(errors.length===0,'PUBLIC_UI_JAVASCRIPT_ERROR');await page.close();}}finally{await browser.close();}
 console.log('RESULT: READ_ONLY_POST_DEPLOY_SMOKE_PASS; NO_LOGINS_USERS_FIXTURES_DATABASE_OR_STORAGE_WRITES');
}catch(e){const code=e instanceof Error&&/^[A-Z_]+$/.test(e.message)?e.message:'DETAILS_WITHHELD';console.log('RESULT: READ_ONLY_POST_DEPLOY_SMOKE_STOP; CODE='+code);process.exitCode=1;}}
if(/[/\\]staging-readonly-smoke\.(ts|js)$/.test(process.argv[1]||''))await main();
