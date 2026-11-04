// Local synthetic fixture only, separate from the cloud and existing test databases.
import {fixture} from './fixture.js';
import {build} from '../src/app.js';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const f=await fixture('ab_backup_'+randomUUID().replaceAll('-',''));await f.app.close();
if(process.env.AB_TEST_FINANCE_SCHEMA==='yes')await f.admin.query(await readFile('supabase/proposed/009_financial_workbench.sql','utf8'));
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3200',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});
await app.listen({host:'127.0.0.1',port:3200});
await writeFile('work/finance-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,schema:process.env.AB_TEST_FINANCE_SCHEMA==='yes'}),{mode:0o600});
console.log('Local synthetic finance browser fixture ready; real PostgreSQL, explicit fake Auth/storage/scanner.');
process.on('SIGTERM',async()=>{await app.close();await f.runtime.end();await f.admin.end();process.exit(0);});
