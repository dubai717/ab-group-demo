# Explicit prospective service billing for existing contracts — E69

BUILD ONLY. No hosted adoption, contract/invoice rewrite, cancellation, balance migration, activation, grant, Reset/Restore or deployment.

## Source and effect

The original legacy contract intentionally kept its original advance-generation behavior. PR111's due-month policy applied to new contracts; historical contracts could not be adopted explicitly. This package reuses the original contract, vehicle events, recurring job, service invoice keys and forecast function. It does not replace the contract or silently migrate history.

An Owner-only preview shows every original service invoice (including future-dated issued invoices), its number/due date/amount/currency, preserved original fee, future effective date and source digest. Explicit approval requires a clean **contract-kind** vehicle attachment, signed-agreement confirmation, preservation confirmation and reason. Current vehicle/customer/company scope and Active states are rechecked. No invoice/JV/RV/PV is emitted by approval.

The immutable existing vehicle-event stream records `AB-PROSPECTIVE-SERVICE-1`. Before cutover, the existing legacy generator may complete only dates before cutover; it cannot create further advance invoices at/after cutover. From cutover the existing current-month generator is used. Already-issued source keys remain unchanged and deduplicate future jobs. Forecasts remain nonposted data. The original contract payload and all historical invoices/amounts/allocations/grants remain unchanged.

A stale source digest requires a fresh preview. An identical retry returns the same original event, including when the first commit's response was lost; changed approval terms do not create another policy. Inconsistent event company/actor/contract metadata fails closed instead of falling back to legacy advance billing. Existing future invoices with a different amount block a fee amendment pending an authorized correction; no issued claim is silently repriced.

Managed investor contracts remain excluded: their independent approved fee-sharing agreement is not inferred or changed. Existing future invoices are not turned into forecasts, cancelled or deleted. Existing unadopted contracts are not automatically opted in, and the server worker remains default-off/explicitly enabled by the existing policy.

## Existing UI and verification

The original vehicle finance tab has a compact preview/approval section and saved effective-date caption, AR/EN event labels and explicit confirmation errors. Original contract/financing/registration screens are retained. Inputs survive failure. Editing cutover invalidates the preview; a real held read is discarded. Actual server commit followed by503 was tested, with retained agreement/reason/confirmations and verified same-result retry; no new invoice or financial entry.

- **Six new native cases**, with **29/29** related native regression cases passed: preservation/concurrency; stale/unsigned/conflicting approval; Owner and active-scope controls; intervening actual billing source; investor exclusion; malformed recorded metadata. Existing vehicle service policy, default-off worker, independent company recurrence, V3 cash/bank/financing and historical workflow cases pass.
- Actual adoption browser passed AR/EN at1440/768/390, original currency display, all original invoices, missing confirmation, held real preview while editing,503 after real commit and safe recovery. Financial statements and matched/unmatched group-closing browsers also pass.
- Original vehicles browser passed with and without proposed schema, including actual funding/registration, future fee amendment, private files, task/contact chain, V3 general/residence services, mobile/dark layout. An occupied original local test port was not killed; the synthetic fixture now accepts a bounded loopback test-port option with unchanged3400 default. The same original test used3665.
- TypeScript,175 static checks and portable build passed. Initial attachment-kind lookup used the wrong level; it was corrected to read the original encrypted file metadata, retaining the signed-contract check.

## Remaining checklist

5.2/5.3 remain partial: this is an available **specific prospective approval path**, not Owner approval/activation of actual legacy contracts. Existing future invoices stay actual records until separately reviewed; investor agreements remain independent. No historic receivable cancellation or implicit legal tax decision. All95 acceptance and the one final protected release remain open.
