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

Legal regime assignment is not inferred; existing unconfigured regimes remain unavailable for estimation. Owner clarification about the requested pause on restore tests versus mandatory isolated deployment restore is pending; restore tests and deployment must wait for that answer, while independent development continues.

External AI/OCR/WhatsApp/SMS/email delivery remain explicitly inactive unless an existing approved integration is configured. No fabricated delivery/read states or automatic financial commitments.

## Owner clarification: external contracting companies (2026-11-07)

The owner explicitly rejected a corporate type in the individual-customer register. The development implementation now has a separate `contracting_companies` register, encrypted legal/contact details, read-only profiles, explicit edit/save/cancel, immutable audit events and reversible Active/Inactive status. New `contracting_view/create/edit/activate/deactivate/contracts` definitions have **no automatic assignments** to existing users or roles. Group-company scope represents the responsible AB entity, not the external party itself.

Prospects and contracts link to that independent register. Legacy `official_company_id` values are retained but are no longer used to represent an external party or activate a new contract. Nothing automatically converts or rewrites existing group companies or individual customers.

Additive migration 022 creates the register, references, independent scoped RLS and guards. Migration 023 adds an explicit contracting-party reference to the **existing** invoice/receipt engine. It replaces the old invoice/batch customer NOT NULL requirement with an exactly-one-party check; existing individual rows continue to satisfy the original business invariant. Additional deferred guards prevent cross-party allocation, mixed identities and reassignment of immutable financial parties. Original posting, clearing, accounting periods, allocation ceilings and reversal protections remain in place. No triggers or RLS are disabled.

Contract invoices have a canonical invoice/journal and cannot exceed the signed contract value. Cash and cheque collection use existing receipt/custody/clearing procedures; a cheque does not count as collected until bank confirmation. Corporate services are not represented by fake individual customers. These SQL files have been tested only on fresh isolated databases, **not** applied to the hosted database.

## Current implementation coverage

Implemented and targeted-tested: invoice-linked collection attempts/reminders; employee self EOS estimates with existing legal rules and encrypted immutable history; original-file document index/archive/retrieve/multi-links/PDF text-layer extraction; original approval adapters; opt-in marketing prospects/opportunities/contracts/resource allocation/commission snapshots/supplier services/monthly targets; independent contracting companies and original-engine corporate billing; investor Auth scope, verified funds, immutable terms, separate capital/returns liabilities and vouchers, actual-event management ratings, non-financial investor change requests; scoped dashboards/report builder/exports/scheduling/snapshots/share revocation; truthful internal communications and localized source-data template previews; server-enforced read-only full owner View As.

TypeScript, the runtime build, 104 targeted integration cases and 18 existing frontend/policy test files have passed. The two integrated browser suites passed on refreshed source, including read-only owner View As and contracting-company lifecycle. A final browser run now also covers investor evidence uploads and preserved PDF versions; its outcome must be recorded before release.

Still incomplete or limited (do not describe these as delivered): definitive investor/vehicle net-loss and recovery responsibility (requires supported approved records and explicit contractual responsibility); advanced free-form joins and any new escalation defaults not configured by the owner; advanced automatic research/OCR/AI/external delivery. Existing unconfigured legal regimes stay unconfigured. No investor loss allocation or group liability is inferred from arrears. Independent supported functions remain usable.

## Deployment blockers (no bypass)

The trusted v2 controller explicitly rejects any SQL under `supabase/additive` (`ADDITIVE_CONTROLLER_REVIEW_REQUIRED`). It requires an owner-reviewed additive migration catalog/rehearsal path before these migrations can run. The protected native owner approval remains mandatory for sensitive database/permission definitions. No SHA exception or weakening has been introduced.

The owner's instruction not to run a restore test conflicts in scope with mandatory isolated restore steps in the existing PR CI/delivery pipeline. Clarification was requested previously and is still pending. No actual restore, live database migration, PR-triggered full CI, merge or deployment has been performed. Feature-branch source preservation is permitted and does not trigger that pipeline. The existing live ERP and all business data remain unchanged.


## Final independent additions

Migration 024 links investor transfer evidence to the original encrypted document/version engine. Only the authenticated investor can upload against their own non-terminated agreement; scoped investment management can read that evidence without receiving general access to personal files. The original scanner, private object store, immutable versions and authorized download route remain authoritative. Evidence never changes capital or creates an accounting receipt. Six isolated tests cover versions, actual binary downloads, manager/other-investor boundaries and zero financial effect.

Reports now support explicit percentage numerators/denominators, currency separation and an unavailable value for a zero denominator. Preset related-company/customer/vehicle fields are joined in batches and checked against each related record's own permissions. Encrypted scheduled snapshots retain a permission proof for related fields; revoking a customer/vehicle/contractor permission prevents access to old snapshots even if invoice-row access remains. Optional owner-selected numeric thresholds suppress internal report notices until met. Existing task/HR escalation mechanisms remain in place; no unapproved escalation recipients or business defaults are invented.

The new definitions inherit the existing active-actor/suspended-account guard. EOS reads also check grant revocation at PostgreSQL level. Neither roles nor existing permission grants are redistributed.
