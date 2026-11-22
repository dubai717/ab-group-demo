# Original generic invoice imports recover their native result — build only

E60 verified recovery for dated fine imports. Generic row imports still retained the original terminal409 contract, so a real server commit followed by response loss could leave the operator unable to confirm the outcome from that same preview.

The existing rows endpoint now accepts an explicit prospective `resultRecoveryVersion:2`. The existing UI opts into it for ordinary rows; monthly Salik keeps its existing path and fine files keep their existing version1 source proof. Existing legacy previews/imports without this flag retain their old behavior and are never rewritten or silently adopted.

New opted-in previews use a distinct mapping-aware source hash. Completed imports save their exact native result inside the original encrypted import payload. The same preview can recover that result only after present import/create rights and actual current customer authority, strict result shape/count/unique-ID checks, and exact native invoice linkage, item, customer, vehicle, amount, currency and due date. It does not call the invoice engine again. Unknown IDs or inconsistent results require source review. Partial-valid generic files retain their original rejected/duplicate counts; fine files still reject unresolved rows as a unit.

A new preview for a legacy already-issued source may report it as a duplicate, but cannot issue it again. Source file bytes and original invoice/JV/RV behavior remain unchanged. Different mappings and scoped source contexts retain separate reviews without replacing the old import. The old legacy mapping/source hash rules remain intact.

The original UI preserves file and same preview on an uncertain commit, with a finite deadline and no automatic financial retry. Explicit retry recovers the original result. Verified success remains success if the following read refresh fails. The unchanged legacy API contract remains tested independently.

## Acceptance

- Three new native cases passed: concurrent and lost-response recovery without another invoice/journal/receipt; legacy409 and distinct prospective duplicate preview; present customer/import/create authority without grant changes; malformed counts/duplicate or invented invoice IDs fail closed.
- Final42/42 native regression cases passed, including original CSV/XLSX templates, legacy row semantics, dated fines, monthly Salik, recorded responsibility and the original operational ledger matrix. TypeScript,172 static cases and portable build passed.
- Actual generic browser passed: the real original server commits, a503 replaces only its response, inputs/preview remain, manual retry returns the exact original invoice, and the native workbench contains one invoice, one journal, zero receipt/PV.
- Actual fine import browser passed with retained files, AR/EN at three widths, changed scope/input rejection, real uncertain-outcome recovery and separate issue authority. Original monthly Salik and ledger UI regressions with and without012 also passed, including partial collection, statement and ageing.
- E61 simultaneously closes the independently reproduced pre-read financial-evidence company-context bug, with its separate original/candidate browser evidence.

No cloud operation, schema change, historical adoption, financial activation, automatic retry, role/grant edit, staging merge, delivery request, Reset/Restore or Render action. This is not acceptance of all95 financial requirements.

## Frozen combined acceptance

Exact local `805c09f02c1ae18bf395ad3f2c1f0edd92b7eed4`, tree `0478880a179364f7cee17ae0db6bc5868ce9dddb`, passed **586/586**,0 failed/skipped,908059.525305ms on independent loopback5442. Tracked source stayed unchanged. Log `/tmp/financial-import-recovery-cumulative.log`. The previous exact E60 remote tree independently passed the entire unprivileged GitHub run44998596373, including583 native cases and all required browsers. These are build checks, not a merge or deployment.
