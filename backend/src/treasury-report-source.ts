import {requireOk} from './core.js';
// Only original report facts, after the caller's unchanged per-company report/export guards.
export async function treasuryReportSource(c:any,companies:string[],q:any){
 const sources:Record<string,{table:string,date:string,fields:string}>={
  vouchers:{table:'finance_vouchers',date:'created_at',fields:'number::text,amount::text,currency,issued_on,status'},
  deposits:{table:'finance_deposits',date:'effective_on',fields:'amount::text,confirmed::text,currency,status'},
  cheques:{table:'finance_cheques',date:'due_on',fields:'number,beneficiary,amount::text,currency,direction,issued_on,status'}
 };
 const source=sources[q.kind];requireOk(source,422,'unsupportedStatementPresentation');
 const rows=(await c.query(`select id,company_id,${source.date} report_date,${source.fields} from ab.${source.table} where company_id=any($1::uuid[]) and ${source.date}::date between $2 and $3 and($4::text is null or currency=$4) order by ${source.date},id limit 20001`,[companies,q.from,q.to,q.currency||null])).rows;
 requireOk(rows.length<=20000,422,'registerTooLarge');return rows;
}
