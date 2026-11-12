import {requireOk} from './core.js';
import {V} from './vehicle-domain.js';
import {monthlyReady,monthBounds,isoDay,isMonthly} from './investor-monthly-domain.js';
import {evaluateMonthlySources,MonthlyAllocation,MonthlyBankPart} from './investor-monthly-sources.js';

// Owner-only caller, within the existing tenant transaction. This function does not persist claims,
// touch custody, create accounting journals, or turn deposit evidence into a bank reconciliation.
export async function loadMonthlySources(c:any,cipher:any,query:{companyId:string;investorId:string;currency:string;period:string}){
 requireOk(await monthlyReady(c),503,'monthlyReviewPending');
 requireOk((await c.query('select ab.investor_registry_owner() ok')).rows[0].ok,403,'ownerOnly');
 const bounds=monthBounds(query.period),today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Dubai'}),cutoff=bounds.to<today?bounds.to:today;
 const target=(await c.query(`select distinct x.receipt_id from ab.vehicle_allocations x
 join ab.vehicle_invoices i on i.id=x.invoice_id join ab.vehicles v on v.id=i.vehicle_id
 join ab.investor_funding_requests f on f.request_id=v.request_id
 join ab.investor_funding_versions fv on fv.funding_id=f.id
 join ab.investor_monthly_versions mv on mv.version_id=fv.version_id
 join ab.finance_receipts r on r.id=x.receipt_id
 where mv.company_id=$1 and mv.investor_id=$2 and mv.currency=$3 and r.currency=$3 and r.received_on<=$4::date
 order by x.receipt_id limit 20001`,[query.companyId,query.investorId,query.currency,cutoff])).rows;
 requireOk(target.length<=20000,422,'monthlySourceRangeTooLarge');const receipts=target.map((r:any)=>r.receipt_id);
 if(!receipts.length)return {...evaluateMonthlySources({...query,allocations:[],bankParts:[],claims:[]}),details:{}};
 const rows=(await c.query(`select x.*,i.kind,i.amount invoice_amount,i.due_on,i.invoice_number,r.amount receipt_amount,r.kind receipt_kind,r.payment_state,r.received_on,r.receipt_number,r.currency receipt_currency,r.reference receipt_reference,r.batch_id,r.deposit_operation_id,
 vr.request_number,customer.file_number customer_file_number,v.id vehicle_id,v.file_number,v.payload_cipher vehicle_cipher,f.id funding_id,f.terms_cipher,fv.version_id,mv.investor_id,mv.configuration_id,ic.id classification_id,
 exists(select 1 from ab.finance_allocation_reversals rev where rev.allocation_id=x.id) reversed,
 exists(select 1 from ab.investor_registration_sources src where src.funding_id=f.id and src.invoice_id=i.id) registration_source,
 j.payload_cipher collection_snapshot
 from ab.vehicle_allocations x join ab.vehicle_invoices i on i.id=x.invoice_id
 join ab.finance_receipts r on r.id=x.receipt_id
 left join ab.vehicles v on v.id=i.vehicle_id left join ab.vehicle_requests vr on vr.id=v.request_id left join ab.customers customer on customer.id=i.customer_id left join ab.investor_funding_requests f on f.request_id=v.request_id
 left join ab.investor_funding_versions fv on fv.funding_id=f.id left join ab.investor_monthly_versions mv on mv.version_id=fv.version_id
 left join ab.investor_monthly_invoice_classifications ic on ic.invoice_id=i.id
 left join lateral(select payload_cipher from ab.finance_journals where status='Posted'and(source_key='receipt:'||r.id::text or source_key='monthly-transfer-receipt:'||r.id::text)order by created_at limit 1)j on true
 where x.receipt_id=any($1::uuid[])order by r.receipt_number,i.due_on,i.invoice_number,x.id`,[receipts])).rows;
 const allocations:MonthlyAllocation[]=[],details:any={},receiptRows=new Map<string,any>();
 for(const row of rows){
  receiptRows.set(row.receipt_id,row);const frozen=row.terms_cipher?cipher.open(row.terms_cipher):null,selected=row.investor_id===query.investorId&&(row.kind==='finance'||row.kind==='admin'&&V.units(row.invoice_amount)===V.units(frozen.registrationBaseFee));
  let kind:MonthlyAllocation['kind']='other',offset=0n,base=0n,share=0n;
  if(selected){
   const terms=cipher.open(row.terms_cipher);requireOk(isMonthly(terms)&&terms.monthlyConfigurationId===row.configuration_id,409,'monthlyConfigurationMismatch');
   requireOk(row.classification_id,409,'monthlyInvoiceClassificationRequired');
   if(row.kind==='admin')requireOk(row.registration_source,409,'monthlyRegistrationSourceRequired');
   const snapshot=row.collection_snapshot?cipher.open(row.collection_snapshot).monthlyAgencyRouting?.find((p:any)=>p.allocationId===row.id):null;
   // Bank-confirmed settlement may consume only amounts already posted as investor payables.
   requireOk(snapshot&&snapshot.sourceAmount&&V.units(snapshot.sourceAmount)===V.units(row.amount)&&snapshot.fundingId===row.funding_id,409,'monthlyCollectionPostingSnapshotRequired');
   kind=row.kind==='finance'?'installment':'registration_share';offset=V.units(snapshot.registrationOffset||'0');base=V.units(terms.registrationBaseFee);share=V.units(terms.registrationShareAmount);
  }
  allocations.push({id:row.id,receiptId:row.receipt_id,fundingId:row.funding_id||'',versionId:row.version_id||'',companyId:row.company_id,currency:row.receipt_currency,kind,amount:V.units(row.amount),receivedOn:isoDay(row.received_on),registrationOffset:offset,registrationBase:base,registrationShare:share,reversed:row.reversed||row.payment_state!=='Cleared'});
  const vehicle=row.vehicle_cipher?cipher.open(row.vehicle_cipher):{};details[row.id]={customerNumber:row.customer_file_number?String(row.customer_file_number):'',fundingNumber:row.request_number?String(row.request_number):'',agreementNumber:frozen?.agreementNumber||'',versionLabel:(frozen?.agreementNumber||'')+' / '+(frozen?.agreementVersion||''),invoiceId:row.invoice_id,invoiceNumber:String(row.invoice_number),receiptReference:row.receipt_reference,receiptNumber:String(row.receipt_number),vehicleId:row.vehicle_id,fileNumber:row.file_number?String(row.file_number):null,plate:vehicle.plate||'',receivedOn:isoDay(row.received_on)};
 }
 // Excess is a customer-credit hole. It must not be reassigned to a later invoice or counted again.
 for(const [receiptId,row]of receiptRows){const total=allocations.filter(a=>a.receiptId===receiptId).reduce((sum,a)=>sum+a.amount,0n),excess=V.units(row.receipt_amount)-total;requireOk(excess>=0n,409,'monthlyReceiptAllocationMismatch');if(excess)allocations.push({id:'excess:'+receiptId,receiptId,fundingId:'',versionId:'',companyId:query.companyId,currency:query.currency,kind:'other',amount:excess,receivedOn:isoDay(row.received_on)});}
 const bankRows=(await c.query(`with trace as(
 select cm.receipt_id,cm.id trace_id,-cm.amount amount,dep.operation_id,dep.status='Confirmed'confirmed,cm.created_at
 from ab.finance_custody_moves cm join ab.finance_deposits dep on cm.source_key='deposit:'||dep.id::text||':out:'||cm.receipt_id::text and dep.tenant_id=cm.tenant_id
 where cm.receipt_id=any($1::uuid[])and cm.amount<0
 union all select r.id,r.id,r.amount,case when r.kind='transfer'then b.operation_id else r.deposit_operation_id end,r.payment_state='Cleared',r.created_at
 from ab.finance_receipts r left join ab.finance_receipt_batches b on b.id=r.batch_id where r.id=any($1::uuid[])and r.kind in('transfer','cheque'))
 select t.*,o.status operation_status,o.kind operation_kind,o.company_id,o.currency,o.effective_on operation_on,e.id entry_id,e.bank_account_id,e.debit::text bank_debit,
 st.status statement_status,sl.amount::text statement_amount,sl.effective_on statement_on,
 (select min(fe.created_at)at time zone 'Asia/Dubai'from ab.finance_events fe where fe.entity_id=st.id and((fe.entity_type='finance_statement'and fe.action='approved')or(fe.entity_type='ledger'and fe.action='bank_reconciliation_approved')))::date confirmed_on
 from trace t left join ab.finance_operations o on o.id=t.operation_id
 left join ab.finance_entries e on e.operation_id=o.id and e.bank_account_id is not null and e.debit>0
 left join ab.finance_statement_lines sl on sl.entry_id=e.id left join ab.finance_statements st on st.id=sl.statement_id and st.bank_account_id=e.bank_account_id
 order by t.created_at,t.trace_id`,[receipts])).rows;
 const bankParts:MonthlyBankPart[]=bankRows.map((b:any)=>({id:b.trace_id,receiptId:b.receipt_id,companyId:b.company_id||query.companyId,currency:b.currency||query.currency,amount:V.units(b.amount),entryId:b.entry_id,bankAccountId:b.bank_account_id,operationApproved:b.operation_status==='Approved'&&b.operation_kind==='receipt'&&isoDay(b.operation_on)<=cutoff,depositConfirmed:b.confirmed,statementApproved:b.statement_status==='Approved',statementAmountMatches:b.statement_amount!==null&&b.bank_debit!==null&&V.units(b.statement_amount)===V.units(b.bank_debit)&&isoDay(b.statement_on)===isoDay(b.operation_on),confirmedOn:b.confirmed_on?isoDay(b.confirmed_on):undefined}));
 const held=(await c.query("select cm.receipt_id,cm.holder_id,r.holder_id collector_id,sum(cm.amount)::text amount from ab.finance_custody_moves cm join ab.finance_receipts r on r.id=cm.receipt_id where cm.receipt_id=any($1::uuid[])and r.kind='cash'group by cm.receipt_id,cm.holder_id,r.holder_id having sum(cm.amount)>0 order by cm.receipt_id,cm.holder_id",[receipts])).rows;
 for(const h of held)bankParts.push({id:'held:'+h.receipt_id+':'+h.holder_id,receiptId:h.receipt_id,companyId:query.companyId,currency:query.currency,amount:V.units(h.amount),operationApproved:false,depositConfirmed:false,statementApproved:false,statementAmountMatches:false,holderId:h.holder_id,custodyStage:h.holder_id===h.collector_id?'collector':'cashier'});
 const claims=(await c.query(`select l.allocation_id,l.bank_entry_id,l.kind,s.status from ab.investor_monthly_lines l join ab.investor_monthly_settlements s on s.id=l.settlement_id where l.receipt_id=any($1::uuid[])and not l.released`,[receipts])).rows.map((r:any)=>({key:[r.allocation_id,r.bank_entry_id,r.kind].join(':'),status:r.status}));
 return {...evaluateMonthlySources({...query,allocations,bankParts,claims}),details};
}
