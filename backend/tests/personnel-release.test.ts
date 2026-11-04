import test from 'node:test';
import assert from 'node:assert/strict';
import {personnelReleaseGuard,personnelReleasePlan,applyPersonnelRelease} from '../deploy/personnel-release.js';
test('personnel release is inert without explicit owner, runner, target, snapshot and restore approvals',async()=>{assert.throws(()=>personnelReleaseGuard({}));const plan=await personnelReleasePlan();assert.equal(plan.migrations.length,5);assert.equal(plan.migrations.at(-1).name,'013_personnel_tasks_performance.sql');assert.equal(plan.baseMigrations,8);assert.equal(plan.targetMigrations,13);let connected=false;await assert.rejects(applyPersonnelRelease({connect:async()=>{connected=true;throw Error('must not connect');}} as any,{}));assert.equal(connected,false);});
