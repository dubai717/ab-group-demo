import { z } from 'zod';
import { requireOk } from './core.js';
import { customerCan } from './customers.js';
import { vehicleRight } from './vehicle-domain.js';
import { financeRight } from './finance.js';
import { hrRight,taskRight } from './personnel-domain.js';
import { invoices } from './ledger-domain.js';
import { marketingAllowed } from './marketing.js';
import { investorManager } from './investors.js';

export const datasetNames=z.enum(['companies','banks','customers','vehicles','invoices','employees','tasks','marketing','investments']);
export const datasetColumns:Record<string,string[]>={
 companies:['id','companyId','nameAr','nameEn','status','emirate'],
 banks:['id','companyId','companyName','accountName','bankId','currency','status'],
 customers:['id','companyId','companyName','number','name','nationality','type','status'],
 vehicles:['id','companyId','companyName','number','plate','type','status','customerId'],
 invoices:['id','companyId','companyName','number','kind','dueOn','currency','amount','paid','outstanding','status'],
 employees:['id','companyId','companyName','number','name','jobTitle','status','hiredOn'],
 tasks:['id','companyId','companyName','number','title','status','dueOn','employeeId'],
 marketing:['id','companyId','companyName','title','stage','createdAt'],
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
 if(source==='banks')out=m.bank.list().map((r:any)=>({id:r.id,companyId:r.companyId,accountName:r.accountName,bankId:r.bankId,currency:r.currency,status:r.status}));
 if(source==='customers'&&await exists('customers'))for(const r of await rows('customers'))if(customerCan(m,'view',r.company_id)){const p=cipher.open(r.payload_cipher);out.push({id:r.id,companyId:r.company_id,number:String(r.file_number),name:p.fullName,nationality:p.nationality,type:r.type,status:r.status});}
 if(source==='vehicles'&&await exists('vehicles'))for(const r of await rows('vehicles'))if(vehicleRight(m,'view',r.company_id)){const p=cipher.open(r.payload_cipher);out.push({id:r.id,companyId:r.company_id,number:String(r.file_number),plate:p.plate,type:p.vehicleType,status:r.status,customerId:r.customer_id});}
 if(source==='invoices'&&await exists('finance_invoice_links'))for(const co of m.state.companies)if(financeRight(m,'ledger_view',co.id))for(const r of await invoices(c,{companyId:co.id}))out.push({id:r.id,companyId:co.id,number:r.invoiceNumber,kind:r.kind,dueOn:r.dueOn,currency:r.currency,amount:r.amount,paid:r.paid,outstanding:r.outstanding,status:r.status});
 if(source==='employees'&&await exists('hr_employees'))for(const r of await rows('hr_employees'))if(hrRight(m,'view',r.company_id)||r.user_id===m.actor.id||r.manager_id===m.actor.id){const p=cipher.open(r.payload_cipher);out.push({id:r.id,companyId:r.company_id,number:String(r.employee_number),name:p.nameEn||p.nameAr,jobTitle:r.job_title,status:r.state,hiredOn:columnDate(r.hired_on)});}
 if(source==='tasks'&&await exists('tasks')){const staff=await rows('hr_employees');for(const r of await rows('tasks')){const e=staff.find((e:any)=>e.id===r.employee_id);if(e&&(e.user_id===m.actor.id||e.manager_id===m.actor.id||hrRight(m,'task_manage',r.company_id)||taskRight(m,'assign',r.company_id)))out.push({id:r.id,companyId:r.company_id,number:String(r.task_number),title:cipher.open(r.payload_cipher).title,status:r.state,dueOn:columnDate(r.due_on),employeeId:r.employee_id});}}
 if(source==='marketing'&&await exists('marketing_opportunities')&&(await c.query("select value from ab.settings where key='marketing-enabled'")).rows[0]?.value?.enabled===true)for(const r of await rows('marketing_opportunities'))if(marketingAllowed(m,r.company_id))out.push({id:r.id,companyId:r.company_id,title:cipher.open(r.payload_cipher).title,stage:r.stage,createdAt:r.created_at.toISOString()});
 if(source==='investments'&&await exists('investor_agreements')){const profiles=await rows('investor_profiles');for(const r of await rows('investor_agreements'))if(profiles.some((p:any)=>p.id===r.investor_id&&p.user_id===m.actor.id)||investorManager(m,r.company_id))out.push({id:r.id,companyId:r.company_id,mode:r.mode,currency:r.currency,status:r.state});}
 requireOk(out.length<=20000,422,'registerTooLarge');return out.map(r=>({...r,...(datasetColumns[source].includes('companyName')?{companyName:companyName(r.companyId)}:{})}));
}
