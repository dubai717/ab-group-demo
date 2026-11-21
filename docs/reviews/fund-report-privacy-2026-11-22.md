# Original fund reading and reporting — E44

Build only; no hosted DB operation, migration, financial posting, role/grant update or deployment.

## Reproduced finding

An isolated ordinary employee explicitly given only company ledger view/report/export could read another employee's fund in the original workbench. The saved before-fix assertion returned two fund IDs instead of the employee's one. This proves the source behavior, not a claim about actual hosted access or historical data.

The original funds report separately queried each fund's chart balance. The workbench did the same. Both now reuse one read-only, grouped original-ledger projection; they do not create another custody ledger.

## Behavior

- Fund management or financial-audit authority supervises funds only in its authorized companies. Otherwise the DB query returns only the actor's own funds. An explicit other-holder filter is refused without supervisory scope across the requested companies. The same projection feeds original workbench, report, CSV/Excel and print responses.
- Original posted journal / approved bank entries alone determine balances. Workbench retains its existing current-ledger semantics; period reports use the requested effective-date cutoff. Draft and later entries do not become historical held cash. AED and other retained historical currencies remain separate.
- Archived funds with held money remain visible to their proper holder/supervisor. No opening balance, ceiling, holder, entry, archive flag or previous grant is rewritten by reading.
- The original table/report shows actual company and holder names. Raw identifiers stay internal to the default report display. Source metadata is retained for original links and authorized audit/export.
- Spending, refill and count-settlement controls are displayed only for their existing permissions and proper holder/manager, with the original server checks retained. No title-derived permission or new role is added.
- Fund cash balances **exclude** collection custody, employee receivable advances and outgoing cheque instruments; summing those together would double-count or misclassify money. Comprehensive multi-source custody reporting remains a separate unfinished acceptance item.

## Evidence

- Two new native cases: own scope / export / forged holder refusal / explicit manager supervision; one grouped SQL query for three funds across two companies and currencies; archived 200 AED retained, actual 100 AED unaffected by Draft 50, 30 GBP not converted; historical cutoff, CSV/Excel/print; all entries/grants compared unchanged.
- **44 related native tests passed**, including original ledger/operational matrix, cash role guards, employee 500 actual receipt/ceiling, bank non-sales claims/task linkage and VAT workpaper. Work Amount is exercised unchanged.
- Actual original browser passed for a separate ordinary user: only their own 10 AED fund, no unauthorized cash-action buttons, actual names and no raw IDs in the fund report, AR/EN at three widths. Original role rejection and two-actor petty handover browser also passed.
- TypeScript, all 172 static/regression checks and portable runtime-graph build passed.
- The preceding E43 saved source (`e7dbd4f` / remote `68653b017d10af867501ffb49c580e64da71448f`, tree `857f10f16f5d00dc43d10dceb42c1ac49d44346d`) passed **520/520 native cumulative tests**, with no source edits during that run. These are not claimed as cumulative proof of E44.

## Remaining independent issue

The existing ledger PDF/print paths reference `ledger_print`, absent from the actual action catalog; this was found when preparing the fixture. This package does not invent a grant or silently alter existing users. A separate follow-up must align output authorization with the defined financial export permission and verify scoped non-Owner PDF/Excel acceptance. No publication or broader checklist completion is claimed here.
