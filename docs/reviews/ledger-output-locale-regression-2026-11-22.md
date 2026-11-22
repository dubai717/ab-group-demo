# E76 — Original ledger-output locale acceptance

Build only. No deployment, source database, financial record or permission change.

GitHub draft CI45019473013 on447c750 passed638/638 native tests and stopped at the original ledger-output browser. The assertion demanded English `posted entries|actual|original` inside the Arabic printed report, whose existing scope correctly states `حركات الفترة الأصلية فقط`. Subsequent steps were skipped; the whole run failed.

The test now verifies the actual localized scope in each language and regenerates the report after changing locale. This follows the existing UI rule that discards a report with an obsolete statement locale. It does not retain or print a report from the previous language.

Acceptance: `node backend/tests/ledger-output-suite.browser.cjs` passed on the isolated synthetic browser database. Original report/export authority, a reader without export, all rows beyond50, real multi-page PDF, numeric/date filtering, exact CSV/Excel source and unchanged journal identities remain asserted. Page errors and alerts are empty. Local log: `/tmp/e76-ledger-output-regression.log`. No production or original Supabase reads/writes.
