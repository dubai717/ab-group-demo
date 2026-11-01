# AB Group Demo Prototype

This repository contains a working interactive prototype of the AB Group administrative system.

## What is included

- Login screen
- Owner account for the main admin
- Role-based dashboard access
- User management panel
- Department and company views
- Role and permission seed data
- Interactive prototype built with static front-end logic and browser storage
- Arabic / English language switching
- Corporate branding with logo integration
- Updated visual identity using the official AB Group color system

## Demo accounts

Use any of the following demo usernames with their matching passwords:

- Owner: `owner` / `Owner@12345`
- General Manager: `gm` / `Gm@12345`
- Regional Manager: `region_manager` / `Region@12345`
- Employee: `employee1` / `Emp@12345`
- Investor: `investor1` / `Inv@12345`

## Run locally

1. Clone or download this repository.
2. Open a terminal in the project folder.
3. Run:

```bash
npm start
```

4. Open in the browser:

```text
http://localhost:3000
```

## GitHub Pages deployment

This demo is designed to run as a static website. The recommended deployment method is GitHub Pages:

1. Open the repository on GitHub.
2. Go to Settings → Pages.
3. Select `Deploy from a branch`.
4. Choose `main` and `/root`.
5. Save the settings.

Then the app will be available at a URL in the format:

```text
https://<your-username>.github.io/ab-group-demo/
```

## Notes

This is a working front-end prototype for testing the structure, roles, access logic, screens, and user flows. It is designed for iterative refinement as part of the product design and development process.

The prototype stores data in the browser's local storage so it can be used immediately without a database backend.

## Latest update

This version includes:
- official AB Group logo integration in the login page and dashboard shell
- Arabic / English toggle
- RTL / LTR switching support
- updated corporate visual identity with the official red, brown, copper and gold palette
- consistent color system applied across login, sidebar, dashboard, buttons, tables, and controls
- preservation of the original prototype features and test accounts

## Next steps

After this prototype is reviewed, the next iteration can add:
- real database integration
- backend APIs
- secure authentication
- company and investor modules
- task lifecycle and notifications
- reports and dashboard reporting
- deployment setup

## Companies and legal entities

The current prototype also includes company registration, legal entity records, status controls, search and emirate/status filters, and local document uploads.

CSS lives in `styles.css`; browser JavaScript lives in `app.js`. Existing v2 browser data is retained when loading the v3 application.

## Browser storage migration

On startup, existing `ab_group_demo_state_v3` data takes precedence and is not rewritten. If v3 is absent, valid `ab_group_demo_state_v2` data is copied to v3, adding missing company fields and filters while retaining existing records and custom fields. The original v2 value is never changed or deleted. Migration runs once; subsequent saves use v3.

If a storage write fails, the loaded data remains available in memory and the stored source remains intact. If saved data cannot be parsed or has an invalid structure, automatic state writes are disabled for that session to avoid replacing it with demo data; the app displays its demo state. Storage recovery requires correcting the saved data and reloading.

Run the storage regression checks with `node tests/storage.test.cjs` (no dependencies required).

## Users, appointments and delegated access (session demo)

The vertical **Users** menu now opens the extended user administration workflow. Arabic/English and RTL/LTR follow the existing language switch. Existing role definitions, saved users, demo accounts, corporate palette and official logo are retained.

Implemented workflows:

- Scoped user list with name/username/email search and account/company/department filters.
- New user and editable profile: Arabic/English names, Emirates ID, nationality, phone, email, username, job title, hire date, manager, multiple companies and departments, and account status.
- Separate checks for create, edit, status changes, assignments, permission management, reset requests and attachment access. A fully authorized appointment saves and activates directly, without an extra approval step. New accounts have the employee base role; existing role IDs cannot be changed through profile payloads.
- Group, company, department and reporting-line scopes. Both original and proposed memberships are checked on reassignment. Management cycles and duplicate usernames/emails are rejected. A company/department scope is explicit; restricted delegates may re-grant the same scope, while group authority can grant narrower scopes.
- Existing create/edit/deactivate role rights are honored without adding new rights to existing roles. Existing basic user-list visibility is retained for the owner, general manager and roles with `view_users`. Other users see themselves and records within their delegated actions. Menu visibility does not confer write access.
- A non-owner cannot modify the owner, grant powers they do not hold, grant broader scopes or grant themselves powers. Passing on delegation management requires explicit re-delegation authority; each passed-on right must also be marked delegable. Revocation conservatively removes grants issued downstream by the recipient, with audit events. Existing inherited role rights cannot be revoked here.
- Profile photo, Emirates ID front/back, passport, employment contract and optional driving licence: add, preview and replace per session. PNG/JPEG/PDF up to 5 MB; photos must be PNG/JPEG. Viewing requires attachment access; updating an existing user's files additionally requires edit access. Files and identity data are never added to the legacy application state by this module.
- Audit events for creation, edits, assignments, grants, revocations, status changes, file updates/views and reset requests. The owner sees session events; other actors see their own events. The log contains identifiers and field names, not document contents or identity-number values. Display times use Dubai time.

### Data and security boundaries

**This is a UI/authorization simulation, not a secure ERP backend. Use fictional data only.** New profiles, edits, status changes, grants, attachments and audit events stay in page memory. Reloading discards them. They are deliberately not serialized into localStorage, sessionStorage, IndexedDB or a remote service; existing stored records and permissions remain untouched. File previews use temporary object URLs. Logout switches the acting account but retains the page's demo workflow so delegated scenarios can be tested; reload ends it.

The existing demo authentication and legacy localStorage behavior remain unchanged and are not suitable for real credentials or personal records. The new workflow has no password field and does not generate or store passwords. The reset button only logs a **simulated reset request**; it sends no message and changes no credential. Editing a profile username here does not replace the legacy demo sign-in identity. New accounts cannot sign in until a backend provides authentication.

Before real use, implement all of the following on a trusted server:

1. Authenticated sessions (secure HttpOnly cookies), CSRF protection, rate limits, server-side authorization on every operation and attachment read, and revocation/session invalidation. Never trust browser role or grant claims.
2. A relational database for profiles, company/department memberships, reporting lines, grant provenance and scope. Validate assignments, activation and delegation atomically in transactions, with concurrency controls and no escalation. Preserve existing production data through a reviewed migration.
3. A credential service with salted password hashing (e.g. Argon2id), verified reset delivery and single-use, expiring reset tokens. No plaintext credentials or reset tokens in browser storage or logs. Replace the legacy demo authentication before onboarding real users.
4. Private encrypted object storage with authorization-checked uploads/downloads, content validation/malware scanning, size/type limits, short-lived signed links, retention/access policies and encryption for personal identifiers. Browser file checks here are only demonstration checks.
5. Durable, access-controlled, append-only audit records including actor, target, action, grant/scope provenance and permitted before/after metadata. The in-memory log is neither durable nor tamper-resistant.

### Validation

Run `node tests/user-management.test.cjs` and `node tests/storage.test.cjs` without installing dependencies. The permission tests cover owner protection, legacy permissions, all scope types, no escalation, explicit delegation, revocation, activation, cycles, attachment access/update restrictions, duplicate data, immutable source records and reset simulation.

Browser validation exercised owner creation/edit/activation, file preview/replacement, simulated reset, audit/search, scoped operator and read-only employee flows, reload behavior and the absence of new sensitive values in localStorage. It also checked Arabic/English layouts at 1440 px and 390 px, zero JavaScript exceptions, and regression flows for login, navigation, companies/uploads/filters, tasks and v2/v3 storage preservation.

An optional repeatable browser flow is included in `tests/user-management.browser.cjs`. With Playwright and its Chromium installed in your development environment, run `npm start` in one terminal, then `node tests/user-management.browser.cjs` in another. `ERP_DEMO_URL` selects a different local port and `CHROMIUM_PATH` selects an installed Chromium executable. Screenshots are written to `work/ui-artifacts/`; the flow uses generated dummy data and isolated browser storage.
