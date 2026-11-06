export const repo='dubai717/ab-group-demo',owner='dubai717',branch='staging/ab-group-test',entry='.github/workflows/staging-delivery-dispatch.yml',origin='https://ab-group-demo.onrender.com',project='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f';
export function requireValue(ok,code){if(!ok)throw Error(code);}
export function controllerContext(e){return e.GITHUB_ACTIONS==='true'&&e.GITHUB_REPOSITORY===repo&&e.GITHUB_REF==='refs/heads/main'&&['workflow_run','workflow_dispatch'].includes(e.GITHUB_EVENT_NAME)&&e.GITHUB_WORKFLOW_REF===repo+'/'+entry+'@refs/heads/main'&&e.AB_CONTROLLER_VERIFIED==='protected-v2'&&/^[a-f0-9]{40}$/.test(e.AB_STAGING_SOURCE_SHA||'')&&/^[a-f0-9]{40}$/.test(e.AB_CONTROLLER_REF||'');}
export function requireController(e){requireValue(controllerContext(e),'TRUSTED_CONTROLLER_CONTEXT_REQUIRED');}
export function environmentProtection(value,name){
 requireValue(value?.name===name,'ENVIRONMENT_MISSING');const rules=value.protection_rules||[];
 if(name==='staging-owner-approval'){const rule=rules.find(r=>r.type==='required_reviewers');requireValue(rule?.reviewers?.length===1&&rule.reviewers[0].type==='User'&&rule.reviewers[0].reviewer?.login===owner,'OWNER_REVIEWER_REQUIRED');requireValue(value.can_admins_bypass===false,'APPROVAL_BYPASS_MUST_BE_DISABLED');}
 requireValue(value.deployment_branch_policy?.custom_branch_policies===true&&value.deployment_branch_policy.protected_branches===false,'EXPLICIT_MAIN_ONLY_ENVIRONMENT_REQUIRED');
}
export function branchProtection(rules,sets){
 requireValue(Array.isArray(rules)&&rules.some(r=>r.type==='update'),'MAIN_UPDATE_RESTRICTION_REQUIRED');
 for(const r of rules.filter(r=>r.type==='update')){const set=sets.find(s=>s.id===r.ruleset_id);requireValue(set?.enforcement==='active','MAIN_RULESET_NOT_ENFORCED');requireValue((set.bypass_actors||[]).every(a=>a.actor_type==='RepositoryRole'&&a.actor_id===5),'ONLY_REPOSITORY_ADMINS_MAY_UPDATE_CONTROLLER_ENTRY');}
}
