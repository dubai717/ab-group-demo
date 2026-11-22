// Read-only projection of original fund charts. No per-fund SQL, guessed opening, currency mixing or grant mutation.
import {requireOk} from './core.js';
import {financeRight} from './finance.js';
import {L} from './ledger-domain.js';
export const maySuperviseFunds=(m:any,co:string)=>financeRight(m,'ledger_audit',co)||financeRight(m,'ledger_fund_manage',co);
export async function nativeFundReport(c:any,m:any,s:any,companies:string[],q:{to?:string,currency?:string,employeeId?:string}={}){
 const supervised=companies.filter(co=>maySuperviseFunds(m,co));
 requireOk(!q.employeeId||q.employeeId===s.user_id||supervised.length===companies.length,403,'denied');
 const rows=(await c.query("select f.*,coalesce(sum(case when (j.status='Posted' or o.status='Approved') and($2::date is null or coalesce(o.effective_on,j.effective_on)<=$2)then e.debit-e.credit else 0 end),0)::text balance from ab.finance_funds f left join ab.finance_entries e on e.chart_id=f.chart_id and e.company_id=f.company_id and e.currency=f.currency left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where f.company_id=any($1::uuid[]) and(f.company_id=any($3::uuid[]) or f.holder_id=$4)and($5::uuid is null or f.holder_id=$5)and($6::text is null or f.currency=$6)group by f.id order by f.company_id,f.created_at,f.id limit 20001",[companies,q.to||null,supervised,s.user_id,q.employeeId||null,q.currency||null])).rows;
 requireOk(rows.length<=20000,422,'registerTooLarge');
 const names=new Map(m.state.companies.map((co:any)=>[co.id,co])),users=new Map(m.state.users.map((u:any)=>[u.id,u]));return rows.map((r:any)=>{const co:any=names.get(r.company_id),holder:any=users.get(r.holder_id);return{...r,company_name_ar:co?.arabicName||'',company_name_en:co?.englishName||'',holder_name_ar:holder?.nameAr||holder?.nameEn||holder?.username||'',holder_name_en:holder?.nameEn||holder?.nameAr||holder?.username||'',balance:L.money(L.units(r.balance)),refill:L.money(L.units(r.ceiling)-L.units(r.balance)),needsRefill:L.units(r.balance)<L.units(r.threshold)};});
}
