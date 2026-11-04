# Shared emirate and area reference

## Scope and current architecture

Implemented on `feature/emirate-area-reference`, based on `main` (`8f25b79`). No `AGENTS.md` was present in the workspace. The current Node server is a static file server, not a central reference-data or user-database service. No backend, cross-device synchronization or production authorization was added in this change.

The company form now has a seven-emirate dropdown under contact/location details and a searchable area dropdown scoped to the selected emirate. The emirate select retains its legacy English values. Area search accepts Arabic, English and known aliases; the selected area is retained while searching. Changing emirate clears the area and pending new-area fields, while other company-form inputs remain intact. The area stays optional for compatibility with the existing form.

Authorized users can open **Add new area**, enter Arabic and/or English names, save and automatically select the result. At least one name is required. A duplicate selects the existing record without changing its name, metadata or source. Conflicting bilingual names are rejected instead of merging different records. New manual areas are not represented as officially verified.

## Single reference and compatibility

- `data/uae-areas.js`: the sole preloaded dataset, stable IDs, seven emirates and per-source provenance.
- `area-reference.js`: shared normalization, search, ID lookup, duplicate detection, permission checks, local append-only additions and selection validation. The company form and company emirate filter derive their emirate list from this module rather than keeping independent lists.
- Public integration surface: `createStore`, `list(emirateId, query)`, `getArea(id)`, `find(emirateId, name)`, `selection(emirateValue, areaId)` and `add(emirateId, names)` on a store. Future customers, vehicles and geographic reports must use this same reference contract and `areaId`; they must not embed copies of the area list. Those modules are not changed here.
- Newly created company records retain `emirate` and `region` for legacy compatibility and also store `emirateId` and `areaId`. The server-side equivalent must enforce an area/emirate foreign-key relationship. A forged or cross-emirate selection is rejected in the demo save handler.
- Existing company records and their location text are never rewritten. Recognized legacy location text that is absent from the seed is exposed as a separate legacy reference candidate with no invented creator/date. Unknown/non-UAE legacy emirates remain untouched in stored records and are not silently assigned to a UAE emirate.

## Seed coverage and provenance

Snapshot reviewed on 2026-11-01. **367 source-attributed entries, not an exhaustive or certified current official administrative register.** Address areas here include communities, towns and districts; they do not assert a uniform administrative hierarchy or geographical boundary.

| Emirate | Entries | Coverage/source notes |
| --- | ---: | --- |
| Dubai | 222 | Names and community numbers extracted from the public municipality-derived GeoJSON mirror described below. |
| Abu Dhabi | 26 | Communities named by Abu Dhabi Residents Office and towns/regions named by the UAE government platform. |
| Sharjah | 43 | Municipalities, district council service areas and published renamings/subdivisions. |
| Ajman | 20 | Government platform, statistical area tables and examples in the public licence-area dataset. |
| Umm Al Quwain | 25 | Government free-zone description and first-hand departmental addressing/planning statements reported by Al Ittihad. |
| Ras Al Khaimah | 19 | Named areas in the RAK government general-information page. |
| Fujairah | 12 | UAE government emirate page and municipal public licence-area records. |

Each seed record has a `sourceId`, resolved through `sources` in the data file. Source IDs are provenance, not assertions that manual English transliterations are official standardized names. Numbers in a source's explicitly published subdivision range were expanded as separate entries; no unpublished numbering ranges were invented.

Key sources:

- [Dubai municipality-derived mirror](https://github.com/martaferreirahuspy/dubai-realestate-gis): source blob `562baec8f88f680b88ea3a7586f6ea28eba87020`; the mirror attributes 222 communities to Dubai Municipality and an April 2026 snapshot. Only names and community numbers were extracted; no geometry or external code is included. This is a third-party mirror, not direct certification by the municipality. Its stated provenance must be independently reviewed before a production import.
- [Abu Dhabi Residents Office — Where to live](https://www.adro.gov.ae/Living-in-Abu-Dhabi/Where-To-Live), [UAE government — Abu Dhabi](https://u.ae/en/about-the-uae/the-seven-emirates/abu-dhabi).
- [Sharjah municipalities](https://dma.shj.ae/ar/municipalities), [district council service areas](https://sda.sharjah.ae/ar/deceased-affairs-follow-up/organize-condolence-service/organize-condolence-service.aspx). Old Suyoh/Rahmaniyah names are aliases of published new subdivisions; existing company text is not changed.
- [Ajman licence areas](https://data.ajman.ae/explore/dataset/license-in-ajman-area/table/?flg=ar-001), [Ajman statistical report](https://scc.ajman.ae/sites/default/files/publications/Ajman%20Statistical%20Report%202019%20Ar.pdf), [UAE government — Ajman](https://u.ae/ar/about-the-uae/the-seven-emirates/ajman).
- [RAK government general information](https://www.rak.ae/wps/portal/rak/about/ras-al-khaimah/general-information).
- [Umm Al Quwain Free Trade Zone](https://uaqftz.gov.ae/ar/umm-al-quwain), [reported planning statement](https://www.aletihad.ae/article/27663/2018). The second reported addressing statement is recorded under `uaq-addressing` in the data sources.
- [UAE government — Fujairah](https://u.ae/ar/about-the-uae/the-seven-emirates/Fujairah), [Fujairah municipality public register](https://rukhsati.fujmun.gov.ae/EServices/QZone/AdvertisementsTasks/AdvertisementsInquiry).

Some direct official GIS/API/PDF retrievals were inaccessible in this environment. Therefore coverage outside the accessible lists is intentionally limited; unverified neighbourhoods were not invented to inflate the count. Full coverage requires licensed/approved municipal and emirate reference feeds, a reviewed import and periodic updates. Keep obsolete official labels as aliases/historical records; do not delete or rename referenced areas in place.

## Duplicate policy

Normalization is versioned with this implementation. It handles Unicode compatibility, Arabic diacritics/tatweel, common Alef/hamza forms, yaa/alif-maqsura, taa-marbuta/haa, Arabic/Persian digits, spaces/punctuation, English articles, common ordinal variants and curated transliterations such as Jumeira/Jumeirah, Qouz/Quoz, Nuaimia/Nuaimiya/Nuaimeya and Rawda/Rawdha/Rawdah. Both names and known aliases are checked **within the same emirate**. Identical names across different emirates remain valid.

This is conservative matching, not arbitrary fuzzy merging or automatic translation between Arabic and English. Unknown transliterations cannot be guaranteed to match. New aliases and uncertain near matches need central steward review; the backend must apply the same versioned policy and a database uniqueness constraint rather than trusting browser checks.

## Local persistence and permissions — important limitation

`ab_group_area_reference_v1` stores only manual reference additions in localStorage: stable local ID, emirate ID, names, source `local-user`, creator user ID/username and creation time. The seed is not rewritten. Old application-state keys and existing companies are not migrated or changed by adding a reference area. Reads return copies and additions are append-only; there is no delete/rename UI.

**Additions are available only in the same browser profile and origin**, including later visits or another demo user on that browser. A clean browser/device does not have them. Clearing browser storage removes them. This is not a database shared across all users, not durable audit storage, and not trustworthy server authorization. Concurrent tabs can race because localStorage has no transactional uniqueness; cross-client uniqueness and attribution need the central backend below.

In the demo, an active owner or a role already granted `create_company`, `edit_company` or `manage_area_reference` may add areas. No role definition or existing permissions are changed. Permission is checked again at save time. In production, authorization must come from the authenticated server session with explicit reference-data permissions and tenant/scope rules, never from browser-supplied identities.

Invalid stored references are not overwritten. Storage errors return failure, and the UI does not claim a successful addition or select an unsaved reference. Duplicate additions do not modify the original creator/date. User/date metadata is visible in the local additions history; it is not presented as a tamper-proof audit trail.

## Central implementation required for future shared use

1. Add a database with `emirates`, `areas`, `area_names`/aliases and append-only `reference_audit` tables. Areas need stable IDs, emirate foreign keys, Arabic/English labels, source/official codes, status, canonical creator ID and database timestamp. Include tenant/group boundaries if the system hosts multiple organizations.
2. Store normalized alias keys under a unique `(emirate_id, normalized_key)` constraint (and tenant key where applicable). Use transactions to atomically check names/aliases, insert the area and write the audit record. Concurrent duplicates must return the existing area ID or a resolvable conflict, not create another record.
3. Expose authorized APIs such as `GET /reference/emirates`, `GET /reference/areas?emirateId=&q=`, `GET /reference/areas/:id` and `POST /reference/areas`. Recheck authentication, scope, names and emirate linkage server-side. Creator/time must be set by the server, not accepted from the request.
4. The company/customer/vehicle tables reference the same `area_id`. Preserve legacy text as historical/source data and migrate only after reviewing matches. Keep referenced area IDs and past names; use aliases and soft archival rather than destructive merges/deletes.
5. All clients consume one service/cache with versioning/ETags and invalidation or refresh after additions, so a committed new area becomes available to other users. Do not ship separate editable lists per module.
6. Review official source permissions and full datasets, record import version/source codes, verify new manual names as needed, and reconcile against official updates without changing historical records. Server audit must record who/when and be protected against tampering.

No central storage, APIs, cross-user synchronization, future module implementation or production deployment is included here.

## Tests

- `node tests/area-reference.test.cjs`: seed integrity/provenance, all seven emirates, Arabic/English search and normalization, aliases and duplicates, per-emirate uniqueness, creator/date, current permissions, legacy preservation, selection validation, storage corruption/failure and immutable returned records.
- `node tests/storage.test.cjs`: existing v2/v3 data preservation.
- With Playwright installed, run the app and `node tests/area-reference.browser.cjs`. `ERP_DEMO_URL` and `CHROMIUM_PATH` select a local server/browser. Screenshots go to `work/area-artifacts/`.
- Browser scenarios cover draft preservation, auto-selection, reload, another account on the same browser, a clean browser with no local additions, unauthorized users, forged cross-emirate selections, both languages and desktop/mobile layouts. Existing login/user/company/upload/filter/task flows are regression-tested separately.
