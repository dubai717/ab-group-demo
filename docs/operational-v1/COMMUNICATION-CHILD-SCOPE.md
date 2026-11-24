# Communication child company bound — uninstalled review candidate

Original messages and participant rows contain a tenant/thread foreign key, but no direct company column. The existing tenant-only policy cannot independently prevent a runtime connection from selecting those child rows by a known foreign thread ID after only the parent receives a company upper bound.

`backend/review/company-scope-communication-children.sql` adds restrictive parent-existence USING/WITH CHECK predicates to the original messages/participants tables. The correlated parent read runs with the caller's existing RLS, requires the actual tenant/thread and follows the already reviewed thread company upper bound. A SELECT-wrapped tenant function avoids repeated identity work. Existing parent and child keys support the lookup. No SECURITY DEFINER or new bypass/grant is introduced. Existing immutable-history triggers and SELECT/INSERT-only runtime grants remain intact.

The installer refuses missing reviewed prerequisites, bypass/member/owner runtime roles and an unexpected installation actor. It is not included in automatic manifests and is installed only inside an owned random localhost synthetic fixture. No deployed permissions or message data change.

This is a company boundary only. It is not a replacement for the original thread-participant/action checks, nor a complete row-level permission model. The original API still rejects a nonparticipant even when its company parent is visible. External author provenance, encrypted-body document links, general/shared templates, notification receipts, real WhatsApp ingestion and compiled all-source readiness remain separate unfinished work. No source fingerprint is repinned to imply readiness; canApply remains false.

## Evidence

`backend/tests/company-scope-communication-children.test.ts` creates two real original internal threads in two fake companies, applies only reviewed candidates in the isolated DB, checks Owner/selected/empty/unknown/foreign-tenant reads, rejects a foreign-parent message/participant insert and validates allowed inserts only inside rolled-back transactions. Update/delete remain forbidden. It compares original threads/messages/participants/grants/journals before and after. Original known-ID nonparticipant/API source restrictions are checked separately from direct company-bound SQL. `communications.test.ts` retains original scoped recipient, template-version, balance-preview and truthful internal-delivery acceptance. No external message is sent.
