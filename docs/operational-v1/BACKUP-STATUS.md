# Owner backup status — technical evidence, not a current backup certificate

Independent branch only; default disabled. No hosted read, real backup, original-database restore, schedule, secret/configuration change or deployment was performed.

The original protected backup-restore drill can emit an optional small Ed25519-signed `status.absig` companion **after** the original encrypted archive and metadata checks succeed. Existing encrypted formats and protection gates remain unchanged. The companion contains technical source/organization/hash/size/test facts, never customer records, provider credentials or recovery keys. It is signed technical metadata, not an encrypted data archive. All recognized retained companions are excluded from subsequent capture using the original retained path policy.

`backup-status-proof.ts` verifies strict payloads with a public key alone. Optional `BACKUP_STATUS_SIGNING_KEY` belongs exclusively in the protected backup job. Runtime receives `BACKUP_STATUS_PUBLIC_KEY`; it does not consume the encryption key or signing private key. Disabled unless `BACKUP_STATUS_ENABLED=true` and the public key are supplied. A separate storage project requires an explicitly supplied separate credential. Source credentials are not reused for another project. None of these settings have been installed.

`backup-status-source.ts` checks the private bucket, lists at most four folders, reads at most 16 KiB per companion and uses HEAD only for matching archive/metadata presence and archive size. No archive or encrypted metadata GET, recursive inventory, polling or automatic retry. Overall deadline 10 seconds, per-organization concurrent-read deduplication, bounded transport and strict source/tenant checks. Legacy/mismatched records reveal no foreign dates, paths or counts. The bounded scan is not a complete inventory.

Owner-only GET `/api/system/backup-status` rejects employee/view-as access and query overrides before the provider. DTO whitelisting strips additional secrets. Failures return a safe error with the original request reference. An unconfigured source does not mean no backups exist.

The collapsed Owner dashboard section reads only after an explicit click, displays UAE dates and bilingual evidence, and guards stale session/context replies. It separates recorded database restore testing and capture hashes from current checksum verification, Auth service login and Storage service restoration. Same-project storage is explicitly not independent. No restore, capture or download actions are offered.

Incomplete: current real backup inventory and recoverability evidence; schedules and retention; independently managed encrypted file storage; complete Auth/Storage service restoration; external configuration and final isolated release acceptance. Synthetic technical proofs do not complete these requirements.

Reproduce: TypeScript/build; `backup-status.test.ts`, `backup-status-api.test.ts`, original private-store/source-capture tests; `serve-backup-status-fixture.ts` + `backup-status.browser.cjs`. Keys are ephemeral, providers simulated. No original database operation. See BUILD-STATE.json for actual current results.
