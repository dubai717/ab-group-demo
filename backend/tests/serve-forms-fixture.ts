// Local synthetic providers only. No live jobs, cloud credentials or migrations.
import {businessCentersFixture} from './business-centers-fixture.js';
import {build} from '../src/app.js';
import {writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {security} from '../src/core.js';
const f=await businessCentersFixture(),manager=await f.employee('general_manager');
const bank=await f.bank();
let depositId:string|undefined;
if(process.env.AB_DASHBOARD_RANKING_FIXTURE==='1'){
 for(let index=1;index<=14;index++){
  const companyId=index===14?f.co2:f.co1, tag=String(index).padStart(2,'0');
  const customer=(await f.req('POST','/api/customers',{profile:{fullName:'عميل تجريبي '+tag,companyId,type:'owner',status:'Active'}})).id;
  const item=(await f.req('POST','/api/ledger/items',{code:'dashboard-'+tag,nameAr:'بند محاسبي تجريبي '+tag,nameEn:'Synthetic accounting item '+tag,category:'loan',priority:100+index,companyIds:[companyId],invoice:true,receipt:true,payment:false,methods:['manual'],receivableId:f.accounts.ar.id,revenueId:f.accounts.income.id})).id;
  await f.bill(String(index*125),item,{companyId,customerId:customer,dueOn:index===13?'2026-02-06':f.date});
 }
}

for(const action of ['customer_view','vehicle_view'])await f.req('POST','/api/users/'+manager.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
const department=await f.req('POST','/api/departments',{companyId:f.co1,name:'Synthetic Preview Department'});
await f.req('PATCH','/api/users/'+manager.id,{revision:1,nameAr:'علي معاينة جزئية مسؤول العلاقات العامة وإدارة العمليات والنقل للمجموعة',nameEn:'Ali Partial Preview — Senior Public Relations and Transport Operations Coordinator for AB Group',departmentIds:[department.id]});
const permissionTarget=await f.employee(),inactive=await f.employee();await f.req('PATCH','/api/users/'+inactive.id,{revision:1,status:'Disabled'});
if(process.env.AB_DASHBOARD_DELEGATION_FIXTURE==='1'){
 const userId=manager.id,path='/api/central-dashboard/security';
 const current=await f.req('GET',path+'?userId='+userId);
 const body={userId,version:current.version,value:{...current.value,previewCompanyIds:[f.co1]}};
 const {planHash}=await f.req('POST',path+'-plan',body);
 await f.req('POST',path+'-apply',{...body,planHash,confirm:true});
 await f.req('PATCH','/api/users/'+permissionTarget.id,{revision:1,nameAr:'موظف تجريبي للمعاينة',nameEn:'Synthetic preview employee'});
 depositId=randomUUID();
 const proof=await f.proof();
 await f.admin.query(`insert into ab.finance_deposits(id,tenant_id,company_id,holder_id,bank_account_id,currency,
  amount,effective_on,document_version_id,payload_cipher,created_by)values($1,$2,$3,$4,$5,'AED',200,$6,$7,$8,$4)`,
  [depositId,f.org.tenant,f.co1,f.org.user,bank.id,f.date,proof,security(f.secret.key).seal({reference:'SYN-DASHBOARD-200'})]);
}
const pro=await f.req('POST','/api/personnel/employees',{companyId:f.co1,userId:manager.id,nameAr:'مسؤول علاقات اختبار',nameEn:'Synthetic PRO',departmentId:department.id,jobTitle:'Public relations',hiredOn:'2026-01-01'}),pendingRequest=await f.request();
const cipher=security(f.secret.key),contact=(await f.admin.query('select payload_cipher from ab.customers where id=$1',[f.client])).rows[0];
await f.admin.query('update ab.customers set payload_cipher=$2 where id=$1',[f.client,cipher.seal({...cipher.open(contact.payload_cipher),phones:[{id:'forms-phone',number:'+971500000009',status:'valid'}]})]);
const bill=await f.bill(),collectionTask=await f.req('POST','/api/collections/tasks',{invoiceId:bill.id,employeeId:pro.id,dueOn:'2026-11-20'});
const request=await f.request();await f.fund(request.id);const vehicle=await f.register(request.id,{plate:'SYNTHETIC-FORMS',registeredOn:'2026-01-12'});
await f.req('POST','/api/vehicles/'+vehicle.id+'/status',{status:'Pending',reason:'Synthetic event only',effectiveOn:'2026-02-12',revision:1});
await f.app.close();const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3625',secureCookies:false,demoBankingMode:true,auth:f.auth,objects:f.objects,scan:async()=> 'clean'});await app.listen({host:'127.0.0.1',port:3625});
await writeFile('work/forms-browser-fixture.json',JSON.stringify({username:f.username,password:f.password,companyId:f.co1,otherCompany:f.co2,managerId:manager.id,managerUsername:manager.username,managerPassword:manager.password,depositId,bankId:bank.id,vehicleId:vehicle.id,customerId:f.client,pendingRequestId:pendingRequest.id,proEmployeeId:pro.id,collectionTaskId:collectionTask.id,permissionTargetId:permissionTarget.id,ownerId:f.org.user,inactiveId:inactive.id}),{mode:0o600});console.log('SYNTHETIC_FORMS_FIXTURE_READY');process.on('SIGTERM',async()=>{await app.close();await f.close();process.exit(0);});
