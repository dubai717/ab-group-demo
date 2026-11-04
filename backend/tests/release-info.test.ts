import {test} from 'node:test';
import assert from 'node:assert/strict';
import {releaseInfo} from '../deploy/release-info.js';
test('release identity exposes only environment and validated commit, never credential values',()=>{
 assert.deepEqual(releaseInfo({APP_ENV:'staging',RENDER_GIT_COMMIT:'a'.repeat(40),DATABASE_URL:'secret',SUPABASE_SECRET_KEY:'secret'}),{environment:'staging',commit:'a'.repeat(40),projectOriginSha256:null});
 assert.deepEqual(releaseInfo({APP_ENV:'production',RENDER_GIT_COMMIT:'not-a-commit'}),{environment:'unknown',commit:null,projectOriginSha256:null});
});
test('project binding hashes only a public HTTPS origin and refuses credential-bearing URLs',()=>{
 const v=releaseInfo({APP_ENV:'staging',SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co'});assert.match(v.projectOriginSha256||'',/^[a-f0-9]{64}$/);
 assert.equal(releaseInfo({SUPABASE_URL:'https://secret:password@abcdefghijklmnopqrst.supabase.co'}).projectOriginSha256,null);
});
