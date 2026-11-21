# Company tax preparation — draft configuration, no tax posting

Base: merged PR109, 8955033b3440392be03de936407a469826678ce9.
This is a limited next stage of the comprehensive financial order, not completion
of VAT, corporate-tax returns or UAE electronic-invoice compliance.

## Reused sources and behavior

Uses native companies, financial items, posted journals/chart entries, encrypted
settings, finance events, existing configuration/report permissions and shared
bilingual forms. No parallel ledger, migration, grant, opening balance or tax rate
is installed. Configuration is isolated per legal company, encrypted, revision
checked, serialized and audited with old/new values.

Drafts record a 15-digit TRN, independently non-overlapping VAT and corporate-tax
periods, item supply classification/proposed rates/input recovery, documented
proposed corporate-tax additions/deductions and notes. Supporting document
versions, when supplied, require the native clean/scoped evidence check. No
classification/rate is assumed from receipt amount, principal, custody or a name.
Existing invoices and native financial-item posting mappings are unchanged.

The corporate-tax bridge reads posted AED income/expense entries in the exact
selected company/period and displays accounting profit, proposed additions and
deductions separately. Other-period proposals are excluded. Taxable income and
tax due remain unapproved/null; no return is submitted. A statement with no
matching configured period is explicitly marked as such.

UI: Financial management -> Tax preparation and review. Company/first-period
editing preserves additional API-defined periods, item classification and
proposed adjustment forms retain existing settings, and the bridge is a preview.
The UI does not provide approval, e-filing or an ASP connection.

## Official references and unresolved work

- UAE Ministry of Finance electronic-invoicing guidance:
  https://mof.gov.ae/en/about-us/initiatives/einvoicing/
- Federal Tax Authority electronic invoicing:
  https://tax.gov.ae/en/content/uae.einvoicing.aspx
- Federal Tax Authority corporate-tax FAQ:
  https://tax.gov.ae/en/taxes/corporate.tax/faqs.aspx

PINT-AE readiness requires review against current official specifications and
accredited-provider integration. PDF/print is not an electronic-invoice exchange.
Actual supply treatment, recoverability, reverse charge, taxable-income
adjustments, legal entity registrations and any applicable elections still need
accountant review before posting or filing. No compliance certificate is claimed.

## Synthetic test lifecycle correction

The local PostgreSQL volume accumulated 2,128 randomized fixture databases,
approximately 25 GB. Only 80 inactive ab_backup_<32 hex> databases with exclusively
example.test Auth email addresses and exactly one synthetic Owner marker were
removed. No FORCE, cloud connection, source reset, production data or backup
object removal was used. The previously blocked 13 fee/recurrence tests then
passed. The disposal helper now removes only its own allocated fixture after
closing connections; loopback host, configured local port, matching path and
random name are checked before connecting. The permanent ab_test DB is excluded.
Higher HR fixtures reuse this single disposal instead of dropping twice.

## Validation

TypeScript, JS syntax, 172 static/policy checks, 13 targeted tax/fee/recurrence API
cases and the existing financial-package browser workflow pass locally. Tax UI
adds real save/readback, unresolved item classification, profit preview and
Arabic/English desktop/tablet/phone checks to that existing workflow.
Native exact-head CI remains required before merge and protected Staging delivery.
No hosted write, financial activation, historical migration or filing is performed.
