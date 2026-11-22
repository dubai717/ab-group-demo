# Monthly investor agency settlement — owner activation pending

The owner approved investor-owned agency accounting on 2026-11-12, including the full installment, fixed registration share, and memo-only principal recovery. This is **not approval to apply migration 028 to used staging or publish the financial feature**.

See [the accounting, migration and recovery review](investor-agency-028-review.md). SQL 028 is now a single file in the additive catalog of this unmerged review branch. No 026/027 migration is duplicated and no existing balance, agreement, role or secret is changed. The currently deployed permission UI remains `89f4287`.

Cash, bank transfer, incoming cheque, per-company/per-investor sources, 50/100 immutable versions, the 3,000/2,000/1,400 example, custody handover, statement approval, one-voucher lifecycle, confirmed debit finalization, cancellation, unused-capital reservation and invalid overdraw cases have passed isolated integration tests. A second investor cannot read another investor's sanitized statement, including through the new database helper. The Arabic/English responsive interface and real Excel/print-PDF output passed browser checks.

A populated legacy fixture passed row/function/ACL/role preservation and real encrypted backup restoration before and after 028. This is isolated representative data, not a claim that a current hosted backup has already run. Protected delivery must take and actually restore a fresh hosted encrypted backup immediately before applying approved SQL.

The immutable trusted-controller extension is prepared separately from candidate application code. Native GitHub approval, source drift checks, actual runtime validation, backup/restore, transactional rehearsal and production exclusion remain mandatory. Do not merge the application or controller-pin review until the explicit financial activation approval. Direct editing of paid sources, untraced credit applications and unconfigured tax treatment remain blocked.

Local complete backend: 352/352; unit checks: 170/170. Trusted controller: 22/22 rehearsal/security checks and 29/29 policy units, TypeScript/build/integrity passed. Controller pin review: PR #72, unmerged.
