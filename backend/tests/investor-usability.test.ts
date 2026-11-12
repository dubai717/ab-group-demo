import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessCentersFixture} from './business-centers-fixture.js';
import {security,transaction} from '../src/core.js';
import {investorToday,registryFundingSnapshot} from '../src/investor-registry.js';

test('Simplified versions freeze absent recovery instructions without inheriting historical fields; private ranges stay authorized',async()=>{
 const f=await businessCentersFixture();try{
 await f.admin.query(await readFile('supabase/additive/026_investor_registry_versions.sql','utf8'));
 const person={nameAr:'مستثمر نموذج مبسط',nameEn:'Simplified investor',type:'individual',identityNumber:'SIMPLIFIED-ONLY',identityAuthority:'Synthetic',nationality:'AE',phone:'000',address:'Isolated test'};
 const p=await f.req('POST','/api/investor-registry/profiles',person),proof=await f.proof(),today=investorToday();
 const legacy={effectiveOn:'2026-01-01',registrationBaseFee:'300',registrationShareAmount:'50',documentVersionId:proof,principalRecoveryMethod:'pro_rata',capitalReturnFrom:'2026-01-02',returnsDueFrom:'2026-01-03',yieldBps:1200};
 const a=await f.req('POST','/api/investor-registry/agreements',{...legacy,investorId:p.id,companyId:f.co1,mode:'prefunded',pledged:'0'});await f.req('POST','/api/investor-registry/versions/'+a.id+'/approve',{confirm:true});
 const original=(await f.admin.query('select terms_cipher from ab.investor_agreement_versions where id=$1',[a.id])).rows[0].terms_cipher;
 const simplified={effectiveOn:today,registrationBaseFee:'300',registrationShareAmount:'100',documentVersionId:await f.proof()};
 const v=await f.req('POST','/api/investor-registry/agreements/'+a.agreementId+'/versions',simplified);await f.req('POST','/api/investor-registry/versions/'+v.id+'/approve',{confirm:true});
 const terms=security(f.secret.key).open((await f.admin.query('select terms_cipher from ab.investor_agreement_versions where id=$1',[v.id])).rows[0].terms_cipher);
 assert.equal(terms.collectionPolicy,'explicit_records');assert.equal(terms.principalRecoveryMethod,null);assert.equal(terms.capitalReturnFrom,null);assert.equal(terms.returnsDueFrom,null);assert.equal(terms.yieldBps,0);const snapshot=await transaction(f.runtime,f.org.tenant,f.org.user,async c=>registryFundingSnapshot(c,security(f.secret.key),(await c.query('select * from ab.investor_agreements where id=$1',[a.agreementId])).rows[0],{},true));assert.equal(snapshot.principalRecoveryMethod,null);assert.equal(snapshot.capitalReturnFrom,null);assert.equal(snapshot.returnsDueFrom,null);
 assert.equal((await f.admin.query('select terms_cipher from ab.investor_agreement_versions where id=$1',[a.id])).rows[0].terms_cipher,original);
 const view=await f.req('GET','/api/investors/agreements/'+a.agreementId);assert.equal(Number(view.capital.eligibleRefund),0);assert.equal(Number(view.entitlement.available),0);assert.equal(view.currentVersion.registrationShareAmount,'100');
 await f.req('POST','/api/investor-registry/agreements/'+a.agreementId+'/versions',{...simplified,registrationShareAmount:'301'},422);
 await f.req('POST','/api/investor-registry/agreements/'+a.agreementId+'/versions',simplified,409);
 const login=await f.app.inject({method:'POST',url:'/api/login',payload:{username:f.username,password:f.password},headers:{origin:'http://127.0.0.1:3100','x-ab-request':'1'}});assert.equal(login.statusCode,200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const url='/api/documents/'+proof+'/file',headers={cookie,'x-ab-request':'1'};
 const full=await f.app.inject({method:'GET',url,headers});assert.equal(full.statusCode,200);
 const part=await f.app.inject({method:'GET',url,headers:{...headers,range:'bytes=0-7'}});assert.equal(part.statusCode,206);assert.equal(part.rawPayload.length,8);assert.deepEqual(part.rawPayload,full.rawPayload.subarray(0,8));assert.match(String(part.headers['content-range']),/^bytes 0-7\//);assert.match(String(part.headers['cache-control']),/no-store/);
 for(const range of ['bytes=999999-','bytes=8-2','bytes=0-2,5-8','bytes=-1'])assert.equal((await f.app.inject({method:'GET',url,headers:{...headers,range}})).statusCode,416);
 assert.equal((await f.app.inject({method:'GET',url,headers:{'x-ab-request':'1',range:'bytes=0-7'}})).statusCode,401);
 const employee=await f.employee();const other=await f.app.inject({method:'POST',url:'/api/login',payload:{username:employee.username,password:employee.password},headers:{origin:'http://127.0.0.1:3100','x-ab-request':'1'}});
 const denied=await f.app.inject({method:'GET',url,headers:{cookie:String(other.headers['set-cookie']).split(';')[0],'x-ab-request':'1',range:'bytes=0-7'}});assert.equal(denied.statusCode,403);
 }finally{await f.close();}
});
