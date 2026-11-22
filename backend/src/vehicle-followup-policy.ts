import {L} from './ledger-domain.js';

// New, prospective policy only. The legacy calendar-month rules remain unchanged.
export function vehicleFollowupPlan(rule:any, rows:any[], asOf:string, already=new Set<string>()) {
 if(!rule.enabled || asOf<rule.effectiveOn || !asOf.endsWith('-01'))return [];
 const cutoff=new Date(asOf+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-60);
 const before=cutoff.toISOString().slice(0,10),groups=new Map<string,any[]>(),sourceItems=new Set<string>(rule.sourceItemIds||[rule.itemId]);
 for(const r of rows){
  if(r.company_id!==rule.companyId || !sourceItems.has(r.item_id) || r.currency!=='AED' ||
   !r.customer_id || !r.vehicle_id || r.contracting_company_id || r.administrativeFee || r.creditReviewRequired ||
   L.units(r.outstanding)<=0n || L.units(r.written_off||'0')>0n ||
   r.dueOn>=(before) || r.dueOn<(rule.eligibleFrom||rule.effectiveOn))continue;
  const list=groups.get(r.vehicle_id)||[];list.push(r);groups.set(r.vehicle_id,list);
 }
 const result:any[]=[];
 for(const [vehicle,bills] of groups){
  // Never select an arbitrary debtor when historical responsibility is ambiguous.
  if(new Set(bills.map(r=>r.customer_id)).size!==1)continue;
  const period=asOf.slice(0,7),scope=rule.debtCategory?'category-'+rule.debtCategory:rule.itemId,base='admin-fee:vehicle60:'+rule.companyId+':'+vehicle+':',sourceKey=base+scope+':'+period;
  const aliases=[sourceKey,...[...new Set<string>([...sourceItems,...(rule.legacySourceItemIds||[])])].map(k=>base+k+':'+period),...(rule.categoryAliases||[]).map((k:string)=>base+'category-'+k+':'+period)];
  if(aliases.some(k=>already.has(k)))continue;
  result.push({sourceKey,companyId:rule.companyId,customerId:bills[0].customer_id,vehicleId:vehicle,
   originInvoiceIds:bills.map(r=>r.id).sort(),originInvoiceNumbers:bills.map(r=>r.invoiceNumber||null),
   originalDueOn:bills.map(r=>r.dueOn).sort()[0],amount:rule.amount,
   baseOutstanding:L.money(bills.reduce((n,r)=>n+L.units(r.outstanding),0n)),dueOn:asOf,period,
   unit:'vehicle_category',itemId:rule.feeItemId,ruleRevision:rule.revision,...(rule.debtCategory?{debtCategory:rule.debtCategory,sourceItemIds:[...sourceItems].sort()}:{})});
 }
 return result;
}
