# Due-only monthly plate fees and prospective amendments

Base: merged PR110, 27349d74d99cbf73111ce96e29db866ecc5ef56d.

## Behavior

New contracts on the current version-3 request workflow carry an explicit
`due_month_only_v1` marker. Registration/activation and the approved contract
remain prerequisites. Native service billing creates only the current month's
fee on its first-day due date, never the next twelve monthly invoices. The
worker can safely retry later in that same month. It does not invent missed
historical invoices. Vehicle and customer must both be Active. Finance principal
installment schedules, Cash's absence of company financing, investor rights and
independent bank contracts are unchanged.

The existing service:<month-first-day> source identity is retained. A per-vehicle
period transaction lock serializes concurrent runs; posted invoices are never
rewritten. The next twelve future fees are explicit nonposted forecasts on the
original vehicle finance tab, not customer balances, debt or accounting entries.

The existing Owner can record a prospective monthly fee amendment against a
clean, vehicle-scoped agreement document, with a reason, explicit signed-agreement
approval confirmation and revision check. Its effective date must be the first
day of a future month. Existing immutable vehicle/audit events retain before/after
values and the approving identity. The original contract and issued invoices
stay untouched. Billing and forecasts resolve the applicable version by due date;
each new invoice records its rate revision. Investor-financed fee amendments remain blocked pending independent agreement-version review; Owner confirmation alone cannot change investor rights. No implicit tax treatment is added.

## Preservation boundary

Unversioned historical contracts retain their approved original behavior and
existing future invoices. There is no automatic conversion, cancellation, credit,
historical backfill, rate change, worker activation, schema migration or permission
change. Adopting a new policy for historical contracts requires an independently
reviewed transition; this package does not claim that all legacy billing has been
converted. General recurring items, operational contracts, commissions and Work
Amount are outside this change.

## Validation

Ten current service/request tests and sixteen legacy vehicle/release tests passed
locally before the final prospective amendment addition. Focused policy/API tests
also cover forecasts without posting, future-start and zero fees, year boundaries,
one current fee, concurrent retry, signed future rate revision, stale revision,
unchanged original invoice and customer suspension. The existing actual vehicle
browser journey asserts one service invoice instead of ten future invoices,
twelve separate forecasts and prospective Owner amendment/readback in Arabic and
English on desktop/tablet/phone. Required exact-head GitHub CI remains authoritative.
No hosted customer, contract, invoice, rate or financial balance is changed during
development/testing.
