# Security roles, dashboard restrictions and organizational projection

Repository: `dubai717/ab-group-demo`. Target: protected staging only.

## Included without changing existing account permissions

- The existing owner permission plan/apply editor is linked from each account's **Permission management** section. Both lists support search, grouping, filtered select/clear all and staged moves. Inherited role permissions remain locked; direct grants stay separate. Existing revision, grant-version, confirmation, CSRF, idempotency and owner/self protection remain in force. The final audit now includes the previous/new direct permission sets.
- Dashboard security is separate from appearance preferences. The existing general dashboard supports explicit open, per-dataset count visibility and drill-down restrictions, existing financial/chart/report/task/alert panels, and company/unit data bounds. User and security-role restrictions intersect; underlying domain authorization still applies. No duplicate departmental dashboards are created. Module access continues through the existing granular domain permissions, not an inferred job/department/company assignment.
- Restrictions are unconfigured by default: existing account access is unchanged. Opening an editor or transferring items writes nothing. Every change is previewed and explicitly confirmed. Owner/self permissions cannot be changed here.
- Server-side dashboard projections, source-detail requests, financial projections and the vehicle movement chart enforce the restrictions. Unit-restricted financial data without recorded attribution is omitted, never assigned to an invented department. No-source/denied indicators are null rather than artificial zeros. Domain records and report/export endpoints retain their existing independent access checks.
- **Personnel → Administrative and organizational structure** derives its tree from existing employees, units, active assignments and positions. No organizational tables, branch records, duplicate employee records or background synchronization are introduced. Group/company filters, primary/additional units, work-company labels, direct supervisor vs unit responsible, active/all staff, name/position search, profile opening and authorized print/save-PDF are included. Filtered/hidden supervisors are identified as unavailable, not guessed. Cycles are reported to the owner without rewriting records.

## Security migration: isolated only, NOT approved for staging application

`backend/review/security-roles.sql` (SHA-256 `388c6f2e5305480729315c119909cd8cca2d1c1a06e6f74685fadfe77bc27ed4`) is a review candidate, outside every migration manifest and automatic migration directory. Application startup/build never runs it. Role-management writes return `securityRoleReviewRequired` until both reviewed procedures exist. The role directory remains readable to the owner, with an explicit pending-approval message.

The proposed SQL:

1. Adds nullable `tenant_id` to the existing `ab.roles` table. Existing built-in roles remain NULL, with their payloads and permissions unchanged.
2. Adds SELECT RLS policies on the existing role and role-permission tables. Built-ins remain visible as before; a custom role is visible only in its own tenant.
3. Adds an insert/role-update tenant guard on the existing users table, without rewriting any user. Adds two narrowly parameterized, owner-checked, fixed-search-path procedures for saving a tenant custom role and explicitly replacing a user's existing role.
4. Grants EXECUTE on those two procedures to the existing runtime role. No superuser, table-write, BYPASSRLS, login or password privilege is added.
5. Never reassigns users, seeds new roles, changes grants, modifies memberships or deletes a role. Built-in templates cannot be edited globally; the UI can copy one to an explicitly created tenant role.
6. Blocks owner/self reassignment and cross-tenant role selection. Users with outstanding delegated grants require a separate downstream-grant review before role reassignment. Every actual operation is audited with previous/new values.

The new procedures explicitly mark only newly managed roles; an existing role is never reinterpreted from its name or identifier. After this separately approved migration, custom-role granular domain rights use the existing account company memberships; legacy built-in role behavior remains unchanged. HR work companies, job titles, reporting lines and units never grant these rights. Removing a role requires an explicitly selected replacement (for example the existing employee role), never automatic reassignment.

### Required approval and recovery plan

Before staging application: owner approval of these exact SQL bytes; current encrypted backup; tested isolated restore; compatibility snapshots; inclusion through a separately reviewed protected migration/controller plan. Approval of a code deployment alone is not approval to execute this SQL.

Stop on any unexpected difference. The candidate does not alter financial tables or old role/user rows. Disable new role writes by revoking EXECUTE on the two new functions and return to the previously verified application if necessary; retain all created roles, assignments and audit history for review. Never drop the added column or delete roles/users as a rollback shortcut. If an explicit role assignment needs reversal, use the reviewed assignment procedure with a fresh revision and owner confirmation rather than a bulk update. A full restore after subsequent valid activity requires a separate recovery decision, not an automatic destructive restore.

## Validation

- Isolated backend tests cover preserved old role/user/permission rows, schema-not-approved gate, tenant visibility/RLS, explicit role create/edit/replacement, idempotency, protected owner/self, granular company scoping, unprivileged direct APIs and export denial, dashboard user/role intersection, audit, organization filters/links and circular history detection.
- Actual Playwright flows exercise the organization in AR/EN at 1440/768/390px, profile/unit opening, filtered selection controls, dashboard preview/cancel/confirm/readback and role creation/assignment on the isolated reviewed schema.
- Existing backend, frontend and protected-delivery checks run through the native CI entrypoints. The new browser suite is included in the existing forms suite. The local expanded backend run was interrupted at disk capacity; it is not reported as a full pass. No existing database was removed to recover local capacity; only generated build output and the package cache were relocated to temporary storage with their paths preserved.

Publication is recorded only after protected staging release, exact-commit smoke checks and delivery-result succeed. No Production action is authorized.
