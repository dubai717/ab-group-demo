# Company profiles, status actions and protected PDF previews

## Company status and profile

The register remains mounted beneath a side dialog. Opening a name/row/profile
starts read-only. Editing is explicit and saving submits only changed fields with
the revision captured when editing began; Cancel discards the draft. Close, Escape,
logout and browser unload guard unsaved profile changes. A status operation uses a
named confirmation, a status-only revision-checked UPDATE, a verified readback,
and stays in the same register/profile. Repeated status clicks are blocked. Failed
writes retain the original UI state; a committed write followed by failed readback
is reported as unverified, never claimed to have rolled back.

The adapter previously cleared every form data-* attribute when regenerating
idempotency keys. This erased revision/context metadata. It now clears only keys
it owns, preserving edit baselines, revisions, target IDs, validation and saved IDs.
The status-only path no longer upserts the licence or rewrites other company data.
No existing company, document, relationship or financial record is changed by deploy.

## Independently controlled capabilities, preserving current grants

The owner approved separate edit/activate/deactivate controls. Existing users have
no override and continue to inherit the exact previous legacy edit_company powers.
Nothing rewrites roles, permission_grants or users during startup/deployment.
In central user management only, the owner can explicitly save inherit/allow/deny
for each capability independently. Overrides use the existing protected user JSON
record and a revision-checked owner-only endpoint; no new SQL, RLS rule or grant is
needed. Other admins cannot use this endpoint, mutate the owner, or inject overrides
through ordinary user editing. View access and document permissions remain separate
and unchanged. Override scope matches the existing company permission scope.

The shared RecordProfile helper establishes the future view -> explicit edit ->
save/cancel -> audit contract without rebuilding unrelated record screens.

## Audit compatibility

The immutable existing audit_events record retains all legacy changed-field keys.
A versioned `ab-company-change:v1:` envelope in its extensible text[] metadata
contains authenticated ciphertext under the existing data-encryption key. This
adds no column, table, privilege, trigger bypass or new secret. The envelope records
operation kind, previous/new non-sensitive values, actor and database timestamp.
Contact data, codes, notes, documents and other unnecessary private values are not
retained: only redacted changed-field markers are recorded. Public audit adapters
strip the envelope and expose decoded detail only within the existing authorized
audit scope. Old audit records remain readable without invented before/after values.

## PDF

The sandboxed native PDF plugin could fail with a grey embedded frame. PDF.js
6.5.438 is pinned in package-lock and served from explicit same-origin renderer
asset routes. No arbitrary node_modules files are public. The worker is same-origin;
eval and PDF/XFA scripts are not enabled. Authenticated scan-gated file endpoints
and Supabase private storage are unchanged. Documents are never sent to a third party.

PDF pages render to a bounded-resolution canvas; Previous/Next navigate pages,
zoom controls adjust the view, and original download, rendered-page printing and
close remain available. Corrupt/password-protected/unsupported documents show a
clear fallback; denied byte loads cannot be downloaded or previewed. Workers/blob
URLs are cleaned on close, logout, page hide or replacement. Images keep their
existing contain behavior. Local company/bank/user previews and central company,
bank, customer, vehicle and personnel PDF adapters share the viewer.

## Tests and release boundary

All mutations in tests use synthetic isolated PostgreSQL/auth/storage fixtures.
New direct browser tests: company-profile.browser.cjs and pdf-preview.browser.cjs.
They cover read-only/edit/save/cancel, dirty close/Escape, failed writes, same-page
status updates, owner permission controls; real one/multipage PDF pixels, navigation,
zoom, printing, original download, invalid PDF fallback, access denial and no PDF
script execution, in Arabic/English at desktop/tablet/phone widths.
Existing central/workspace/browser component and company/bank lifecycle regressions
also run. New API tests cover the independent capability matrix, preserved roles
and grants, protected owner, encrypted/redacted audit, asset allowlist and strict CSP.
Dependency audit found no production advisories at preparation time.

The current deployment policy is unchanged. New browser scripts run directly in
isolation; adding workflow steps was rejected by automatic approval review as a
sensitive deployment-control change. No workflow change is included. Existing CI
continues to run its existing checks and discovers the added API/unit tests.
Sensitive backend/permission/dependency changes must pass the current exact-SHA
owner approval gate before any staging release. No Reset or hosted test writes.
