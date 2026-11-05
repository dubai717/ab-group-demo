import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {classify,references} from '../fixtures/test-data-cleanup-plan.js';
import {security} from '../src/core.js';
test('cleanup preview retains users, grants, shared counters and any later modified row',()=>{
 const co=randomUUID(),key=JSON.stringify(['tenant','ledger:'+co]),d:any={companies:[{id:co}],sharedSettingsTouches:[key],provenanceRepair:{transaction:'12345'}};
 assert.equal(classify('users','["id"]','12345',d),'protected');assert.equal(classify('permission_grants','["id"]','12345',d),'protected');
 assert.equal(classify('settings',JSON.stringify(['tenant','counters']),'12345',d),'shared');assert.equal(classify('settings',key,'12345',d),'candidate');assert.equal(classify('settings',key,'12346',d),'modified');
 assert.equal(classify('customers','["id"]','12346',d),'modified');
});
test('cleanup inspection finds external references inside encrypted payloads without treating opaque ciphertext as safe',()=>{
 const cipher=security(randomBytes(32).toString('base64')),co=randomUUID(),ref='bank-test-reference-01',ids=new Set([co,ref]);
 const decoded=references({payload_cipher:cipher.seal({companyId:co,bankId:ref})},cipher,ids);assert(decoded.ids.has(co));assert(decoded.ids.has(ref));assert.equal(decoded.opaque,0);
 assert.equal(references({payload_cipher:'unreadable'},cipher,ids).opaque,1);assert.equal(references({dueOn:'2026-11-05'},cipher,ids).ids.size,0);
});
