# Prospective cash / bank / customer-AR separation — E42

Build branch only. No hosted SQL, balance adoption, financial migration, deployment or grant change.

## Actual finding and scope

The before-fix isolated test (`fund-account-roles-before-fix.log`) proves that the original financial-item API accepted a bank-linked account definition as customer receivables (200 instead of 422). The preceding fund-on-bank attempt was **already refused** by the original chart-kind check. This does not prove a misconfigured live account or an incorrect live posting. No hosted financial data was inspected or changed.

The existing fund creation path also needed a distinction between asset roles: an asset alone is not sufficient evidence of counted employee cash. The new checks reject prospective use of customer AR, collection custody, cheque transit, reviewed VAT controls, reciprocal group assets, dedicated wallets, employee advances and non-sales claims as ordinary cash funds. Existing role guards are reused, not replaced.

## Reused sources and behavior

- Original `finance_chart`, `finance_accounts`, financial item ciphertext and actual invoice-item/company links identify roles. Bank association is on `finance_chart`, not on the account-definition table. No new role column, table or parallel ledger.
- Item creation and the original `linkInvoice` path reject customer AR mapped to cash funds, banks or configured controls. Investor-managed invoice classification keeps its separate original path.
- Original fund creation, shared refill, petty spending and cash-count settlement check prospective cash roles. Merely reading an old inconsistent fund, reporting its count or reading old invoices does not rewrite or delete it. Resolving a historical conflict remains an explicit review, not automatic migration.
- A new fund cannot silently adopt a chart that already has entries, even with zero opening input. This conservative refusal requests a review and preserves every prior entry. No claimed historical opening is inferred.
- An encrypted, **company-bound derived role projection** in original settings is invalidated by a PostgreSQL-computed digest of canonical item ciphertext and historical item/company links. Repeat checks transfer one digest, not the full guide. On invalidation, the bounded guide is read once. No polling, extra subscription or new cloud fetch.
- Human Arabic/English reasons and the existing safe trace reference appear in the original fund form. Inputs remain and submit is re-enabled on rejection.

## Accepted evidence

- Five isolated native cases: bank/item mapping; customer-AR/custody/transit/group role rejection; no historical 10 AED adoption; ciphertext and company cache invalidation with exact full-guide query counts; malformed historical item/fund fixtures remain readable but cannot cause new cash/invoice postings. Existing entries, invoices and grants compared unchanged.
- 32 targeted native tests passed, including original ledger operational matrix, VAT workpaper and the actual employee fund handover/ceiling cases.
- Actual original fund browser: AR and EN rejection with human reason + `req-` trace, retained name/account, enabled retry, zero new fund/JV/RV/PV. Original two-actor 500 AED receipt, only-50 refill and prospective 500→700 ceiling browser passed, with AR/EN at three widths.
- TypeScript and all 172 static/regression checks passed. Full cumulative result is recorded only against its saved commit in BUILD-STATE, not inferred from these targeted checks.

No checklist status is promoted solely by this guard package. The remaining noncash non-sales recovery and broader tax requirements remain partial. Final release hold remains active.
