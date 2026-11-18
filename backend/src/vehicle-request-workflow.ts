import {customerFinancingTerms} from './customer-financing-terms.js';
import { V } from './vehicle-domain.js';
import { requireOk } from './core.js';

// A versioned policy on the ORIGINAL request, not another request or ledger.
// Only newly composed requests opt in. Historical approved terms stay untouched.
export const returnedFields = ['vehicleType','make','model','year','description','notes','approximateValue','expectedFunding','months','expectedMonthly','downPayment','registrationMonthlyFee','documentIds','totalObligation','firstInstallment','installmentAdjustmentReason'] as const;
export function normalizeWorkflowTerms(p: any) {
  if(p.workflowVersion===3){if(p.financeType!=='cash'&&(!p.months||V.units(p.expectedFunding||'0')<=0n||V.units(p.expectedMonthly||'0')<=0n))return p;Object.assign(p,customerFinancingTerms(p));return p;}
  if (p.workflowVersion !== 2) return p;
  if (p.financeType === 'cash') {
    requireOk(V.units(p.expectedFunding || '0') === 0n && V.units(p.downPayment || '0') === 0n && V.units(p.expectedMonthly || '0') === 0n && V.units(p.installmentTotal || '0') === 0n && !p.months, 422, 'cashHasNoFinancing');
  } else {
    // Incomplete proposals may be saved for review, but never approved or disbursed.
    if (!(Number.isInteger(p.months) && p.months > 0 && V.units(p.expectedMonthly || '0') > 0n)) return p;
    const calculated = V.units(p.expectedMonthly) * BigInt(p.months), principal=V.units(p.expectedFunding);
    // Match the ledger's 0.001 precision: one minor unit of rounding is settled
    // in the final installment, never by lowering the approved principal.
    requireOk(calculated >= principal || principal-calculated===1n, 422, 'installmentsBelowPrincipal');
    p.installmentTotal = V.money(calculated<principal?principal:calculated);
  }
  return p;
}
export function workflowReviewMissing(p: any): string[] | null {
  if (![2,3].includes(p.workflowVersion)) return null;
  const missing: string[] = [];
  if (!p.vehicleType) missing.push('vehicleType');
  if (V.units(p.approximateValue || '0') <= 0n) missing.push('approximateValue');
  if (p.financeType !== 'cash') {
    if (!p.months) missing.push('months');
    if (V.units(p.expectedFunding || '0') <= 0n) missing.push('expectedFunding');
    if (V.units(p.expectedMonthly || '0') <= 0n) missing.push('expectedMonthly');
    const principal=V.units(p.expectedFunding||'0'),nominal=V.units(p.expectedMonthly||'0')*BigInt(p.months||0),target=principal-nominal===1n?principal:nominal;if(p.workflowVersion!==3&&(V.units(p.installmentTotal||'0')<principal||V.units(p.installmentTotal||'0')!==target))missing.push('installmentTotal');
  }
  // Model/year may be unknown before purchase; actual lender terms are arranged
  // after the customer proposal is approved, before actual disbursement.
  return missing;
}
export function requestWorkflow(r: any, p: any, events: any[] = [], funds: any[] = [], vehicle?: any) {
  const decisions = events.filter(e => e.kind === 'funding_decision'), last = decisions.at(-1);
  const returned = last?.after?.decision === 'return' && !events.some(e => e.kind === 'request_resubmitted' && Number(e.after?.revision)>Number(last.after?.revision));
  const approvalState = r.funding_state === 'Rejected' ? 'Rejected' : r.funding_state === 'Approved' ? 'Approved' : returned ? 'Returned' : r.funding_state === 'NotRequired' ? 'NotRequired' : 'Pending';
  const stage = approvalState === 'Rejected' ? 'rejected' : approvalState === 'Returned' ? 'returned' : approvalState === 'Pending' ? 'funding_approval' : vehicle?.status === 'Terminated' ? 'terminated' : vehicle?.contract ? (p.workflowVersion===3&&!events.some(e=>e.kind==='request_closed')?'closure_review':'completed') : vehicle?.id ? vehicle.status === 'Pending' ? 'registration_activation' : 'installment_start' : p.financeType !== 'cash' && !funds.length ? 'disbursement' : funds.some(f => f.state === 'AwaitingReceipt') ? 'funds_receipt' : 'registration';
  return { approvalState, fundingDeliveryState:p.financeType==='cash'?'NotApplicable':funds.length?'Delivered':'Pending',fundsReceiptState:p.financeType==='cash'?'NotApplicable':funds.some(f=>f.state==='AwaitingReceipt')?'Pending':funds.length?'Confirmed':'NotStarted',registrationState:vehicle?.status==='Active'?'Registered':vehicle?.id?'PendingReview':'NotStarted',billingState:vehicle?.contract?'Activated':'NotStarted',finalState:stage==='completed'?'Completed':stage==='rejected'||stage==='terminated'?'Closed':'Open', operationalState: ({ rejected:'Closed',returned:'Waiting',funding_approval:'New',disbursement:'Waiting',funds_receipt:'Waiting',registration:'InProgress',registration_activation:'InProgress',installment_start:'InProgress',closure_review:'InProgress',completed:'Completed',terminated:'Closed' } as any)[stage], stage, requestedFields: returned ? last?.after?.requiredFields || [] : [], returnReason: returned ? last?.after?.reason || '' : '' };
}
