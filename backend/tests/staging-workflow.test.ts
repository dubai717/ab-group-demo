import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('staging release requires successful checks, trusted push policy, backup/schema gate and post-release smoke',async()=>{
 const s=await readFile('.github/workflows/staging-ci.yml','utf8');
 assert.match(s,/branches: \[staging\/ab-group-test\]/);assert.match(s,/if: github\.event_name == 'push'.*github\.repository == 'dubai717\/ab-group-demo'.*github\.ref == 'refs\/heads\/staging\/ab-group-test'/);
 assert.match(s,/schema:\n    needs: \[staging-checks, policy\]/);assert.match(s,/release:\n    needs: \[policy, schema\]/);assert.match(s,/smoke:\n    needs: release/);assert.match(s,/needs\.release\.result == 'success' && needs\.smoke\.result == 'success'/);
 const publish=s.slice(s.indexOf('  release:'),s.indexOf('  smoke:'));assert(!publish.includes('actions/checkout'));assert(!publish.includes('MIGRATION_DATABASE_URL'));assert.match(publish,/u\.searchParams\.set\('ref',sha\)/);assert.match(publish,/production_environment:false/);assert.match(publish,/LIVE_VERSION_TIMEOUT/);assert.match(publish,/projectOriginSha256/);
 assert.match(s,/private-bucket-no-overwrite/);assert(!s.includes('uses: actions/upload-artifact'));assert.match(s,/cancel-in-progress: false/);
});
