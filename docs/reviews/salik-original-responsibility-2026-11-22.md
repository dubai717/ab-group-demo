# E51 — toll attribution from the original dated vehicle relation (BUILD ONLY)

The monthly Salik importer previously checked customer/company against the original request and registration start, but did not check recorded relationship termination/sale dates. A transaction after that cutoff could therefore pass its date checks. It now reads the selected original relations' recorded `status_changed` termination effective dates and `sale_closed` completion dates, in one bounded company-scoped batch.

The proof uses the original vehicle/customer/company and registration date, never residence company, newest owner or audit creation timestamp. A known transaction before an end stays with that original relation even if it is now Terminated. Missing effective dates or an undated terminated relation require review. A date-only transaction on the transition day itself, or after the recorded end, is stopped for review instead of inventing time-of-day/inclusivity policy or assigning another customer. No existing claim is cancelled or reassigned.

Each new preview row retains a compact attribution proof (one earliest boundary reference, count/digest of the original terminal sources and exact relation revision). Commit re-reads the original source and verifies that proof again before invoicing; a newly arrived source can block a stale preview even when its vehicle revision did not change. Older cached previews without this proof cannot post. A prospective preview hash version permits the same source file to be re-previewed without modifying the old draft. Original transaction reservations/fingerprints and monthly invoice keys remain unchanged, so re-previewing cannot duplicate a charge.

The original invoice/detail source retains this proof. It is evidence of attribution checks, not a new financial approval, payment, revenue, tax decision or source ledger. Source extraction is bounded to selected company/vehicles and source counts; large/ambiguous history fails explicitly. Compact proofs avoid duplicating entire lifecycle histories per file row.

## Acceptance

- **8 final native cases passed**: four new effective-date/proof cases plus original monthly CSV/XLSX, exact grouping, deduplication, Owner wallet consumption and original source guards. Same-day/after-end rows cannot post; a before-end historical original relation posts one original invoice with retained proof. A late original event blocks commit without a revision change. A simulated old cached preview is rejected, then the file re-previews under the new source hash and posts once without rewriting its prior draft.
- Actual import browser passed: localized responsibility review in AR/EN at three widths; rejected mixed preview/commit changes no journals; an original valid before-cutoff transaction posts once with its source proof.
- Original monthly Salik, Owner wallet consumption and full financial package browsers passed again. Final TypeScript, 172 static tests and portable runtime build passed. Logs: `/workspace/ab-test-tmp/salik-responsibility-*` and `salik-source-*-browser.log`.
- Native ledger wording also completes E50's future-policy review errors on the old collection surface; no future policy is activated.

Requirement 5.6 remains partial for all historical/general bulk responsibility cases. Unknown historical boundaries still require documented source review, not automated liability reassignment. No historical migration, balance adjustment, hosted write, grant change, merge, protected-run action or Render deployment occurred.
