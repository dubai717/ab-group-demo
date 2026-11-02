import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateExistingTrial,resetPayload} from '../actions/reset-existing-trial-password.mjs';
const email='trial_4db27b82b8bf@example.test';
const auth={id:'fake-auth-id',email,email_confirmed_at:'2026-01-01'};
const profile={normalized_username:'trial_4db27b82b8bf',status:'Active',role_id:'owner',auth_id:auth.id,auth_email:email};
test('prepared reset targets only the same confirmed active fictional Owner identity',()=>{
 validateExistingTrial(profile,auth,email);
 for(const patch of [{auth_id:'other-id'},{role_id:'employee'},{status:'Inactive'},{auth_email:'other@example.test'},{normalized_username:'another-user'}])assert.throws(()=>validateExistingTrial({...profile,...patch},auth,email));
 assert.throws(()=>validateExistingTrial(profile,{...auth,email_confirmed_at:null},email));
});
test('reset payload modifies password only and enforces existing policy and confirmation',()=>{
 const pw='SYNTHETIC-New@Password123';assert.deepEqual(resetPayload(pw,pw),{password:pw});
 assert.throws(()=>resetPayload(pw,'different'));assert.throws(()=>resetPayload('weak','weak'));
});
test('no reset is executable by default; no account creation, SQL updates or privilege changes',async()=>{
 const source=await readFile('backend/actions/reset-existing-trial-password.mjs','utf8');
 assert(source.includes('AB_APPROVED_TRIAL_PASSWORD_RESET!==username'));
 assert(source.indexOf('AB_APPROVED_TRIAL_PASSWORD_RESET!==username')<source.indexOf("method:'PUT'"));
 assert(!/CREATE ROLE|ALTER ROLE|GRANT |UPDATE ab\.|initializeOrganization|method:'POST'/.test(source));
});
