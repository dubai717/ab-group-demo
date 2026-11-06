# Cancellation plan — new clean project (no deletion performed)

Target ONLY: `ab-group-erp-clean-test`, Project Ref **rdsqerenobigacmetryv**. The older spelling ending `metrvv` was wrong; do not use it to identify a deletion target.

Render's actual `/api/release` still reports original staging SHA `4a162b926352208b85cf53a8d9d4f0c3ecc20841` and the original approved Supabase project-origin hash. Current staging delivery uses `supabase-test`. New-project Actions were read-only connection checks on dedicated verification branches using `supabase-clean-test`, not operational deployments. No running new-project jobs were found during this review. No known Render/ordinary delivery dependency on the cancelled project was identified. This does not enumerate arbitrary external integrations outside these inspected resources.

Inventory to verify and remove only AFTER separate final deletion approval:

- GitHub Environment `supabase-clean-test`, containing `MIGRATION_DATABASE_URL` as reported by the owner. The connector cannot enumerate administration-only Secret metadata; manually check for any later additions before removing the environment.
- Any NEW-project Publishable/Secret/legacy keys, saved new-project database password, test Owner credential and project-specific URLs in the owner's secret manager. Project deletion invalidates project-bound services/keys; do not rotate or remove old-project keys by mistake.
- The new project's `ab-private-test` bucket and its own Auth Owner/schema, as part of deleting that project. This identically named bucket is **not** the original project's backup bucket.
- Retire/disable new-project verification entrypoints before deletion so no job is running or waiting. Preserve code/PR/branch history and past logs; do not rewrite old work.

Deletion sequence after explicit approval: verify target name/ref and dependency inventory; stop pending checks; remove the NEW environment/secrets; delete the NEW project using Supabase dashboard Project Settings → General; verify original Render release/Owner/old backup access afterwards.

Dashboard target: https://supabase.com/dashboard/project/rdsqerenobigacmetryv/settings/general

Never remove `supabase-test`, its `BACKUP_ENCRYPTION_KEY`/`DATA_ENCRYPTION_KEY`, old database, old private bucket/backups, Render credentials/deploy hook, Pages or production settings. No project, Secret, Environment, bucket or account has been deleted in this task. No management access is available to perform the project deletion automatically; it remains an owner-controlled future action after approval.
