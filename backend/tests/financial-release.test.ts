import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { financialReleaseGuard, financialReleasePlan, applyFinancialRelease } from '../deploy/financial-release.js';
import { vehicleFixture } from './vehicle-fixture.js';
import { vehicleBillingTick } from '../src/vehicle-jobs.js';
import { security } from '../src/core.js';
const proof = () => ({ format: 'AB-FINANCIAL-RESTORE-PROOF-1', restoreVerified: true, encryptedObjectsVerified: true, snapshotId: 'synthetic-fixture-only', archiveSha256: 'a'.repeat(64), createdAt: new Date().toISOString() });
test('unapproved release stops before credentials/network and never echoes a secret canary', async () => { assert.throws(() => financialReleaseGuard({ MIGRATION_DATABASE_URL: 'postgres://CANARY_DO_NOT_PRINT@invalid/postgres' }), /approved/); const r = spawnSync(process.execPath, ['--import', 'tsx', 'backend/deploy/financial-release.ts'], { env: { ...process.env, GITHUB_ACTIONS: 'false', MIGRATION_DATABASE_URL: 'postgres://CANARY_DO_NOT_PRINT@invalid/postgres' }, encoding: 'utf8' }); assert.notEqual(r.status, 0); assert((r.stdout + r.stderr).includes('STOP:')); assert(!(r.stdout + r.stderr).includes('CANARY_DO_NOT_PRINT')); await assert.rejects(() => applyFinancialRelease({ connect: () => { throw Error('must not connect'); } } as any, { ...proof(), createdAt: 'invalid' }), /proof/); });
test('reviewed release applies once in order, preserves eight-migration data and roles, and validates a retry without reapplying', async () => { const f = await vehicleFixture(false); try {
    const before = (await f.admin.query('select id,data from ab.companies order by id')).rows, roles = (await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
    const plan = await financialReleasePlan();
    assert.equal(plan.migrations.length, 4);
    assert(plan.rlsTables.includes('vehicle_invoices'));
    assert.equal((await applyFinancialRelease(f.admin, proof())).applied, 4);
    assert.equal((await applyFinancialRelease(f.admin, proof())).applied, 0);
    assert.equal(Number((await f.admin.query('select count(*) n from public.ab_schema_migrations')).rows[0].n), 12);
    assert.deepEqual((await f.admin.query('select id,data from ab.companies order by id')).rows, before);
    assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows, roles);
    assert.equal((await f.req('GET', '/api/vehicles/capabilities')).available, true);
}
finally {
    await f.close();
} });
