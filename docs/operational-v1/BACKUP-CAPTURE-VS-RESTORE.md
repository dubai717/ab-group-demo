# Capture availability is separate from restore proof

The original `AB-BACKUP-STATUS-PAYLOAD-1` format still strictly requires a successful database restore test. It is not weakened. A distinct signed `AB-BACKUP-CAPTURE-PAYLOAD-1` format can report a captured artifact without a restore test. That format requires database/Auth-login/Storage-service restore flags to remain false and refuses an invented restore-test date or unknown fields.

The bounded Owner reader distinguishes both payloads with the same public-key signature, project/tenant/path/clock/private-bucket/presence/size checks. An untested newer capture no longer hides a bounded older drill: it continues scanning at most four folders. Every record keeps its own capture and test evidence; an older drill never certifies the newer archive. No archive or encrypted-metadata GET is performed, and no polling, scheduler, capture or restore is added.

The current Owner dashboard shows the newer capture as explicitly not restore-tested and preserves the older recorded database test separately. Current checksum, complete backup inventory, independent retention, Auth service recovery and Storage service recovery remain unverified. Failed/foreign/unavailable status is not presented as absence of backups or successful recovery.

31 linked tests passed across signature/source/API, cadence, encrypted durable spool/cross-process claim and original independent synthetic dump/restore. The actual AR/EN dashboard journey passed at 1440/768/390, including error reference/retry, no automatic reads, stale response suppression, staff exclusion and separate capture/drill labels. Original operating data and provider configuration were not touched. The fake restore copy is an owned disposable database, not Supabase or operating restoration.

Still pending: approved independent destination/retention, protected capture/scheduler/alert integration, durable hosted storage, current real backup inventory and compatible hosted Auth/Storage recovery. No claim of a recent production backup or transfer readiness is made.
