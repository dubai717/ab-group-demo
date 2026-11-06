// Runs from the immutable controller checkout, without database/provider secrets.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,appendFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {classifyChanges} from './change-risk.mjs';
import {repo,branch,origin,project,requireValue as need,requireController,environmentProtection,branchProtection} from './context.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
export function verifyBranches(rows){need(rows?.branch_policies?.length===1&&rows.branch_policies[0].name==='main'&&rows.branch_policies[0].type==='branch','ENVIRONMENT_MAIN_ONLY_REQUIRED');}
export function verifyRun(run,sha){need(run?.head_sha===sha&&run.head_branch===branch&&run.event==='push'&&run.conclusion==='success'&&run.path==='.github/workflows/staging-ci.yml'&&run.repository?.full_name===repo,'SUCCESSFUL_SOURCE_CHECKS_REQUIRED');}
export async function preflight(e,api,request=fetch){
 requireController(e);const sha=e.AB_STAGING_SOURCE_SHA;
 for(const name of ['supabase-test','staging-owner-approval']){environmentProtection(await api('/environments/'+name),name);verifyBranches(await api('/environments/'+name+'/deployment-branch-policies'));}
 // GitHub prevents non-admin deletion of its default branch; the update restriction also covers force updates.
 need((await api('')).default_branch==='main','MAIN_DEFAULT_BRANCH_REQUIRED');
 const rules=await api('/rules/branches/main'),sets=[];for(const id of new Set(rules.map(r=>r.ruleset_id)))sets.push(await api('/rulesets/'+id));branchProtection(rules,sets);
 need((await api('/git/ref/heads/'+branch)).object.sha===sha,'SOURCE_HEAD_CHANGED');
 need(/^\d+$/.test(e.AB_SOURCE_RUN_ID||''),'SOURCE_RUN_REQUIRED');verifyRun(await api('/actions/runs/'+e.AB_SOURCE_RUN_ID),sha);
 const git=(...args)=>execFileSync('git',['-C','candidate',...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:16*1024*1024});
 for(const file of ['.github/workflows/staging-ci.yml','.github/workflows/staging-checks.yml'])need(hash(readFileSync(file))===hash(readFileSync('candidate/'+file)),'REVIEWED_CHECK_WORKFLOW_REQUIRED');
 const cfg=JSON.parse(readFileSync('backend/deploy/staging-target.json','utf8'));need(cfg.origin===origin&&cfg.projectOriginSha256===project,'PINNED_TARGET_REQUIRED');
 let previous,complete=false;for(let page=1;page<=10&&!previous;page++){const rows=await api('/deployments?environment=supabase-test&task=ab-group-staging&per_page=100&page='+page);for(const d of rows){if(d.production_environment!==false||d.payload?.abGroupStaging!==true)continue;const states=await api('/deployments/'+d.id+'/statuses');if(states[0]?.state==='success'){previous=d;break;}}if(rows.length<100){complete=true;break;}}
 need(previous&&(/^[a-f0-9]{40}$/.test(previous.sha)),'VERIFIED_PREVIOUS_RELEASE_REQUIRED');
 const live=await request(origin+'/api/release',{redirect:'error',signal:AbortSignal.timeout(20000)});need(live.ok,'LIVE_RELEASE_UNAVAILABLE');const v=await live.json();need(v.environment==='staging'&&v.commit===previous.sha&&v.projectOriginSha256===project,'LIVE_BASELINE_MISMATCH');
 const changes=[];const statuses=git('diff','--no-renames','--name-status','-z',previous.sha,sha).split('\0');for(let i=0;i<statuses.length-1;i+=2){const status=statuses[i],path=statuses[i+1];need(/^[AMD]$/.test(status),'UNSUPPORTED_CHANGE_STATUS');const show=ref=>git('show',ref+':'+path);const row=status==='D'?'':git('ls-tree',sha,'--',path);const mode=row.split(' ')[0]||'100644';changes.push({path,status,mode,before:status==='A'?'':show(previous.sha),after:status==='D'?'':show(sha)});}
 const result=classifyChanges(changes);need(result.risk!=='blocked','BLOCKED_CREDENTIAL_OR_LINK_CHANGE');
 // One-time source tree explicitly approved in the protected, immutable controller commit.
 const trust=JSON.parse(readFileSync('backend/deploy/v2/trust.json','utf8'));const tree=git('rev-parse',sha+'^{tree}').trim();const bootstrap=trust.approvedSourceTree===tree&&/^[a-f0-9]{40}$/.test(tree);
 if(bootstrap){result.risk='owner-approved-bootstrap';result.requiresOwner=false;}
 // SQL remains immutable even with owner approval; arbitrary migrations never run here.
 const catalog=[...JSON.parse(readFileSync('backend/actions/approved-migrations.json','utf8')).migrations,...JSON.parse(readFileSync('backend/deploy/personnel-release-plan.json','utf8')).migrations];
 const raw=git('ls-tree','-r','--name-only',sha,'supabase').trim().split('\n').filter(p=>p.endsWith('.sql'));
 need(raw.length===13&&catalog.every(m=>{const p=m.path||'supabase/migrations/'+m.name;return raw.includes(p)&&hash(readFileSync('candidate/'+p,'utf8'))===m.sha256;}),'IMMUTABLE_APPROVED_SQL_REQUIRED');
 // Declared schema additions are deferred until a controller review supports their exact plan.
 const additions=git('ls-tree','-r','--name-only',sha,'supabase/additive').trim().split('\n').filter(Boolean).filter(p=>p!=='supabase/additive/README.md');need(additions.length===0,'ADDITIVE_CONTROLLER_REVIEW_REQUIRED');
 const record={...result,sourceSha:sha,sourceTree:tree,controller:e.AB_CONTROLLER_REF,sourceRun:e.AB_SOURCE_RUN_ID,previousSha:previous.sha};writeFileSync('classification.json',JSON.stringify(record,null,2));
 for(const [k,value]of Object.entries({requires_owner:String(result.requiresOwner),app_sha:hash(readFileSync('candidate/app.js')),hook_hash:cfg.deployHookPathSha256,previous_sha:previous.sha}))appendFileSync(e.GITHUB_OUTPUT,k+'='+value+'\n');
 console.log('RESULT: CLASSIFICATION_'+result.risk.toUpperCase().replaceAll('-','_')+'; VALUES_WITHHELD; SOURCE_TESTS_VERIFIED');return record;
}
if(process.argv[1]?.endsWith('/preflight.mjs')){try{const e=process.env,api=async path=>{const r=await fetch('https://api.github.com/repos/'+repo+path,{headers:{authorization:'Bearer '+e.GH_TOKEN,accept:'application/vnd.github+json'},redirect:'error',signal:AbortSignal.timeout(20000)});need(r.ok,'GITHUB_PROTECTION_OR_HISTORY_UNAVAILABLE');return r.json();};await preflight(e,api);}catch(error){console.log('RESULT: DELIVERY_BLOCKED; CODE='+(/^[A-Z_]+$/.test(error.message||'')?error.message:'WITHHELD'));process.exitCode=1;}}
