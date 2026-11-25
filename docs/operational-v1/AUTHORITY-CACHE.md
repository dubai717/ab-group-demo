# Shared caches after confirmed authority reduction

Unpublished branch source only. No hosted data, rights or deployment changes.

An actual isolated original bank register retained one previously authorized row after the Owner denied bank_view and the same employee reloaded their bootstrap. The new client invalidates original module caches on a confirmed reduction: actor/role changes, removed role actions or company/unit memberships, removed/changed original own grants, new own denials and restrictive company overrides. Preview-context changes invalidate caches too. An unrelated added grant does not erase authorized cache/draft state.

The existing cache reset hooks are reused for customer, vehicle, finance, personnel, ledger, records, documents and attachments; tax and dashboard caches are invalidated as well. The shared register store scrubs detached row references and increases their generation. Pending same-actor source reads cannot repopulate them.

Original API responses are bound to the current client authority generation before sending, after headers and after consuming JSON. An obsolete result is rejected even when its body finishes after a confirmed reduction. Authentication transitions/bootstrap retain their separate request-generation handling. This is client lifecycle protection, not a replacement for server/RLS permission checks, and it cannot make already viewed data unseen.

Synthetic browser proof uses the original bank source and original Owner denial plan/apply. It verifies original rows before revocation, preservation after an unrelated addition, clearing after denial, an actual held old response, delayed JSON consumption and a fresh denied source. No mock balance or manual insertion into the cache is used. The first fixture attempt lacked explicit source view authority and was corrected; only the later one-row stale-cache assertion is the before-fix proof.

The focused browser test passed. The full23-journey UI regression,189 static checks, TypeScript and provider-free build passed. The full native suite passed757 cases for the selected-denial server code. No final-head CI result is claimed.

Remaining release work includes full exception reset, dashboard override inheritance/table/chart previews, real geographic relations, other delegation/service/messaging/import/backup acceptance and the separate unmerged financial dependency.
