# Native bank directory → prospective lender identity

Reuses the existing `ab.bank_references` bank directory and existing request/bank-contract workflow. No duplicate bank registry or company bank account is created.

- New bank requests carry a server-assigned registry version. Their final bank arrangement requires a valid original bank-directory ID; a caller-supplied name cannot bypass this rule or overwrite the registered identity.
- Owner approval still precedes arrangement. Existing company/disbursement permissions and evidence requirements remain. Direct bank settlement continues to require actual confirmation/reference and creates no fabricated bank/cash operation.
- Approval freezes ID and bilingual lender name in the request and original contract. Subsequent directory-name edits do not rewrite an approved contract. Financier disclosure uses that original snapshot; the collector cannot choose a lender.
- Existing requests/contracts retain their historical identity and terms. Reads do not auto-adopt a similarly named bank. Old unarranged requests can select a registered bank through the same UI; historical free-text compatibility remains on retained API payloads.

Acceptance: 16 related native tests passed, including new required-reference, unknown reference, name injection, immutable snapshot, original historical ciphertext, independent 36/48 schedules, funding lifecycle and scoped refusal. Actual browser passed directory selector, bilingual snapshot, no editable lender name, independent schedules, direct-bank registration stage and AR/EN responsive layouts. TypeScript/portable build and static checks are recorded at the cumulative checkpoint.

Build branch only. No hosted contract, reference directory, balance, grant, Render setting or protected deployment was changed.
