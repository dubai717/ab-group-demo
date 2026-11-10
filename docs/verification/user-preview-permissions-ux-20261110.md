# User preview, permission plans and test banking UX

Baseline staging: d08cad17603f96ac56ff718fbbcaf28bfb4bea42. Protected dispatch
42783623675 actually completed its owner review, Render release and post-deploy
smoke; it is no longer waiting. Ordinary action sizing is isolated in PR #59.

## Current implementation

- Owner-only `/api/view-as/targets` reads the whole authorized tenant directory,
  independent of dashboard company/date/widget filters. It returns both name
  aliases, username, linked HR numbers, departments, role and account status;
  inactive/self/owner rows remain visible but cannot be selected for preview.
  The previous projection returned one name alias and omitted department and HR
  labels. A partial-name query could therefore omit a known Arabic/English name.
- The dashboard uses one dropdown containing search and direct selection, then
  an explicit Preview employee screen button. Existing server projection and
  read-only PostgreSQL transactions stay authoritative. No employee password,
  identity impersonation, owner session replacement or new grant is used.
- Owner Roles & permissions shows current inherited/direct rights, links to the
  original user/department profile and actual preview, and produces explicit
  add/revoke plans using the existing grant policy. The plan itself performs no
  grant mutation. Apply requires confirmation, a matching plan hash, current
  user revision and a current full grant-version witness. Existing conservative
  downstream revocation is disclosed and audited. Self/owner edits and non-owner
  access are refused by the server. Committed readback retries do not reapply.
- Existing-user role changes and company-emirate access bounds remain disabled
  here because the database explicitly prohibits runtime role changes and has
  no reviewed access-envelope policy. Their separate sensitive proposal must
  be tested and reviewed before registration/application; current accounts and
  grants are never rewritten by publishing this UI.
- Test banking UI is enabled only by the explicit local/staging runtime flag.
  Reserved `000` routing generates an arithmetic-valid UAE IBAN and identifies
  it as unverified fictional data. Existing normalization, length and MOD-97
  checks, duplicate policy, central save/readback and field errors are reused.
- Shared delayed non-blocking progress begins at the original API boundary.
  Buttons are guarded while the request is active; existing save/readback and
  idempotency guards remain. Requests finishing before the visual delay do not
  flash a screen overlay. Errors stop the indicator without clearing fields.
- Save buttons receive minimum usable widths and action rows can wrap. Search
  retains its original single-line contract; register headers wrap whole buttons.

## Validation and delivery

Synthetic PostgreSQL plus explicit fake Auth/storage only. Focused server tests
cover directory aliases/inactive visibility, owner-only access, read-only plans,
confirmation/hash/version rejection, atomic grant/revoke, idempotent retries and
self-escalation refusal. New independent Chromium coverage exercises partial
Arabic search, role/department/number labels, explicit preview, unchanged real
owner cookie, server write denial, synthetic IBAN, slow/repeated saves, confirmed
permission plans and committed-readback retry, delayed progress and AR/EN sizes.
Original customer/form, bank and View As browser regressions remain required.
No live test records, grants, users, Reset, DDL, credentials or provider changes.

The existing classifier/controller and real native review gate are unchanged.
A source CI pass is not publication; exact Render release plus smoke is required.
