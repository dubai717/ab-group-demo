# E49 — original receipt financier disclosure and full output (BUILD ONLY)

The original contract resolver already populated receivable statements, receipt source detail and financial document detail. The old native receipt workbench/collection register omitted those fields, so its print/Excel could omit the original financier. The original workbench now uses that same batched allocation/contract resolver and the native register shows a localized financier column. It adds no manual financier choice, private investor bank details, alternate account or financial write. Captions are attributed to the invoice's original company/vehicle/contract, not residence company or latest contract.

Financing invoices without a contract reference are explicitly labelled **requires contract review**, not assigned an invented financier. A wrong-company/vehicle reference cannot borrow another contract's caption. Cash/non-financing lines are not automatically labelled financed. Existing immutable Bank/investor snapshots remain authoritative. Reversed allocation selection remains the original resolver policy; no historical allocations or documents are rewritten.

Native receipt table state is kept per locale to avoid retained Arabic field filters corrupting English output. Navigation keys remain captured before field labels are added; no phantom financier tabs. Existing company ledger view/report/export gates apply to all complete output.

**36 final native cases passed** with the final original source, including original Group financing, actual Bank-financed customer receipt with separate bank debt unchanged, actual investor agency collection/name/identifier without private account data, native complete print/Excel and real AR/EN three-width browser output. The first new browser run caught a duplicate dashboard/nav locator in its harness; assertions were scoped to the actual navigation and rerun. This is not a product financial error.

No source balance, grant, historical relationship, Work Amount, hosted database, protected run or Render deployment is changed.

Actual dedicated native-receipt browser, original financial-package and full ledger-output/PDF browser regressions all passed. Dedicated output verifies the original financier in localized complete print/Excel at 1440/768/390 and unchanged source journals. Final TypeScript passed. Logs: `/workspace/ab-test-tmp/financier-complete-native-final.log` and `financier-complete-*-browser-final.log`.

The prior exact E48 local `e0c3ffd6c64046fa14630a02ff4ffa1dbe682261`, remote `93888ba2eba3f29a7d19af80a1aee5ffe9983db9`, tree `3e038add96dd0040b3168a9dfbab5aef2fb72bda` passed **539/539 cumulative native tests** with tracked source unchanged throughout, log `financial-treasury-overview-cumulative.log`. That immutable result predates E49.
