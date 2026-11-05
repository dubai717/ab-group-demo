# Operational registers and test workspace — work in progress

Base: PR #23 (`db6d05076b4fcad9b0c44a587f51c88bb7055384`), original staging project/service. Development branch: `feature/operational-registers-test-center`. PR #23 is not merged or altered. No live reset, deployment, migrations, connection/Secret changes or cloud provisioning occur in this task.

## Decisions and remaining activation gate

- The Owner approved audited removal from current attachments while retaining files, versions and evidence history. Implemented without changing immutable tables, RLS, triggers, roles or the live schema. Historical access retains existing permissions and scan gates. Nothing has been removed on the hosted database.
- Automatic upload review initially rejected app.js because of pre-existing cleartext Demo credentials. The Owner explicitly approved PBKDF2 verifiers and disabling local Demo password autofill. The new app.js upload passed review. Demo account identities/roles and password validity are preserved; cloud Supabase login is unchanged. Legacy v2 browser data is not overwritten; existing current Demo state is upgraded on local initialization without copying cleartext into a new v3 record. This remains an untrusted browser demonstration, not secure server authentication. The review patch in `blocked-work/` is historical, not an executable deployment step.
- **Live Reset activation remains inactive**: PR #23's one-time secure Actions dispatch wiring/workflow activation and sensitive release approval remain separate. No current reset, merge, deployment or connection/Secret change is performed here.

## Implemented candidate (final tests pending)

- Shared server-scoped register filters/facets, stable sorting, full filtered navigation and file-number seek; Excel XML/CSV/PDF/print exports retain column order. No invented financial balances. Existing company/user grants stay unchanged.
- Customer/vehicle register controls and persisted preferences reuse current modules and profile/save endpoints. Server rechecks view/export/print company permissions; no browser-only authorization.
- Optional issuing emirate, licence cancellation status/date, existing Traffic Code/Salik fields and common company profile logo; metadata uses existing company JSON and audit, no schema migration.
- Session-only attachment viewer, selected-file thumbnails, first-page native PDF preview, unsupported Office preview labelled honestly; authenticated download adapters retain scan/quarantine checks. No public document URLs or file localStorage.
- Owner Test Data center counts the current RLS-authorized workspace and links original modules/Test Users; no automatic provisioning/seeding. Manual accounts are identified by server creation provenance or Owner creation audit; fresh Owner authentication protects one-time temporary password resets. No current passwords are retrieved or stored. One-time password dialogs clear on account/page changes, visibility loss and timeout.
- Reset canonical ordered/checksummed approved migration registry; dynamic operational-table clearing and unknown schema/definition/configuration stop gates. A complete application-schema replay/empty proof on the isolated restored copy precedes an executable hosted plan. New approved operational tables in `ab` require their normal ordered/checksummed migration registration, not a Reset code change. Existing safe JSON additions are loaded through their established compiler automatically. Global reference/configuration changes still need explicit reviewed retention classification; unclassified changes must block.
- A synthetic next migration/child relationship/immutable trigger rehearsal and unregistered-table rollback test are prepared. Neither is a real migration for the live project.

## Verification record

Pending runs will be recorded here with exact outcomes. Component mocks do not prove full app.js integration; the separate loopback suite tests the real application. Do not describe successful local/CI tests as publication or an actual hosted reset.

## Practical boundaries

- Register-wide facets/exports are capped at 20,000 authorized records; excess returns an explicit error, never a partial export. Financial totals that had no complete source remain unavailable. Existing customer completeness and alert counts are reused, not replaced with invented values.
- Excel export uses genuine Excel SpreadsheetML (`.xml`), not a CSV renamed to `.xlsx`. PDF/print retain selected column order. Sharing requires an explicit user gesture and browser Web Share support; no external message is sent automatically.
- Private server documents still require an actual clean scan. The fixture scanner is explicitly a local test double. Office types already allowed by company/bank storage retain their policy; customer/vehicle MIME restrictions remain unchanged. Unsupported native previews fall back to download.
- Future operational tables belong in the owned `ab` application schema and an approved migration. Unknown namespaces, schema definitions, reference/role changes or unclassified configuration block Reset before hosted destruction; there is no promise to delete unrecognized objects blindly. Every real Reset still requires its own fresh backup/restore proof, Owner authentication and confirmation.
