// Independent synthetic providers, no hosted account, file, balance or grant changes.
import {businessCentersFixture}from'./business-centers-fixture.js';import {build}from'../src/app.js';import {writeFile}from'node:fs/promises';
const f=await businessCentersFixture(),request=await f.request({financeType:'cash'}),vehicle=await f.register(request.id);await f.request();
const bill=await f.bill('100',f.items.salik,{vehicleId:vehicle.id});await f.bill('50',f.items.salik,{vehicleId:vehicle.id,dueOn:'2099-01-05'});await f.collection('25',{vehicleId:vehicle.id,items:[{itemId:f.items.salik,amount:'25'}]});await f.req('POST','/api/ledger/invoices/'+bill.id+'/correct',{amount:'10',effectiveOn:'2026-01-05',reason:'Synthetic approved discount'});
const viewer=await f.employee();for(const action of ['customer_view','vehicle_view'])await f.req('POST','/api/users/'+viewer.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
if(process.env.AB_REGISTER_REVIEW_FIXTURE==='1'){
 await f.req('POST','/api/companies',{arabicName:'شركة دون سجلات',englishName:'Empty synthetic company',tradeLicenseNumber:'REG-SYN-EMPTY',status:'Active'});
 await f.req('POST','/api/customers',{profile:{companyId:f.co1,fullName:'Synthetic permit holder',type:'driver',status:'Prospect',residencyCompanyId:f.co1,identityDocuments:[{kind:'residence',number:'SYN-VALID',expiresOn:'2099-01-01'}]}});
 await f.req('POST','/api/customers',{profile:{companyId:f.co1,fullName:'Synthetic pending customer',status:'Suspended',identityDocuments:[{kind:'residence',number:'SYN-INCOMPLETE'}]}});
 const employee=await f.req('POST','/api/personnel/employees',{companyId:f.co1,nameAr:'موظف اصطناعي',nameEn:'Synthetic employee',jobTitle:'Test',hiredOn:'2026-01-01'});
 const ep='/api/personnel/employees/'+employee.id+'/documents';
 const permit=await f.req('POST',ep,{kind:'residence',residenceCompanyId:f.co2,expiresOn:'2099-01-01',
  title:'Synthetic permit',name:'permit.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 Synthetic sample').toString('base64')});
 await f.req('POST',ep+'/'+permit.versionId+'/review',{approve:true,reason:'Synthetic recorded source'});

}
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3635',secureCookies:false,auth:f.auth,objects:f.objects,scan:async()=>'clean'});await app.listen({host:'127.0.0.1',port:3635});await writeFile('work/customer-workspace-fixture.json',JSON.stringify({viewerUsername:viewer.username,viewerPassword:viewer.password,username:f.username,password:f.password,companyId:f.co1,otherCompany:f.co2,customerId:f.client,vehicleId:vehicle.id}),{mode:0o600});console.log('SYNTHETIC_CUSTOMER_WORKSPACE_READY');process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
