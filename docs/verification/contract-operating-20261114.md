# Contract operation UI and explicit monthly terms

Repository: dubai717/ab-group-demo only. Base: c29feca. No migration, existing invoice change, account change or historical backfill.

New monthly vehicle terms use termsVersion=2, explicit calendar_actual/full_month policy and independently computed periods. Both endpoints are included. calendar_actual divides inclusive operating days by actual days of that calendar month; full_month charges every touched month in full. Amounts round half-up to 0.001 per period and sum exactly. Displayed fractional months never multiply a monthly invoice. Older unversioned quantity/value/extras retain their original rules and payloads; no automatic conversion.

Several stable-ID services may be prepared per vehicle with amount, matching currency, application dates and monthly checkbox. One-time services produce one immutable preview line; recurring services produce separate period lines. Server validates dates, duplicate IDs, currency and recomputed totals. Contract-wide services and actual-fee accounting are part of the separate financial proposal, not enabled here.

History presents bilingual event labels, UAE timestamps, resolved staff/user names and a scalar allowlist of changes; ordinary views contain no JSON or UUID columns. Original encrypted events/API remain intact. Unknown events receive a generic readable label. Existing financial-detail permission redaction remains.

Actions reuse existing secondary button tokens (Change state style). Floating windows remain native shared components. Browser tests cover real company→contract→vehicle linking, new monthly terms, several services, readable audit, activation, independent original invoice/collection paths and AR/EN desktop/tablet/phone.

Verified locally: six server/domain tests; actual fleet browser suite with multiple services/history; TypeScript compilation. Full native PR CI is required before merge.

Financial proposal is deliberately separate: proposed 029 is outside the approved migration catalog, not applied or registered into runtime. No recurring operating invoices or fee invoices are activated by this UI change.
