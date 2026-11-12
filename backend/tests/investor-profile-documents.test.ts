import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {businessCentersFixture} from './business-centers-fixture.js';
import {approvedInvestorBank} from '../src/investor-registry.js';
import {security,transaction} from '../src/core.js';

test('Investor profile documents, optional bank approval and existing-login link preserve financial rows and grants',async()=>{
 const f=await businessCentersFixture();try{
 await f.admin.query(await readFile('supabase/additive/026_investor_registry_versions.sql','utf8'));
 const financial=await f.admin.query('select * from ab.finance_journals order by id'),roles=await f.admin.query('select * from ab.role_permissions order by role_id,permission_id');
 const person={nameAr:'مستثمر مستندات مستقل',nameEn:'Independent documents investor',type:'individual',identityNumber:'DOCUMENTS-NEW',identityAuthority:'Synthetic',nationality:'AE',phone:'+971500000000',address:'Synthetic address'};
 const p=await f.req('POST','/api/investor-registry/profiles',person),url='/api/investor-registry/profiles/'+p.id;
 let d=await f.req('GET',url);assert.equal(d.iban,'');assert.equal(d.userId,null);assert.equal(d.electronicAccessAvailable,false);
 await f.req('POST',url+'/bank-approve',{revision:1,confirm:true},422);
 const investor=await f.employee('investor');await f.req('POST',url+'/electronic-access',{userId:investor.id,confirm:true},503);
 await f.admin.query(await readFile('supabase/additive/027_investor_electronic_access.sql','utf8'));
 const users=await f.admin.query('select id,role_id,status from ab.users order by id');
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9sAAAAASUVORK5CYII=','base64');
 const doc=async(name:string,bytes:Buffer,mime='image/png',status=200)=>f.req('POST','/api/documents',{userId:f.org.user,category:'contract',title:name,date:f.date,name,mime,base64:bytes.toString('base64')},status);
 const a=await doc('front.png',png),b=await doc('passport.pdf',Buffer.from('%PDF-1.4 synthetic passport'),'application/pdf');
 const link={versionId:a.versionId,kind:'identity',classification:'idFront'},key=crypto.randomUUID();await f.req('POST',url+'/documents',link,200,key);await f.req('POST',url+'/documents',link,200,key);await f.req('POST',url+'/documents',link,409);
 await f.req('POST',url+'/documents',{versionId:b.versionId,kind:'other',classification:'passport'});
 const dup=await doc('different-name.png',png);await f.req('POST',url+'/documents',{...link,versionId:dup.versionId},409);
 await doc('bad.txt',Buffer.from('not supported'),'text/plain',422);
 d=await f.req('GET',url);assert.equal(d.documents.length,2);assert.equal(d.documents.find((x:any)=>x.version_id===b.versionId).classification,'passport');assert(d.documents.every((x:any)=>x.sha256&&x.canRemove));
 const count=f.objects.rows.size;await f.req('POST',url+'/documents/'+a.versionId+'/withdraw',{reason:'Owner archives duplicate source; retain original',confirm:true});assert.equal(f.objects.rows.size,count);assert((await f.req('GET',url)).documents.find((x:any)=>x.version_id===a.versionId).withdrawn);
 const bank={bankName:'Synthetic bank',accountHolder:'Synthetic owner',accountNumber:'SYNTHETIC-ACCOUNT',iban:'ae07 0331 2345 6789 0123 456'};
 await f.req('POST',url+'/details',{...person,...bank,iban:'AE080331234567890123456',revision:1,status:'Active',confirm:true},422);
 await f.req('POST',url+'/details',{...person,...bank,revision:1,status:'Active',confirm:true});
 const cipher=security(f.secret.key);await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>approvedInvestorBank(c,cipher,p.id)),/investorBankApprovalRequired/);
 await f.req('POST',url+'/bank-approve',{revision:2,confirm:true});await transaction(f.runtime,f.org.tenant,f.org.user,async c=>assert((await approvedInvestorBank(c,cipher,p.id))?.fingerprint));
 await f.req('POST',url+'/details',{...person,...bank,accountNumber:'SYNTHETIC-CHANGED',revision:3,status:'Active',confirm:true});await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>approvedInvestorBank(c,cipher,p.id)),/investorBankApprovalRequired/);
 await f.req('POST',url+'/electronic-access',{userId:f.org.user,confirm:true},422);
 await f.req('POST',url+'/electronic-access',{userId:investor.id,confirm:true});assert.equal((await f.req('GET',url)).userId,investor.id);
 assert.deepEqual((await f.admin.query('select id,role_id,status from ab.users order by id')).rows,users.rows);
 await f.login(investor.username,investor.password);assert.equal((await f.req('GET',url)).canEdit,false);await f.req('POST',url+'/bank-approve',{revision:4,confirm:true},403);await f.req('POST',url+'/documents/'+b.versionId+'/withdraw',{reason:'Denied',confirm:true},403);
 await assert.rejects(transaction(f.runtime,f.org.tenant,investor.id,c=>c.query('select ab.investor_link_login($1,$2)',[p.id,investor.id])),(e:any)=>e.code==='42501');
 await f.login();await assert.rejects(transaction(f.admin,f.org.tenant,f.org.user,c=>c.query("update ab.investor_profiles set payload_cipher='must-not-change' where id=$1",[p.id])),(e:any)=>e.code==='42501');await assert.rejects(transaction(f.admin,f.org.tenant,f.org.user,c=>c.query('delete from ab.investor_profiles where id=$1',[p.id])),(e:any)=>e.code==='22023');
 await f.login();assert.deepEqual((await f.admin.query('select * from ab.finance_journals order by id')).rows,financial.rows);assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,roles.rows);
 }finally{await f.close();}
});
