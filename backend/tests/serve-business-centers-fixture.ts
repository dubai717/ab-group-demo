// Local synthetic providers only. This entrypoint never starts cloud jobs or changes Supabase.
import {businessCentersFixture} from './business-centers-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
const f=await businessCentersFixture();
const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(let n=1;n<=2;n++)pdf.addPage().drawText('Isolated synthetic document - page '+n,{x:40,y:700,font,size:20});
const proof=await f.req('POST','/api/documents',{companyId:f.co1,category:'other',title:'Synthetic browser document',description:'Isolated fixture',date:'2026-01-01',name:'synthetic-two-pages.pdf',mime:'application/pdf',base64:Buffer.from(await pdf.save()).toString('base64')});
const manager=await f.employee('general_manager'),investor=await f.employee('investor');await f.bill('100');await f.request();
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3614',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3614});
await writeFile('work/business-centers-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,companyId:f.co1,managerId:manager.id,investorId:investor.id,proofVersionId:proof.versionId}),{mode:0o600});
console.log('SYNTHETIC_BUSINESS_CENTERS_FIXTURE_READY');
process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
