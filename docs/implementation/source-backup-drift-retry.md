# Source drift investigation and one conditional staging retry

Failed protected run: 42377809674. Candidate application remains f15daefd3796679d19fc0e01ff3acb679745b937; its successful full source checks remain reusable because application code, dependencies and check workflows are unchanged.

The failed log proves: retained encrypted backup downloaded/decrypted successfully, 97 encrypted files verified, isolated database restore matched its original manifest, actual runtime TLS/authentication and no-context denial passed, all twelve SQL migrations rehearsed and rolled back with original data/balances/grants/relationships preserved. Only the final live-source equality guard failed. The log did not identify the table, so no exact user action or table is assumed.

The pinned controller now first reads the previously retained encrypted archive and compares its manifest with a repeatable-read, read-only snapshot of the original pinned test project. It logs only table names, row counts and bounded action categories; no IDs, contact/account data, values, keys, passwords or hashes. The comparison format is unchanged and shared by capture/rehearsal/source checks. A local PostgreSQL test proves compatibility with existing backup hashes.

If settings changed, only their old COPY data is extracted from the authenticated archive into a scratch table in the existing ephemeral restore container. Current source settings are read-only. Allowlisted, schema-validated ledger/customer navigation preferences can be distinguished from a fresh randomized ciphertext for the same logical preference; keys/users/values are never logged. Unknown settings or security-related changes stop before a fresh backup. This analysis does not exclude settings, sessions or audit records from the final source guard.

After an explained routine/audited change only: create a new encrypted retained backup without overwriting old archives, restore it in the isolated container, rehearse exact reviewed 014–025, compare the full original source again under locks, then apply atomically and deploy the same tested candidate. A second drift stops the transaction and deployment; no automatic retry loop, data rewrite, Reset, trigger/RLS bypass or credential/grant change exists.

Controller-entry changes on protected main may start the same protected dispatch automatically, with exactly the existing source checks, pinned target, classification and native owner-review gate. This avoids rerunning successful application tests merely to start a controller-only diagnostic. It does not grant a source branch access to secrets or waive native approval. A reviewer must still approve the new immutable controller run before provider credentials become available.

If drift repeats, retain both backups and report the changed table. Propose a short agreed quiet/read-only interval or a separately reviewed write fence; do not implement either by hiding volatile records or relaxing the equality guard.
