# Native invoice import templates — 21 November 2026

Adds authenticated, company-scoped CSV and true XLSX templates to the existing invoice import screen. Uses the existing `importWorkbook` generator and the existing import mapping/preview/commit pipeline; no parallel importer is introduced.

The Data sheet contains only the eight accepted header keys: sourceKey, customerNumber, vehicleNumber, plate, itemCode, amount, currency, dueOn. The separate Fields sheet provides Arabic/English definitions, required status and examples. No fictional invoice is placed in Data. AED is the documented currency. Original transaction references, authorized company selection and review remain required.

Downloading a template creates no import session, customer, invoice, journal, grant or financial movement. Existing `ledger_invoice_import` authority is required; a company-scoped grant cannot download for another company. Late download responses are rejected if actor/company context changed.

Acceptance: CSV header/BOM compatibility; bounded XLSX reader round-trip proves the Data sheet is empty; permission and zero-financial-effect checks; real browser downloads both formats and checks the XLSX ZIP signature across AR/EN desktop/tablet/mobile. Static checks, TypeScript and compiled runtime graph are also checked.

This completes the downloadable-template slice (5.5). It does not complete monthly Salik aggregation, attribution to the responsible customer at transaction time, or the remaining bulk-invoice requirements. Existing imports still require preview and explicit commit. No historical data is imported during this work.
