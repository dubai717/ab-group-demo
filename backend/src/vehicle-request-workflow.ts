import { V } from './vehicle-domain.js';
import { requireOk } from './core.js';

// A versioned policy on the ORIGINAL request, not another request or ledger.
// Only newly composed requests opt in. Historical approved terms stay untouched.
export const returnedFields = ['vehicleType','make','model','year','description','approximateValue','expectedFunding','months','expectedMonthly','downPayment','registrationMonthlyFee','documentIds'] as const;
export function normalizeWorkflowTerms(p: any) {
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
  if (p.workflowVersion !== 2) return null;
  const missing: string[] = [];
  if (!p.vehicleType) missing.push('vehicleType');
  if (V.units(p.approximateValue || '0') <= 0n) missing.push('approximateValue');
  if (p.financeType !== 'cash') {
    if (!p.months) missing.push('months');
    if (V.units(p.expectedFunding || '0') <= 0n) missing.push('expectedFunding');
    if (V.units(p.expectedMonthly || '0') <= 0n) missing.push('expectedMonthly');
    const principal=V.units(p.expectedFunding||'0'),nominal=V.units(p.expectedMonthly||'0')*BigInt(p.months||0),target=principal-nominal===1n?principal:nominal;if(V.units(p.installmentTotal||'0')<principal||V.units(p.installmentTotal||'0')!==target)missing.push('installmentTotal');
  }
  // Model/year may be unknown before purchase; actual lender terms are arranged
  // after the customer proposal is approved, before actual disbursement.
  return missing;
}
export function requestWorkflow(r: any, p: any, events: any[] = [], funds: any[] = [], vehicle?: any) {
  const decisions = events.filter(e => e.kind === 'funding_decision'), last = decisions.at(-1);
  const returned = last?.after?.decision === 'return' && !events.some(e => e.kind === 'request_resubmitted' && Number(e.after?.revision)>Number(last.after?.revision));
  const approvalState = r.funding_state === 'Rejected' ? 'Rejected' : r.funding_state === 'Approved' ? 'Approved' : returned ? 'Returned' : r.funding_state === 'NotRequired' ? 'NotRequired' : 'Pending';
  const stage = approvalState === 'Rejected' ? 'rejected' : approvalState === 'Returned' ? 'returned' : approvalState === 'Pending' ? 'funding_approval' : vehicle?.status === 'Terminated' ? 'terminated' : vehicle?.contract ? 'completed' : vehicle?.id ? vehicle.status === 'Pending' ? 'registration_activation' : 'installment_start' : p.financeType !== 'cash' && !funds.length ? 'disbursement' : funds.some(f => f.state === 'AwaitingReceipt') ? 'funds_receipt' : 'registration';
  return { approvalState, operationalState: ({ rejected:'Closed',returned:'WaitingChanges',funding_approval:'WaitingApproval',disbursement:'WaitingDisbursement',funds_receipt:'WaitingReceipt',registration:'Registration',registration_activation:'RegistrationReview',installment_start:'Activation',completed:'Active',terminated:'Terminated' } as any)[stage], stage, requestedFields: returned ? last?.after?.requiredFields || [] : [], returnReason: returned ? last?.after?.reason || '' : '' };
}
