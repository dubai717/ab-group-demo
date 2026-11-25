# Customer attachment company boundary — review-only SQL

`company-scope-customer-files.sql` extends the uninstalled company/identity proposals. It is absent from automatic manifests and has not been installed on Supabase.

A customer visible through an actual vehicle/service relationship does not make that customer's documents from all companies visible. Restrictive file SELECT requires actual file company in the selected scope **and** a currently visible customer identity. File review rows inherit the same boundary. An explicit empty/unknown/foreign-tenant scope reveals no files. Unconfigured legacy scope and original Owner behavior are retained.

INSERT checks actual customer visibility, selected file company and, for a replacement, an existing visible parent with the same actual customer and company. The narrow STABLE internal Boolean lookup is needed for same-table lineage without recursive RLS. It accepts no tenant/actor/company-scope override and returns no object keys, metadata or bytes. It uses original transaction tenant/actor scope and the original identity reader. PUBLIC execution is revoked, search_path is qualified with pg_temp last, and the original privileged technical owner must already be reviewed. No role receives a new bypass bit or role membership. Installer refuses unsupported technical-owner/runtime ownership.

Original file immutability, separate scanner service, original API document authority, scan/quarantine checks and encrypted object store remain authoritative. This candidate does not grant a cross-company document permission or activate file sharing. The original profile/file controller currently retains its primary-company checks; adapting those safely is still engineering, not a completed path. Other document types, document-text indexes, generic links, exports, source namespaces and complete lineage/withdrawal/report acceptance remain open. Combined readiness is not repinned or promoted to apply.

## Local evidence

`company-scope-customer-files.test.ts` creates an owned random localhost fake database and compares original files/reviews/grants/journals. A cross-company visible identity exposes no foreign file/review; valid original lineage is tested inside a rolled-back transaction without uploading an object; forged parent/customer/company is denied. Empty/unknown/foreign tenant and accidental SECURITY INVOKER drift fail closed. Existing scanner function is still callable by the original scanner role. No source row changes survive the checks.

Documentation access: public Supabase markdown returned403 in this environment; current Supabase MCP documentation search and skill security guidance were consulted. No hosted project, advisors or configuration was changed. The native PostgreSQL test is evidence for the local candidate only.

## Dependent text/archive/link rows

`company-scope-document-children.sql` is another uninstalled candidate. It restricts indexed text/search tokens, archive events and document links to their original visible source. Links additionally require a visible target company/customer/vehicle. Its new parent-source helper is SECURITY INVOKER, with no identity change or privileged lookup. Customer-file scope uses the already scoped Boolean attachment reader; generic company documents and vehicle files use actual parent rows and original RLS.

The test explicitly seeds two synthetic text-index records (the original upload fixture does not generate them), two archive events and two original document links before installing the candidate. Own source rows remain visible; foreign text/tokens, links and archive rows disappear. Forged foreign archive and invisible link target are rejected. Valid archive action is rolled back. Every original file/review/index/link/archive/grant/journal row is compared afterwards.

Nullable-company/shared/private generic document relationships, original employee self-service/private-authority rules, full API/report/export and source namespaces remain incomplete. The SQL does not invent sharing or change nullable records. It is not a certificate of full document authorization or a deployable combined scope package.

The final focused12-case run, current TypeScript/provider-free build and162 original root checks passed. A coherent30-case linked native run including these document candidates passed before the later literal-CR parser-only fix. The40-journey UI baseline predates these SQL candidates; no SQL activation or release acceptance is inferred from it.
