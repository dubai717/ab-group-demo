import {z} from 'zod';
import {dashboardSecurity} from './dashboard-security.js';
import {has} from './data.js';
import {financeRight} from './finance.js';
import {P} from './ledger-domain.js';
import {requireOk} from './core.js';
const totalUnits=(value:any)=>{const text=String(value);requireOk(/^-?\d{1,40}(\.\d{1,3})?$/.test(text),422,'financialTotalOutOfRange');const negative=text.startsWith('-'),[whole,fraction='']=text.replace('-','').split('.');return(BigInt(whole)*1000n+BigInt(fraction.padEnd(3,'0')))*(negative?-1n:1n);};
export async function dashboardFinancial(c:any,m:any,filter:any={}){
 const allowed=m.state.companies.filter((co:any)=>(!filter.companyId||filter.companyId===co.id)&&(!filter.companyIds||filter.companyIds.includes(co.id))&&financeRight(m,'ledger_view',co.id)).map((co:any)=>co.id),ready=!!(await c.query("select to_regclass('ab.finance_journals')ok")).rows[0].ok;
 const ledger:any[]=[];if(ready&&allowed.length){const rows=(await c.query("select e.company_id,e.currency,ch.kind,sum(e.debit-e.credit)::text net from ab.finance_entries e join ab.finance_chart ch on ch.id=e.chart_id left join ab.finance_operations o on o.id=e.operation_id left join ab.finance_journals j on j.id=e.journal_id where e.company_id=any($1::uuid[])and ch.kind in('income','expense')and(o.status='Approved'or j.status='Posted')and($2::date is null or coalesce(o.effective_on,j.effective_on)>=$2)and($3::date is null or coalesce(o.effective_on,j.effective_on)<=$3)group by e.company_id,e.currency,ch.kind",[allowed,filter.from||null,filter.to||null])).rows;
 const groups=new Map<string,any>();for(const r of rows){const key=r.company_id+':'+r.currency,g=groups.get(key)||{companyId:r.company_id,currency:r.currency,income:0n,expenses:0n};g[r.kind==='income'?'income':'expenses']+=totalUnits(r.net)*(r.kind==='income'?-1n:1n);groups.set(key,g);}for(const g of groups.values())ledger.push({...g,income:P.money(g.income),expenses:P.money(g.expenses),postedNet:P.money(BigInt(g.income)-BigInt(g.expenses))});}
 const banks:any[]=[],selected=ready?m.bank.list().filter((b:any)=>(!filter.companyId||b.companyId===filter.companyId)&&(!filter.companyIds||filter.companyIds.includes(b.companyId))&&financeRight(m,'finance_view',b.companyId)):[];
 const sums=selected.length?(await c.query("select e.bank_account_id,coalesce(sum(e.debit-e.credit),0)::text amount from ab.finance_entries e join ab.finance_operations o on o.id=e.operation_id where e.bank_account_id=any($1::uuid[])and o.status='Approved'group by e.bank_account_id",[selected.map((b:any)=>b.id)])).rows:[],delta=new Map<string,string>(sums.map((r:any)=>[r.bank_account_id,r.amount]));for(const b of selected)banks.push({id:b.id,companyId:b.companyId,name:b.accountName,currency:b.currency,status:b.status,canViewDeposits:canMonitorDeposit(m,b.companyId,b.id),balance:P.money(P.units(b.openingBalance)+totalUnits(delta.get(b.id)||'0'))});
 return {ledger,banks,basis:'posted original ledger entries by effective date; current bank balances use the original bank workbench formula and are not date-filtered',formalFinancialStatements:false,bankBalancesAsOf:'current'};
}

function canMonitorDeposit(m:any,companyId:string,accountId:string){
 return financeRight(m,'finance_view',companyId)&&financeRight(m,'ledger_view',companyId)&&
  financeRight(m,'ledger_deposit_verify',companyId)&&m.bank.list().some((bank:any)=>bank.id===accountId&&bank.companyId===companyId);
}

export function registerDashboardDeposits(app:any,call:any,cipher:any){
 app.get('/api/central-dashboard/banks/:accountId/deposits',call(async(c:any,m:any,_s:any,req:any)=>{
  const accountId=z.uuid().parse(req.params.accountId);
  const security=await dashboardSecurity(c,m);
  const bank=m.bank.list().find((r:any)=>r.id===accountId);
  requireOk(has(m.actor,'view_dashboard')&&bank&&security.open&&security.panels.includes('financial')&&security.departmentIds===null&&
   (security.companyIds===null||security.companyIds.includes(bank.companyId))&&canMonitorDeposit(m,bank.companyId,accountId),403,'denied');
  const {depositId}=z.object({depositId:z.uuid().optional()}).strict().parse(req.query);
  if(depositId){
   const row=(await c.query(`select id,currency,amount::text,effective_on::text,status,payload_cipher
    from ab.finance_deposits where id=$1 and bank_account_id=$2 and company_id=$3 and status='Review'`,
    [depositId,accountId,bank.companyId])).rows[0];
   requireOk(row,404,'notFound');
   const {payload_cipher,...detail}=row;
   return {detail:{...detail,reference:cipher.open(payload_cipher).reference||''}};
  }
  const rows=(await c.query(`select id,currency,amount::text,effective_on::text,status
   from ab.finance_deposits where bank_account_id=$1 and company_id=$2 and status='Review'
   order by effective_on desc,id limit 101`,[accountId,bank.companyId])).rows;
  return {rows:rows.slice(0,100),hasMore:rows.length>100};
 }));
}
