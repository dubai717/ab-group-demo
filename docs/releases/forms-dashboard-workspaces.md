# Forms and record workspaces

Scope: existing staging application; no migrations, provider settings, secrets,
role grants, Reset or live test records.

- UAE IBAN: normalize input, enforce AE plus 21 digits and MOD-97; distinguish
  format/checksum errors in both the shared server policy and inline UI.
- Customers: use the existing authoritative emirate/area picker. Draft-only
  messages cannot imply final creation. Final save confirms server readback,
  preserves a committed ID across retry, returns to the register or opens a
  fresh form / the original customer-bound vehicle request. Failed saves retain
  input. Unsaved preview uses current values and authorized existing documents.
- Shared validation: inline messages, labels, focus and missing-field summary;
  no plaintext/sensitive browser draft storage. Three-way customer navigation
  supports the existing server draft API. Other forms keep their existing
  draft capabilities and discard confirmation; no new draft persistence is added.
- Shared non-modal record windows: draggable, resizable, maximize/restore, close,
  responsive RTL/LTR; reuse original record forms, permissions and actions.
  Bank and vehicle metadata start read-only with explicit Edit/Cancel.
- Contracting companies: six distinct form sections, responsive grouped profile,
  responsible group company clearly separated from external legal-party data.
- Related records reuse authorized original APIs. Bank book balance and paged
  posted movements use the existing finance workbench/report. Customer vehicle
  status and issued-invoice totals remain company/currency separated. Company
  relationships use existing scoped dashboard projections. Unavailable or denied
  sources display an explicit notice, never fabricated financial values.
- Existing owner View As gains searchable users and retains real server-enforced
  read-only target scope and audit. Inactive/self options cannot be selected.
- Vehicle monthly report uses recorded registration, status and sale events;
  effective dates when recorded, event timestamps otherwise. Current licence
  and emirate scope is explicit; Pending-to-Terminated is not a second exit.
  Twelve/twenty-four months, scoped drilldown and original vehicle profile.
  Existing other report datasets remain available; no financial formula added.

Validation: isolated PostgreSQL/TestAuth/TestObjects only. New browser suites are
included in the existing business-centers CI entry, each with its own fresh
synthetic fixture and rate limiter. No changes to protected delivery workflows.

Deployment: follow the existing staging CI/controller. Native protected-environment
review remains mandatory if the classifier requests it. Do not approve it on the
owner's behalf or change manual SHA variables/protection settings.
