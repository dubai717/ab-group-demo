// Synthetic local providers and isolated database only; never imported by server.ts.
import {randomUUID,randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixture.js';
import {build} from '../src/app.js';
import {provisionTestUsers} from '../src/test-user-provisioning.js';
import {seedIntegratedData} from '../fixtures/integrated-test-data.js';
const f=await fixture('ab_backup_'+randomUUID().replaceAll('-',''));
for(const file of ['009_financial_workbench.sql','010_customers.sql','011_vehicles.sql','012_financial_management.sql','013_personnel_tasks_performance.sql'])await f.admin.query(await readFile('supabase/proposed/'+file,'utf8'));
const r=(await provisionTestUsers(f.admin,f.auth,f.secret.key,{tenant:f.org.tenant,id:f.org.user})).registry;
await seedIntegratedData(f.runtime,f.secret.key,r,f.objects);
const browserPassword='Aa1!'+randomBytes(30).toString('base64url'),owner=r.users.find(u=>u.role==='owner')!,localOwner=(await f.admin.query('select auth_id from ab.users where id=$1',[f.org.user])).rows[0];await f.auth.setPassword(localOwner.auth_id,browserPassword);await f.auth.setPassword(owner.authId,browserPassword); // Ephemeral TestAuth only; no real provider.
const employee=r.users.find(u=>u.role!=='owner')!;await f.auth.setPassword(employee.authId,browserPassword); // Disposable provider only.
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3700',secureCookies:false,auth:f.auth,objects:f.objects,testUsersEnabled:true});
app.get('/__fixture',async()=>({username:f.username,testOwner:owner.username,employee:employee.username,password:browserPassword}));await app.listen({host:'127.0.0.1',port:3700});
process.on('SIGTERM',async()=>{await app.close();await f.app.close();await f.runtime.end();await f.admin.end();});
