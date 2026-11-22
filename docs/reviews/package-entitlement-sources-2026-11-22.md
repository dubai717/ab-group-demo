# E53 — original fee/entitlement exports and scoped source names (BUILD ONLY)

The original financial workspace obtained only the first100 customer references, and customer API names were `fullName` while some financial consumers expected `name`. Entitlement labels could therefore be unavailable despite an existing authorized relation. Financial reference rows now normalize that existing name field, and entitlement rows obtain actual permitted customer/item names in bounded batches from their original references, independently of that first page. No all-customer download, parallel person registry, relationship change or financial posting is introduced.

Customer name hydration filters the original company customer-view scope **before** reading/decrypting those profiles. A person belonging to a different company can still be referenced by the authorized financial relationship, but their name remains unavailable to an actor without original customer-view authority for that company. The original financial company, person and relation IDs are never rewritten or inferred from residence. Only name fields are returned; documents/identity/contact details are not copied into these reports.

The existing shared report source now also covers original follow-up fee rules and explicit entitlement bindings. Complete print/Excel/CSV uses existing view/report/export gates, human localized fields, original company/currency, filters and typed dates/amounts. Rule enabled/disabled state is separate from the original company financial feature approval: a saved binding/rule is not an invoice or permission to issue one. Reads and output cannot activate rules, enable workers or allocate financial document numbers.

Read-side metadata mismatching its selected company fails for review instead of being silently labelled as that company. Existing row actions and legacy fallback display remain; there is no migration or financial adoption.

## Acceptance

- **33 final native cases passed**, including three new beyond-first100/name-scope/fee-approval/metadata-boundary cases plus original package register, actual advance, supplier payment, document, register and output regressions.
- More than100 valid synthetic customers exercise a linked person outside the old lookup. Owner reads the correct original name; a company-scoped exporter gets only authorized customer names and a clear unavailable value for the other company's person. Empty output and another company still require their original rights. Fee and binding output remains explicitly unapproved financially.
- Snapshots prove no invoice, receipt, entry, grant, original binding or fee-record changes on reads/exports. An initial synthetic fixture omitted the original customer's normalized profile arrays; it was corrected by cloning the valid fictional fixture profile, not by weakening application validation.
- Actual Owner/scoped-exporter browser passed beyond-first100 name display, AR/EN at three widths, exact complete print/Excel, private other-company name exclusion and unchanged invoices/journals. Original 601-row register/PDF, financial package, future discount and complete ledger-output browsers all passed again.
- Final TypeScript, **172 static tests**, portable build and module graph passed. Logs: `/workspace/ab-test-tmp/package-entitlements-*`.

Requirement9.9 remains partial for original document metadata exports and remaining dashboard/drill-down acceptance. No hosted write, source migration, financial activation, balance change, grant change, merge, protected-run action or Render deployment occurred.
