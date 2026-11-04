# Vehicles and integrated staging — owner review

Status: prepared for review, NOT deployed; no hosted migrations, role assignments, secrets or Render settings changed. Development branch: `feature/vehicles-finance`, based on PR #14 (`feature/customer-management`). PRs #10–#14 remain open. The eight approved migration files are unchanged.

## Implemented and tested with synthetic data

Customer-bound vehicle requests, four funding sources, independent approval/disbursement/recipient acknowledgement/custody settlement, vehicle files and physical-asset identity, precise three-decimal financing schedules, separate recurring service invoices, immutable invoices and allocations linked to approved bank transactions, outstanding/legal/accounting balances, rescheduling with approval/consent, termination preserving financing and past dues, insurance/GPS cost-versus-charge tracking and supplier payments, keys, legal circulars, recovery assignment/follow-up, settlements, internal/external sales and approved private PDF letters, versioned quarantined documents, scoped permissions and audit, reports, synthetic legacy imports, Arabic/English responsive screens. Companies, banks and customers remain in the same application.

No existing user receives new delegated permissions automatically. Owners retain existing authority. Invoice issue and payment allocation do not create a second bank posting. Optional contract evidence does not block core billing; absent evidence stays explicitly incomplete. Sensitive waivers, consent, sale letters and similar legal actions still require verified evidence.

External GPS, WhatsApp and OCR are explicitly inactive. Production malware scanning/signature assets are not configured by this work; real uploads remain quarantined. Automatic billing is OFF by default and additionally requires explicit company configuration. Risk colors/thresholds are not fabricated. Investor/bank-financing accounting, full general-ledger completion, real historical loan migration and richer specialized reports remain separate work. Synthetic imports do not redisburse historical loans. Local mocked Auth/scanning results are not proof of hosted password authentication or live scanner operation.

## Validation

Local build passed. Backend: 85/85; root policies/UI regression unit tests: 114/114. Vehicle browser flow exercised request → approval → disbursement → acknowledgement → registration → schedule preview → invoices → reload, Arabic/English, light/dark, widths 1440/1024/768/390, no JavaScript errors or sensitive browser persistence. Runtime npm audit: zero known vulnerabilities at preparation time.

Release tests apply proposed 009→010→011 to an isolated synthetic PostgreSQL database, verify retry applies zero migrations, preserve existing companies and role assignments, and enforce RLS/immutable invoices. Backup drill dumps source data, encrypts the archive plus private encrypted object fixtures, restores to a NEW isolated database and verifies row equality, decrypted fixtures and runtime access controls. Source databases are retained. This is not a restore test of a fresh hosted snapshot.

GitHub CI additionally runs existing company/bank/customer browser regression, vehicle schema-present/schema-absent cases and builds the staging Docker image. Consult the PR checks for the actual CI outcome; local success does not mean published.

## Cloud read-only preflight

`vehicle-readiness.yml` only runs on `verify/vehicles-staging-readonly-*`, using the EXISTING `supabase-test` Environment. It verifies secret presence/formats without values, approved migration hashes, actual admin/runtime read-only TLS connections, safe `ab_runtime` attributes, Auth settings and private bucket, plus public Render health/application fingerprint. It does not test passwords, mutate data, apply migrations or inspect Render's protected environment.

No Render connector or authenticated service-settings access is available in this session. Repository `render.yaml` specifies existing `staging/ab-group-test`, manual deployment (`autoDeployTrigger: off`), Starter and Node 24. Public application fingerprint can corroborate deployed code, not prove the live configured branch or complete environment. These settings and the exact selected deployment commit must be checked in the existing service before activation. Existing secrets must be reused, not copied into the frontend or requested again unnecessarily. `render-env-check.mjs` is prepared for the new build; it is NOT assumed present in the old deployed image.

## Database and backup gates

Proposed files remain outside the automatic approved migration folder:
1. `009_financial_workbench.sql` (PR #13)
2. `010_customers.sql` (PR #14)
3. `011_vehicles.sql` (vehicle PR)

Their ordered hashes and expected RLS tables are frozen in `backend/deploy/vehicle-release-plan.json`. New schema is additive and preserves prior data/assignments; indexes, uniqueness/FK checks and triggers can still take locks and reject inconsistent existing rows. The release runner validates the eight-file ledger, refuses unknown or untracked existing target tables, and executes only missing approved additions in a transaction, with FK/RLS checks. Do not blindly reapply migrations.

Before any hosted change: capture a fresh read-only encrypted database + private-object backup using `backup-staging.ts`; keep an independent `BACKUP_ENCRYPTION_KEY` separate from the data key and archive in restricted storage, never a public CI artifact. Verify actual restore in an isolated compatible target without overwriting Supabase, including auth/storage schema compatibility and object decryptability. No new hosted target may be created without approval. Local PostgreSQL can be used for the drill; a hosted Supabase disaster recovery exercise additionally requires provider-compatible Auth/Storage restoration review. Issue a fresh restore proof only after checking the actual archive. Keep archive and keys separately, define retention and operator access.

The release template `.github/workflows/vehicle-release.yml.example` is INERT. It deliberately cannot run without the owner-approved branch/flags AND a fresh independently verified restore proof. It does not manufacture that proof or claim the capture-only backup is a restore. A missing backup key, failed restore, unknown schema or inaccessible environment blocks activation. No cloud migration has been performed here.

## Proposed single approval / activation sequence

After explicit owner approval only:
1. Confirm the existing Render service branch/manual mode/environment; verify independent backup key, capture fresh encrypted hosted backup and verify restore. Stop on any failed prerequisite.
2. Apply only reviewed 009→010→011 to `ab-group-erp-test` with the frozen hashes, validated ledger and restore proof. Recheck relations, RLS, runtime and private storage. Do not expand existing role assignments or enable external integrations.
3. Merge the reviewed vehicle PR into `feature/customer-management`, then PR #14 into the banking feature branch and PR #13 into `staging/ab-group-test`, preserving the tested combined tree. Do not merge main or PRs #10/#11/#12, delete branches or close unrelated work. Rerun required CI if the final tree changes.
4. In the EXISTING Render service select **Manual Deploy → Deploy a specific commit** for the approved tested staging SHA. No new service, database or subscription. Same URL: https://ab-group-demo.onrender.com . Repository build: `npm ci --ignore-scripts --include=dev --omit=optional --no-audit --no-fund && node backend/deploy/build.mjs`; start: `node backend-build/deploy/server.js`; root: repository root. Keep `NODE_EXTRA_CA_CERTS=./backend/certificates/supabase-prod-ca-2021.crt`; never disable TLS verification. Existing Starter target approximately USD 7/month, subject to the existing account's actual plan/invoice; no purchase authorized.
5. Smoke-test the SAME URL in Arabic/English desktop/mobile: existing test login, company create/save/reopen/edit, bank account and relationship-manager data, customer create/reopen, customer-bound vehicle request, funding and invoices with approved synthetic evidence, save/retrieve, permission denials and private-file quarantine. Verify old data and permissions remain. Do not reset an account or claim verified document workflows without configured scanning.

Rollback: redeploy the previously confirmed staging application SHA if necessary; preserve new tables/data and use forward schema fixes. No destructive down-migration or overwrite restore. A schema restore or permission change needs separate approval if outside the agreed additive plan. Keep worker defaults off until explicitly approved; core manual flows remain available.
