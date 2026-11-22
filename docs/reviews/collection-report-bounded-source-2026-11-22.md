# E78 — Bound original collection report source reads

Build only; no hosted query, schema, permission or financial mutation.

The original collection report loaded `r.*` for every matching company's historical item receipt, including encrypted payload and unrelated fields, before filtering movement dates/currency in application memory. It now reads only nine required receipt/clearing/reversal facts from the same tables. The existing report permission, aggregation, amounts and output engine are unchanged.

The database applies the requested currency, employee, item and movement date range. A receipt is selected when its cash/transfer receipt or cheque clearing date lies in the range **or its reversal date lies in the range**. The original application-side date checks remain, so only the relevant movement is counted. This preserves a return occurring after a receipt/clearing outside the selected period. Original pending cheques still contribute no confirmed collection.

At most20001 source rows are returned; more than20000 refuses the complete report with existing `registerTooLarge` instead of silently truncating it. Narrow the selected range/company/item/employee. No new index or migration is applied. This bounds backend payload transfer; it is not a measured billing saving or evidence that AB Group caused the earlier organization-wide Egress spike.

27/27 related native tests passed: original custody/deposit/cheque/voucher/card/closing integration plus exact report grouping/output and a real PostgreSQL requested-period source test. The source test verifies the nine-column projection excludes encrypted payload, accepts a reversal with clearing outside the requested range, rejects foreign company/item/employee/currency and preserves original pending/clearing behavior.175/175 static checks, TypeScript and provider-free build passed. Local logs:`/tmp/e78-bounded-collection-native.log`,`/tmp/e78-bounded-collection-{type,static,build}.log`. Actual original collection-browser acceptance passed AR/EN, all five grouping modes, three screen widths, exact original totals, real PDF and Excel, and unchanged receipt/journal sources; log:`/tmp/e78-bounded-collection-browser.log`.

No original Supabase call, load test, balance correction, new receipt or grant, protected workflow action or delivery request. Requirement9.9 and full95 acceptance remain partial.
