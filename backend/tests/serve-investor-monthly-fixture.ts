// Synthetic, isolated providers and database only. No hosted credentials or migration catalog changes.
import {monthlyAgencyFixture} from './investor-monthly-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
import {sourceFingerprint} from './source-fingerprint.mjs';
const f=await monthlyAgencyFixture();await f.app.close();
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3631',secureCookies:false,demoBankingMode:true,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3631});
await writeFile('work/monthly-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,companyId:f.co1,profileId:f.person.id,sourceFingerprint:await sourceFingerprint()}),{mode:0o600});console.log('SYNTHETIC_MONTHLY_FIXTURE_READY');process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
