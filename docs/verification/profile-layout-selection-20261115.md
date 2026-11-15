# Record selection and grouped profiles — 15 November 2026

Scope: dubai717/ab-group-demo, staging only, based on deployed PR90 (52c6745). No backend, SQL, financial, role, membership or deployment-policy changes.

## Implementation

- Native multiple selects retain their original names, values, FormData, validation and server save paths. Accessible labelled checkboxes provide independent click/Space toggling without Ctrl/Command. Search, selected counts and filtered bulk select/clear retain hidden selections. Disabled controls stay disabled; search-only controls have no submitted names.
- Shared RecordLayout sections, value grids and node-moving form groups reuse AB Group tokens and original controls/listeners. Explicit employee/vehicle groups skip the older automatic layout heuristic. Tablet/phone employment fields use one column when the sidebar leaves insufficient space; larger screens use two/three columns. Add-unit/position actions remain beside their original fields.
- Employee personal, identity, passport, residency, work permit, employment, contact, qualifications and other-document sections use original scoped metadata, authorized private fields and read-through login documents. Original photo, phone/WhatsApp links, versions, financial tabs and floating windows remain available.
- Customer identity/permit details show their own current file cards, authorized lazy previews and existing view/download actions. Customer editor identity groups display existing related documents. Vehicle registration and insurance groups display their corresponding files, with remaining documents grouped separately. Read-only vehicle controls stay disabled while permitted document viewing remains usable.
- Existing company/bank/modal fieldsets share the border/title treatment; detailed regrouping starts with personnel, customers and vehicles as requested. Other business forms and financial workflow semantics remain intact.
- All previews reuse the existing scan-gated adapters and AttachmentViewer's intersection-based queue (at most two decoders). No document movement, copies, bulk reclassification or stored revisions are introduced.

## Validation

Browser coverage extends existing independent synthetic PostgreSQL/Auth/storage/scanner fixtures: click/Space multi-selection, counts/search/bulk, narrower security scope saved/reopened, three work companies and units, readable controls at desktop/tablet/phone widths, retained inputs, initial employee files/legacy originals, actual PDF first-page previews and byte-identical downloads in customer and vehicle grouped profiles. Existing schema-unavailable journeys remain covered. Arabic/English, light/dark, record save/reopen and existing vehicle activation/invoice journeys remain part of the original suites.

Build/runtime import graph, stylesheet parsing, original demo tests and exact-head native CI are required. Deployment must use the existing human staging-owner-approval gate; no Production publication is authorized.

Local results: build/import graph PASS; original demo tests 143/143 PASS; CSS parse PASS; source integrity 281 reviewed files PASS; personnel + independent directory browser PASS; customers/vehicles schema-unavailable browsers PASS; full-schema customer browser PASS including actual grouped PDF preview/download byte comparison; full-schema vehicle + independent funding-review browsers PASS including grouped ownership preview/download and unchanged read-only edit state; original user-save browser PASS. Responsive employee screenshots inspected at 768px and 390px.

Native CI confirmed 170/170 demo checks and 362/362 server checks plus full customer/vehicle/personnel browser suites. The workspace test waits for the rendered sorted register before opening it. Each language now owns a fresh local DB/Auth/storage/rate limiter, following the existing independent-provider pattern: the old combined journey reached 293 requests before English vehicle navigation and then received 429 responses from the unchanged 300/minute guard. Both independent locale journeys retain all navigation/export/permission assertions and explicitly reject any HTTP 429 or unexpected dialog. The test-only port is restricted to loopback ports 3360/3361; no cloud bindings, server protection, production code or workflow configuration change. Local result: six cases PASS with zero throttled requests.

Bulk actions use an explicit half-row flex basis with the count on its own row, so Select all and Clear all remain adjacent above the list at narrow widths. Actual security-scope UI assertions verify matching button rows and no body overflow at 1440/768/360px; the complete independent personnel-directory journey passes after this CSS refinement.
