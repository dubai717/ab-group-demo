import {financeRight} from './finance.js';
import {P} from './ledger-domain.js';
import {requireOk} from './core.js';
const totalUnits=(value:any)=>{const text=String(value);requireOk(/^-?\d{1,40}(\.\d{1,3})?$/.test(text),422,'financialTotalOutOfRange');const negative=text.startsWith('-'),[whole,fraction='']=text.replace('-','').split('.');return(BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0')))*(negative?-1n:1n);};
export async function dashboardFinancial(c:any,m:any,filter:any={}){
 const allowed=m.state.companies.filter((co:any)=>(!filter.companyId||filter.companyId===co.id)&&(!filter.companyIds||filter.companyIds.includes(co.id))&&financeRight(m,'ledger_view',co.id)).map((co:any)=>co.id),ready=!!(await c.query("select to_regclass('ab.finance_journals')ok")).rows[0].ok;
 const ledger:any[]=[];if(ready&&allowed.length){const rows=(await c.query("select e.company_id,e.currency,ch.kind,sum(e.debit-e.credit)::text net from ab.finance_entries e join ab.finance_chart ch on ch.id=e.chart_id left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.company_id=any($1::uuid[])and ch.kind in('income','expense')and(o.status='Approved'or j.status='Posted')and($2::date is null or coalesce(o.effective_on,j.effective_on)>=$2)and($3::date is null or coalesce(o.effective_on,j.effective_on)<=$3)group by e.company_id,e.currency,ch.kind",[allowed,filter.from||null,filter.to||null])).rows;
 const groups=new Map<string,any>();for(const r of rows){const key=r.company_id+':'+r.currency,g=groups.get(key)||{companyId:r.company_id,currency:r.currency,income:0n,expenses:0n};g[r.kind==='income'?'income':'expenses']+=totalUnits(r.net)*(r.kind==='income'?-1n:1n);groups.set(key,g);}for(const g of groups.values())ledger.push({...g,income:P.money(g.income),expenses:P.money(g.expenses),postedNet:P.money(BigInt(g.income)-BigInt(g.expenses))});}
 const banks:any[]=[],selected=ready?m.bank.list().filter((b:any)=>(!filter.companyId||b.companyId===filter.companyId)&&(!filter.companyIds||filter.companyIds.includes(b.companyId))&&financeRight(m,'finance_view',b.companyId)):[];
 const sums=selected.length?(await c.query("select e.bank_account_id,coalesce(sum(e.debit-e.credit),0)::text amount from ab.finance_entries e join ab.finance_operations o on o.id=e.operation_id where e.bank_account_id=any($1::uuid[])and o.status='Approved'group by e.bank_account_id",[selected.map((b:any)=>b.id)])).rows:[],delta=new Map<string,string>(sums.map((r:any)=>[r.bank_account_id,r.amount]));const bankIds=selected.map((b:any)=>b.id);
 const depositsReady=bankIds.length&&(await c.query("select to_regclass('ab.finance_deposits') ok")).rows[0].ok;
 const deposits=depositsReady?(await c.query("select id,bank_account_id,company_id,amount::text,effective_on::text date from ab.finance_deposits where bank_account_id=any($1::uuid[]) and status='Review' order by effective_on",[bankIds])).rows:[];
 const statements=bankIds.length?(await c.query("select distinct on (s.bank_account_id) s.id,s.bank_account_id,s.status,s.period_to::text,exists(select 1 from ab.finance_statement_lines l where l.statement_id=s.id and l.entry_id is null and l.explanation='') unmatched from ab.finance_statements s where s.bank_account_id=any($1::uuid[]) order by s.bank_account_id,s.period_to desc,s.created_at desc",[bankIds])).rows:[];
 for(const bank of selected){
  const recent=statements.find((r:any)=>r.bank_account_id===bank.id),pending=deposits.filter((r:any)=>r.bank_account_id===bank.id&&financeRight(m,'ledger_view',bank.companyId));
  banks.push({id:bank.id,companyId:bank.companyId,bankId:bank.bankId,name:bank.accountName,lastFour:bank.accountNumber?.replace(/[^0-9]/g,'').slice(-4),currency:bank.currency,status:bank.status,
   balance:P.money(P.units(bank.openingBalance)+totalUnits(delta.get(bank.id)||'0')),
   pending:depositsReady&&financeRight(m,'ledger_view',bank.companyId)?P.money(pending.reduce((sum:bigint,row:any)=>sum+totalUnits(row.amount),0n)):null,
   deposits:pending.map((r:any)=>({id:r.id,date:r.date,amount:r.amount,reference:r.reference})),
   reconciliation:recent?.status,unmatched:recent?.unmatched,reconciledOn:recent?.status==='Approved'?recent.period_to:null,statementId:recent&&financeRight(m,'finance_reconcile',bank.companyId)?recent.id:null,statementPeriod:recent?.period_to});
 }
 return {ledger,banks,basis:'posted original ledger entries by effective date; current bank balances use the original bank workbench formula and are not date-filtered',formalFinancialStatements:false,bankBalancesAsOf:'current'};
}
