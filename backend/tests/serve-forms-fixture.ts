// Local synthetic providers only. No live jobs, cloud credentials or migrations.
import {businessCentersFixture} from './business-centers-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
const f=await businessCentersFixture(),manager=await f.employee('general_manager');
const request=await f.request();await f.fund(request.id);const vehicle=await f.register(request.id,{plate:'SYNTHETIC-FORMS',registeredOn:'2026-01-12'});
await f.req('POST','/api/vehicles/'+vehicle.id+'/status',{status:'Pending',reason:'Synthetic event only',effectiveOn:'2026-02-12',revision:1});
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3625',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3625});
await writeFile('work/forms-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,companyId:f.co1,otherCompany:f.co2,managerId:manager.id,managerUsername:manager.username,vehicleId:vehicle.id}),{mode:0o600});console.log('SYNTHETIC_FORMS_FIXTURE_READY');process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
