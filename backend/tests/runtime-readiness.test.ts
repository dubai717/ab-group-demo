import {test} from 'node:test';import assert from 'node:assert/strict';import {randomBytes} from 'node:crypto';import {spawnSync} from 'node:child_process';
import {runtimeReadiness} from '../actions/runtime-readiness.js';
test('readiness distinguishes missing protected inputs without exposing values',()=>{
 assert.deepEqual(runtimeReadiness({}).missing,['DATABASE_URL','DATA_ENCRYPTION_KEY']);
 const key=randomBytes(32).toString('base64');const state=runtimeReadiness({DATABASE_URL:'SYNTHETIC_URL_CANARY',DATA_ENCRYPTION_KEY:key});assert(state.ready);assert(!JSON.stringify(state).includes(key));assert(!JSON.stringify(state).includes('SYNTHETIC_URL_CANARY'));
});
test('invalid encryption secret blocks role provisioning without logs or network',()=>{
 const marker='READINESS_SECRET_CANARY';const r=spawnSync(process.execPath,['--import','tsx','backend/actions/runtime-readiness.ts'],{encoding:'utf8',env:{PATH:process.env.PATH,DATABASE_URL:marker,DATA_ENCRYPTION_KEY:marker}});assert.equal(r.status,2);assert(r.stdout.includes('MANUAL_REQUIRED'));assert(!(r.stdout+r.stderr).includes(marker));
});

test('role setup can proceed without a data key, while fixture creation remains blocked',()=>{
 const e={DATABASE_URL:'synthetic protected URL'};
 assert(runtimeReadiness(e,false).ready);
 const trial=runtimeReadiness(e);assert(!trial.ready);assert.deepEqual(trial.missing,['DATA_ENCRYPTION_KEY']);
});
