import {V} from './vehicle-domain.js';
import {requireOk} from './core.js';

// Only version 3 proposals use these terms. Existing schedules are never rebuilt.
export function customerFinancingTerms(p:any){
 const principal:bigint=V.units(p.expectedFunding||'0'),down:bigint=V.units(p.downPayment||'0');
 if(p.financeType==='cash'){
  requireOk(principal===0n&&down===0n&&V.units(p.totalObligation||'0')===0n&&V.units(p.firstInstallment||'0')===0n,422,'cashHasNoFinancing');
  return {installmentTotal:'0.000',firstInstallment:'0.000',lastInstallment:'0.000',totalObligation:'0.000',contractualSpread:'0.000',distributionDifference:'0.000'};
 }
 requireOk(Number.isInteger(p.months)&&p.months>0&&p.months<=600,422,'invalidSchedule');
 const total:bigint=V.units(p.totalObligation||'0'),due:bigint=total-down,monthly:bigint=V.units(p.expectedMonthly||'0');
 requireOk(principal>0n&&due>=principal&&monthly>0n,422,'installmentsBelowPrincipal');
 const first:bigint=p.firstInstallment===undefined||p.firstInstallment===''?monthly:V.units(p.firstInstallment);
 const last=p.months===1?due:due-first-monthly*BigInt(p.months-2);
 requireOk(first>0n&&last>0n&&(p.months!==1||first===due),422,'invalidSchedule');
 const difference=due-(p.months===1?first:first+monthly*BigInt(p.months-1));
 // Rounding may accumulate at most one AED cent for each installment.
 if((difference<0n?-difference:difference)>10n*BigInt(p.months))requireOk(p.installmentAdjustmentReason?.trim(),422,'installmentAdjustmentReasonRequired');
 return {totalObligation:V.money(total),installmentTotal:V.money(due),firstInstallment:V.money(first),lastInstallment:V.money(last),contractualSpread:V.money(due-principal),distributionDifference:V.money(difference)};
}
export function customerFinancingSchedule(p:any,start:string){
 const terms=customerFinancingTerms(p),rows=V.schedule(p.expectedFunding,terms.installmentTotal,p.months,start);
 const result=rows.map((r:any,i:number)=>({...r,amount:i===rows.length-1?terms.lastInstallment:i===0?terms.firstInstallment:V.money(V.units(p.expectedMonthly))}));
 requireOk(result.reduce((n:bigint,r:any)=>n+V.units(r.amount),0n)+V.units(p.downPayment||'0')===V.units(terms.totalObligation),422,'installmentTotalMismatch');
 return result;
}
