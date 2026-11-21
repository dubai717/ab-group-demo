# Contract-based financier disclosure — 21 November 2026

Adds read-only bilingual financing captions to original financing invoice movements and allocated receipt movements in the existing customer statement, its exports, and the native RV source viewer.

The resolver uses `vehicle_invoices.contract_id` and verifies its vehicle and legal company. It never chooses the latest contract or derives the lender from the customer's residence company. Group financing uses the contract company's name; bank financing uses the bank lender stored in that contract; investor financing follows the original request's existing agreement to its company-scoped investor profile. Only the financier's name is disclosed, not bank details, identity documents or the full investor payload.

Cash and service invoices receive no financing caption. A missing financier name is explicitly marked for contract review. Missing contract relationships are left unassigned; no historical record is repaired or reclassified. Receipt captions follow live allocations and exclude reversed allocations. Multiple contracts remain distinct in the source metadata.

This is a presentation/provenance improvement, not a change to principal, returns, allocations, investor loss guarantees, VAT or bank settlement. No SQL migration, historical rewrite, new permission, invoice, journal or real cash transaction is introduced.

Limits: no new independent investor numbering is invented; bank names in old contracts may be free text. This does not complete the bank master or investor agency requirements. The separate financial document register and every legacy printable voucher are not covered by this first disclosure slice. Requirement 2.4 therefore remains **partial**.

Validation includes caption rules for group/bank/investor/cash/missing names; a synthetic actual contract/invoice/receipt/statement chain; immutable contract comparison and rejection of an unrelated vehicle; existing receivable/custody/deposit regression; and the real financial-package browser with a financed vehicle in Arabic/English at desktop/tablet/mobile widths. No hosted customer or financial data is used.
