# UAE e-invoicing source review — 21 November 2026

Build research only. No ASP selection, purchase, credentials, onboarding, tax election, report submission or invoice transmission.

## Sources checked directly

- [Ministry of Finance programme portal](https://mof.gov.ae/en/about-us/initiatives/einvoicing/) and [its ASP accreditation list](https://mof.gov.ae/en/about-us/initiatives/einvoicing/einvoicing-accredited-service-providers-asps/). Production exchange needs the applicable accredited-provider onboarding; a PDF or a screen labelled PINT-AE does not establish compliant exchange.
- [MoF mandatory-field document V1.1, 28 October 2026](https://mof.gov.ae/wp-content/uploads/2026/10/UAE-Electronic-Invoice-Mandatory-Field-Requirements.pdf). Seller/buyer identity and addresses, document context, tax breakdown and line/totals information are separate requirements. The UAE participant endpoint uses scheme 0235 with the relevant ten-digit TIN. A VAT TRN, a company display name or a customer residence-company association must not be used to invent missing participant or legal-party data. The document distinguishes tax and commercial invoice requirements; supply classification cannot be inferred from receipt amounts.
- [OpenPeppol official release table](https://peppol.org/documentation/technical-documentation/post-award-documentation/) and [PINT-AE 1.0.5](https://docs.peppol.eu/poac/ae/v1.0.5/pint-ae/). The release table lists 1.0.5 as published 17 November 2026 with mandatory date 3 December 2026; it separately lists 1.0.4. Therefore a build on 21 November must distinguish specification publication from effective/mandatory date and pin the reviewed profile rather than silently switching to whichever URL is latest.

## Safe engineering path

1. Keep company-specific reviewed legal identity and endpoint data separate from display names; never manufacture missing data from a different company or personal customer file.
2. Prepare original-source, revision-checked payloads for invoices and credit notes, with exact decimal validation and original-document references. Missing or ambiguous fields block readiness; previewing cannot create accounting entries.
3. Validate generated XML against the pinned official syntax and business-rule resources. Unit string equality is insufficient compliance acceptance.
4. Introduce a provider adapter with explicit company scope, durable idempotency and immutable source/payload digest. Default network transmission stays disabled. Uncertain remote outcomes require status reconciliation before any resend.
5. Complete accredited-provider sandbox acceptance and evidence retention after Owner chooses the provider and authorizes any costs/onboarding. Do not claim production compliance or file actual returns from local synthetic tests.

Requirement 3.8 remains incomplete. These sources justify technical dependencies, not a legal conclusion about a particular AB Group company's implementation date, TRN, transaction classification or tax liability. Existing historical documents are not rewritten.
