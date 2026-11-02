import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {stagingOrigin} from '../deploy/server.js';
import {backupConnection} from '../deploy/backup-staging.js';
test('staging blueprint defines one service, no database/admin connection and no automatic deploy',async()=>{
 const yaml=await readFile('render.yaml','utf8');
 assert.equal((yaml.match(/- type: web/g)||[]).length,1);
 assert(yaml.includes("autoDeployTrigger: 'off'"));assert(yaml.includes('branch: staging/ab-group-test'));
 assert(!/MIGRATION_DATABASE_URL|preDeployCommand|db:migrate|^databases:/m.test(yaml));
 assert(yaml.includes('node backend-build/deploy/server.js'));
 for(const name of ['DATABASE_URL','DATA_ENCRYPTION_KEY','SUPABASE_SECRET_KEY'])assert(new RegExp('key: '+name+'\\s+sync: false').test(yaml));
});
test('staging startup rejects administrative context without leaking a supplied connection',()=>{
 const marker='STAGING_ADMIN_CANARY';const r=spawnSync(process.execPath,['--import','tsx','backend/deploy/server.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,APP_ENV:'staging',MIGRATION_DATABASE_URL:marker,DATABASE_URL:marker}});
 assert.equal(r.status,1);assert(!(r.stdout+r.stderr).includes(marker));assert(r.stdout.includes('STOP: staging startup'));
});
test('backup configuration enforces test target, independent key and verified read-only libpq environment',()=>{
 const e={SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',MIGRATION_DATABASE_URL:'postgresql://postgres.abcdefghijklmnopqrst:FAKE_SECRET@aws-0-eu-west-1.pooler.supabase.com:5432/postgres',DATA_ENCRYPTION_KEY:randomBytes(32).toString('base64'),BACKUP_ENCRYPTION_KEY:randomBytes(32).toString('base64'),PATH:'/bin'};
 const c=backupConnection(e);assert.equal(c.pg.PGSSLMODE,'verify-full');assert.equal(c.pg.PGOPTIONS,'-c default_transaction_read_only=on');assert.equal(c.pg.PGPASSWORD,'FAKE_SECRET');
 assert.throws(()=>backupConnection({...e,BACKUP_ENCRYPTION_KEY:e.DATA_ENCRYPTION_KEY}));
 assert.throws(()=>backupConnection({...e,MIGRATION_DATABASE_URL:e.MIGRATION_DATABASE_URL+'?options=unsafe'}));
 assert.throws(()=>backupConnection({...e,MIGRATION_DATABASE_URL:e.MIGRATION_DATABASE_URL.replace('postgres.','ab_runtime.')}));
});
test('deployment and cloud backup remain inert templates and deployment pins the tested SHA',async()=>{
 const deploy=await readFile('.github/workflows/render-staging-deploy.yml.example','utf8');
 assert(deploy.includes("needs.staging-checks.result == 'success'"));assert(deploy.includes("github.ref == 'refs/heads/staging/ab-group-test'"));
 assert(deploy.includes("u.searchParams.set('ref',sha)"));assert(!deploy.includes('uses: actions/checkout'));
 const backup=await readFile('.github/workflows/staging-backup.yml.example','utf8');
 assert(!backup.includes('uses: actions/upload-artifact'));assert(!backup.includes('pg_restore'));
 const docker=await readFile('Dockerfile.staging','utf8');assert(docker.includes('USER node'));assert(!/COPY.*\.env|ARG.*SECRET|ENV.*DATABASE_URL/.test(docker));
});

test('staging origin follows the platform-assigned HTTPS address without manual URL guessing',()=>{
 assert.equal(stagingOrigin({RENDER:'true',RENDER_EXTERNAL_URL:'https://ab-test-unique.onrender.com/'}),'https://ab-test-unique.onrender.com');
 assert.equal(stagingOrigin({PUBLIC_ORIGIN:'https://trial.example.com'}),'https://trial.example.com');
 assert.throws(()=>stagingOrigin({RENDER_EXTERNAL_URL:'https://ab.onrender.com'}));
 assert.throws(()=>stagingOrigin({RENDER:'true',RENDER_EXTERNAL_URL:'https://other.example.com'}));
 assert.throws(()=>stagingOrigin({PUBLIC_ORIGIN:'https://trial.example.com/path'}));
});
