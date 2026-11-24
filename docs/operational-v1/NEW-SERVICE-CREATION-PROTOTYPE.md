# Original new-service creation — isolated acceptance only

The original vehicle and residence/general request creators now expose one trusted server callback after original authorization/field validation and existing request replay, but before consuming a number or inserting a new request. Draft submission reuses these original creators. No new request, task, ledger or permission subsystem is introduced. `server.ts` does not provide the callback; ordinary behavior is unchanged unless a trusted build caller explicitly supplies it.

`isolatedNewServiceEligibilityGuard` can run only in an exact random `ab_backup_<32 hex>` database. It refuses an operating database name before reading financial sources. Its explicit effective date is a synthetic test configuration, not live activation. It uses the actual-actor purpose source, original allocation/adjustment helpers and approved last-two-actual-due-month rule. Source reads use one bounded stable SQL snapshot; the original strict read-only repeatable-read review adapter remains separate. A missing/incomplete source requires review, never an allowed fallback. No Owner impersonation, new role, historical balance modification or external action.

## Verified original paths

- Original Cash vehicle request, residence renewal and free general request are refused at the threshold, before request/task/financial/dedup creation. Setting requiresApproval=false cannot bypass this check or original mandatory Owner review.
- An actual scoped employee with original service permissions is refused for arrears while the ordinary ledger API remains forbidden; no finance-view grant is manufactured.
- The same guarded app still accepts settlement through its original invoice-adoption/receipt path, exclusively on synthetic data. Fresh source then permits original service creation. Creating the free service or Cash request adds no invoice, receipt or journal.
- A later unclassified manual loan requires review. Retrying a previously saved general request still returns its original identity instead of creating a duplicate or treating replay as a new service.
- Arabic/English original draft→submit UI retains company, subject, description and zero fee after actual409 refusal, shows a localized message/reference, keeps controls usable and prevents duplicate submit. Three screen widths pass. No optional approval checkbox reappears. A saved draft remains distinct from a submitted service request.

The15-case linked policy/source/prototype set, final native creation case, TypeScript/provider-free build and focused bilingual browser pass on their documented source points. The operational browser runner includes this as journey49. Earlier48 acceptance remains its own baseline.

## Still incomplete

This is **not a deployable live service policy**. Approval and execution hooks, verified grandfathering of already-started services, explicit timed Owner exceptions, authenticated activation/effective-date evidence, final source/dependency compilation, minimal worker amount/reason/collection-link UX and full prospective concurrency/rollback acceptance remain engineering work. The production/staging server has no callback configuration and the source SQL is an uninstalled proposal. No protected receipt, settlement, deposit, document, complaint or existing-service path is hooked. The requirement remains partial, not published or approved for activation.
