# Original group closing source review — E67

Build only. No hosted close, period, account, grant, migration, history or deployment was changed.

## Reproduced cause

An isolated native journal debited a configured due-from control10 and credited equity10. Every individual company checklist passed and each company closed. The original consolidated report correctly retained the unmatched reciprocal10, but the original group-close API still returned200 and inserted a closing: it checked company closures, not the reciprocal condition already enforced by reporting. The before-fix native test reproduced200 versus required409.

## Original policy and prospective correction

`group-reciprocal-source.ts` extracts the **existing** configured aggregate reciprocal-balance policy, separately by currency. The ordinary group report uses that same helper. It does not invent pairwise matching, eliminate unconfigured liabilities, convert currencies or rewrite any journal.

The original group-close endpoint now reads the same Posted/Approved reciprocal entries through period-end, requires an ended period, original group-close authority for every active company, the existing company closes and clean checklists, and matching configured balances. Unmatched balances return409 before any closing/event insert.

A successful new closing retains an encrypted `AB-GROUP-CLOSE-SOURCE-1` review with original company-period references, per-currency result and source digest. Existing tenant transaction serialization protects competing requests. A repeated completion returns the same verified original ID, without a second close or audit batch. Previous legacy closes lacking this source format are never adopted or rewritten; replay requires separate review. The preflight identifies an already-recorded closing and does not offer another approval.

## Existing UI extended

The current closing checklist has company/group scope. The group view names each company, its period/checklist state and reciprocal differences by currency. Its approval control exists only after server preflight passes. Problem labels are AR/EN; source totals are not a tax return or a new financial journal. Editing month/scope invalidates the review and pending response; stale approval is unavailable. Native server validation remains authoritative, including replay.

## Acceptance

- Five new native cases: reproduced unmatched close; read-only preflight and exact concurrent replay; all-company authorization/unfinished period/invalid date; currency separation and unchanged aggregate policy; immutable legacy review gate.
- **39/39 related native tests passed**, zero failures/skips, including original ledger operational matrix, reciprocal settlement transit/matched behavior, human statements, Owner-card/staff/investor group facts. Financial entries and grants compare unchanged by review/closing.
- Actual browser passed both separately seeded matched/unmatched fixtures, AR/EN, desktop/tablet/phone, actual successful native close and same-ID replay, held real preflight while month changes. No real company/cash/bank/provider used.
- TypeScript,175 static checks and portable build passed. Full combined cumulative acceptance follows; no all95, hosted activation, certified financial statements or release claim.

## Limits

Group close retains the original restrictive company checklist. This does not decide input-tax recovery, legal classifications, investor principal/return allocation, exceptional Owner-personal spending, historical adoption or provider transmission. Independent full workflow/period acceptance and material financial decisions remain on the95 checklist. No Reset/Restore, historical repair or protection bypass.
