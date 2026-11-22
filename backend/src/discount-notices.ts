// Discount notifications reuse native adjustments and the existing inbox; no receipt or task is created.
import {financeRight} from './finance.js';
import {customerCan} from './customers.js';
import {event,notify} from './ledger-domain.js';
export async function discountNotice(c:any,cipher:any,s:any,invoice:any,adjustmentId:string,data:any){
 await event(c,cipher,s,invoice.company_id,adjustmentId,'invoice_discount_applied',null,{invoiceId:invoice.id,customerId:invoice.customer_id,vehicleId:invoice.vehicle_id,amount:data.amount,reason:data.reason,effectiveOn:data.effectiveOn,actorId:s.user_id,cashReceived:'0.000'});
 await notify(c,s,invoice.company_id,adjustmentId,'ledger:discount_applied','discount:'+adjustmentId);
}
export async function discountNoticeDetails(c:any,cipher:any,m:any,ids:string[]){
 if(!ids.length)return new Map();
 const rows=(await c.query("select a.id,a.company_id,a.amount::text,a.created_by,a.created_at,a.payload_cipher,i.id invoice_id,i.invoice_number::text,i.customer_id,i.vehicle_id,i.currency,c.company_id customer_company,c.file_number::text customer_number,c.payload_cipher customer_payload,v.file_number::text vehicle_number from ab.vehicle_invoice_adjustments a join ab.vehicle_invoices i on i.id=a.invoice_id join ab.customers c on c.id=i.customer_id left join ab.vehicles v on v.id=i.vehicle_id where a.id=any($1::uuid[]) and a.kind='waiver'",[ids])).rows;
 return new Map(rows.filter((r:any)=>financeRight(m,'ledger_view',r.company_id)&&customerCan(m,'view',r.customer_company)).map((r:any)=>{const d=cipher.open(r.payload_cipher),u=m.state.users.find((u:any)=>u.id===r.created_by);return[r.id,{customerId:r.customer_id,customerNumber:r.customer_number,discount:{id:r.id,invoiceId:r.invoice_id,invoiceNumber:r.invoice_number,customerId:r.customer_id,customerName:cipher.open(r.customer_payload).fullName||'',vehicleId:r.vehicle_id,vehicleNumber:r.vehicle_number,employeeId:r.created_by,employeeName:u?.fullName||u?.nameAr||u?.nameEn||u?.username||'',amount:r.amount,currency:r.currency,reason:d.reason,effectiveOn:d.effectiveOn,createdAt:r.created_at}}];}));
}
