# Statement line parent scope — uninstalled review candidate

`company-scope-statement-lines.sql` adds a restrictive policy over original FK-only statement lines. An explicitly scoped runtime must see the actual original statement and any referenced original entry. `USING` hides foreign rows; `WITH CHECK` also rejects moving a visible line to a hidden statement or entry. It does not create a privileged function, grant a role/membership, change balances or define a second reconciliation system. Existing original tenant/active-user policy, grants and controller date/account/amount/approval checks remain.

Original unconfigured legacy scope and Owner behavior remain. Explicit empty/unknown/foreign-tenant contexts reveal no lines. The original technical owner and non-bypass runtime are required; no privilege repair is attempted. The candidate is excluded from automatic migration manifests and all hosted systems.

## Local evidence

`company-scope-statement-lines.test.ts` uses an owned random localhost synthetic database. Statements and evidence are created through the original bank-statement APIs; two **unapproved Draft** journals provide original source entries without posting, bank settlement or external movement. Original company2 lines disappear for a company1 scope; hidden UPDATE returns zero rows; forged INSERT, statement reassignment and entry reassignment fail42501. Visible edits are tested only in rolled-back transactions. Statements, lines, entries, journals and grants are byte-for-byte row-compared after the checks.

This passed with original attachment-child/readiness tests in one4-case run. No readiness pin is promoted; canApply remains false. Shared/personal-Owner statement rights, remaining financial FK children, original workbench/report/export acceptance and combined source/privacy review remain engineering work. The test is a company boundary check, not approval or proof of bank reconciliation.
