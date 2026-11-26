import {L} from './ledger-domain.js';

type Rule = {
    companyId:string; itemId:string; feeItemId:string; effectiveOn:string;
    amount:string; condition:'double_fee'|'any_unpaid'|'double_monthly_due'|'above_limit'; enabled:boolean;
    threshold?:string; monthlyDue?:string;
};
type Debt = { customerId:string; outstanding:string };

export function latestClosedDubaiMonth(asOf:string) {
    const first = new Date(asOf.slice(0,7)+'-01T00:00:00Z');
    first.setUTCDate(0);
    const closeOn = first.toISOString().slice(0,10);
    return {closeOn, month:closeOn.slice(0,7)};
}

export function planMonthlyFollowup(rule:Rule, closeOn:string, debts:Debt[], legacyCustomers:Set<string>, issued:Set<string>) {
    if (!rule.enabled || rule.effectiveOn>closeOn) return [];
    const fee=L.units(rule.amount), month=closeOn.slice(0,7);
    return debts.flatMap(({customerId,outstanding})=>{
        const debt=L.units(outstanding);
        const sourceKey='monthly-followup:'+rule.itemId+':'+customerId+':'+month;
        if(debt<=0n || (rule.condition==='double_fee' && debt<2n*fee) ||
            (rule.condition==='double_monthly_due' && (!rule.monthlyDue || debt<2n*L.units(rule.monthlyDue))) ||
            (rule.condition==='above_limit' && (!rule.threshold || debt<=L.units(rule.threshold))) ||
            legacyCustomers.has(customerId) || issued.has(sourceKey)) return [];
        return [{sourceKey,companyId:rule.companyId,customerId,itemId:rule.feeItemId,
            amount:rule.amount,baseOutstanding:outstanding,month}];
    }).sort((a,b)=>a.customerId.localeCompare(b.customerId));
}
