# Investor interface and performance correction

Base: staging release `75bec97`; staging only. No SQL migration, new grants, secrets, balance rewrites or historical agreement updates.

## Changes and preservation

- Preview user select stays one normal field high, with the native scrolling option popup. Prefix/name/number/department/role search filters options without rebuilding the dashboard. Actual server-enforced read-only View As is unchanged.
- Dashboard data, authorized preview targets and widget preferences load concurrently. Investor metadata uses one latest-version lateral join instead of three schema/version queries per profile. Document classifications are read/decrypted once per profile, not once per card. Redundant profile readbacks were removed. Failed initial register reads stop with an explicit retry button, rather than repeatedly reloading on every render; queued initial reads coalesce. Finance writes still use live server balances.
- PDF first pages use the pinned PDF.js renderer, lazy intersection loading and at most two decoders. The existing private, scan-gated, integrity-checked file route supports authenticated byte ranges. Every range rechecks authorization. Originals stay in existing permanent encrypted storage. No public thumbnails or persistent browser cache. Large-file test verifies that a first-page card transfers less than the complete 1MB PDF; some PDFs can need more ranges depending on their structure. Small PDFs naturally fit in one range. The server still verifies the original encrypted object in full before serving bytes; this deliberately retains integrity protection.
- Image cards load only near the viewport. Local upload PDF previews reuse their canvases during progress updates. Clicking a preview opens the full original; errors leave the PDF badge and original view/download usable.
- Forms capture their final initial state, and clear dirty state after confirmed saves/readbacks. The staged upload queue participates in dirty tracking. Partial upload/readback failures retain the form and upload/link identities; retry does not recreate the investor. Close and repeated submit are blocked while saving.
- New agreement forms omit recovery priority and both repayment eligibility dates, retaining effective date, signed document, fixed registration fee and investor share. Missing retired API fields are valid. Legacy clients can still explicitly supply historical-style instructions; immutable old versions and financing snapshots are untouched.

## Financial compatibility boundary

The existing collection engine actually uses recovery priority to divide installments and the two dates to determine payout eligibility. Removing visible fields alone would let an amended version inherit old agreement-level values. New simplified version snapshots explicitly freeze `principalRecoveryMethod`, `capitalReturnFrom`, and `returnsDueFrom` as null, tagged `collectionPolicy=explicit_records`, overriding those old parent defaults only for new financing.

No principal-first/proportional allocation, yield, repayment date or payable is invented. Actual receipt records and fixed registration-fee accruals remain visible, but the existing payout/release guards fail closed when distribution/eligibility instructions are absent. This release does **not** introduce a replacement manual classification or date-free payout authorization policy. Before payouts under such new simplified versions, the owner must approve a separate documented classification/eligibility workflow. The form explains this consequence. Existing financing retains its original calculation and payout behavior. No historical balances are recalculated.

## Measured performance

Both revisions used isolated synthetic PostgreSQL fixtures, 100 investors and eight private PDFs. These are local measurements, not claims about Render latency. Server timings: median of seven warm HTTP-injection samples. Chromium: five navigation-and-refresh cycles at 1440×1000 with an artificial 150ms delay per API request; same fixture shape and 500KB upload.

| Operation | Before | After |
|---|---:|---:|
| Server investor register median | 207.24ms / 327 queries | 56.17ms / 27 queries |
| Server investor profile median | 204.41ms / 42 queries | 64.30ms / 35 queries |
| Server dashboard median | 34.52ms / 47 queries | 40.70ms / 47 queries |
| Browser dashboard refresh | 676.8ms | 328.7ms |
| Browser investor register navigation + refresh | 619.3ms | 466.1ms |
| Browser investor profile open | 825.8ms | 394.4ms |
| Browser 500KB upload + profile link, one sample | 691.0ms | 610.2ms |

No server-side dashboard improvement is established; its browser gain comes from concurrent requests. Upload timing is a single sample and does not establish a stable throughput improvement. Document lazy loading reduces navigation transfer and decoding work. No new database index was needed: latest-version lookup uses the existing investor/revision index. All authorized name metadata is still fetched as a complete snapshot for existing cross-column filters; document bytes are lazy. This is not a claim that arbitrary large registers or every ERP module are fully optimized.

Reproduce sequentially (these scripts create and clean only random isolated synthetic databases):

```
node --import tsx backend/tests/investor-performance.mts sample
node backend/tests/investor-navigation-performance.cjs /absolute/path/to/revision sample
```

Results are written to ignored `work/` JSON files; fixtures require the existing isolated local test PostgreSQL configuration. Do not run fixtures concurrently on the shared test cluster. No hosted test investors or financial rows are created.

## Verification and publication

Regression coverage includes simplified/legacy versions, preserved original ciphertext, frozen absent instructions, conflict/fee validation, authenticated byte-range integrity and denial, invalid ranges, real large PDF first-page transfer, thumbnail failure with full-original fallback, partial-save retry and rapid submit/close, clean dismissal, and Arabic/English desktop/tablet/mobile views. Existing 50/100 financing, capital, collection, payout, restoration and permissions tests remain mandatory. Native GitHub owner approval remains required whenever the protected delivery policy classifies the candidate as sensitive/unknown. Live deployment must be checked against the final merged SHA and protected smoke evidence before claiming publication.

### Backup test correction discovered by merged-push CI

Merged-push run `43209176387` stopped before any deployment: 338 of 339 backend tests passed, and the investor restore test rejected a valid encrypted envelope because its Base64 happened to contain the five letters `PGDMP`. The test had treated absence of this short marker as encryption evidence. Base64 of a random IV/tag/ciphertext can contain that marker, so the predicate produces false failures.

A test-only follow-up replaces this predicate in all four restoration suites with independent AES-256-GCM authentication/decryption through Node crypto, canonical envelope checks and exact database/hash comparison. Existing wrong-key, tamper, private-object byte equality, isolated PostgreSQL restore, original-row, RLS and grant checks stay in place. A deterministic fixture has a valid authenticated IV whose Base64 starts with `PGDMP`; it restores exactly and proves why the old predicate was wrong. Plaintext JSON and Base64-encoded plaintext, wrong keys, changed IV/tag/ciphertext and wrong database content are rejected. Production encryption, backup format, restoration code and deployment workflow remain unchanged. No failed check is skipped or blindly rerun.
