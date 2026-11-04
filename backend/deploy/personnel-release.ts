// Review-only release runner. No network connection until explicit owner/runner/backup guards pass.
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { databaseOptions, assertVerifiedDatabaseTls } from '../src/database.js';
import { sha } from '../src/core.js';
export function personnelReleaseGuard(e: NodeJS.ProcessEnv) { if (e.AB_PERSONNEL_RELEASE_APPROVED !== 'owner-approved-staging-only' || e.AB_SYNTHETIC_PROJECT !== 'yes' || e.GITHUB_ACTIONS !== 'true' || e.GITHUB_REPOSITORY !== 'dubai717/ab-group-demo' || e.GITHUB_REF !== 'refs/heads/activate/personnel-staging-approved')
    throw Error('owner-approved isolated release runner required'); const endpoint = new URL(e.SUPABASE_URL || ''), db = new URL(e.MIGRATION_DATABASE_URL || ''); if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co\/?$/.test(endpoint.href) || !['postgres:', 'postgresql:'].includes(db.protocol) || decodeURIComponent(db.username) !== 'postgres.' + endpoint.hostname.split('.')[0] || !db.hostname.endsWith('.pooler.supabase.com') || (db.port || '5432') !== '5432' || db.pathname !== '/postgres' || [...db.searchParams.keys()].some(k => k !== 'sslmode') || (db.searchParams.has('sslmode') && db.searchParams.get('sslmode') !== 'verify-full'))
    throw Error('approved test project required'); return db.href; }
export async function personnelReleasePlan() { const plan = JSON.parse(await readFile('backend/deploy/personnel-release-plan.json', 'utf8')); if (plan.format !== 'AB-PERSONNEL-RELEASE-1' || plan.migrations.length !== 5)
    throw Error('invalid release plan'); const names = ['009_financial_workbench.sql', '010_customers.sql', '011_vehicles.sql', '012_financial_management.sql','013_personnel_tasks_performance.sql']; for (let i = 0; i < 5; i++) {
    const m = plan.migrations[i];
    if (m.name !== names[i] || m.path !== 'supabase/proposed/' + m.name)
        throw Error('invalid migration order');
    const sql = await readFile(m.path, 'utf8');
    if (sha(sql) !== m.sha256 || /\bDROP\s+(?:TABLE|SCHEMA|COLUMN|DATABASE)|\bTRUNCATE\b|\bDELETE\s+FROM\b/i.test(sql))
        throw Error('unreviewed or destructive migration');
} return plan; }
export async function applyPersonnelRelease(pool: Pool, proof: any) { if (proof?.format !== 'AB-PERSONNEL-RESTORE-PROOF-1' || proof.restoreVerified !== true || proof.encryptedObjectsVerified !== true || !proof.snapshotId || !(/^[a-f0-9]{64}$/.test(proof.archiveSha256 || '')) || !Number.isFinite(new Date(proof.createdAt).getTime()) || Date.now() - new Date(proof.createdAt).getTime() > 24 * 3600000 || new Date(proof.createdAt).getTime() > Date.now())
    throw Error('fresh independently verified backup/restore proof required'); const plan = await personnelReleasePlan(), base = JSON.parse(await readFile('backend/actions/approved-migrations.json', 'utf8')), c = await pool.connect(); try {
    await c.query('BEGIN');
    await c.query("select pg_advisory_xact_lock(hashtext('ab-schema-migrations'))");
    const ledger = (await c.query('select name,sha256 from public.ab_schema_migrations')).rows;
    for (const m of base.migrations)
        if (!ledger.some(r => r.name === m.name && r.sha256 === m.sha256))
            throw Error('base migration mismatch');
    if (ledger.some(r => ![...base.migrations, ...plan.migrations].some(m => m.name === r.name && m.sha256 === r.sha256)))
        throw Error('unknown applied migration');
    let applied = 0;
    for (const m of plan.migrations) {
        const done = ledger.find(r => r.name === m.name), exists = (await c.query('select to_regclass($1) present', [m.guardTable])).rows[0].present;
        if (done) {
            if (!exists)
                throw Error('applied migration schema incomplete');
            continue;
        }
        if (exists)
            throw Error('untracked existing schema; never reapply blindly');
        await c.query(await readFile(m.path, 'utf8'));
        await c.query('insert into public.ab_schema_migrations(name,sha256)values($1,$2)', [m.name, m.sha256]);
        applied++;
    }
    const failed = (await c.query("select count(*) n from pg_constraint where connamespace='ab'::regnamespace and not convalidated")).rows[0].n;
    if (Number(failed))
        throw Error('unvalidated relation');
    const unsafe = (await c.query("select count(*) n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind='r' and c.relname=any($1::text[]) and not c.relrowsecurity", [plan.rlsTables])).rows[0].n;
    if (Number(unsafe))
        throw Error('RLS not enabled');
    const found = Number((await c.query("select count(*)n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind='r' and c.relname=any($1::text[])", [plan.rlsTables])).rows[0].n);
    if (found !== plan.rlsTables.length)
        throw Error('incomplete target schema');
    await c.query('COMMIT');
    return { applied };
}
catch (e) {
    await c.query('ROLLBACK');
    throw e;
}
finally {
    c.release();
} }
async function main() { let pool: Pool | undefined; try {
    const url = personnelReleaseGuard(process.env);
    const proof = JSON.parse(await readFile('work/personnel-release-restore-proof.json', 'utf8'));
    await personnelReleasePlan();
    if (!proof.restoreVerified || !proof.encryptedObjectsVerified)
        throw Error('backup proof missing');
    pool = new Pool({ ...databaseOptions(url), max: 1 });
    pool.on('error', () => { });
    const c = await pool.connect();
    try {
        assertVerifiedDatabaseTls(c);
    }
    finally {
        c.release();
    }
    const r = await applyPersonnelRelease(pool, proof);
    console.log('PASS: approved additive staging release applied atomically; migrations=' + r.applied + '; values withheld');
}
catch {
    console.log('STOP: personnel release guard/schema/backup check; values withheld; no retry or destructive rollback');
    process.exitCode = 1;
}
finally {
    if (pool)
        await pool.end();
} }
if (/[/\\]personnel-release\.(ts|js)$/.test(process.argv[1] || ''))
    await main();
