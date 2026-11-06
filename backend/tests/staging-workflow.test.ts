import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
test('staging source cannot deploy; protected controller requires checks, approval, backup and smoke',async()=>{
 const source=await readFile('.github/workflows/staging-ci.yml','utf8'),s=await readFile('.github/workflows/trusted-staging-controller.yml','utf8'),w=parse(s);
 assert.match(source,/branches: \[staging\/ab-group-test\]/);assert.deepEqual(Object.keys(parse(source).jobs),['staging-checks']);assert.equal(JSON.stringify(parse(source)).includes('secrets.'),false);
 assert.deepEqual(w.jobs.schema.needs,['policy','owner-approval']);assert.match(w.jobs.schema.if,/needs.policy.result == 'success'/);assert.match(w.jobs.schema.if,/needs.owner-approval.result == 'success'/);assert.equal(w.jobs['owner-approval'].environment,'staging-owner-approval');
 assert.deepEqual(w.jobs.release.needs,['policy','schema']);assert.equal(w.jobs.smoke.needs,'release');assert.match(w.jobs.finalize.steps[0].env.VERIFIED_STATE,/needs.release.result == 'success' && needs.smoke.result == 'success'/);
 const publish=w.jobs.release.steps[1].run;assert(!publish.includes('MIGRATION_DATABASE_URL'));assert.match(publish,/u\.searchParams\.set\('ref',sha\)/);assert.match(publish,/production_environment:false/);assert.match(publish,/LIVE_VERSION_TIMEOUT/);assert.match(publish,/projectOriginSha256/);
 assert.match(s,/private-bucket-no-overwrite/);assert(!s.includes('STAGING_SENSITIVE_APPROVAL_SHA'));assert.equal(w.concurrency['cancel-in-progress'],false);
 for(const job of [w.jobs.schema,w.jobs.smoke]){assert.equal(job.steps[0].with.ref,'${{ inputs.controller_ref }}');assert.equal(job.steps[1].with.path,'candidate');assert.equal(job.steps.some((step:any)=>step.run?.includes('cd candidate')),false);}
});
