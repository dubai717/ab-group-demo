import {test} from 'node:test';import assert from 'node:assert/strict';import {fixture} from './fixture.js';
test('retired pages and frontend assets are 404 while operational assets and original data remain',async()=>{const f=await fixture();try{
 const before=(await f.admin.query('select id,auth_id,role_id,status,data from ab.users order by id')).rows,roles=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,objects=f.objects.rows.size;
 for(const url of ['/test-data','/test-users','/testData','/testUsers','/test-users-ui.js','/reset-test-database-ui.js'])assert.equal((await f.app.inject({method:'GET',url})).statusCode,404,url);
 for(const url of ['/','/app.js','/company-documents.js','/customers.js','/vehicles.js','/attachment-viewer.js'])assert.equal((await f.app.inject({method:'GET',url})).statusCode,200,url);
 assert.deepEqual((await f.admin.query('select id,auth_id,role_id,status,data from ab.users order by id')).rows,before);assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,roles);assert.equal(f.objects.rows.size,objects);
 }finally{await f.app.close();await f.runtime.end();await f.admin.end();}});
