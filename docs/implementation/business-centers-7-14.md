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
