import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {drillGuard} from '../deploy/backup-restore-drill.js';
const env=()=>({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'dubai717/ab-group-demo',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/verify/backup-restore-20261104',AB_BACKUP_DRILL_APPROVED:'read-only-source-isolated-restore',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',MIGRATION_DATABASE_URL:'postgresql://postgres.abcdefghijklmnopqrst:fake@aws-0-example.pooler.supabase.com:5432/postgres',DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'),BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('base64')});
test('hosted backup drill rejects wrong runner/ref/approval and invalid or reused backup key before any connection',()=>{
 const e=env();assert.equal(drillGuard(e).key,e.BACKUP_ENCRYPTION_KEY);
 for(const bad of [{GITHUB_REF:'refs/heads/main'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REPOSITORY:'other/repo'},{AB_BACKUP_DRILL_APPROVED:''},{BACKUP_ENCRYPTION_KEY:''},{BACKUP_ENCRYPTION_KEY:e.DATA_ENCRYPTION_KEY},{BACKUP_ENCRYPTION_KEY:e.BACKUP_ENCRYPTION_KEY+'\n'},{MIGRATION_DATABASE_URL:e.MIGRATION_DATABASE_URL.replace(':5432',':6543')},{MIGRATION_DATABASE_URL:e.MIGRATION_DATABASE_URL+'?sslmode=disable'}])assert.throws(()=>drillGuard({...e,...bad}));
});
test('drill has no deployment, migration invocation or public archive upload; restore uses a fixed local container',async()=>{
 const workflow=await readFile('.github/workflows/backup-restore-drill.yml','utf8');
 assert.match(workflow,/environment: supabase-test/);assert.match(workflow,/127\.0\.0\.1:5547:5432/);
 assert.doesNotMatch(workflow,/uses:.*upload-artifact|run:.*(?:db:migrate|release\.ts|deploy-hook)/);
 const source=await readFile('backend/deploy/backup-restore-drill.ts','utf8');
 assert.match(source,/default_transaction_read_only=on/);assert.match(source,/BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/);
 assert.match(source,/'pg_restore','--host=127\.0\.0\.1','--port=5432','--username=postgres','--dbname=ab_drill'/);
 assert.doesNotMatch(source,/process\.env\.DATABASE_URL/);
});
