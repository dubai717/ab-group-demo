# Monthly follow-up and verified deposit allocation

This review branch starts at staging commit `f878bdc`. It extends the catalogue, legacy follow-up engine, custody handover and bank evidence workflow already present there.

- The company's `monthly-followup` approval gates issuance. Each rule maintains an effective history and one child item per base item. Close uses Dubai dates and issues separate documents for each customer, base item and month. A rerun is safe, including during transition from the legacy rule. The scheduler considers the latest completed month.
- The `priority` approval governs automatic allocation. The list contains the items selected by the administrator, in priority order. The staff form supports direct allocation to an item or an invoice. Confirming the preview locks its meaning for receipt creation.
- On companies approved for `deposit-allocation`, receiving cash records custody and saves the allocation. Verified matching bank evidence posts that allocation in the same database transaction as deposit confirmation. A delegated depositor can handle the assigned custody, see the designated deposit account and complete that operation using bank-bound evidence. Standard account and customer permissions remain in effect.
- A deferred receipt must be deposited in full. A receipt can itself cover part of the outstanding customer balance. A changed allocation at deposit requires reconciliation before posting.

Synthetic PostgreSQL acceptance covers Dubai month boundaries, separate invoices, zero balances, threshold and effective revisions, replay, legacy overlap, priority, manual selection, wrong deposit account and restricted depositor access. It also covers the AED 200 collection against AED 300 outstanding, including custody handover, PDF proof readback, AED 100 remaining after deposit and repeated confirmation. Hosted acceptance follows the protected staging workflow for the exact reviewed SHA.

## Accounting item catalogue review

The catalogue opens from the chart of accounts and items. Item details show the related entitlement and fee records. Catalogue viewing uses the existing company ledger view. The proposed schema change registers separate create and edit/remove grants. The existing item manager grant retains its current capabilities. For a shared item, editing or removing it requires rights in every mapped company.

The new month-end rules use twice the configured monthly due as an inclusive threshold or a separately configured balance as a strict threshold. The fee amount is independent. Stored legacy conditions keep their original meaning. The item and its monthly rule are saved in one transaction. Existing company financial approval still controls issuance.

`supabase/proposed/026_accounting_item_catalogue.sql` requires separate schema review before hosted use. It supports assigning the new grants and removing unused items. Until then, the server reports the missing database capability on an unused-item removal request. The isolated test applies the proposal only to disposable PostgreSQL.
