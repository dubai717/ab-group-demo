// Synthetic local test providers only; never connects to Supabase/Render.
import {vehicleFixture} from './vehicle-fixture.js';
import {build} from '../src/app.js';
import {readFile,writeFile} from 'node:fs/promises';
const port=Number(process.env.AB_TEST_VEHICLES_PORT||3400);if(!Number.isInteger(port)||port<1024||port>65535)throw Error('invalidSyntheticPort');
const available=process.env.AB_TEST_VEHICLES_SCHEMA==='yes',f=await vehicleFixture(available);if(available){for(const file of ['012_financial_management.sql','013_personnel_tasks_performance.sql'])await f.admin.query(await readFile('supabase/proposed/'+file,'utf8'));}
await f.app.close();
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:'+port,secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port});
await writeFile('work/vehicles-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,schema:available,port,companyId:f.co1,otherCompanyId:f.co2,customerId:f.client,customerName:'Fictional vehicle customer'}),{mode:0o600});
console.log('Synthetic vehicles fixture ready; local PostgreSQL and explicit fake Auth/store/scanner.');
process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
