# Prospective recurring expense drafts in the existing worker

The original same-service financial worker now invokes the same generator as the original manual commitment action. This does not create a second scheduler or an expense/payment ledger.

- Existing rules default to manual drafting. Only an explicit Owner-reviewed rule opt-in enables automatic drafts; company worker enablement and the existing worker actor rights are still required. Nothing was enabled on Staging.
- Each enabled monthly/annual rule produces at most one draft per original rule/date. The common rule/record transaction locks protect manual/worker overlap and repeated ticks.
- Enabling or re-enabling automation starts prospectively. It never adopts historical commitments or generates drafts for disabled-rule intervals before reactivation. Existing forecasts, month-end/leap handling, evidence and exact shared-company validation are reused.
- Generated records remain Draft with no journal, voucher, invoice, receipt, bank operation or payment. Existing accrual approval, payment request, authorization and bank reconciliation stay separate.
- The rule table discloses manual/automatic/stopped draft preparation. Owner can stop/re-enable automation; ordinary existing configuration rights do not grant permission to activate it. Shared-rule toggle preserves the original allocations and tax review instead of dropping them.
- Native events and audit records preserve service identity.

Acceptance: seven related native cases passed, including original commitments, shared expenses, original scheduled invoices and explicit recurring drafts; a repeat/manual race creates no duplicates and no financial documents. Fresh source tests additionally passed the monthly Salik CSV→XLSX duplicate boundary and positive XLSX grouped invoice with exact 3.303 AED source details. Actual scheduler browser passed explicit default-off creation, Owner stop/re-enable, no implicit drafting/accrual/payment, original manual generation and AR/EN responsive layouts.

No original Supabase write, historical migration, permission mutation, existing-worker activation, Render deployment or protected run action was performed.
