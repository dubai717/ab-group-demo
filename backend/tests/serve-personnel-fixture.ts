// Synthetic, local-only providers. Never connects to Supabase or Render.
import {personnelFixture} from './personnel-fixture.js';
import {ledgerFixture} from './ledger-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
const schema=process.env.AB_TEST_PERSONNEL_SCHEMA!=='no',f=schema?await personnelFixture():await ledgerFixture();
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3600',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3600});
await writeFile('work/personnel-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,companyId:f.co1,payrollItemId:f.items.expense,schema}),{mode:0o600});console.log('Personnel local synthetic fixture ready.');
process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
