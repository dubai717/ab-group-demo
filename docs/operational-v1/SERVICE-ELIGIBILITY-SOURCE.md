# Original two-month source review — unpublished, not an active service guard

Owner decision: use the sum of actual obligations due in the last two due months,
including unequal installments. The existing pure policy remains the calculation
source; this package adds a read-only review of original accounting records and an
Owner action in the existing complete customer profile. No customer sections,
ratings, document cards, vehicle links, requests or financial summary are replaced.

The endpoint reuses original receivables, actual non-reversed allocations, approved
reductions, customer vehicle contracts and exact contract-confirmation events. The
vehicle and invoice legal company is authoritative, independently of the customer's
residency/company. Finance installments require their exact contract/number/date
source; monthly number fees require the original recurring service source. Future
invoices and unrelated fines/Salik are excluded from the periodic reference. Customer
bank installments are not replaced with bank-to-company obligations. Managed investor
customer obligations do not become group revenue in this projection.

The numerator uses original legal periodic amounts less approved reductions and
actual allocations. A book writeoff is not assumed to be legal debt release. Unknown
contract sources and posted manual loans without verified periodic terms, unsupported amounts/currency, reference gaps, potential paid
commitments without classification, financial claims and unapplied confirmed credits
require review rather than a guessed threshold. Old settled history cannot inflate
the last two verified months. A claim explicitly linked to a nonperiodic invoice does
not classify periodic invoices as disputed. Administrative case closure alone does
not supply financial resolution; actual receipt allocations update the source.

GET /api/customers/:id/service-eligibility-review is Owner-only. It accepts no scope
or historical-date query override and uses the existing transaction helper with
REPEATABLE READ and READ ONLY. Its implementation verifies both database settings.
All source reads are bounded; no invoice, journal, allocation, balance, task or
configuration is written during review. The UI reads manually, uses a bounded
request timeout, shows retained errors/references and refreshes explicitly. Resizing
or painting does not poll the ledger. Actor, profile, locale and session guards reject
late old-context responses. The original profile and service entry remain available.

Activation is explicitly false, effective date null and controllerGuardInstalled
false. The calculation uses a hypothetical effective date solely for simulation;
no approved live activation date is invented or stored. This does not implement the
final new-service create/approve/execute guard or authorize live use. Collection,
receipts, deposits, settlements, documents, complaints and existing service execution
remain unchanged. Financial/controller integration, reviewed limited employee output,
configurable approved scope, timed authorized exceptions and final acceptance remain
programming/integration work. Requirement2.2 and the release remain partial.

Acceptance uses isolated synthetic PostgreSQL/Auth/Storage. Fifteen focused native
cases cover the Owner policy, original source projection and original conversation
case decoder. Original receipt APIs settle the periodic invoices in a disposable
fixture; a nonperiodic unpaid bill remains, the fresh result changes and repeat reads
create no records. Exact current snapshot settings, settings/events/financial counts,
Owner scope and rejected historical query are asserted. Eighteen operational browser
journeys passed, including source failure/retry, existing profile/document/service
entry, no polling, late profile response and denied-reader UI at AR/EN1440/768/390.
The browser run precedes final backend classification-only refinements; focused native
acceptance and build cover those refinements. CI must independently pass this head.
