# Investor profile documents and banking — deployment review

Builds on the published investor registry (7d1a837) and existing immutable agreements/capital journals. No historical financial balance, agreement term, original attachment, user role or permission grant is rewritten.

The current task covers investor creation/profile UX. The preceding broad finance-tree brief was cut off; it does not authorize activating a new chart or posting rules in this change.

## Behavior

Multiple JPG/PNG/PDF files can be selected, classified, previewed and saved through the original encrypted permanent document storage/scanner. Cards use the original authorized byte endpoint and shared image/PDF renderer. Duplicate file hashes are rejected within a selection and against an investor's saved documents; API linking is serialized and duplicate checked as well. A committed profile/upload is retained across retries rather than recreated. Archive removes a file from the current list but preserves its original bytes, link, history and audit. Archived items remain visible through the history toggle. No physical document deletion is implemented.

Investor creation does not require bank, account holder, account number or IBAN. A provided IBAN still undergoes the existing normalization and checksum validation. Bank details can be completed later. Explicit owner approval creates a new immutable profile revision. Changing any bank field invalidates this approval; unrelated profile edits retain it. New withdrawals are blocked until complete bank details are approved, and the original voucher approval/settlement paths recheck them. New payout records freeze the approved bank fingerprint: a later bank change requires reviewing/cancelling and recreating the payout, rather than silently changing its destination. Existing balances and vouchers are not rewritten. Existing bank details require explicit review before the next payout; they are not automatically approved.

Successful creation closes the form and returns to the register. Opening an investor shows a draggable/resizable in-page profile containing details, document cards, agreements and the financial summary. Forms stay above the profile window. The login selector lives in an owner-only Electronic access section, not the creation form. Preview writes remain denied server-side.

## Migration 027: one-time existing-login link only

`supabase/additive/027_investor_electronic_access.sql` introduces two narrow functions. In one transaction it replaces only the `investor_profiles.immutable_history` trigger with a profile-specific guard that:

* rejects every DELETE;
* rejects changes to every original column except `user_id`;
* permits `user_id` only from NULL to an existing active same-tenant investor login, when the actor is an active owner;
* rejects detaching/replacing an existing association.

The original shared `vehicle_immutable()` function and every other trigger remain unchanged. Runtime gains no UPDATE/DELETE grant on the table. The new SECURITY DEFINER entry checks the owner/tenant/target and updates this single association, with an audit event. It never creates a login, changes a role/grant, or changes financial/contract records. The owner must explicitly select and confirm the link. The existing investor role's original own-profile permissions continue to apply.

The protected controller accepts only the exact original trigger definition/enabled state and the exact reviewed replacement, for migration 027 only. Any other prior trigger or preservation difference fails closed. The catalog binds exact SQL bytes. There is no data backfill.

## Verification and recovery

Isolated cases exercise optional/invalid/approved/changed banking, blocked payouts after a bank change, multiple attachments, real storage/readback, duplicates, unsupported types, archive without deleting storage, owner/investor boundaries, immutable profile payload and deletion rejection, unchanged financial journals and role grants. Browser coverage includes PDF rendering/download, thumbnail cards, failure retry without duplicate profile creation, moving the optional login into the profile, and Arabic/English desktop/tablet/mobile.

The release must use the existing protected owner gate, fresh retained encrypted backup, actual restoration and rehearsal on the hosted snapshot, old-row/grant/balance preservation, atomic staging-only application and actual post-deploy byte/auth checks. No Reset or production deployment. On a failed mandatory check, stop. Before accepting new writes, a verified restored alternative database is the recovery target; after new writes, preserve the current state and use reviewed forward correction/reconciliation rather than deleting the new schema or blindly restoring an old snapshot.
