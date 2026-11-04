import {test} from 'node:test';
import assert from 'node:assert/strict';
import {additiveSql} from '../deploy/safe-staging-additives.js';
test('safe additions generate only bounded nullable columns or nonunique plain indexes',()=>{
 assert.deepEqual(additiveSql('014_label.json',{format:'AB-SAFE-ADDITIVE-1',operations:[{kind:'addNullableColumn',table:'companies',column:'custom_label',type:'text'}]}),['ALTER TABLE ab."companies" ADD COLUMN "custom_label" text']);
 assert.match(additiveSql('014_index.json',{format:'AB-SAFE-ADDITIVE-1',operations:[{kind:'createIndex',table:'companies',columns:['created_at']}]}).join(''),/^CREATE INDEX /);
});
test('unsafe defaults, constraints, SQL expressions, protected tables, core columns and unsupported operations fail closed',()=>{
 for(const op of [{kind:'addNullableColumn',table:'users',column:'custom_label',type:'text'},{kind:'addNullableColumn',table:'companies',column:'tenant_id',type:'uuid'},{kind:'addNullableColumn',table:'companies',column:'custom_label',type:'text',default:'unsafe'},{kind:'addNullableColumn',table:'companies',column:'custom_label',type:'text; DROP TABLE ab.users'},{kind:'createIndex',table:'companies',columns:['lower(name)']},{kind:'createIndex',table:'finance_journals',columns:['id']},{kind:'dropTable',table:'companies'},{kind:'execute',table:'companies',sql:'DELETE FROM ab.users'}])assert.throws(()=>additiveSql('014_unsafe.json',{format:'AB-SAFE-ADDITIVE-1',operations:[op]}));
 assert.throws(()=>additiveSql('013_history.json',{format:'AB-SAFE-ADDITIVE-1',operations:[]}));
});
