# Employee forms, personal files and descriptive organization

Repository: dubai717/ab-group-demo only. Base/live before this change: 74ef792; its protected release43579938325 completed successfully. No new SQL migration, financial028, bulk document move, grants, secret or production changes.

## Reuse and preservation

The existing personnel profile, departments, encrypted payloads/settings, document/version storage and original login/linking procedures remain authoritative. New position records are explicitly owner-created in existing settings with bilingual names, immutable code, related unit, status, revision and audit. Existing free-text job records remain compatible and are not automatically converted. A selected position is resolved server-side; existing approved job/financial snapshots are not recalculated when a catalog name/status changes.

Work-company coverage and additional units are descriptive employee metadata, never authentication memberships or permission grants. Employment/residency company remains one legal company. UI uses checkbox groups with Select all/Clear all; primary unit stays distinct. Direct supervisors are existing employees, including employees without logins. Serialized server validation rejects self/cyclic chains. The old user-backed HR manager field is retained for compatibility and only maps to an existing authorized login; no account or access scope is fabricated. Existing historical user managers without an employee are preserved without guessing.

## Files before and after save

Create/edit forms expose separate personal-photo and multiple-attachment sections, per-file classification and authorized image/PDF previews. The canonical employee save occurs first, then native encrypted durable upload calls. An acknowledged employee is frozen while pending uploads complete; stable per-file idempotency keys and completed-file tracking allow retries after a lost response without creating a second employee/file. Partial save is explicitly reported; cancelling opens the saved employee's document section. Queued preview URLs/work are cleared on successful completion, cancellation and actor reset.

Saved clean photos are shown in the employee card and permission-gated lazy roster thumbnails. This does not mark a submitted identity/photo as HR-approved or alter document completeness rules.

Saved documents can be viewed/downloaded and explicitly updated from the employee editor without discarding unsaved employee fields. Native HR documents retain their original parent/version chain. Existing login-owned documents use a read-through link only when the account is explicitly and immutably linked. Original IDs, bytes, ownership, metadata, classification and audit are preserved. Non-investor-evidence original categories remain visible; explicit legacy versions use the original document upload path with both its original ACL and the employee document-update check. An unknown historical category can only be continued on its own already-owned parent, never used to invent a new user document category. Unlinked account documents remain read-only in the original location; no employee is guessed and no bulk operation runs.

Central login editors no longer offer personal document uploads or employment/identity edits. Historical nonstaff values remain stored, with permitted linked-login reference data visible in Personnel under both HR-private and original user-edit authorization. Account names/contact, credential procedures, status, security scopes and grants stay under the existing user system. Linking grants no new access.

## Validation

Meaningful isolated server checks cover catalog duplicate/inactive handling, primary/additional units, descriptive company coverage, staff supervisor self/cycle denial, immutable original document IDs/bytes and explicit versions, user/grant preservation and employee-only access. Browser checks cover inline position/unit creation, three work companies then one, two units, staff supervisor, initial photo/PDF/multiple files, first-page preview before save, a server-committed upload with lost response and duplicate-free retry, persistent avatar, account link, editor document update preserving the old PDF and employee inputs, readback and bilingual responsive pages. Existing personnel API and backup/restore compatibility suites are retained. Native exact-head and merged-push CI must pass before the existing human staging-owner-approval gate and GET-only live source-byte smoke.

Rollback requires no database restore. Retain new settings, employee metadata, document versions and audit; use a compatible forward fix if later records depend on the new structure. Never delete historical data or restore an older database over subsequent activity.

## Login-link concurrency and historical hierarchy guard

The one-time login endpoint now locks and rereads the employee before checking revision/identity. Two owner confirmations cannot replace a saved login or increment its revision twice. The existing supervision lock also validates a virtual login assignment before any write, because linking an account can resolve an old user-backed manager edge. A newly created legacy-linked employee cannot close such a cycle either. Rejection leaves the account unlinked and originals unchanged; after an explicit supervisor correction the same legitimate link succeeds. Isolated tests use two blocked concurrent requests and assert200/409, one revision increment, and cyclic creation/link refusal followed by successful corrected linking. No migration, grant or stored-data rewrite is introduced.
