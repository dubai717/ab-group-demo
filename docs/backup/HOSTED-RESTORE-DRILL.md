# Hosted backup / isolated restoration drill

## Scope and safety

The one-shot workflow `backup-restore-drill.yml` runs only from `verify/backup-restore-20261104`, using the existing `supabase-test` environment. It does not deploy or invoke migrations. Its source connection is the existing administrative Session pooler URL with verified TLS and `default_transaction_read_only=on`; every source transaction is read-only. Source database roles, permissions, passwords and objects are never changed.

The existing independent BACKUP key validation and AES-256-GCM archive format are reused. Key contents, data rows, provider messages and SQL errors are withheld. The restore target is hard-coded to a fresh PostgreSQL 17 container on the runner's loopback port 5547. Restore credentials cannot be selected from a source URL. The local database lives in tmpfs and has no application server or externally published port. The runner removes that container and its ephemeral archive on completion, including failure.

## What is checked

- The BACKUP key is canonical base64, exactly 32 bytes, and different from DATA_ENCRYPTION_KEY.
- All eight existing ledger entries match approved hashes; this drill refuses any additional migrations.
- A single exported repeatable-read snapshot binds source-table digests to the PostgreSQL custom-format dump.
- Scope: ab, public, auth and storage schemas, plus bytes of objects in ab-private-test. Provider platform settings, role passwords, API keys and data-encryption keys are intentionally not included.
- Private objects are reread for concurrent-change detection; encrypted archive authentication and each component digest are verified.
- Restore uses available local extension prerequisites and local NOLOGIN roles; unsupported dependencies must fail the restoration, not be stripped to produce a false pass. Role password/LOGIN restoration and provider control-plane recovery are outside this drill.
- Source/restored table sets, row counts and row-content digests, constraints, RLS flags/policies and non-internal triggers must match. Restored document references must resolve to restored object bytes; encrypted document payloads must decrypt with the existing data key and match their recorded SHA-256.
- The isolated runtime role must see no company rows without tenant/user context. This is a clone check, not a live hosted application test.
- The source ledger is rechecked at the end. No operation in the drill writes source data; concurrent external writers cannot be ruled out by a read-only observer.

## Retention and readiness limits

This workflow deliberately uploads no dump, encrypted archive, row manifest or keys to the public repository or Actions artifacts. It proves capture/restoration only while its isolated runner exists. A successful drill does NOT establish a durable backup, a retention policy or complete hosted Supabase platform disaster recovery.

Before migrations or deployment, arrange an explicitly approved restricted archive destination, independent key custody and retention, then capture a fresh backup and retain its digest-bound restore evidence. A new storage service, settings change or secret change requires owner approval. Do not activate deployment or change the existing staging branch merely to run this drill.
