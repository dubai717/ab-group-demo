# Direct invoice correction preserves the existing writeoff recovery gate — build only

The original financial-package preview already refuses a further Discount when the invoice has a recorded book writeoff. An isolated test reproduced a validation gap: after either a full105.000 or partial50.000 native BadDebt posting, that preview returned409, but the direct `/ledger/invoices/:id/correct` endpoint returned200 for another credit.

The direct endpoint now applies the same existing `writeoffRecoveryAccountingReviewRequired` check before inserting an adjustment or allocating document numbers. It does not invent a new writeoff/refund policy, reverse a historical writeoff, release the legal debt or choose a recovery accounting treatment. The shared error is translated; inputs can remain for a reviewed process instead of a misleading financial success.

Two new native cases use the real original BadDebt approval/preview/confirmation path in their freshly allocated synthetic database. Both original-source failures were reproduced before the fix. Afterward, the existing preview and the direct endpoint both refuse; entries and the single original writeoff remain unchanged, no receipt appears, legal outstanding stays105.000, and book outstanding remains respectively0.000 or55.000. This protects against a second AR credit, particularly a negative AR balance after a full writeoff.

Thirty targeted native regressions passed, including original invoice tax/account source guards, unrestricted authorized trial discounts and the original invoice/operational ledger matrix. TypeScript also passed. No company activation, approval authority or grant is changed. The only financial-approval record used by these tests is inside the newly allocated loopback fixture, following the existing isolated review pattern.

No original Supabase, operating cash, migration, historical rewrite, deployment request or Render action. Actual post-writeoff recovery and post-collection refund/correction still require the existing reviewed accounting process; blocking an unsafe direct credit is not completion of that process or all95 requirements.
