# Session-aware schema gate (staging only)

## Evidence and scope

Run 42410189301's read-only diagnostic found audit_events 994 → 999 and
sessions 45 → 49, with four login audits and one logout audit. The current
login handler inserts a session and its audit atomically; logout shortens
session expiry and appends an audit. This explains that observed drift.
The final schema operation in that run reported DETAILS_WITHHELD rather than
an exposed PostgreSQL code. Do not claim those earlier diagnostic counts prove
the cause of that final exception. The controller now reports only SQLSTATE
and a fixed operation label to distinguish drift, lock and provider failures.

## Explicit table policy

- All business, balances, financial transactions, contracts, user/role/grant,
  settings and other ab tables retain exact snapshot hash/count equality.
- audit_events: every pre-backup row ID and full SHA-256 witness must survive
  unchanged. Only new user login/logout session audits with valid active
  same-tenant actors, null entity and empty field list are admitted.
- sessions: every old row must remain. Its identity/token and all other fields
  are immutable. Only expiry shortening is allowed, with corresponding new
  logout audit for that tenant/user. New sessions require exactly matching
  new login audit counts per tenant/user and bounded expiry.
- Unknown activity, missing/modified audit, deleted sessions, changed tokens,
  extended expiry, unmatched actors or permission/business drift stop the run.
- No generic transient-table exclusion. No change to RLS, grants, triggers,
  schema migration SQL/checksums, account credentials or database contents by
  this policy. Old backups are retained; a fresh backup with encrypted row
  witnesses is mandatory before applying this policy.

Witness IDs/hashes are stored only inside the existing authenticated encrypted
backup context. No session tokens, row values, identities or witness hashes
are printed. Restore must exactly reproduce the entire manifest/witnesses.

## Concurrent activity and atomicity

The gate takes the existing write-conflicting locks on all current ab tables
before comparing to the restored snapshot. Already running writers finish
before the lock is obtained; accepted login/logout deltas are verified then.
The preservation snapshot is taken after these accepted additions, so every
new audit/session row is also checked byte-for-byte across the migration.
Locks remain until all twelve approved migrations and checks commit, or the
entire transaction rolls back. Writers queued behind the lock resume normally.
Auth/Storage preservation and runtime isolation checks remain in force.

Table fingerprints, old-column row hashing and function preservation checks
are batched to reduce remote round trips during the lock. The original hash
algorithm, all old column projections and function/grant checks are unchanged;
there is no timeout increase or lock/retry loop.

## Verification

Isolated PostgreSQL tests cover a login transaction committing while migration
waits for its lock, logged-out expiry preservation, financial activity and grant
distribution drift rejection, exact batch/legacy fingerprint equality, twelve
ordered migrations, injected rollback, balances, original rows/grants/relations,
and repeated-run no-op. Unit tests cover audit tamper/deletion, session deletion,
identity/cipher changes, expiry extension, orphan login, missing logout audit,
cross-actor events, unknown audit types and missing old witnesses.

## Release

Application candidate remains f15daefd3796679d19fc0e01ff3acb679745b937;
its successful exact push CI remains 42377186819. Only the immutable controller
pin changes on protected main; no application main merge or new migration.
The native staging-owner-approval environment stays mandatory. No secret or
GitHub protection settings are changed. Fresh backup/download/restore/rehearsal
must pass again for the new attempt. A fresh drift or other schema failure stops
release; never retry automatically or weaken the comparison to get a pass.
