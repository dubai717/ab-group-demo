// Future approved payment methods of the original supplier obligation; no second expense ledger.
import {z} from 'zod';
import {requireOk,sha} from './core.js';
import {financeRight,createFinanceOperation} from './finance.js';
import {L,need,company,chart,evidence,journal,line,balance,open} from './ledger-domain.js';
import {today} from './vehicle-domain.js';
import {assertCashFundAccounts} from './fund-account-roles.js';
import {saveCommitment,lockCommitment} from './financial-commitments.js';
const id=z.uuid(),text=z.string().trim().min(1).max(2000),amount=z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).refine(v=>L.units(v)>0n);
const base=z.object({companyId:id,amount,documentVersionId:id,reference:z.string().trim().min(1).max(160),reason:text,actualPaymentVerified:z.literal(true)}).strict();
async function activation(c:any,cipher:any,m:any,co:string){
 const{financialApproval}=await import('./financial-package.js');
 requireOk(await financialApproval(c,cipher,m,co,'commitment_payments'),403,'financialActivationRequired');
}
async function reserveReference(c:any,cipher:any,s:any,r:any,reference:string){
 const key='commitment-payment-source-v1:'+r.companyId+':'+sha(reference);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
 const row=(await c.query('select value from ab.settings where key=$1',[key])).rows[0],old=row?cipher.open(row.value.cipher):null;
 requireOk(!old||old.companyId===r.companyId&&old.commitmentId===r.id,409,'commitmentPaymentReferenceUsed');
 if(!old)await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[s.tenant_id,key,{cipher:cipher.seal({companyId:r.companyId,commitmentId:r.id,reference,createdBy:s.user_id,createdAt:new Date().toISOString()})}]);
}
async function accrual(c:any,r:any){
 requireOk(r.status==='Approved'&&r.accrualJournalId&&r.payableChartId,409,'commitmentApprovalRequired');
 for(const a of [{companyId:r.companyId,journalId:r.accrualJournalId},...(r.allocationJournals||[])])
  requireOk((await c.query("select 1 from ab.finance_journals j where j.id=$1 and j.company_id=$2 and j.status='Posted' and not exists(select 1 from ab.finance_journals rev where rev.reversal_of=j.id)",[a.journalId,a.companyId])).rowCount,409,'commitmentVoucherMismatch');
}
async function freeVoucher(c:any,r:any){if(r.voucherId){const v=(await c.query('select status from ab.finance_vouchers where id=$1 and company_id=$2',[r.voucherId,r.companyId])).rows[0];requireOk(v?.status==='Cancelled',409,'linkedVoucherCorrectionRequired');}}
export async function assertCommitmentPaymentIdle(c:any,r:any){
 if(!r.payment)return;
 if(r.payment.kind==='cash')requireOk(false,409,'paidCommitmentCorrectionRequired');
 const o=(await c.query('select status from ab.finance_operations where id=$1 and company_id=$2',[r.payment.operationId,r.companyId])).rows[0];
 requireOk(o?.status==='Rejected',409,'linkedCommitmentBankPaymentRequired');
}
export async function commitmentPaymentProjection(c:any,co:string,rows:any[]){
 const cashIds=rows.filter(r=>r.payment?.kind==='cash').map(r=>r.payment.journalId),bankIds=rows.filter(r=>r.payment?.kind==='bank').map(r=>r.payment.operationId);
 const cash=cashIds.length?(await c.query("select j.id,j.status,j.source_key,j.currency,exists(select 1 from ab.finance_journals rev where rev.reversal_of=j.id) reversed,e.chart_id,sum(e.debit-e.credit)::text amount from ab.finance_journals j join ab.finance_entries e on e.journal_id=j.id where j.company_id=$1 and j.id=any($2::uuid[]) group by j.id,e.chart_id",[co,cashIds])).rows:[];
 const bank=bankIds.length?(await c.query('select o.id,o.status,o.revision,o.kind,o.amount::text,o.currency,o.counterpart_id,o.integration_refs,(select coalesce(sum(e.debit-e.credit),0)::text from ab.finance_entries e where e.operation_id=o.id and e.chart_id=o.counterpart_id) posted_debit from ab.finance_operations o where o.company_id=$1 and o.id=any($2::uuid[])',[co,bankIds])).rows:[];
 return new Map(rows.map(r=>{const p=r.payment;if(!p&&r.status!=='Approved')return[r.id,{paymentState:'NotPayable',paid:'0.000',outstanding:'0.000'}];if(!p)return[r.id,{paymentState:r.voucher?.status==='Paid'?'Paid':r.voucher&&r.voucher.status!=='Cancelled'?'ChequeInProgress':'Unpaid',paid:r.voucher?.status==='Paid'?L.money(L.units(r.amount)):'0.000',outstanding:r.voucher?.status==='Paid'?'0.000':L.money(L.units(r.amount))}];
 const o=p.kind==='bank'?bank.find((x:any)=>x.id===p.operationId):null,j=cash.find((x:any)=>x.id===p.journalId&&x.chart_id===r.payableChartId),valid=p.kind==='cash'?j?.status==='Posted'&&!j.reversed&&j.currency==='AED'&&j.source_key==='commitment-cash:'+r.id&&L.units(j.amount)===L.units(r.amount):o?.status==='Approved'&&o.kind==='payment'&&o.currency==='AED'&&o.counterpart_id===r.payableChartId&&o.integration_refs?.commitmentReference===r.id&&L.units(o.amount)===L.units(r.amount)&&L.units(o.posted_debit)===L.units(r.amount);
 return[r.id,{paymentState:valid?'Paid':p.kind==='bank'&&o?.status==='Draft'?'BankApprovalPending':p.kind==='bank'&&o?.status==='Rejected'?'BankRejected':'ReviewRequired',paid:valid?L.money(L.units(r.amount)):'0.000',outstanding:valid?'0.000':L.money(L.units(r.amount)),paymentNumber:p.number||null,operationRevision:o?.revision||null}];}));
}
export function registerCommitmentPayments(app:any,route:any,cipher:any){
 const path='/api/ledger/commitments/:id';
 app.post(path+'/cash-payment',route(async(c:any,m:any,s:any,req:any)=>{
  const d=base.extend({fundId:id}).parse(req.body),r=await lockCommitment(c,cipher,m,d.companyId,id.parse(req.params.id),'settle');
  need(m,'fund_manage',r.companyId);need(m,'voucher_approve',r.companyId);company(m,r.companyId);await activation(c,cipher,m,r.companyId);
  const digest=sha(JSON.stringify(d));
  if(r.payment?.kind==='cash'){
   requireOk(r.payment.digest===digest,409,'commitmentPaymentAlreadyRecorded');
   const state=(await commitmentPaymentProjection(c,r.companyId,[r])).get(r.id);requireOk(state?.paymentState==='Paid',409,'paidCommitmentCorrectionRequired');
   return{id:r.id,journalId:r.payment.journalId,number:r.payment.number,existing:true,...state};
  }
  await accrual(c,r);await freeVoucher(c,r);await assertCommitmentPaymentIdle(c,r);
  requireOk(L.units(d.amount)===L.units(r.amount),422,'amountMismatch');await evidence(c,m,r.companyId,d.documentVersionId);await reserveReference(c,cipher,s,r,d.reference);
  const fund=(await c.query('select * from ab.finance_funds where id=$1 and company_id=$2 for update',[d.fundId,r.companyId])).rows[0];
  requireOk(fund?.active&&fund.kind==='cash'&&fund.currency==='AED'&&fund.holder_id===s.user_id,403,'commitmentCashFundRequired');
  await assertCashFundAccounts(c,cipher,r.companyId,[fund.chart_id]);requireOk(await balance(c,fund.chart_id)>=L.units(d.amount),422,'insufficientFundBalance');
  const payable=await chart(c,r.companyId,'AED',r.payableChartId,'liability'),cash=await chart(c,r.companyId,'AED',fund.chart_id,'asset');
  const j=await journal(c,cipher,s,r.companyId,today(),'AED','commitment-cash:'+r.id,[line(payable,L.units(d.amount)),line(cash,-L.units(d.amount))],{commitmentId:r.id,beneficiary:r.beneficiary,reason:d.reason,reference:d.reference,documentVersionId:d.documentVersionId,fundId:fund.id,actualCashPayment:true,alreadyAccrued:true});
  const{recordFinancialDocument}=await import('./financial-package.js'),doc=await recordFinancialDocument(c,cipher,s,r.companyId,j,'PV',{sourceKind:'cash_journal',commitmentId:r.id,beneficiary:r.beneficiary,fundId:fund.id});
  await saveCommitment(c,cipher,s,'records',{...r,payment:{kind:'cash',journalId:j,number:doc.number,digest,reference:d.reference,documentVersionId:d.documentVersionId,approvedBy:s.user_id,paidBy:s.user_id,paidAt:new Date().toISOString()},paymentHistory:[...(r.paymentHistory||[]),...(r.payment?[r.payment]:[])]},r);
  return{id:r.id,journalId:j,number:doc.number,existing:false,paymentState:'Paid',paid:L.money(L.units(d.amount)),outstanding:'0.000'};
 }));
 app.post(path+'/bank-payment',route(async(c:any,m:any,s:any,req:any)=>{
  const d=base.extend({bankAccountId:id}).parse(req.body),r=await lockCommitment(c,cipher,m,d.companyId,id.parse(req.params.id),'settle');
  company(m,r.companyId);await activation(c,cipher,m,r.companyId);requireOk(financeRight(m,'finance_create',r.companyId)&&financeRight(m,'finance_view',r.companyId)&&m.bank.can('view',r.companyId),403,'denied');
  const digest=sha(JSON.stringify(d));
  if(r.payment?.kind==='bank'&&r.payment.digest===digest){const o=(await c.query('select status from ab.finance_operations where id=$1 and company_id=$2',[r.payment.operationId,r.companyId])).rows[0];requireOk(o&&o.status!=='Rejected',409,'rejectedCommitmentBankPayment');return{id:r.id,operationId:r.payment.operationId,status:o.status,existing:true};}
  await accrual(c,r);await freeVoucher(c,r);await assertCommitmentPaymentIdle(c,r);
  requireOk(L.units(d.amount)===L.units(r.amount),422,'amountMismatch');await evidence(c,m,r.companyId,d.documentVersionId);await reserveReference(c,cipher,s,r,d.reference);
  const accrualNumber=(await c.query('select number::text from ab.finance_journals where id=$1 and company_id=$2',[r.accrualJournalId,r.companyId])).rows[0].number,attempt=(r.bankPaymentAttempt||0)+1,op=await createFinanceOperation(c,m,s,cipher,{companyId:r.companyId,kind:'payment',bankAccountId:d.bankAccountId,amount:d.amount,currency:'AED',effectiveOn:today(),reason:d.reason,reference:'COM-PAY-JV-'+accrualNumber+'-'+attempt,counterpartId:r.payableChartId,documentVersionId:d.documentVersionId,beneficiary:r.beneficiary,integrationRefs:{commitmentReference:r.id,commitmentPaymentSchema:'1',bankConfirmationReference:d.reference}});
  await saveCommitment(c,cipher,s,'records',{...r,bankPaymentAttempt:attempt,payment:{kind:'bank',operationId:op.id,digest,reference:d.reference,documentVersionId:d.documentVersionId,createdBy:s.user_id,createdAt:new Date().toISOString()},paymentHistory:[...(r.paymentHistory||[]),...(r.payment?[r.payment]:[])]},r);
  return{id:r.id,operationId:op.id,status:'Draft',existing:false,paymentState:'BankApprovalPending',financialEffect:false};
 }));
}
// Called only for the explicitly versioned future source; ordinary historical banking remains unchanged.
export async function reviewCommitmentBankPayment(c:any,cipher:any,m:any,s:any,o:any,confirmation:string|undefined,complete=false){
 if(!o.integration_refs?.commitmentPaymentSchema)return;
 requireOk(o.integration_refs.commitmentPaymentSchema==='1'&&z.uuid().safeParse(o.integration_refs.commitmentReference).success,422,'commitmentVoucherMismatch');
 const r=await lockCommitment(c,cipher,m,o.company_id,o.integration_refs.commitmentReference,'settle');
 await activation(c,cipher,m,r.companyId);await accrual(c,r);await freeVoucher(c,r);await open(c,r.companyId,o.effective_on.toISOString().slice(0,10));
 requireOk(r.payment?.kind==='bank'&&r.payment.operationId===o.id&&o.kind==='payment'&&o.currency==='AED'&&!o.cheque_id&&!o.to_bank_account_id&&o.counterpart_id===r.payableChartId&&o.beneficiary===r.beneficiary&&L.units(o.amount)===L.units(r.amount)&&o.document_version_id===r.payment.documentVersionId&&confirmation===r.payment.reference,409,'commitmentBankPaymentConfirmationRequired');
 await evidence(c,m,r.companyId,o.document_version_id);
 if(!complete)return;
 const debit=L.units((await c.query('select coalesce(sum(debit-credit),0)::text amount from ab.finance_entries where operation_id=$1 and chart_id=$2',[o.id,r.payableChartId])).rows[0].amount);requireOk(debit===L.units(r.amount),409,'commitmentVoucherMismatch');
 if(r.payment.number)return;
 const{recordFinancialDocument}=await import('./financial-package.js'),doc=await recordFinancialDocument(c,cipher,s,r.companyId,o.id,'PV',{sourceKind:'bank_operation',commitmentId:r.id,beneficiary:r.beneficiary});
 await saveCommitment(c,cipher,s,'records',{...r,payment:{...r.payment,number:doc.number,approvedBy:s.user_id,approvedAt:new Date().toISOString()}},r);
}
