// Extend native obligations with explicit intercompany shares; no new payable/payment system.
import {z} from 'zod';
import {requireOk} from './core.js';
import {L,need,company,item,resolve,journal,line} from './ledger-domain.js';
import {today} from './vehicle-domain.js';
export const sharedCommitmentAllocation=z.object({companyId:z.uuid(),itemId:z.uuid(),amount:z.string().regex(/^\d{1,15}(\.\d{1,3})?$/).refine(s=>L.units(s)>0n),payerDueFromDefinitionId:z.uuid(),beneficiaryDueToDefinitionId:z.uuid()}).strict();
export async function sharedCommitmentPlan(c:any,cipher:any,m:any,d:any,right='voucher_create'){
 const splits=d.sharedAllocations||[];if(!splits.length)return[];
 requireOk(d.taxTreatment==='reviewed_no_vat'&&d.taxReviewReason?.trim(),422,'sharedExpenseTaxReviewRequired');
 need(m,'intercompany',d.companyId);const unique=new Set(),plan=[];let total=0n;
 const payerItem=await item(c,cipher,m,d.itemId,d.companyId);requireOk(L.units(payerItem.data.taxRate||'0')===0n,422,'sharedExpenseTaxReviewRequired');
 for(const split of splits){requireOk(split.companyId!==d.companyId&&!unique.has(split.companyId),422,'duplicateSharedCompany');unique.add(split.companyId);company(m,split.companyId);need(m,right,split.companyId);need(m,'intercompany',split.companyId);
  const it=await item(c,cipher,m,split.itemId,split.companyId),expense=await resolve(c,split.companyId,'AED',it.data.expenseId),dueFrom=await resolve(c,d.companyId,'AED',split.payerDueFromDefinitionId),dueTo=await resolve(c,split.companyId,'AED',split.beneficiaryDueToDefinitionId);
  requireOk(it.data.payment&&expense.kind==='expense'&&dueFrom.kind==='asset'&&dueTo.kind==='liability',422,'intercompanyMappingRequired');requireOk(L.units(it.data.taxRate||'0')===0n,422,'sharedExpenseTaxReviewRequired');
  for(const a of [dueFrom,dueTo])requireOk(a.definition_id&&(await c.query('select eliminate from ab.finance_accounts where id=$1',[a.definition_id])).rows[0]?.eliminate===true,422,'intercompanyMappingRequired');
  total+=L.units(split.amount);const co=m.state.companies.find((x:any)=>x.id===split.companyId);plan.push({...split,expense,dueFrom,dueTo,companyNameAr:co.arabicName,companyNameEn:co.englishName});
 }
 requireOk(total<=L.units(d.amount),422,'sharedExpenseUnbalanced');return plan;
}
export async function postSharedCommitment(c:any,cipher:any,m:any,s:any,r:any,accounts:any,reason:string){
 const plan=await sharedCommitmentPlan(c,cipher,m,r,'journal_approve'),payerLines=[line(accounts.payable,-L.units(r.amount))],own=L.units(r.amount)-plan.reduce((n:bigint,x:any)=>n+L.units(x.amount),0n),allocationJournals=[];
 if(own>0n)payerLines.push(line(accounts.expense,own));
 for(const split of plan){const units=L.units(split.amount);payerLines.push(line(split.dueFrom,units));const journalId=await journal(c,cipher,s,split.companyId,today(),'AED','shared-commitment:'+r.id+':'+split.companyId,[line(split.expense,units),line(split.dueTo,-units)],{commitmentId:r.id,itemId:split.itemId,intercompany:true,otherCompanyId:r.companyId,taxTreatment:r.taxTreatment,taxReviewReason:r.taxReviewReason,reason,documentVersionId:r.documentVersionId});allocationJournals.push({companyId:split.companyId,journalId,amount:split.amount,companyNameAr:split.companyNameAr,companyNameEn:split.companyNameEn});}
 const journalId=await journal(c,cipher,s,r.companyId,today(),'AED','commitment:'+r.id,payerLines,{commitmentId:r.id,itemId:r.itemId,reason,documentVersionId:r.documentVersionId,approvedBy:s.user_id,sharedAllocations:r.sharedAllocations||[],taxTreatment:r.taxTreatment,taxReviewReason:r.taxReviewReason});return{journalId,allocationJournals};
}
