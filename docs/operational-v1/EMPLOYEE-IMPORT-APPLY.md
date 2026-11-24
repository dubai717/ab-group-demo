# Original employee batch writer — unpublished, disabled by default

Continues the existing personnel import preview. No parallel employee register, Auth user creator, salary engine or permission model is added. `employeeImportEnabled` defaults false and the runtime server does not enable it. Only the owned synthetic fixture explicitly enables it. Real import remains prohibited without final Owner approval.

The original `/api/personnel/employees` creator is shared as one callback by the batch handler. It retains the original schema, Active employer/link/phone checks, employee numbering, encrypted private defaults, employee audit and original EOS estimate snapshot. The import accepts only basic new personnel fields; Auth/user linkage, private identity, compensation, documents and permission columns are rejected. Existing employees are never overwritten or auto-merged. Shared names/phone/email and earlier source matches remain review rows. Such matches are not proved duplicate identities.

Preview remains an uncached repeatable-read/read-only transaction. Its HMAC binds tenant, current Owner, exact source bytes/plan and original employee revisions/data and company revisions/status. Apply refreshes the plan and rejects stale tokens. At most25 valid new employees can be saved in one batch. Rejected/matching rows require an explicit valid-only choice. Normal mode rejects any unresolved row. The original request receipt, employee/counter/audit/EOS writes are one transaction. No migration or new ledger is required.

The original wrapper serializes fresh authority, company directory and personnel mutations before reading the apply snapshot. It checks current Owner/work eligibility and default-off configuration before recovering a cached batch receipt. Concurrent same-key retries recover the identical outcome; different keys cannot reuse an already consumed preview. Batch audit records only original metadata field names; each employee retains its own original company-scoped audit. No cross-company list of employee identities is copied into an individual employee's audit.

The original shared dialog adds explicit confirmation only when the test configuration enables apply. Lost replies retain a frozen body/key. After an acknowledged commit, retry performs bounded original employee/dashboard reads only. It verifies all new IDs before replacing the original personnel data and preserves current filters. Actor, authority, CSRF, page and locale transitions reject stale results. There are no Auth, payroll or posted financial writes. The original creator's EOS estimate snapshots are preserved as estimates.

An actual integration test exposed the company import launcher matching a dialog's shared marker after personnel redraw. The launcher now binds only to the real button. Closing the employee importer is checked to leave no unintended company dialog.

## Evidence

- `backend/tests/employee-import-apply.test.ts`: actual random localhost synthetic DB and original writer, same-key concurrency, default-off cached replay refusal, stale preview, two different keys, strict batch cap, late second-insert failure, complete employee/receipt/counter/audit rollback and exact recovery, original employee readback, unchanged existing users/grants/journals and unauthorized cached replay refusal.
- `backend/tests/employee-import-apply.browser.cjs`: original staff register; explicit partial-source confirmation, lost committed reply, same-key/body retry, acknowledged readback failure with GET-only recovery, exactly one new file and AR/EN1440/768/390; screenshots inspected.
- Linked67-case original HR/company/security/import run passed. Current focused atomic run and complete44-journey browser run are recorded separately; pending runs are not success claims.
- TypeScript, provider-free build and162 original root checks passed.

## Remaining

Document/organization mappings, authorized duplicate-resolution decisions, centres/document/opening-balance adapters, final company-scope integration and complete release acceptance remain incomplete. No actual import, deployment, financial activation or historical migration was performed. Financial PR115 is untouched.
