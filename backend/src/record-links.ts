import {z} from 'zod';
import {requireOk} from './core.js';
import {communicationSource} from './communications.js';
import {financeRight} from './finance.js';
import {invoices} from './ledger-domain.js';
import {vehicleInvoices} from './vehicle-domain.js';
import {audit} from './data.js';
export function registerRecordLinks(app:any,call:any,cipher:any){app.get('/api/record-links/:type/:id',call(async(c:any,m:any,s:any,req:any)=>{
 const type=z.enum(['company','customer','vehicle','invoice','task','marketing','investment','voucher','operation','deposit']).parse(req.params.type),key=z.uuid().parse(req.params.id);let fields:any={},companyId:string,original:any;
 if(['voucher','operation','deposit'].includes(type)){const table=type==='voucher'?'finance_vouchers':type==='operation'?'finance_operations':'finance_deposits';const r=(await c.query('select * from ab.'+table+' where id=$1',[key])).rows[0];requireOk(r,404,'notFound');companyId=r.company_id;requireOk(financeRight(m,type==='operation'?'finance_view':'ledger_view',companyId));fields={number:r.number||r.reference||r.id,status:r.status,amount:r.amount,currency:r.currency,issuedOn:r.issued_on||r.effective_on,createdAt:r.created_at};original={page:type==='operation'?'bankAccounts':'financialManagement',procedureRequired:true};
 }else{const src=await communicationSource(c,m,type,key),r=src.row;companyId=src.companyId;
 if(type==='invoice'){const bill=r.vehicle_id?(await vehicleInvoices(c,r.vehicle_id)).find((i:any)=>i.id===r.id):(await invoices(c,{companyId})).find((i:any)=>i.id===r.id);requireOk(bill,404,'notFound');fields={number:bill.invoiceNumber,kind:bill.kind,dueOn:bill.dueOn,currency:bill.currency,amount:bill.amount,paid:bill.paid,outstanding:bill.legalOutstanding??bill.outstanding};original={page:'financialManagement',procedureRequired:true};}
 else if(type==='company')fields={nameAr:r.data.arabicName,nameEn:r.data.englishName,status:r.data.status};
 else if(type==='customer'){const p=cipher.open(r.payload_cipher);fields={number:String(r.file_number),name:p.fullName,status:r.status};}
 else if(type==='vehicle'){const p=cipher.open(r.payload_cipher);fields={number:String(r.file_number),plate:p.plate,type:p.vehicleType,status:r.status};}
 else if(type==='task'){const p=cipher.open(r.payload_cipher);fields={number:String(r.task_number),title:p.title,expectedResult:p.expectedResult,state:r.state,dueOn:r.due_on};}
 else if(type==='marketing'){const p=cipher.open(r.payload_cipher);fields={title:p.title,stage:r.stage,createdAt:r.created_at};original={page:'marketing',procedureRequired:false};}
 else fields={mode:r.mode,currency:r.currency,state:r.state};
 }
 await audit(c,s.tenant_id,s.user_id,'original_record_opened',type,key,Object.keys(fields));return {id:key,type,companyId,fields,original};
}));}
