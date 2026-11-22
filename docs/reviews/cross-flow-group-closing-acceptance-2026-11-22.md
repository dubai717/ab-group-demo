# Native period acceptance across Owner/staff/investor sources — E68

Build only. These are isolated, synthetic end-to-end accounting tests; no hosted close or original data/clock/settings changes.

The E66 native group cases now continue beyond read-only reports through the original statement/reconciliation, each company's month close, E67 group preflight, group close and verified same-ID replay. Existing financial entries, invoices, receipts/vouchers and grants are compared unchanged by report/closing. No new financial calculation or elimination policy is introduced.

- **Owner personal card:** native mixed payment40 contains reviewed business expenses13 across two companies, prepaid wallet20, customer AR5 and excluded personal2. The original full January card statement is matched and approved, all active companies close, group close completes and repeats safely. Owner liabilities38 remain external obligations; they are not eliminated as reciprocal balances or called income.
- **Staff advance:** native approved voucher/delivery100.001, approved actual bank recovery40.001 and original recovery match leave60 staff AR. The original full-month bank statement matches the two actual bank entries and closes at the fixture's synthetic bank net-60; no bank funding is invented. Month close/group close retain the60 staff debt and create no customer sale/receipt/income.
- **Managed investor:** the original isolated028 fixture completes actual capital/funding, receipt, partial custody, accepted deposit and native bank statement matching/approval. Unused capital1000 and collected investor liability1400 remain payable; bank assets2550 and actual company income150 are preserved. Uncollected principal is not company AR. Individual and group close complete without paying investor liabilities or inferring an investor payout from customer collection.

Staff/investor fixtures execute all operations at their original actual synthetic dates. **Only after** source/reconciliation acceptance, `node:test` mocks JavaScript Date into the next month inside that worker to exercise ended-period guards. The database clock is never altered; mocks automatically restore. An initial attempt to backdate a current voucher or create future capital was rejected by the existing native date/reference guards; fixtures were corrected, not those controls.

Acceptance: final3/3 cross-flow cases passed, zero failures/skips; previous E67 combined39/39, actual matched/unmatched AR/EN browsers and175 static/type/build passed. Full merged cumulative acceptance is separate and still required. No tax return, audited consolidated financial statement, real funds, hosted028 activation or deployment claim.

## Checklist decision

Requirements1.3 and9.4 (company/group reports with existing reciprocal treatment) are now **complete but unpublished** based on original report sources, full scoped output, shared-settlement transit/matched acceptance, E67 closing guard/replay and these three end-to-end group closing flows. This does not certify historical pairwise matching, FX or tax treatment, and does not mark broader integration1.1, output9.9, all95 acceptance9.10 or agency/tax activation complete.
