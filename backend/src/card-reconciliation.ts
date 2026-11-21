// Validate the original immutable card-match records; no posting or new match store.
import {requireOk} from './core.js';
import {L,evidence} from './ledger-domain.js';
import {personalCardOwnership} from './personal-owner-card.js';
export async function assertCardStatementReconciled(c:any,cipher:any,m:any,st:any){
 const card=(await c.query('select id,currency from ab.finance_cards where id=$1',[st.card_id])).rows[0];requireOk(card,409,'invalidReference');
 if(st.document_version_id)await evidence(c,m,st.company_id,st.document_version_id);
 const personal=await personalCardOwnership(c,cipher,st.card_id);
 const matches=(await c.query(`select x.line_id,x.statement_id,x.charge_id,x.voucher_id,l.statement_id line_statement_id,l.effective_on line_on,l.amount::text line_amount,
 ch.card_id charge_card_id,ch.currency charge_currency,ch.amount::text charge_amount,ch.paid_on,
 v.amount::text voucher_amount,v.currency voucher_currency,v.status voucher_status,o.status operation_status,o.effective_on,
 cs.card_id voucher_card_id,v.company_id voucher_company_id
 from ab.finance_card_matches x join ab.finance_statement_lines l on l.id=x.line_id
 left join ab.finance_card_charges ch on ch.id=x.charge_id
 left join ab.finance_vouchers v on v.id=x.voucher_id
 left join ab.finance_operations o on o.id=v.operation_id
 left join ab.finance_card_settlements cs on cs.voucher_id=v.id
 where x.statement_id=$1 or l.statement_id=$1`,[st.id])).rows;
 const sums=new Map<string,bigint>(),date=(d:any)=>d instanceof Date?d.toISOString().slice(0,10):String(d).slice(0,10);
 for(const x of matches){
  requireOk(x.statement_id===st.id&&x.line_statement_id===st.id,409,'unresolvedDifference');
  let amount:bigint;
  if(x.charge_id){requireOk(x.charge_card_id===st.card_id&&x.charge_currency===card.currency&&date(x.paid_on)===date(x.line_on),409,'unresolvedDifference');amount=L.units(x.charge_amount);}
  else{
   // A company's reimbursement to its Owner is not payment to the personal card issuer.
   requireOk(!personal,409,'ownerCardPaymentProofRequired');
   requireOk(x.voucher_card_id===st.card_id&&x.voucher_currency===card.currency&&x.voucher_status==='Paid'&&x.operation_status==='Approved'&&date(x.effective_on)===date(x.line_on),409,'unresolvedDifference');
   amount=-L.units(x.voucher_amount);
  }
  requireOk((amount>0n)===(L.units(x.line_amount)>0n),409,'unresolvedDifference');
  sums.set(x.line_id,(sums.get(x.line_id)||0n)+amount);
 }
 const lines=(await c.query('select id,amount::text from ab.finance_statement_lines where statement_id=$1',[st.id])).rows;
 requireOk(lines.length>0&&lines.every((l:any)=>sums.has(l.id)&&sums.get(l.id)===L.units(l.amount)),409,'unresolvedDifference');
 requireOk(L.units(st.opening_balance)+lines.reduce((n:bigint,l:any)=>n+L.units(l.amount),0n)===L.units(st.closing_balance),409,'statementBalanceMismatch');
 return{matchedLines:lines.length,personal:!!personal,financialEffect:false};
}

export async function cardStatementMatchAmounts(c:any,statementId:string){
 return(await c.query(`select l.id,coalesce(sum(case when x.charge_id is not null then ch.amount when v.status='Paid' and o.status='Approved' then -v.amount else 0 end),0)::text matched_amount,(l.amount-coalesce(sum(case when x.charge_id is not null then ch.amount when v.status='Paid' and o.status='Approved' then -v.amount else 0 end),0))::text remaining_amount from ab.finance_statement_lines l left join ab.finance_card_matches x on x.line_id=l.id and x.statement_id=l.statement_id left join ab.finance_card_charges ch on ch.id=x.charge_id left join ab.finance_vouchers v on v.id=x.voucher_id left join ab.finance_operations o on o.id=v.operation_id where l.statement_id=$1 group by l.id order by l.line_no`,[statementId])).rows;
}
