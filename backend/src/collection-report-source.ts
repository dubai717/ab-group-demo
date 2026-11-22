// Read only, period-bounded original receipt facts. No posting, allocation or second collection engine.
import {requireOk} from './core.js';
export async function collectionReportSource(c:any,companies:string[],q:{from:string,to:string,currency?:string,employeeId?:string,itemId?:string}){
 const rows=(await c.query(`select r.company_id,r.kind,r.received_on,r.amount::text,r.currency,r.created_by,r.item_id,j.effective_on cleared_on,jr.effective_on returned_on
 from ab.finance_receipts r
 left join ab.finance_journals j on j.source_key='receipt:'||r.id::text and j.company_id=r.company_id and j.status='Posted'
 left join ab.finance_journals jr on jr.reversal_of=j.id and jr.status='Posted'
 where r.company_id=any($1::uuid[]) and r.item_id is not null and r.kind<>'credit'
 and($2::uuid is null or r.created_by=$2)and($3::uuid is null or r.item_id=$3)and($4::text is null or r.currency=$4)
 and((case when r.kind='cheque' then j.effective_on else r.received_on end between $5::date and $6::date)or jr.effective_on between $5::date and $6::date)
 order by r.company_id,r.received_on,r.id limit 20001`,[companies,q.employeeId||null,q.itemId||null,q.currency||null,q.from,q.to])).rows;
 requireOk(rows.length<=20000,422,'registerTooLarge');return rows;
}
