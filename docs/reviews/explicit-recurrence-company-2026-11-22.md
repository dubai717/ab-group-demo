# E54 — prospective explicit recurrence company (BUILD ONLY)

The original generator matched an explicitly approved financial binding's company against the person's profile company. Creating a valid binding across those two companies was allowed, but the generator silently skipped it. A real isolated before-fix reproduction demonstrated zero invoices instead of one and confirmed that the profile-company comparison obscured the original customer authorization boundary. Source evidence: `explicit-recurrence-company-before-confirmed.log` in the isolated test log directory.

New bindings receive a server-only `explicit_relation_company_v1` policy marker. The generator resolves the original tenant/person, retains original customer-view, invoice, item, company, vehicle, period, evidence and financial-feature permissions, and invoices under the explicitly selected legal company. Original company/person relationships and grants remain unchanged. Duplicate period protection and atomic rollback remain original.

**No automatic historical adoption:** old cross-company bindings without that marker were never billed by this generator and still are not billed. They return a visible review requirement. Existing same-company bindings continue as before. Disabling remains available; silently re-enabling a historical cross-company binding is refused. There is no automatic backfill, migration, adoption endpoint, financial approval or worker activation. A specific prospective Owner decision is required for those legacy bindings; the build continues independently.

The original default-off worker propagates review results and logs only a sanitized code/count/company list. Manual UI displays actual issued and review counts. The recurrence invoice link records the policy and observed profile company, without claiming a legal ownership inference or introducing row-update permissions. Source tables show review state separately from enabled state. All failures preserve the actual server state.

## Acceptance

- **24 focused native cases passed**, including five new company-boundary cases: new approved cross-company invoicing once, concurrent replay, original customer scope denial with atomic rollback and Owner retry, cipher/company mismatch refusal, unchanged default-off worker, explicit approved worker behavior, and historical cross-company non-adoption alongside valid same-company billing.
- Balanced original company/AED journals and unchanged profiles/grants/history verified on synthetic data. Original package, jobs, entitlement-source, vehicle-release and service-billing regressions included.
- Three actual browser suites passed: new recurrence UI, original financial package and entitlement exports. New suite verifies Arabic/English at desktop/tablet/phone widths, actual issuance/review counts, disabled historical relation, HTTP409 and visible inline refusal on re-enable, no false state and no duplicate invoice.
- Initial browser harness incorrectly waited for an alert; original product correctly uses the inline workspace notice. Acceptance now checks that actual notice and response rather than changing product error behavior.
- Final TypeScript, **172 static tests**, portable build/module graph passed. Logs: `/workspace/ab-test-tmp/explicit-recurrence-company-*`.

## CI execution budget

Draft run44977048066 completed static/build and all550 native tests successfully, then reached the existing30-minute job budget in its long browser loop. It was cancelled by that execution budget, not by superseding pushes (`cancel-in-progress:false`) or an agent action. The unprivileged reusable checks job now allows90 minutes with every required test retained. Protected deployment controller/approval unchanged. No old run was cancelled/restarted and no deployment requested.

Requirements5.1 and9.10 remain partial. No cloud write, hosted migration, financial activation, grant/balance change, merge or deployment.
