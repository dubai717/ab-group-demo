# Business centers implementation record

Base: staging/ab-group-test @ 2dc29aae05e395e3c74522b67efebbb1003cb5a6.
Development branch: feature/business-centers-7-14.

## Required scope

- [ ] 7 Marketing: opt-in CRM, opportunities, customer/supplier contracts, allocations, commission snapshots, targets and annual clock.
- [ ] 8 Investors: scoped portal, funding commitments versus actual receipts, financing snapshots, settlements, statements and evidence-based ratings.
- [ ] 11 Central dashboards/reports: scoped metrics, saved report builder, schedules, audited read-only owner View As.
- [ ] 12 Notifications: existing inbox, localized templates, reply/task links and honest external-provider state.
- [ ] 13 Documents: authorized original-file index, versions, archive/retrieve, metadata/content search and multiple authorized links.
- [ ] 14 Approvals: aggregate original workflows without additional approval steps or duplicate financial execution.
- [ ] Collections: canonical invoice/task linkage, attempt history, configurable reminders; no automatic task closure on contact attempts.
- [ ] EOS: own estimate visibility, effective-date history, no assumed legal regime or direct employee edits.

## Existing components to reuse

Canonical finance_notifications, tasks/hr_task_events, customer_events, documents/document_versions, financial vouchers/journals, personnel legalEOS and existing approvals. Unified register search/Excel filters and secure attachment viewer remain authoritative.

## Safety and unresolved decisions

No live database changes, cloud business fixtures, role redistribution or external-provider calls have been performed for this branch. All new database work must first pass isolated synthetic tests and the approved backed-up release mechanism. Existing migrations 001–013 stay unchanged.

Legal regime assignment is not inferred; existing unconfigured regimes remain unavailable for estimation. Owner explicitly authorized fresh encrypted backup, isolated restore, ordered 014–025 rehearsal and conditional test-only application/deployment on 2026-11-07. No live schema application is allowed unless every preservation check succeeds.

External AI/OCR/WhatsApp/SMS/email delivery remain explicitly inactive unless an existing approved integration is configured. No fabricated delivery/read states or automatic financial commitments.

## Owner clarification: external contracting companies (2026-11-07)

The owner explicitly rejected a corporate type in the individual-customer register. The development implementation now has a separate `contracting_companies` register, encrypted legal/contact details, read-only profiles, explicit edit/save/cancel, immutable audit events and reversible Active/Inactive status. New `contracting_view/create/edit/activate/deactivate/contracts` definitions have **no automatic assignments** to existing users or roles. Group-company scope represents the responsible AB entity, not the external party itself.

Prospects and contracts link to that independent register. Legacy `official_company_id` values are retained but are no longer used to represent an external party or activate a new contract. Nothing automatically converts or rewrites existing group companies or individual customers.

Additive migration 022 creates the register, references, independent scoped RLS and guards. Migration 023 adds an explicit contracting-party reference to the **existing** invoice/receipt engine. It replaces the old invoice/batch customer NOT NULL requirement with an exactly-one-party check; existing individual rows continue to satisfy the original business invariant. Additional deferred guards prevent cross-party allocation, mixed identities and reassignment of immutable financial parties. Original posting, clearing, accounting periods, allocation ceilings and reversal protections remain in place. No triggers or RLS are disabled.

Contract invoices have a canonical invoice/journal and cannot exceed the signed contract value. Cash and cheque collection use existing receipt/custody/clearing procedures; a cheque does not count as collected until bank confirmation. Corporate services are not represented by fake individual customers. These SQL files have been tested only on fresh isolated databases, **not** applied to the hosted database.

## Current implementation coverage

Implemented and targeted-tested: invoice-linked collection attempts/reminders; employee self EOS estimates with existing legal rules and encrypted immutable history; original-file document index/archive/retrieve/multi-links/PDF text-layer extraction; original approval adapters; opt-in marketing prospects/opportunities/contracts/resource allocation/commission snapshots/supplier services/monthly targets; independent contracting companies and original-engine corporate billing; investor Auth scope, verified funds, immutable terms, separate capital/returns liabilities and vouchers, actual-event management ratings, non-financial investor change requests; scoped dashboards/report builder/exports/scheduling/snapshots/share revocation; truthful internal communications and localized source-data template previews; server-enforced read-only full owner View As.

TypeScript, the runtime build, 109 targeted integration cases and 18 existing frontend/policy test files have passed on the final implementation. Integrated browser suites passed on refreshed source, including read-only owner View As and the independent contracting-company/direct-contract lifecycle in Arabic and English at desktop/tablet/mobile widths. The separate investor-evidence browser suite also passed: authenticated own portal, secure PDF upload and preview, preserved versions, zero financial effect and responsive Arabic/English layout.

Still incomplete or limited (do not describe these as delivered): definitive investor/vehicle net-loss and recovery responsibility (requires supported approved records and explicit contractual responsibility); advanced free-form joins and any new escalation defaults not configured by the owner; advanced automatic research/OCR/AI/external delivery. Existing unconfigured legal regimes stay unconfigured. No investor loss allocation or group liability is inferred from arrears. Independent supported functions remain usable.

## Deployment blockers (no bypass)

The updated controller is prepared with an exact reviewed 014–025 SQL checksum catalog. It rejects unreviewed SQL or JSON additions, altered original 001–013 hashes and a nonsequential migration ledger. Activation must pin this immutable controller in the main entry. The protected native owner approval remains mandatory; no SHA exception or weakening is introduced.

PR #40 now runs full required unprivileged CI, including synthetic restore tests, under the owner's new authorization. The first run passed 314 cases and failed the old all-SQL-in-Reset registry check; the new release catalog is now checked separately while Reset remains unmodified and fails closed on an unsupported ledger. Eight isolated release-runner tests passed, including populated original finance preservation, transactional rehearsal, injected failure rollback and verified repeated-application no-op. A current hosted backup/restore/rehearsal has not yet run; no hosted migrations, merge or deployment is claimed.


## Final independent additions

Migration 024 links investor transfer evidence to the original encrypted document/version engine. Only the authenticated investor can upload against their own non-terminated agreement; scoped investment management can read that evidence without receiving general access to personal files. The original scanner, private object store, immutable versions and authorized download route remain authoritative. Evidence never changes capital or creates an accounting receipt. Six isolated tests cover versions, actual binary downloads, manager/other-investor boundaries and zero financial effect.

Reports now support explicit percentage numerators/denominators, currency separation and an unavailable value for a zero denominator. Preset related-company/customer/vehicle fields are joined in batches and checked against each related record's own permissions. Encrypted scheduled snapshots retain a permission proof for related fields; revoking a customer/vehicle/contractor permission prevents access to old snapshots even if invoice-row access remains. Optional owner-selected numeric thresholds suppress internal report notices until met. Existing task/HR escalation mechanisms remain in place; no unapproved escalation recipients or business defaults are invented.

The new definitions inherit the existing active-actor/suspended-account guard. EOS reads also check grant revocation at PostgreSQL level. Neither roles nor existing permission grants are redistributed.

## Independent direct contracts and current-record report proofs

Migration 025 allows a contract to reference exactly one original CRM prospect or an independent contracting company. Direct contracts need no synthetic prospect/customer and work while CRM is disabled. Existing contracts retain their original prospect identity. The shared contract engine requires the independent contracts grant for management, checks signed original documents at activation, and preserves immutable party identity and encrypted contract history. Financial history is redacted for a legal-only viewer. No current permission assignments are changed.

Snapshot access proofs now recheck each related record's current company as well as current permission grants, preventing old exports from leaking joined customer/vehicle/contractor fields after revocation or transfer. Read-only POST exports do not enter the write-request response cache. Owner View As also rejects a target whose HR/account status becomes suspended and disables mutation buttons in nested dialogs; PostgreSQL read-only transactions remain the enforcement boundary.

## Release preparation, not execution

1. Preserve the current source tree on the feature branch; do not merge the ERP tree into the protected main controller branch.
2. Use the owner's approved fresh retained encrypted backup and isolated restore; never restore onto the source. No hosted restore or live schema action is claimed yet.
3. Review additive SQL 014 through 025 in numeric order using the existing 001–013 schema as the unchanged baseline. These SQL migrations are outside the automatic JSON-only additive policy; the trusted controller must explicitly support and approve them before use. In particular, 023 changes the financial party invariant to exactly one individual or contracting party, while 025 changes contract identity to exactly one prospect or contracting company. Both preserve existing valid rows but require sensitive-schema review.
4. Through the approved release mechanism, pin the existing test project/service, prove a fresh encrypted backup can be restored, rehearse the complete additions against the isolated copy and compare original data, balances, grants and relationships. Do not run business-data seeding on Supabase.
5. Obtain the existing native owner approval for sensitive schema/permission definitions, then apply only the approved catalog and deploy the pinned build to the existing staging service. No secret or connection substitution is part of this change.
6. Smoke-test the actual owner login, original companies/customers/vehicles/finance, independent contracting register and authorized file downloads. Until then, local passing tests are not evidence of hosted availability.

Rollback must preserve database evidence: stop deployment on a mismatch; prefer the previous compatible application release without destructive down-migrations. A database restore is a separate explicitly authorized recovery action, not an automatic release cleanup. Newly entered development records must never be wiped by a deployment.

## Approved release runner (prepared, activation still required)

The credential-bearing controller executes its own checksum-reviewed SQL, never candidate JavaScript or candidate dependencies. The restored copy is rehearsed and rolled back. The source application uses one transaction and the existing schema advisory lock, refuses changed source rows since backup, verifies original projected-column row hashes, financial journal balance, users/role grants, role attributes/membership, old table/column/function ACLs, old constraints/triggers/policies and Auth/Storage data. Only the explicitly reviewed nullable-party changes in 023 and 025 are allowed. New tables require RLS and validated relationships. Runtime authentication/TLS/no-context denial and original owner Auth identity are checked without testing or changing a password. Failure rolls back pending DDL and blocks deployment; already committed releases never undergo destructive down-migrations.

Reset has not been run, enabled or expanded by this delivery. Its legacy reconstruction chain remains separate and refuses a ledger it does not support. No data seeding is part of the release.
