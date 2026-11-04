// Synthetic local-only browser fixture. No cloud credentials or changes.
import {fixture} from './fixture.js';
import {build} from '../src/app.js';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const f=await fixture('ab_backup_'+randomUUID().replaceAll('-',''));await f.app.close();
const available=process.env.AB_TEST_CUSTOMERS_SCHEMA==='yes';
if(available){await f.admin.query(await readFile('supabase/proposed/009_financial_workbench.sql','utf8'));await f.admin.query(await readFile('supabase/proposed/010_customers.sql','utf8'));}
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3300',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});
await app.listen({host:'127.0.0.1',port:3300});
await writeFile('work/customers-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,schema:available}),{mode:0o600});
console.log('Synthetic customer browser fixture ready, explicit fake Auth/storage/scanner; local PostgreSQL only.');
process.on('SIGTERM',async()=>{await app.close();await f.runtime.end();await f.admin.end();process.exit(0);});
