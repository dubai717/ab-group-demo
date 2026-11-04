// Synthetic local test providers only; never connects to Supabase/Render.
import {vehicleFixture} from './vehicle-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
const available=process.env.AB_TEST_VEHICLES_SCHEMA==='yes',f=await vehicleFixture(available);await f.app.close();
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3400',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3400});
await writeFile('work/vehicles-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,schema:available,companyId:f.co1,otherCompanyId:f.co2,customerId:f.client,customerName:'Fictional vehicle customer'}),{mode:0o600});
console.log('Synthetic vehicles fixture ready; local PostgreSQL and explicit fake Auth/store/scanner.');
process.on('SIGTERM',async()=>{await app.close();await f.runtime.end();await f.admin.end();process.exit(0);});
