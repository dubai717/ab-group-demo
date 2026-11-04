import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';import {spawnSync} from 'node:child_process';
import {approvedFiles,approvedMigrationContext,migrationBranch} from '../actions/approved-schema.js';
test('approved migration manifest contains exactly the eight reviewed files and no destructive statements',async()=>{
 const f=await approvedFiles();assert.equal(f.manifest.migrations.length,8);assert(f.tables.includes('companies'));assert(f.tables.includes('bank_accounts'));assert(f.tables.includes('audit_events'));
 const schema=await readFile(new URL('../../.github/workflows/supabase-schema.yml',import.meta.url),'utf8');assert(schema.includes('environment: supabase-test'));assert(!/upload-artifact|deploy-pages|set -x/.test(schema));
});
test('migration execution requires the exact owner-approved hosted branch and workflow',()=>{
 const e={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'dubai717/ab-group-demo',GITHUB_EVENT_NAME:'push',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_REF:migrationBranch,GITHUB_WORKFLOW_REF:`dubai717/ab-group-demo/.github/workflows/supabase-schema.yml@${migrationBranch}`};assert(approvedMigrationContext(e));
 for(const patch of [{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/main'},{RUNNER_ENVIRONMENT:'self-hosted'},{GITHUB_REPOSITORY:'other/fork'}])assert(!approvedMigrationContext({...e,...patch}));
});
test('unauthorized migration attempt stops before network and never echoes a secret canary',()=>{
 const marker='SYNTHETIC_MIGRATION_SECRET_CANARY';const r=spawnSync(process.execPath,['--import','tsx','backend/actions/approved-schema.ts'],{encoding:'utf8',cwd:process.cwd(),env:{PATH:process.env.PATH,MIGRATION_DATABASE_URL:marker}});assert.equal(r.status,1);assert((r.stdout+r.stderr).includes('IMPACT_ERROR: trusted context'));assert(!(r.stdout+r.stderr).includes(marker));
});
