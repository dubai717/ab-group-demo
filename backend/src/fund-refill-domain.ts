// Shared original fund-to-fund journal. Authorization stays in the original route or the explicit two-actor handover.
import {requireOk} from './core.js';
import {L,balance,chart,journal,line} from './ledger-domain.js';
export async function executeFundRefill(c:any,cipher:any,s:any,targetId:string,d:any,sourceKey:string,sourceEvidence:any={}){
 await c.query('select id from ab.finance_funds where id=any($1::uuid[]) order by id for update',[[targetId,d.sourceFundId].sort()]);
 const f=(await c.query('select * from ab.finance_funds where id=$1',[targetId])).rows[0],source=(await c.query('select * from ab.finance_funds where id=$1',[d.sourceFundId])).rows[0];
 requireOk(f?.active&&source?.active&&source.id!==f.id&&source.chart_id!==f.chart_id&&source.company_id===f.company_id&&source.currency===f.currency,422,'invalidReference');
 const remaining=await balance(c,f.chart_id),available=await balance(c,source.chart_id);requireOk(remaining>=0n&&L.units(d.amount)===L.units(f.ceiling)-remaining&&available>=L.units(d.amount),422,'amountMismatch');
 return{id:await journal(c,cipher,s,f.company_id,d.effectiveOn,f.currency,sourceKey,[line(await chart(c,f.company_id,f.currency,f.chart_id),L.units(d.amount)),line(await chart(c,f.company_id,f.currency,source.chart_id),-L.units(d.amount))],{...d,fundId:f.id,expense:false,...sourceEvidence})};
}
