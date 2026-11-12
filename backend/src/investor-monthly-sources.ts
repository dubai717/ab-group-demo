import {requireOk} from './core.js';
import {monthBounds,intersectFunds,registrationSlice} from './investor-monthly-domain.js';

export type MonthlyAllocation={id:string;receiptId:string;fundingId:string;versionId:string;companyId:string;currency:string;kind:'installment'|'registration_share'|'other';amount:bigint;receivedOn:string;registrationOffset?:bigint;registrationBase?:bigint;registrationShare?:bigint;reversed?:boolean};
export type MonthlyBankPart={id:string;receiptId:string;companyId:string;currency:string;amount:bigint;entryId?:string;bankAccountId?:string;operationApproved:boolean;depositConfirmed:boolean;statementApproved:boolean;statementAmountMatches:boolean;confirmedOn?:string};
export type MonthlyClaim={key:string;status:'Draft'|'Reviewed'|'Approved'|'Paid'|'Cancelled'};
export type MonthlyCandidate={key:string;allocationId:string;receiptId:string;fundingId:string;versionId:string;bankEntryId:string|null;kind:string;sourceAmount:bigint;amount:bigint;originalReceivedOn:string;carriedForward:boolean;reason:string|null};

// Inputs must be loaded in their persisted receipt/allocation/deposit order, including reversals and
// unconfirmed bank portions. Removing a hole would assign another vehicle's money to an investor.
// This is a read-only plan. SQL source locks, frozen terms, scope checks and unique claims remain
// mandatory when a later, explicitly confirmed settlement saves the plan.
export function evaluateMonthlySources(input:{companyId:string;currency:string;period:string;allocations:MonthlyAllocation[];bankParts:MonthlyBankPart[];claims:MonthlyClaim[]}){
 const {from,to}=monthBounds(input.period),eligible:MonthlyCandidate[]=[],excluded:MonthlyCandidate[]=[],seen=new Set<string>();
 const duplicate=(values:string[])=>new Set(values).size!==values.length;
 requireOk(!duplicate(input.allocations.map(a=>a.id))&&!duplicate(input.bankParts.map(b=>b.id)),409,'monthlyDuplicateSource');
 const claims=new Map<string,MonthlyClaim>();for(const claim of input.claims){if(claim.status==='Cancelled')continue;requireOk(!claims.has(claim.key),409,'monthlyDuplicateClaim');claims.set(claim.key,claim);}
 const receipts=new Set(input.allocations.filter(a=>a.companyId===input.companyId&&a.currency===input.currency).map(a=>a.receiptId));
 for(const receiptId of receipts){
  const allocations=input.allocations.filter(a=>a.receiptId===receiptId),parts=input.bankParts.filter(b=>b.receiptId===receiptId);
  requireOk(allocations.every(a=>a.companyId===input.companyId&&a.currency===input.currency)&&parts.every(b=>b.companyId===input.companyId&&b.currency===input.currency),409,'monthlySourceScopeMismatch');
  const gross=allocations.reduce((sum,a)=>sum+a.amount,0n),bankGross=parts.reduce((sum,b)=>sum+b.amount,0n);requireOk(bankGross<=gross,409,'monthlyReceiptOvertraced');
  // Receipt excess/customer-credit must be included as kind=other, preserving its original position.
  const allParts=[...parts,...(bankGross<gross?[{id:'held:'+receiptId,receiptId,companyId:input.companyId,currency:input.currency,amount:gross-bankGross,operationApproved:false,depositConfirmed:false,statementApproved:false,statementAmountMatches:false}]:[])];
  const allocationById=new Map(allocations.map(a=>[a.id,a])),partById=new Map<string,MonthlyBankPart>(allParts.map(p=>[p.id,p]));
  for(const slice of intersectFunds(allocations,allParts)){
   const a=allocationById.get(slice.allocationId)!,b=partById.get(slice.bankPartId)!;if(a.kind==='other'||a.receivedOn>to)continue;
   const key=[a.id,b.entryId||b.id,a.kind].join(':'),amount=a.kind==='installment'?slice.amount:registrationSlice((a.registrationOffset??0n)+slice.allocationOffset,slice.amount,a.registrationBase??0n,a.registrationShare??0n);
   if(amount===0n)continue;requireOk(!seen.has(key),409,'monthlyDuplicateSource');seen.add(key);
   const claim=claims.get(key);let reason:string|null=null;
   if(a.reversed)reason='collection_reversed';
   else if(claim)reason=claim.status==='Paid'?'previously_paid':'reserved_in_settlement';
   else if(!b.entryId||!b.bankAccountId)reason='held_in_custody';
   else if(!b.operationApproved||!b.depositConfirmed)reason='deposit_pending';
   else if(!b.statementApproved||!b.statementAmountMatches||!b.confirmedOn)reason='bank_reconciliation_pending';
   else if(b.confirmedOn>to)reason='bank_confirmation_after_period';
   const candidate={key,allocationId:a.id,receiptId:a.receiptId,fundingId:a.fundingId,versionId:a.versionId,bankEntryId:b.entryId||null,kind:a.kind,sourceAmount:slice.amount,amount,originalReceivedOn:a.receivedOn,carriedForward:a.receivedOn<from,reason};
   (reason?excluded:eligible).push(candidate);
  }
 }
 return {companyId:input.companyId,currency:input.currency,period:input.period,eligible,excluded,amount:eligible.reduce((sum,line)=>sum+line.amount,0n)};
}
