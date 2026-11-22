import {requireOk} from './core.js';
// Fixed original source definitions only; caller retains report/audit/export and private-card guards.
export async function remainingReportSource(c:any,companies:string[],q:any){
 const sources:Record<string,string>={
  cards:'select ch.id,ch.company_id,ch.card_id,ch.amount::text,ch.currency,ch.paid_on,ch.reference,ch.created_at,card.name card_name from ab.finance_card_charges ch left join ab.finance_cards card on card.id=ch.card_id and card.company_id=ch.company_id where ch.company_id=any($1::uuid[])and ch.created_at::date between $2 and $3 and($4::text is null or ch.currency=$4) order by ch.created_at,ch.id limit 20001',
  kpi:'select id,company_id,employee_id,kind,amount::text,created_at from ab.finance_kpi_facts where company_id=any($1::uuid[])and created_at::date between $2 and $3 and($4::uuid is null or employee_id=$4) order by created_at,id limit 20001',
  intercompany:'select t.id,t.company_id,t.to_company_id,t.voucher_id,t.state,t.created_at,v.number::text voucher_number,v.status voucher_status,v.amount::text,v.currency from ab.finance_intercompany t left join ab.finance_vouchers v on v.id=t.voucher_id and v.company_id=t.company_id where t.company_id=any($1::uuid[])and t.created_at::date between $2 and $3 and($4::text is null or v.currency=$4) order by t.created_at,t.id limit 20001'
 };
 requireOk(sources[q.kind],422,'unsupportedStatementPresentation');const rows=(await c.query(sources[q.kind],[companies,q.from,q.to,q.kind==='kpi'?q.employeeId||null:q.currency||null])).rows;requireOk(rows.length<=20000,422,'registerTooLarge');return rows;
}
