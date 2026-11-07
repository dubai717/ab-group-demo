import {contractingRight} from './contracting-access.js';
import { z } from 'zod';
import { requireOk } from './core.js';
import { customerCan } from './customers.js';
import { vehicleRight } from './vehicle-domain.js';
import { financeRight } from './finance.js';
import { hrRight,taskRight } from './personnel-domain.js';
import { invoices } from './ledger-domain.js';
import { marketingAllowed } from './marketing.js';
import { investorManager } from './investors.js';

type RelatedPermission={permission:string,companyId:string};
const relatedPermissions=new WeakMap<object,RelatedPermission[]>();
export function centralDatasetPermissionProof(rows:any[]){return [...new Map(rows.flatMap(row=>relatedPermissions.get(row)||[]).map(p=>[p.permission+':'+p.companyId,p])).values()];}
export function centralDatasetProofAllowed(m:any,proof:any){return proof?.version===2&&Array.isArray(proof.related)&&proof.related.every((p:any)=>p.permission==='customer_view'?customerCan(m,'view',p.companyId):p.permission==='vehicle_view'?vehicleRight(m,'view',p.companyId):p.permission==='contracting_view'?contractingRight(m,'view',p.companyId):false);}
export const datasetNames=z.enum(['companies','contractingCompanies','banks','customers','vehicles','invoices','employees','tasks','marketing','investments']);
export const datasetColumns:Record<string,string[]>={
 companies:['id','companyId','nameAr','nameEn','status','emirate'],
 contractingCompanies:['id','companyId','companyName','nameAr','nameEn','licenseNumber','relationship','status'],
 banks:['id','companyId','companyName','accountName','bankId','currency','status'],
 customers:['id','companyId','companyName','number','name','nationality','type','status'],
 vehicles:['id','companyId','companyName','number','plate','type','status','customerId','customerName'],
 invoices:['id','companyId','companyName','number','kind','dueOn','currency','amount','paid','outstanding','status','customerName','contractingCompanyName','vehicleNumber'],
 employees:['id','companyId','companyName','number','name','jobTitle','status','hiredOn','departmentId'],
 tasks:['id','companyId','companyName','number','title','status','dueOn','employeeId','departmentId'],
 marketing:['id','companyId','companyName','title','stage','createdAt','departmentId'],
 investments:['id','companyId','companyName','mode','currency','status'],
};
export const numericColumns=new Set(['amount','paid','outstanding']);
const columnDate=(v:any)=>v instanceof Date?v.toISOString().slice(0,10):String(v||'').slice(0,10);
export async function centralDataset(c:any,m:any,cipher:any,source:string){
 datasetNames.parse(source);let out:any[]=[];
 const companyName=(id:string)=>{const r=m.state.companies.find((co:any)=>co.id===id);return r?.englishName||r?.arabicName||'';};
 const exists=async(table:string)=>!!(await c.query('select to_regclass($1) ok',['ab.'+table])).rows[0].ok;
 const rows=async(table:string)=>{const r=(await c.query('select * from ab.'+table+' limit 20001')).rows;requireOk(r.length<=20000,422,'registerTooLarge');return r;};
 if(source==='companies'){out=m.company.canRead()?m.state.companies.map((r:any)=>({id:r.id,companyId:r.id,nameAr:r.arabicName,nameEn:r.englishName,status:r.status,emirate:r.emirate})):[];}
 if(source==='contractingCompanies'&&await exists('contracting_companies'))for(const r of await rows('contracting_companies'))if(contractingRight(m,'view',r.company_id)){const p=cipher.open(r.payload_cipher);out.push({id:r.id,companyId:r.company_id,nameAr:p.nameAr,nameEn:p.nameEn,licenseNumber:p.licenseNumber,relationship:p.relationship,status:r.status});}
 if(source==='banks')out=m.bank.list().map((r:any)=>({id:r.id,companyId:r.companyId,accountName:r.accountName,bankId:r.bankId,currency:r.currency,status:r.status}));
 if(source==='customers'&&await exists('customers'))for(const r of await rows('customers'))if(customerCan(m,'view',r.company_id)){const p=cipher.open(r.payload_cipher);out.push({id:r.id,companyId:r.company_id,number:String(r.file_number),name:p.fullName,nationality:p.nationality,type:r.type,status:r.status});}
 const related=async(table:string,keys:string[],allowed:(co:string)=>boolean,name:(r:any)=>string)=>{if(!keys.length)return new Map<string,any>();const columns=table==='vehicles'?'id,company_id,file_number':'id,company_id,payload_cipher';const source=(await c.query('select '+columns+' from ab.'+table+' where id=any($1::uuid[])',[[...new Set(keys)]])).rows;return new Map<string,any>(source.filter((r:any)=>allowed(r.company_id)).map((r:any)=>[r.id,{name:name(r),companyId:r.company_id}]));};
 if(source==='vehicles'&&await exists('vehicles')){const selected=(await rows('vehicles')).filter((r:any)=>vehicleRight(m,'view',r.company_id)),names=await related('customers',selected.map((r:any)=>r.customer_id),co=>customerCan(m,'view',co),r=>cipher.open(r.payload_cipher).fullName);for(const r of selected){const p=cipher.open(r.payload_cipher);const row={id:r.id,companyId:r.company_id,number:String(r.file_number),plate:p.plate,type:p.vehicleType,status:r.status,customerId:r.customer_id,customerName:names.get(r.customer_id)?.name||''};if(names.has(r.customer_id))relatedPermissions.set(row,[{permission:'customer_view',companyId:names.get(r.customer_id).companyId}]);out.push(row);}}
 if(source==='invoices'&&await exists('finance_invoice_links')){const bills:any[]=[];for(const co of m.state.companies)if(financeRight(m,'ledger_view',co.id))for(const r of await invoices(c,{companyId:co.id}))if(!r.contracting_company_id||contractingRight(m,'view',co.id))bills.push(r);requireOk(bills.length<=20000,422,'registerTooLarge');const customers=await related('customers',bills.map(r=>r.customer_id).filter(Boolean),co=>customerCan(m,'view',co),r=>cipher.open(r.payload_cipher).fullName),parties=await related('contracting_companies',bills.map(r=>r.contracting_company_id).filter(Boolean),co=>contractingRight(m,'view',co),r=>{const p=cipher.open(r.payload_cipher);return p.nameAr||p.nameEn;}),vehicles=await related('vehicles',bills.map(r=>r.vehicle_id).filter(Boolean),co=>vehicleRight(m,'view',co),r=>String(r.file_number));for(const r of bills){const row={id:r.id,companyId:r.company_id,number:r.invoiceNumber,kind:r.kind,dueOn:r.dueOn,currency:r.currency,amount:r.amount,paid:r.paid,outstanding:r.outstanding,status:r.status,customerName:customers.get(r.customer_id)?.name||'',contractingCompanyName:parties.get(r.contracting_company_id)?.name||'',vehicleNumber:vehicles.get(r.vehicle_id)?.name||''};const proof:RelatedPermission[]=[];for(const [map,key,permission]of [[customers,r.customer_id,'customer_view'],[parties,r.contracting_company_id,'contracting_view'],[vehicles,r.vehicle_id,'vehicle_view']]as any[])if(map.has(key))proof.push({permission,companyId:map.get(key).companyId});relatedPermissions.set(row,proof);out.push(row);}}
 if(source==='employees'&&await exists('hr_employees'))for(const r of await rows('hr_employees'))if(hrRight(m,'view',r.company_id)||r.user_id===m.actor.id||r.manager_id===m.actor.id){const p=cipher.open(r.payload_cipher);out.push({id:r.id,companyId:r.company_id,number:String(r.employee_number),name:p.nameEn||p.nameAr,jobTitle:r.job_title,status:r.state,hiredOn:columnDate(r.hired_on),departmentId:r.department_id||''});}
 if(source==='tasks'&&await exists('tasks')){const staff=await rows('hr_employees');for(const r of await rows('tasks')){const e=staff.find((e:any)=>e.id===r.employee_id);if(e&&(e.user_id===m.actor.id||e.manager_id===m.actor.id||hrRight(m,'task_manage',r.company_id)||taskRight(m,'assign',r.company_id)))out.push({id:r.id,companyId:r.company_id,number:String(r.task_number),title:cipher.open(r.payload_cipher).title,status:r.state,dueOn:columnDate(r.due_on),employeeId:r.employee_id,departmentId:e.department_id||''});}}
 if(source==='marketing'&&await exists('marketing_opportunities')&&(await c.query("select value from ab.settings where key='marketing-enabled'")).rows[0]?.value?.enabled===true)for(const r of await rows('marketing_opportunities'))if(marketingAllowed(m,r.company_id))out.push({id:r.id,companyId:r.company_id,title:cipher.open(r.payload_cipher).title,stage:r.stage,createdAt:r.created_at.toISOString(),departmentId:m.state.users.find((u:any)=>u.id===r.assigned_user_id)?.departmentId||''});
 if(source==='investments'&&await exists('investor_agreements')){const profiles=await rows('investor_profiles');for(const r of await rows('investor_agreements'))if(profiles.some((p:any)=>p.id===r.investor_id&&p.user_id===m.actor.id)||investorManager(m,r.company_id))out.push({id:r.id,companyId:r.company_id,mode:r.mode,currency:r.currency,status:r.state});}
 requireOk(out.length<=20000,422,'registerTooLarge');return out.map(r=>{const row={...r,...(datasetColumns[source].includes('companyName')?{companyName:companyName(r.companyId)}:{})};relatedPermissions.set(row,relatedPermissions.get(r)||[]);return row;});
}
