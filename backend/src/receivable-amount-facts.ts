// Extraction seam for the ORIGINAL receivable projection. No policy, record, balance or writeoff mutation.
import{L}from'./ledger-domain.js';
export function receivableAdjustmentFacts(amount:string,paid:string,adjustments:any[]){
 const sum=(test:(row:any)=>boolean)=>L.money(adjustments.filter(test).reduce((n,row)=>n+L.units(String(row.amount)),0n)),discounts=sum(row=>row.kind==='waiver'&&row.document_type!=='Cancel'),settlements=sum(row=>row.kind!=='waiver'&&row.kind!=='writeoff'),writtenOff=sum(row=>row.kind==='writeoff'),credits=adjustments.reduce((n,row)=>n+L.units(String(row.amount)),0n),remaining=L.units(amount)-L.units(paid)-credits;
 return{discounts,settlements,writtenOff,cancelled:adjustments.some(row=>row.document_type==='Cancel'),remaining,outstanding:L.money(remaining>0n?remaining:0n)};
}
export function unappliedReceiptCreditFacts(rows:{amount:string;allocated:string}[]){return L.money(rows.reduce((n,row)=>n+L.units(row.amount)-L.units(row.allocated),0n));}
