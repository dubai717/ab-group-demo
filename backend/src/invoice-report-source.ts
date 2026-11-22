// Original document facts and existing invoice-balance engine only. No financial posting or historical reconstruction.
import {requireOk} from './core.js';
import {invoices} from './ledger-domain.js';
export async function invoiceReportSource(c:any,companies:string[],q:{kind:string,from:string,to:string,currency?:string,itemId?:string,employeeId?:string}){
 const installments=q.kind==='installments';requireOk(installments||q.kind==='adjustments',422,'unsupportedStatementPresentation');
 const sql=installments?`select i.id,i.company_id,i.id invoice_id,i.invoice_number::text,i.due_on::text date,i.amount::text,i.currency,to_jsonb(i)->>'contracting_company_id' contracting_company_id
 from ab.vehicle_invoices i where i.company_id=any($1::uuid[]) and i.kind='finance' and i.due_on between $2::date and $3::date`:
 `select a.id,a.company_id,i.id invoice_id,i.invoice_number::text,(timezone('Asia/Dubai',a.created_at))::date::text date,a.kind adjustment_kind,a.amount::text,i.currency,to_jsonb(i)->>'contracting_company_id' contracting_company_id
 from ab.vehicle_invoice_adjustments a join ab.vehicle_invoices i on i.id=a.invoice_id and i.company_id=a.company_id where a.company_id=any($1::uuid[])and(timezone('Asia/Dubai',a.created_at))::date between $2::date and $3::date`;
 const rows=(await c.query(sql+` and($4::text is null or i.currency=$4)and($5::uuid is null or exists(select 1 from ab.finance_invoice_links l where l.invoice_id=i.id and l.company_id=i.company_id and l.item_id=$5))and($6::uuid is null or ${installments?'i':'a'}.created_by=$6)order by date,${installments?'i':'a'}.id limit 20001`,[companies,q.from,q.to,q.currency||null,q.itemId||null,q.employeeId||null])).rows;
 requireOk(rows.length<=20000,422,'registerTooLarge');if(!installments)return rows;
 const balances=new Map<string,any>();for(const co of companies){const ids=rows.filter((r:any)=>r.company_id===co).map((r:any)=>r.invoice_id);if(ids.length)for(const r of await invoices(c,{companyId:co,invoiceIds:ids}))balances.set(r.id,r);}
 return rows.map((r:any)=>{const b=balances.get(r.invoice_id);if(b)requireOk(b.company_id===r.company_id&&b.currency===r.currency&&String(b.invoiceNumber)===r.invoice_number,409,'financialSourceReviewRequired');return{...r,balanceKnown:!!b,allocated:b?.paid??null,credited:b?.credited??null,legalOutstanding:b?.outstanding??null,bookOutstanding:b?.bookOutstanding??null,paymentStatus:b?.status??null,managedInvestorRight:b?.ownedBy==='investor'};});
}
