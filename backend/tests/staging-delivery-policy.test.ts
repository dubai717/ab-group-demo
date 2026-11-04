import {test} from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore Reviewed executable policy module intentionally has no TypeScript declaration.
import {sensitivePath} from '../deploy/staging-delivery-policy.mjs';
test('financial, permission, applied SQL and delivery-control changes need approval while presentation and declared additions remain routine',()=>{
 for(const p of ['backend/src/app.ts','backend/src/ledger-domain.ts','backend/src/core.ts','backend/src/server.ts','backend/deploy/staging-target.json','.github/workflows/staging-ci.yml','supabase/proposed/013_personnel_tasks_performance.sql','ledger-policy.js','user-management-policy.js','finance-workbench.js'])assert(sensitivePath(p),p);
 for(const p of ['styles.css','index.html','app.js','README.md','supabase/additive/014_label.json'])assert(!sensitivePath(p),p);
});
