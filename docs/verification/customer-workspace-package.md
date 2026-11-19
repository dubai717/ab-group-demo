# Customer workspace package

Repository: `dubai717/ab-group-demo`. Staging only.
Base: PR #104, `d6766a0f5b0d40177b1f294124f7d848b4775a2f`; verified live on Render before this work.

## Reused architecture and scope

The existing customer store, register API, numbering, drafts, encrypted attachments, attachment versions/scanner, customer events/audit, vehicle records and accounting sources remain authoritative. No schema migration, historical rewrite, financial posting or permission assignment is included. Vehicle/service request workflows, detailed vehicle files, bank/investor/group financing, collections, contracts, Work Amount and commissions are not rewritten.

The shared `CustomerWorkspace` presentation component organizes the existing customer record, rather than creating another customer system. The three references supply layout only; all counts and amounts come from authorized stored records. The existing `assets/logo.svg` and AB Group brown theme tokens are used. The blue reference's header, identity/passport/licence cards, vehicle history, financial summary, notes, undertakings/settlements and service summary are retained as sections with responsive layouts.

## Register

Two compact matrices summarize people by company/status and actual vehicle records by source of financing/status. The company relation basis is explicitly described: record administration scope, recorded residency/sponsor, or a registered vehicle. A person associated with multiple companies appears once in the distinct overall total; company memberships intentionally overlap. Prospect/Suspended map to the pending summary, and Ended/Archived to ended; original statuses remain unchanged. Vehicle requests without a vehicle record are never counted as vehicles. Vehicle financing categories come from the original request's canonical `finance_type`.

The register retains its original search, server filtering/sorting, pagination/loading, exports, printing and row opening. Added vehicle/financial facts use batched reads; multiple currencies are not summed together. Permissions apply independently to customer, vehicle and financial data. Failed summary loading is an error, never a fabricated zero.

## Creation, editing and documents

The basic form contains the person's identity/contact details and three document cards. Country selection reuses the existing searchable country reference. Salary, work permit and residency licence inputs are removed from the basic form; existing values remain stored and visible in retained information. Emergency contacts and address/history remain available. The current company's old field remains the existing **record administration/access scope**, automatically initialized to an authorized active company and placed in an advanced disclosure. It is not a residency company or a binding vehicle/financial company; removing its underlying security relation would require a separate reviewed scope migration.

Photo and PDF/image selections are held in session memory until final customer save; they are never placed in localStorage. Optional files can be omitted. The committed customer ID and per-file idempotency keys allow partial-upload failures to resume without repeating the customer or successful uploads. Discarding a form does not delete a customer already committed. Renewals use the existing attachment-version mechanism, preserving originals.

Uploads do not set `verifiedVersionId`. Human verification is a separate reviewed, scan-gated, revision-checked action requiring existing view/edit/documents/review rights and a mandatory note. Document kind and number must match. Verification is audited; an earlier verified version does not silently verify a replacement. No grants are added.

Official identifier comparisons normalize formatting and Arabic/Persian digits without rewriting historical digests. Passport countries distinguish numbers only when both countries are recognized; unknown historical countries are treated conservatively. A new confirmed duplicate is blocked even with a review reason. Existing previously reviewed duplicates remain editable when their official identifiers are unchanged. Shared phone or matching name/birth date requires an authorized review reason. Similarity results reveal only files in the caller's scope, and editing excludes the authorized current record. Customer numbering and duplicate checking remain transactional.

## Profile and read-only finance

The profile uses actual opening date, photo, status, contact/nationality, residence information when present, real registered vehicles and current/history documents. A final score remains uncalculated because no approved weights exist. Payment compliance is a descriptive ratio of allocated payments to net due installments, separated by company/currency; rescheduling, violation invoice counts, service volume and vehicle states are separate indicators, never automatic financing decisions.

Financial totals reuse native invoice/allocation calculations. Actual cleared RVs exclude credit notes, pending and returned payments; invoice allocations are shown separately. Only true discount metadata contributes to the discount total; cancellation/rescheduling credits and accounting write-offs remain distinguishable. Book and pre-write-off legal balances are shown separately. Overdue, due-today and future balances are components of the remaining balance. Merely opening a profile writes no financial documents or journals.

Passport custody appends dated movements with actor, optional evidence and predecessor checks, retaining the history. Termination document links come from recorded closure requests, rather than guessing that every attachment is a termination document. Notes display actor names. Vehicle rows open the existing vehicle file; the top request action opens the existing customer-bound composer.

## Verification boundaries

Local integration/browser tests use isolated synthetic databases, fake Auth/private-object providers and an explicit test scanner. Tests cover distinct/multi-company totals, unregistered requests, exact invoice/receipt/discount balances and no read-side journal writes; official/potential duplicates and review; unauthorized access; optional/staged PDF/photo upload and partial-failure replay; first-page preview, exact downloaded bytes and printable rendered pixels; independent human verification; custody history; save/edit/reopen, unchanged request/vehicle navigation; Arabic/English and desktop/tablet/phone layouts.

Existing customer, drafts, undertakings, follow-up, permission, user enrollment and linked UI regression suites run before protected delivery. Final CI counts, PR/source/merge commits and protected approval status are recorded in the release report. No hosted business writes are represented as tests. Deployment is complete only after the protected main controller succeeds and Render's live commit and read-only smoke checks match the intended release. `staging-owner-approval` is never bypassed.
