// Reviewed investor schema runs only in this random isolated local database.
import {businessCentersFixture} from './business-centers-fixture.js';
import {build} from '../src/app.js';
import {readFile,writeFile} from 'node:fs/promises';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {investorToday} from '../src/investor-registry.js';
const f=await businessCentersFixture();await f.admin.query(await readFile('docs/proposals/investor-registry-versions.review-only.sql','utf8'));
await f.admin.query(await readFile('supabase/additive/027_investor_electronic_access.sql','utf8'));
const loginInvestor=await f.employee('investor');
const bank=await f.bank();async function liability(code:string){return (await f.req('POST','/api/ledger/accounts',{code,nameAr:'التزام مستثمر معزول',nameEn:'Isolated investor liability',kind:'liability',companyIds:[f.co1],currency:'AED'})).charts[0].id;}
const capital=await liability('v2-ui-capital'),returns=await liability('v2-ui-returns');
for(const [name,words]of [['identity','Isolated synthetic identity'],['version-1','Synthetic investment version 1: 50 of 300'],['version-2','Synthetic investment version 2: 100 of 300']]){const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);doc.addPage().drawText(words,{x:40,y:700,font,size:15});await writeFile('work/investor-v2-'+name+'.pdf',await doc.save(),{mode:0o600});}
await writeFile('work/investor-profile-image.png',Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=','base64'));
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3627',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3627});
const today=investorToday(),yesterday=new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);await writeFile('work/investor-registry-fixture.json',JSON.stringify({username:f.username,password:f.password,loginInvestorId:loginInvestor.id,companyId:f.co1,customerId:f.client,bankId:bank.id,capital,returns,expense:f.accounts.expense.charts[f.co1],loan:f.items.loan,commission:f.items.commission,today,yesterday}),{mode:0o600});console.log('SYNTHETIC_INVESTOR_REGISTRY_READY');process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
