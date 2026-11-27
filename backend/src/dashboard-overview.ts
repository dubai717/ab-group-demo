import {dashboardCollectionTasks} from './central-read-models.js';
import {hrRight,taskRight} from './personnel-domain.js';
import {marketingAllowed} from './marketing.js';
import {contractingRight} from './contracting-access.js';
import {financeRight} from './finance.js';
import {investorManager, investorStatement} from './investors.js';
import {today, V} from './vehicle-domain.js';

const terminal = new Set(['Done', 'Completed', 'Cancelled', 'Closed']);
const completed = new Set(['Done', 'Completed', 'Closed']);

function taskMetrics(rows: any[], date: string) {
  const due = rows.filter(row => row.dueOn <= date && row.status !== 'Cancelled');
  const done = due.filter(row => completed.has(row.status)).length;
  return {done, due: due.length, overdue: due.filter(row => row.dueOn < date && !terminal.has(row.status)).length};
}

function groupBy(rows: any[], key: string) {
  const grouped = new Map<string, any[]>();
  for (const row of rows) {
    const group = grouped.get(row[key]);
    if (group) group.push(row); else grouped.set(row[key], [row]);
  }
  return grouped;
}

const ratio = (numerator: bigint, denominator: bigint) =>
  denominator > 0n ? Number((numerator * 10000n) / denominator) / 100 : null;
const average = (values: number[]) => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;

export async function dashboardOverview(c: any, m: any, cipher: any, input: {
  companyIds: string[];
  selectedCompany?: string;
  filtered: Map<string, any[]>;
  financial: boolean;
  reports: boolean;
  departmentScoped: boolean;
  alerts: boolean;
  charts: boolean;
  details: string[];
  from?: string;
  to?: string;
}) {
  const {filtered} = input;
  const date = input.to && input.to < today() ? input.to : today();
  const month = date.slice(0, 7);
  const specialPeriod = !!(input.from || input.to);
  const list = (source: string) => filtered.get(source) || [];
  const companies = m.state.companies.filter((co: any) => input.companyIds.includes(co.id) && (!input.selectedCompany || co.id === input.selectedCompany));
  const countsByCompany = (rows: any[]) => {
    const result = new Map<string, number>();
    for (const row of rows) result.set(row.companyId, (result.get(row.companyId) || 0) + 1);
    return result;
  };
  const tasksByEmployee = groupBy(list('tasks'),'employeeId');
  const bankCounts = countsByCompany(list('banks'));
  const employeeCounts = countsByCompany(list('employees'));
  const contractCompanies=companies.filter((co:any)=>contractingRight(m,'view',co.id));
  const contractCounts=new Map<string,number>();
  const contractsReady=input.reports&&filtered.has('contractingCompanies')&&
    (await c.query("select to_regclass('ab.marketing_contracts') is not null and to_regclass('ab.contracting_links') is not null ok")).rows[0].ok;
  if(contractsReady && list('contractingCompanies').length){
    const rows=(await c.query(`select x.company_id,count(distinct x.id)::int count
      from ab.marketing_contracts x
      left join ab.contracting_links l on (l.contract_id=x.id or l.prospect_id=x.prospect_id) and l.company_id=x.company_id
      where (to_jsonb(x)->>'contracting_company_id'=any($1::text[]) or l.contracting_company_id=any($1::uuid[]))
       and ($2::date is null or x.ends_on >= $2)
       and ($3::date is null or x.starts_on <= $3)
      group by x.company_id`,[list('contractingCompanies').map(row=>row.id),input.from||null,input.to||null])).rows;
    for(const row of rows)contractCounts.set(row.company_id,row.count);
  }
  const financialCompanies = input.financial && !input.departmentScoped && filtered.has('invoices')
    ? companies.filter((co: any) => financeRight(m, 'ledger_view', co.id)) : [];
  const financialIds = new Set(financialCompanies.map((co: any) => co.id));
  const totals = new Map<string, {companyId: string; currency: string; invoiced: bigint; due: bigint; collected: bigint; overdue: bigint; outstanding: bigint; periodDue: bigint; periodCollected: bigint}>();
  for (const invoice of list('invoices')) {
    if (!financialIds.has(invoice.companyId)) continue;
    const key = invoice.companyId + ':' + invoice.currency;
    const row = totals.get(key) || {companyId: invoice.companyId, currency: invoice.currency, invoiced: 0n, due: 0n, collected: 0n, overdue: 0n, outstanding: 0n, periodDue: 0n, periodCollected: 0n};
    const outstanding = V.units(invoice.outstanding);
    const paid = V.units(invoice.paid);
    row.invoiced += V.units(invoice.amount);
    row.collected += paid;
    row.outstanding += outstanding;
    if (invoice.dueOn <= date) {
      row.due += outstanding;
      if (invoice.dueOn < date) row.overdue += outstanding;
      if (specialPeriod || invoice.dueOn.startsWith(month)) {
        row.periodDue += outstanding + paid;
        row.periodCollected += paid;
      }
    }
    totals.set(key, row);
  }
  const financial = financialCompanies.flatMap((co: any) => {
    const rows = [...totals.values()].filter(r => r.companyId === co.id);
    return (rows.length ? rows : [{companyId: co.id, currency: null, invoiced: 0n, due: 0n, collected: 0n, overdue: 0n, outstanding: 0n}])
      .map(({companyId, currency, invoiced, due, collected, overdue, outstanding}: any, index: number) => ({
        companyId, currency, invoiced: V.money(invoiced), due: V.money(due), collected: V.money(collected),
        overdue: V.money(overdue), outstanding: V.money(outstanding),
        banks: index === 0 && filtered.has('banks') && m.bank.can('view',companyId) ? bankCounts.get(companyId) || 0 : null,
        employees: index === 0 && filtered.has('employees') && (hrRight(m,'view',companyId)||employeeCounts.has(companyId)) ? employeeCounts.get(companyId) || 0 : null
      }));
  });

  const tasks = list('tasks');
  const periodTasks = specialPeriod ? tasks : tasks.filter(row => row.dueOn?.startsWith(month));
  const staff = input.charts && input.details.includes('employees') && input.details.includes('tasks') ? list('employees').map(row => {
    const assigned = (tasksByEmployee.get(row.id)||[]).filter(task=>specialPeriod||task.dueOn?.startsWith(month));
    return {id:row.id,companyId:row.companyId,name:row.name,...taskMetrics(assigned,date),
      collections:taskMetrics(assigned.filter(task=>dashboardCollectionTasks.has(task)),date)};
  }) : [];
  const marketingCounts = countsByCompany(specialPeriod ? list('marketing') : list('marketing').filter(row => String(row.createdAt).slice(0, 7) === month));
  const marketingCompanies=new Set(companies.filter((co:any)=>marketingAllowed(m,co.id)).map((co:any)=>co.id));
  const marketingTargets: Map<string, number> = new Map();
  if (input.charts && !input.departmentScoped && !specialPeriod && filtered.has('marketing') &&
      (await c.query("select to_regclass('ab.marketing_targets') ok")).rows[0].ok) {
    const rows = (await c.query(`select distinct on(company_id) company_id,payload_cipher
      from ab.marketing_targets where company_id=any($1::uuid[]) and year=$2 and metric='opportunities'
      and user_id is null and department_id is null order by company_id,created_at desc,id desc`,
      [[...marketingCompanies], Number(month.slice(0,4))])).rows;
    for (const row of rows) marketingTargets.set(row.company_id, Number(cipher.open(row.payload_cipher).months[Number(month.slice(5))-1]));
  }
  const tasksByCompany=groupBy(periodTasks,'companyId');
  const performance = companies.map((co: any) => {
    const collections = [...totals.values()].filter(row => row.companyId === co.id)
      .map(row => ratio(row.periodCollected, row.periodDue)).filter((value): value is number => value !== null);
    return {companyId: co.id, collection: average(collections), collectionScoped:financialIds.has(co.id), opportunities: filtered.has('marketing') && marketingCompanies.has(co.id) ? marketingCounts.get(co.id) || 0 : null,
      target: marketingTargets.get(co.id) ?? null,
      ...taskMetrics(tasksByCompany.get(co.id)||[], date),
      taskScope:filtered.has('tasks')&&(tasksByCompany.has(co.id)||hrRight(m,'task_manage',co.id)||taskRight(m,'assign',co.id))};
  });

  const investors = new Map<string, {companyId: string; currency: string; investors: Set<string>; vehicles: Set<string>; invested: bigint; installments: bigint; plates: bigint; principal: bigint}>();
  if (input.reports && filtered.has('investments') && !input.departmentScoped) {
    const visibleAgreements = new Set(list('investments').map(row => row.id));
    if (visibleAgreements.size) {
      const agreements = (await c.query('select * from ab.investor_agreements where id=any($1::uuid[])', [[...visibleAgreements]])).rows;
      for (const a of agreements) {
        if (!investorManager(m, a.company_id)) continue;
        const statement = await investorStatement(c, cipher, a);
        const key = a.company_id + ':' + a.currency;
        const row = investors.get(key) || {companyId:a.company_id, currency:a.currency, investors:new Set<string>(), vehicles:new Set<string>(), invested:0n, installments:0n, plates:0n, principal:0n};
        row.investors.add(a.investor_id);
        row.invested += V.units(statement.capital.received);
        row.installments += V.units(statement.entitlement.collected);
        row.principal += V.units(statement.capital.remainingPrincipal);
        for (const financing of statement.financings) {
          if (financing.vehicle) row.vehicles.add(financing.requestId);
          for (const bill of financing.installments) if (bill.kind === 'service') row.plates += V.units(bill.paid);
        }
        investors.set(key, row);
      }
    }
  }
  const emirates = new Map<string, number>();
  for (const co of list('companies')) if (co.emirate) emirates.set(co.emirate,(emirates.get(co.emirate)||0)+1);
  return {
    financial: input.financial && !input.departmentScoped && filtered.has('invoices') ? financial : null,
    contracts: contractsReady ? contractCompanies.map((co:any) => ({companyId:co.id, count:contractCounts.get(co.id)||0})) : null,
    emirates: input.reports && filtered.has('companies') ? [...emirates].map(([emirate,count])=>({emirate,count})) : null,
    investorTotals:{investors:new Set([...investors.values()].flatMap(r=>[...r.investors])).size,vehicles:new Set([...investors.values()].flatMap(r=>[...r.vehicles])).size},
    investors: input.reports && filtered.has('investments') && !input.departmentScoped && m.actor.roleId!=='investor'
      ? [...investors.values()].map(r=>({companyId:r.companyId,currency:r.currency,investors:r.investors.size,vehicles:r.vehicles.size,
          invested:V.money(r.invested),installments:V.money(r.installments),plates:V.money(r.plates),principal:V.money(r.principal)})) : null,
    urgent:input.alerts && filtered.has('tasks') ? tasks.filter(row=>row.dueOn<=date&&!terminal.has(row.status))
      .sort((a,b)=>a.dueOn.localeCompare(b.dueOn)).slice(0,10).map(row=>({...row,
        employee: input.details.includes('employees') ? list('employees').find(e=>e.id===row.employeeId)?.name||null : null})) : null,
    performance:input.charts ? {
      rows:performance, staff, staffReady:filtered.has('tasks')&&filtered.has('employees')&&input.details.includes('tasks')&&input.details.includes('employees'),
      drilldowns:{collection:input.details.includes('invoices'),marketing:input.details.includes('marketing'),management:input.details.includes('tasks')},
      collectionReady:input.financial&&filtered.has('invoices'), marketingReady:filtered.has('marketing'), managementReady:filtered.has('tasks'),
      date, month, specialPeriod
    } : null
  };
}
