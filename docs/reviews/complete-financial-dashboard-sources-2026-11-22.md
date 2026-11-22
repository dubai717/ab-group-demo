# E81 — Complete original financial dashboard count navigation

Build only. No financial source, count formula, backend endpoint, permission, theme or financial workflow change.

The existing financial control dashboard used the explicit source-selection/reset path for Pending vouchers and Review deposits, but ordinary tab navigation for receipts, open custody and cards. Those three tabs preserved unrelated prior table conditions/search. A real browser reproduction opened the receipt count1 after an old impossible filter and received0 rows.

All five existing dashboard count buttons now use the same original `FinancialTables.selectSource` path. Receipt/custody/card counters reset only their target source to the complete original authorized view and clear unrelated search. Voucher/deposit counters retain their exact Pending/Review filters. Ordinary tab navigation continues to preserve existing table state. The receipt tab retains its original async load and form/draft behavior. No source counts, collection attempts, invoices, ledgers, custody moves, card ownership, private-source rules or grants are inferred/changed.

Actual browser before correction failed at0 versus1. After correction, Owner and scoped reader passed AR/EN, numeric/text filters, old search, original complete print count, empty scoped results, three screen widths, forbidden other-company read and unchanged source IDs/custody/journals/rights. The original Pending-voucher/Review-deposit drilldown browser also passed.175/175 static checks and provider-free build passed.

Logs:`/tmp/e81-dashboard-before.log`,`/tmp/e81-dashboard-after.log`,`/tmp/e81-dashboard-original-regression.log`,`/tmp/e81-dashboard-{static,build}.log`. No native backend test is added because no backend query or financial behavior changed. This is acceptance of these five original financial-control counters, not every system dashboard or all95 requirements. No protected delivery requested.
