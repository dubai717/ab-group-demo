# Service requests and financing lifecycle v3

Repository: `dubai717/ab-group-demo`. Target: `staging/ab-group-test` only.
Base merged and deployed release: `0a7c08309a5fb6753c135d0f176c9bb445f45f84` (PR #102).

## Implementation boundaries

- Existing customer events remain the canonical residence/general request store. Existing vehicle requests, custody, personnel tasks, invoice links, journals and private document archives are reused.
- No schema migration, financial backfill, historical recalculation, grant update, Work Amount change, commission change or contracting agreement change is included.
- New vehicle requests use server-controlled workflow version 3. Explicit attempts to create version 2 are rejected with a refresh instruction. Stored version 2 and older requests retain their existing policy.
- The customer profile's lower combined request section is removed. A top-level composer and a separately opened instance of the existing scoped request register replace it. Registered vehicles retain their existing view.
- New general/residence requests use AED. Existing saved currencies are retained. General service fees default to zero, are not cash receipts and are invoiced through the existing ledger only. Fee amendments append audited events, require a current revision, reset an existing approval for review, and stop once an invoice exists. Issued invoices require the established financial correction procedure.
- New financing terms separate principal, vehicle estimate, down payment, first installment, regular installment and total obligation. Rounding is settled in the last installment. An unequal distribution beyond accumulated cent rounding requires an explanation before owner approval. The sum must equal the explicit obligation; bank terms remain independent.
- Vehicle/company selection is independent of the customer's home company. Both existing authorization boundaries still apply. IDs and customer ownership are not transferred.
- A broad initial make/model catalogue is supplemented through audited, company-scoped settings by users with existing vehicle configuration permission. Historical vehicle strings are not rewritten.
- Pending version 3 proposals permit owner corrections with a reason and revision audit. Approved terms remain locked. Investor allocation locks include the new obligation and first-installment fields.
- Owner financing delivery work is projected from the original approved request into the existing work center as operational work, separate from approval counts, and remains in completion history after delivery. A real posted payment/cash proof is required; approval itself never posts money. The selected active employee receives a once-only native receipt task. Exact amount acknowledgment precedes registration. Native reassignment validates the replacement's company and vehicle permission and retains assignment history. The version 3 registration responsibility remains open through documents, billing and final request closure; registration activation alone cannot complete it.
- Approval task completion is labeled separately from request completion. Version 3 requests remain open after contract/billing activation until explicit closure verifies clean ownership, insurance and contract documents, the native installment schedule and receipt prerequisites.
- Queue navigation uses the current visible request order and retains register state. Unsaved input and pending saves block navigation. Source notifications do not silently inherit a previous queue.
- Staff company labels deduplicate identical names/licences in presentation; reference IDs and relationships are untouched. The column wraps within a bounded width and retains full text in its title and record details.

## Verification and deployment

Final test counts, CI URLs, source/merge commits and protected deployment status are recorded in the PR and delivery report. Local integration/browser fixtures use isolated synthetic databases and fake Auth/object providers; they never approve actual requests or move hosted money. Render release verification must match the intended merge SHA. A merged PR alone is not deployment evidence.

The existing main-branch controller, policy checks and `staging-owner-approval` remain authoritative. No old deployment is approved or bypassed by this work.
