import {financeRight} from './finance.js';
import {investorStatement} from './investors.js';
import {marketingAllowed} from './marketing.js';
import {hrRight} from './personnel-domain.js';
import {V,today} from './vehicle-domain.js';

export async function dashboardOverview(c:any,m:any,rows:Map<string,any[]>,cipher:any,month:string,scope:{companyId?:string;companyIds:string[]|null;from?:string;to?:string;departmentScoped:boolean}) {
 const visible=(key:string)=>rows.get(key);
 const day=today();
 const invoices=visible('invoices')||[], employees=visible('employees')||[];
 const groups=new Map<string,any>(), rankings={debt:new Map<string,any>(),items:new Map<string,any>()};
 const rank=(kind:keyof typeof rankings,id:string,name:string,currency:string,amount:bigint,nameEn?:string)=>{
  if(!id)return;
  const map=rankings[kind],key=id+':'+currency,row=map.get(key)||{id,name:name||id,nameEn,currency,amount:0n};
  row.amount+=amount;map.set(key,row);
 };
 for(const bill of invoices){
  const key=bill.companyId+':'+bill.currency;
  const row=groups.get(key)||{companyId:bill.companyId,currency:bill.currency,amount:0n,due:0n,paid:0n,overdue:0n,outstanding:0n};
  const outstanding=V.units(bill.outstanding);
  row.amount+=V.units(bill.amount);row.paid+=V.units(bill.paid);row.outstanding+=outstanding;
  if(outstanding>0n&&bill.dueOn<=day){
   row.due+=outstanding;if(bill.dueOn<day)row.overdue+=outstanding;
   rank('debt',bill.partyId,bill.customerName||bill.contractingCompanyName,bill.currency,outstanding);
   rank('items',bill.itemId,bill.itemName,bill.currency,outstanding,bill.itemNameEn);
  }
  groups.set(key,row);
 }
 const format=(row:any)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?V.money(value):value]));
 const totals=new Map<string,any>();
 for(const row of groups.values()){
  const sum=totals.get(row.currency)||{currency:row.currency,amount:0n,due:0n,paid:0n,overdue:0n,outstanding:0n};
  for(const key of ['amount','due','paid','overdue','outstanding'])sum[key]+=row[key];
  totals.set(row.currency,sum);
 }
 const rankRows=(map:Map<string,any>)=>[...map.values()]
  .sort((a,b)=>a.currency.localeCompare(b.currency)||(a.amount===b.amount?a.name.localeCompare(b.name)||a.id.localeCompare(b.id):a.amount>b.amount?-1:1))
  .map(format);
 const evaluable=employees.filter(e=>hrRight(m,'evaluation_view',e.companyId));
 const hasReviews=evaluable.length&&(await c.query("select to_regclass('ab.hr_reviews') as ready")).rows[0].ready;
 const reviews=hasReviews?(await c.query('select employee_id,company_id,score,payload_cipher from ab.hr_reviews where employee_id=any($1::uuid[]) and month=$2',[evaluable.map(e=>e.id),month])).rows:[];
 const evaluations=employees.map(employee=>{
  const review=reviews.find((r:any)=>r.employee_id===employee.id&&r.company_id===employee.companyId);
  const payload=review?cipher.open(review.payload_cipher):{};
  return {...employee,score:review?.score??null,minimumScore:payload.jobWeights?.length?payload.jobWeights.reduce((sum:number,w:any)=>sum+(payload.models.find((r:any)=>r.jobTitle===w.jobTitle)?.minimumScore??0)*w.weight,0)/10000:null,
   collections:(payload.models||[]).flatMap((model:any)=>model.currency?(model.criteria||[]).filter((criterion:any)=>criterion.metric==='collection_amount'&&criterion.available).map((criterion:any)=>({currency:model.currency,target:V.money(BigInt(criterion.target)),actual:V.money(BigInt(criterion.actual)),remaining:V.money(BigInt(criterion.target)>BigInt(criterion.actual)?BigInt(criterion.target)-BigInt(criterion.actual):0n)})):[])};
 });
 const marketing=visible('marketing');
 const marketingCompanies=[];
 if(marketing&&!scope.departmentScoped&&(await c.query("select value from ab.settings where key='marketing-enabled'")).rows[0]?.value?.enabled===true){
  const ids=m.state.companies.filter((company:any)=>(!scope.companyId||scope.companyId===company.id)&&(!scope.companyIds||scope.companyIds.includes(company.id))&&marketingAllowed(m,company.id)).map((company:any)=>company.id);
  const year=Number(month.slice(0,4));
  const contracts=(await c.query("select id,company_id,state,payload_cipher from ab.marketing_contracts where company_id=any($1::uuid[]) and starts_on >= coalesce($2::date,make_date($4,1,1)) and starts_on <= coalesce($3::date,make_date($4,12,31))",[ids,scope.from||null,scope.to||null,year])).rows;
  const targets=(await c.query("select company_id,payload_cipher from ab.marketing_targets where company_id=any($1::uuid[]) and year=$2 and metric='contracts' and user_id is null and department_id is null",[ids,year])).rows;
  for(const companyId of ids){
   const goals=targets.filter((row:any)=>row.company_id===companyId);
   const target=goals.length===1?cipher.open(goals[0].payload_cipher).months.reduce((sum:number,n:string)=>sum+Number(n),0):null;
   marketingCompanies.push({companyId,target,open:marketing.filter(row=>row.companyId===companyId&&!['contracted','lost'].includes(row.stage)).length,
    contracts:contracts.filter((row:any)=>row.company_id===companyId).map((row:any)=>({id:row.id,state:row.state,title:cipher.open(row.payload_cipher).title||row.id}))});
  }
 }
 const investorCompanies=new Map<string,any>();
 const agreements=visible('investments');
 if(agreements?.length){
  const hasPlateSources=(await c.query("select to_regclass('ab.investor_registration_sources') ready")).rows[0].ready;
  const plateSources=new Set(hasPlateSources?(await c.query('select r.invoice_id from ab.investor_registration_sources r join ab.investor_funding_requests f on f.id=r.funding_id where f.agreement_id=any($1::uuid[])',[agreements.map(row=>row.id)])).rows.map((r:any)=>r.invoice_id):[]);
  const scoped=(await c.query('select * from ab.investor_agreements where id=any($1::uuid[])',[agreements.map(row=>row.id)])).rows;
  for(const agreement of scoped){
   const statement=await investorStatement(c,cipher,agreement),key=agreement.company_id+':'+agreement.currency;
   const row=investorCompanies.get(key)||{companyId:agreement.company_id,currency:agreement.currency,investors:new Set(),vehicles:new Set(),invested:0n,installments:0n,principal:0n,plateFees:null};
   row.investors.add(agreement.investor_id);row.invested+=V.units(statement.capital.received);
   row.installments+=V.units(statement.entitlement.collected);row.principal+=V.units(statement.capital.remainingPrincipal);
   for(const financing of statement.financings){
    if(financing.vehicle)row.vehicles.add(financing.requestId);
    for(const bill of financing.installments)if(plateSources.has(bill.id))row.plateFees=(row.plateFees??0n)+V.units(bill.paid);
   }
   investorCompanies.set(key,row);
  }
 }
 const investorTotals=new Map<string,any>();
 for(const row of investorCompanies.values()){
  const total=investorTotals.get(row.currency)||{currency:row.currency,investors:new Set(),vehicles:new Set(),invested:0n,installments:0n,principal:0n,plateFees:null};
  for(const id of row.investors)total.investors.add(id);
  for(const id of row.vehicles)total.vehicles.add(id);
  for(const key of ['invested','installments','principal'])total[key]+=row[key];
  if(row.plateFees!==null)total.plateFees=(total.plateFees??0n)+row.plateFees;
  investorTotals.set(row.currency,total);
 }
 const investorRow=(row:any)=>format({...row,investors:row.investors.size,vehicles:row.vehicles.size});
 const financialCompanies=visible('invoices')?m.state.companies.filter((co:any)=>
  (!scope.companyId||scope.companyId===co.id)&&(!scope.companyIds||scope.companyIds.includes(co.id))&&financeRight(m,'ledger_view',co.id)).map((co:any)=>co.id):[];
 return {financial:[...groups.values()].map(format),financialCompanies,totals:[...totals.values()].map(format),
  debt:rankRows(rankings.debt),items:rankRows(rankings.items),evaluations,month,
  companies:visible('companies'),marketing,marketingCompanies,investments:agreements,investorCompanies:[...investorCompanies.values()].map(investorRow),investorTotals:[...investorTotals.values()].map(investorRow),
  bankCounts:visible('banks')?.reduce((a,r)=>(a[r.companyId]=(a[r.companyId]||0)+1,a),{}),
  employeeCounts:visible('employees')?.reduce((a,r)=>(a[r.companyId]=(a[r.companyId]||0)+1,a),{})};
}
