# Review-only owner role and access bounds

Status: PREPARED, NOT APPROVED FOR HOSTED APPLICATION. This branch is a draft.
It is not merged into staging. Its SQL is deliberately outside `supabase/` and
is not present in any approved migration/release catalog, controller pin or
provisioning command. No deployed application reads or executes this SQL file.

The current database blocks runtime changes to an existing `role_id`. This
proposal keeps that trigger intact and adds one narrowly checked SECURITY
DEFINER procedure requiring a real active owner context, a non-owner/non-self
target, explicit confirmation, a known non-owner role and the current revision.
New bounds/history tables initially contain zero rows. Installing the reviewed
structure does not change any current user, role, membership or grant.

The optional bounds are intersections of company IDs, licence IDs and the
company's registered emirate. NULL preserves an unrestricted existing dimension;
an empty selected list grants access to no companies. These are company/legal
entity bounds, **not vehicle registration emirates, locations, or GPS access**.
A restrictive PostgreSQL policy covers companies and each existing UUID
`company_id` table; licence-bearing rows also check their actual licence ID.
Permission-grant metadata is excluded from the sweep so global grant authority
is still interpreted by the original policy within the bounded records. Bounds
never grant an action that the user's chosen role/direct grants do not allow.

A signed preview uses current role definitions, target revision, existing bounds,
company/licence metadata and active grants. The UI shows the proposed role's
rights and permitted companies before native owner confirmation. Direct grants
are preserved; choosing a role does not silently revoke historical grants or
assign new explicit grants. The database procedure records immutable before/after
access history and the ordinary owner audit event. Owner records/self-escalation
and non-owner calls remain prohibited. Existing-user role and scope controls are
not displayed until the exact reviewed procedure is present.

Validation runs ONLY on randomly named local synthetic databases. Tests verify
unchanged existing users/role grants on SQL preparation, owner/confirmation/
revision checks, invalid role/scope rejection, direct SQL RLS reads and writes,
company/licence/emirate intersections and empty-deny, immutable history, failed
runtime role UPDATE, stale grant plans, preserved direct grants and source API
scope. The isolated browser proves cancelled confirmation, actual confirmed
role/bounds save and committed-readback retry without applying twice.

Activation requires a separate explicit owner review of the SQL/security change,
registration of an immutable checksum-reviewed migration in the trusted catalog,
retained encrypted backup plus isolated restore/rehearsal, preservation checks,
and the existing native protected-environment approval. Do not run this SQL
through Render Shell, edit provider secrets/rulesets or bypass the controller.
After approved activation, each existing user still changes only through a
separate explicit owner preview/confirmation. No bulk role or permission update
is included or authorized by this draft.
