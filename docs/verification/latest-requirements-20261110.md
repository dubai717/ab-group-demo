# Latest requirements verification — 10 November 2026

Baseline: staging `18cc30c710d7ae223a334db70a6c3e72f03d44bf`; protected main
`bf8abf2e29e847f55e6538bd45588ecfb0d0b210`. The local startup checkout was
`e6f4819` and was not used as the implementation baseline. Open legacy draft
PRs #6–#9 are superseded by integrated staging code and were left unchanged.

Actual prior publication evidence: protected dispatch 42595449160 completed
successfully. Its release job verified exact staging SHA/project/public app;
smoke passed public browser and CSS byte checks; finalize recorded deployment
7651509427 as successful. Source CI 42593798341 passed. This session's direct
Render request is blocked by the environment proxy's destination policy (403),
so current provider state is not independently asserted from that request.

## Requirement findings and candidate changes

- Bank creation / IBAN: existing shared format/MOD-97 normalization, canonical
  create/readback and reserved synthetic routing generator already implemented.
  Reused them; no new seed, migration or live test account. Existing isolated
  bank browser passed. Extended synthetic generator validation through the same
  production policy for 100 identifiers.
- Collection contacts: existing invoice-linked tasks, delayed reminders, immutable
  encrypted attempts and no balance change from a reported payment already
  implemented. Added explicit failed SQL UPDATE/DELETE and HTTP PATCH/DELETE
  checks with unchanged history. Display localized outcomes and Dubai dates.
- Funding / PRO: existing approval-center adapter and authoritative funding
  decision, disbursement and receipt remain. Added explicit initial assignment
  to the canonical `vehicle_registration` task/source key; reuse existing
  personnel reassignment, permissions, company membership, task notifications
  and source-completion checks. No completion from approval/disbursement alone.
  No new grant or implicit PRO authority. Registered requests cannot create a
  replacement task. Existing follow-up cannot duplicate this source key.
- Buttons/labels: wrap action buttons and form labels at narrow widths; desktop,
  tablet and phone tested in Arabic and English.
- Raw audit: ordinary bank/user pages no longer render raw tables; customer
  and vehicle activity shows event metadata without JSON snapshots or raw audit
  download controls. Server history, export endpoints and rights remain.
- Employee dropdown: existing searchable actual-user dropdown and real read-only
  View As already implemented. Re-ran search, scoped navigation, write denial,
  stop/return and responsive browser coverage; no duplicate preview system.
- Dates: shared date-only DD/MM/YYYY and timestamp DD/MM/YYYY HH:mm in Asia/Dubai;
  preserve machine/input/filter values. Collection follow-up input explicitly
  names Dubai and converts with +04:00 independent of browser timezone.
- Vehicle statuses: scoped full-source aggregate before pagination and status
  column filtering; cards for all/Active/Pending/Terminated above register,
  company and current trade-licence filters and click-to-filter/reset. Counts
  obey other search/grid filters and never include unauthorized companies.

Local verification of the candidate: 170 unit/controller cases and 17 targeted
server cases passed; forms/customer, bank-IBAN, new status/PRO/audit and
movement/View As independent Chromium suites passed. Build passed. Full server
and exact GitHub source checks must finish before merge/publication is claimed.

Delivery: PR #56 independently contains only ordinary bank raw-audit visibility
and responsive CSS. Remaining candidate contains a new guarded task endpoint
and unknown presentation boundaries under the existing immutable classifier;
its native owner-review gate must be retained. No classifier, workflow,
protection, credentials, role grants, hosted SQL or provider settings changed.
