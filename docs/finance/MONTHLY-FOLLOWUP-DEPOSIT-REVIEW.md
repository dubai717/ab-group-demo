# Monthly follow-up and verified deposit allocation

This review branch starts at staging commit `f878bdc`. It extends the catalogue, legacy follow-up engine, custody handover and bank evidence workflow already present there.

- The company's `monthly-followup` approval gates issuance. Each rule maintains an effective history and one child item per base item. Close uses Dubai dates and issues separate documents for each customer, base item and month. A rerun is safe, including during transition from the legacy rule. The scheduler considers the latest completed month.
- The `priority` approval governs automatic allocation. The list contains the items selected by the administrator, in priority order. The staff form supports direct allocation to an item or an invoice. Confirming the preview locks its meaning for receipt creation.
- On companies approved for `deposit-allocation`, receiving cash records custody and saves the allocation. Verified matching bank evidence posts that allocation in the same database transaction as deposit confirmation. A delegated depositor can handle the assigned custody, see the designated deposit account and complete that operation using bank-bound evidence. Standard account and customer permissions remain in effect.
- A deferred receipt must be deposited in full. A receipt can itself cover part of the outstanding customer balance. A changed allocation at deposit requires reconciliation before posting.

Synthetic PostgreSQL acceptance covers Dubai month boundaries, separate invoices, zero balances, threshold and effective revisions, replay, legacy overlap, priority, manual selection, wrong deposit account and restricted depositor access. It also covers the AED 200 collection against AED 300 outstanding, including custody handover, PDF proof readback, AED 100 remaining after deposit and repeated confirmation. Hosted acceptance follows the protected staging workflow for the exact reviewed SHA.
