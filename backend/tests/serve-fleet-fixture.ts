// Fresh random local database only; never connects to hosted providers.
import {businessCentersFixture} from './business-centers-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
const f=await businessCentersFixture(),party=await f.req('POST','/api/contracting-companies',{companyId:f.co1,nameAr:'شركة تشغيل اختبار معزولة',nameEn:'Isolated fleet work company',licenseNumber:'SYNTHETIC-FLEET-UI',licenseAuthority:'Synthetic'});
const vehicles=[];for(const type of ['Bus','Truck']){const request=await f.request({financeType:'cash',expectedFunding:'0',vehicleType:type});vehicles.push((await f.register(request.id,{vehicleType:type})).id);}
const proof=await f.proof();await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3626',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3626});
await writeFile('work/fleet-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,companyId:f.co1,partyId:party.id,vehicles,proof,itemId:f.items.loan}),{mode:0o600});console.log('SYNTHETIC_FLEET_READY');process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
