# Prospective prepaid wallet consumption — build only

The existing personal Owner card top-up remains Dr prepaid wallet / Cr Owner payable. It creates neither a customer receipt nor a second expense. This bundle connects actual, reviewed Salik consumption to the original monthly invoice importer without adding a financial ledger.

## Accounting and boundaries

1. Owner explicitly reviews a prospective prepaid-only configuration, clean supporting document and dedicated new unbilled recovery asset. No historical adoption or balance migration runs. Configuration is immutable; replay of the identical request is safe.
2. Actual toll consumption: Dr unbilled customer recovery asset / Cr prepaid wallet, using a native posted journal and the original transaction reference/date/customer/registered vehicle/item.
3. Original monthly Salik invoice remains Dr customer AR / Cr pass-through liability. In the **same database transaction**, an exact source match posts Dr pass-through liability / Cr unbilled recovery. There is no additional Owner payable, revenue, receipt or custody entry.
4. A mismatched original reference/amount/date/customer/vehicle/item rolls back the entire invoice commit. Already billed sources require explicit review rather than retrospective automatic adoption. Reversed consumption journals cannot be silently cleared.
5. Concurrent native journal and approved bank-operation postings share sorted account advisory locks. A later top-up cannot fund earlier consumption, and a backdated withdrawal cannot make a later effective-date balance negative. Both prepaid and unbilled recovery assets are guarded. Manual role reuse as customer AR, a cash fund, staff advance, custody or VAT control is rejected for these prospective configured accounts.
6. Original customer/vehicle responsibility is checked conservatively against original request and registration; responsibility changes require review. No invented VAT treatment, late historical invoice, bank overdraft or customer collection is inferred.

## Acceptance

- Ten related serial native cases passed: consumption, original monthly import, VAT controls, native posting locks, employee advances and personal Owner card regressions.
- Exact 20 AED top-up / 4.125 AED consumption: wallet 15.875, unbilled 4.125 then 0 after invoice; original pass-through liability 0 after matched clearance; Owner payable remains 20; no RV.
- Duplicate replay returns the original record. Changed reference data and insufficient funds reject; invoice mismatch leaves no invoice or partial clearing. Simultaneous 7+7 spending against 10 permits one posting only. Tests also reject backdating against later funding and overdrawing a later effective-date boundary.
- Actual browser passed prospective mapping, consumption, readable overdraw error, retained form, corrected retry, history, Arabic/English and 1440/768/390 widths. Browser setup is synthetic, loopback-only with fake providers.
- 172 static tests passed. TypeScript and portable build are rechecked at the cumulative checkpoint.

## Limits

Only prepaid Salik consumption is enabled by this explicit prospective workflow. Provider-credit arrangements, already billed/historical adoption, cancelled/adjusted source corrections and non-toll customer disbursements need their proper reviewed native correction flow. This does not declare all financial requirements complete. No hosted data, live grants, historical balances, protected workflow or Render settings were changed. PR115 remains draft and release held.
