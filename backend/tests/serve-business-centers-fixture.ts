import {sourceFingerprint} from './source-fingerprint.mjs';
// Local synthetic providers only. This entrypoint never starts cloud jobs or changes Supabase.
import {businessCentersFixture} from './business-centers-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const port=Number(process.env.AB_SYNTHETIC_UI_PORT||3614);if(![3614,3624].includes(port))throw Error('LOCAL_SYNTHETIC_PORT_REQUIRED');
const fingerprint=await sourceFingerprint(),f=await businessCentersFixture();
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let n=1;n<=2;n++)pdf.addPage().drawText('Isolated synthetic document - page '+n,{x:40,y:700,font,size:20});
const proof=await f.req('POST','/api/documents',{companyId:f.co1,category:'other',title:'Synthetic browser document',description:'Isolated fixture',date:'2026-01-01',name:'synthetic-two-pages.pdf',mime:'application/pdf',base64:Buffer.from(await pdf.save()).toString('base64')});
const manager=await f.employee('general_manager'),investor=await f.employee('investor');await f.bill('100');await f.request();
const investorProfile=await f.req('POST','/api/investors/profiles',{companyId:f.co1,userId:investor.id,nameAr:'مستثمر متصفح معزول',nameEn:'Synthetic browser investor'}),agreement=await f.req('POST','/api/investors/agreements',{companyId:f.co1,investorId:investorProfile.id,mode:'committed',currency:'AED',pledged:'1000',registrationBps:0,serviceBps:0,feeBasis:'collected_gross',documentVersionId:proof.versionId,legalBasis:'Synthetic browser signed agreement'});await writeFile('work/synthetic-investor-evidence.pdf',await pdf.save(),{mode:0o600});
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:'+port,secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port});
if(await sourceFingerprint()!==fingerprint)throw Error('SYNTHETIC_FIXTURE_SOURCE_CHANGED_DURING_START');
await writeFile(port===3614?'work/business-centers-browser-fixture.json':'work/business-centers-browser-fixture-'+port+'.json',JSON.stringify({sourceFingerprint:fingerprint,username:f.username,password:f.password,companyId:f.co1,managerId:manager.id,investorId:investor.id,investorUsername:investor.username,investorPassword:investor.password,agreementId:agreement.id,proofVersionId:proof.versionId}),{mode:0o600});
console.log('SYNTHETIC_BUSINESS_CENTERS_FIXTURE_READY');
process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
