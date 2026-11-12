import {requireOk} from './core.js';
import {V} from './vehicle-domain.js';
import {monthlyFunding,monthlyAmount,monthlyReady,isMonthly} from './investor-monthly-domain.js';

export async function classifyMonthlyInvoice(c:any,cipher:any,m:any,s:any,i:any,it:any){
 if(!i.vehicle_id||!['finance','admin'].includes(i.kind))return false;
 const context=await monthlyFunding(c,cipher,i.id);if(!context)return false;
 if(i.kind==='admin'&&V.units(i.amount)!==V.units(context.terms.registrationBaseFee))return false;
 requireOk(V.units(it.data.taxRate||'0')===0n,409,'monthlyTaxAccountingReviewRequired');
 await monthlyFunding(c,cipher,i.id,true);
 const {event}=await import('./ledger-domain.js');await event(c,cipher,s,i.company_id,i.id,'monthly_agency_invoice_classified',null,{invoiceId:i.id,versionId:context.terms.agreementVersionId||context.terms.documentVersionId,recognition:'actual_collection_only',companyRevenueAtIssue:false});
 return true;
}
export async function monthlyReceiptCredits(c:any,cipher:any,r:any){
 if(!r.vehicle_id||!await monthlyReady(c))return {gross:0n,credits:[] as any[],snapshots:[] as any[]};
 const allocations=(await c.query('select x.*,i.kind,i.amount invoice_amount from ab.vehicle_allocations x join ab.vehicle_invoices i on i.id=x.invoice_id where x.receipt_id=$1 and not exists(select 1 from ab.finance_allocation_reversals rev where rev.allocation_id=x.id)order by x.created_at,x.id',[r.id])).rows;
 let gross=0n;const credits:any[]=[],snapshots:any[]=[];const {chart,line}=await import('./ledger-domain.js');
 for(const a of allocations){if(!['finance','admin'].includes(a.kind))continue;const ctx=await monthlyFunding(c,cipher,a.invoice_id);if(!ctx)continue;requireOk(ctx.classified,409,'monthlyInvoiceClassificationRequired');
  if(a.kind==='admin')requireOk(ctx.row.registration_source===true,409,'monthlyRegistrationSourceRequired');
  const prior=(await c.query(`select coalesce(sum(x.amount),0)::text amount from ab.vehicle_allocations x join ab.finance_receipts previous on previous.id=x.receipt_id where x.invoice_id=$1 and not exists(select 1 from ab.finance_allocation_reversals rev where rev.allocation_id=x.id)and(previous.receipt_number,x.id)<($2::bigint,$3::uuid)`,[a.invoice_id,r.receipt_number,a.id])).rows[0].amount;
  const amount=V.units(a.amount),investor=monthlyAmount(a.kind,amount,V.units(prior),ctx.terms),company=amount-investor;gross+=amount;
  if(investor>0n)credits.push(line(await chart(c,r.company_id,r.currency,ctx.cfg.payable_chart_id,'liability'),-investor));
  if(company>0n)credits.push(line(await chart(c,r.company_id,r.currency,ctx.cfg.fee_income_chart_id,'income'),-company));
  snapshots.push({allocationId:a.id,fundingId:ctx.row.id,agreementVersionId:ctx.terms.agreementVersionId||null,kind:a.kind,sourceAmount:V.money(amount),registrationOffset:V.money(V.units(prior)),registrationBaseFee:ctx.terms.registrationBaseFee,registrationShareAmount:ctx.terms.registrationShareAmount,investorAmount:V.money(investor),companyAmount:V.money(company),splitPrincipalAndProfit:false});
 }
 return {gross,credits,snapshots};
}
export async function monthlyTransferReceipt(c:any,cipher:any,m:any,s:any,r:any,it:any,date:string){
 const routed=await monthlyReceiptCredits(c,cipher,r);if(!routed.gross)return;
 const {line,resolve,journal}=await import('./ledger-domain.js');await journal(c,cipher,s,r.company_id,date,r.currency,'monthly-transfer-receipt:'+r.id,[line(await resolve(c,r.company_id,r.currency,it.data.receivableId),routed.gross),...routed.credits],{receiptId:r.id,bankReposted:false,monthlyAgencyRouting:routed.snapshots});
}
export async function assertMonthlyFundingDisbursement(c:any,cipher:any,f:any,disbursement:any){
 const terms=cipher.open(f.terms_cipher);if(!isMonthly(terms))return;requireOk(await monthlyReady(c),503,'monthlyReviewPending');
 const cfg=(await c.query('select * from ab.investor_monthly_configurations where id=$1 and company_id=$2 and currency=$3',[terms.monthlyConfigurationId,f.company_id,terms.currency])).rows[0];requireOk(cfg,409,'monthlyAccountingApprovalRequired');requireOk(terms.accounting?.capitalChartId===cfg.capital_chart_id&&terms.accounting?.returnsChartId===cfg.payable_chart_id,409,'monthlyAccountingMappingMismatch');
 const op=(await c.query('select * from ab.finance_operations where id=$1',[disbursement?.paymentOperationId])).rows[0];requireOk(op?.kind==='payment'&&op.status==='Approved'&&op.company_id===f.company_id&&op.currency===cfg.currency&&op.counterpart_id===cfg.capital_chart_id&&V.units(op.amount)===V.units(f.amount),409,'monthlyCapitalCustodyDisbursementRequired');
}
