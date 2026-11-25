# Official WhatsApp durable technical ingress — inactive, unpublished

The HTTP boundary can now be tested against a real PostgreSQL receipt store instead of only an in-memory sink. `backend/src/whatsapp-ingress-store.ts` is not registered or instantiated by the original application/server. It accepts only explicit sandbox configuration and an existing explicitly supplied processing principal; current implementation requires the original Active Owner authority. It neither creates a service/user role nor chooses a principal automatically. Reviewing the eventual integration principal remains a prerequisite to activation. `received_by` records technical processing, never the customer's authorship or staff reply attribution.

`backend/review/whatsapp-ingress.sql` is an uninstalled technical proposal excluded from migration manifests. Its two subordinate transport receipt tables do not form a second conversation UI or ledger. Original conversations/messages remain unchanged. Tenant/Owner/active-work RLS protects the encrypted records; PUBLIC/anon/authenticated receive no access. Runtime gets append/read only, with original immutable-history triggers and a real-recipient processing FK. No privileged function or bypass grant is added.

After official raw-byte signature/account/number validation, the boundary passes the original bytes and their hash to the sink. Each normalized event receives its stable provider key and a hash of canonical **original provider event content**, including captions, filenames and unsupported-message details. The exact original envelope is encrypted once for a newly accepted batch, preserving unmodeled details. It is not repeated for every event. A deferred FK and one original transaction ensure every new event has its original encrypted envelope before commit. Duplicate/rebundled/formatted deliveries with identical content create neither extra events nor unused envelopes. Changed content under an existing provider key is refused for review without overwriting history. Routing configuration changes do not silently reroute the first saved event.

The existing5-second HTTP deadline/capacity behavior remains. Store statements/locks have4/3-second bounds; aborted/failing work rolls back. Only a completed transaction permits HTTP200. Response-loss retries recover the same durable keys. No text/phone/secret appears in error responses. Media identifiers and the original envelope are retained; media bytes are **not** claimed downloaded or restored. Shared-centre routing remains unresolved as to legal company; hints grant no authority.

## Acceptance

`backend/tests/whatsapp-ingress-store.test.ts` uses a newly owned random localhost fixture and the actual signature parser, HTTP boundary, crypto and PostgreSQL transaction. It verifies concurrent/reformatted retries, encrypted exact original bytes, canonical-content conflicts, late batch rollback/retry, source user/grant/journal/message/thread parity, wrong tenant/actor denial, envelope-hash validation and abort. It also encrypts a real synthetic PG dump with the original backup archive format, restores only to a newly created owned `ab_restore_<uuid>` database, compares both transport tables and object bytes, and checks restored FORCE RLS/runtime denial. The original source database is not restored or replaced. Optional native test tools are restricted to localhost/owned DB names; Docker remains CI default.

The coherent27-case run includes original internal communications, Meta protocol/outbound suppression and actual HTTP boundary acceptance. TypeScript and provider-free build are recorded separately. No actual provider call, hosted schema/data write, financial movement or live restore was performed. Synthetic backup success is not proof of a current hosted Auth/Storage independent backup or retention schedule.

## Remaining before real integration

- Approved provider/number/use case, secrets and live endpoint/processing principal review.
- Verified existing customer/company/source matching, durable external-author extension of the **original** message model and real participant/recipient authorization.
- Official media download/scanning/storage, original delivery/read-state matching, notification fan-out and Owner WhatsApp notices.
- Actual consent/templates/window, reminder scheduling, outbound durable dispatch and final integration acceptance.

Queued receipt is not an opened conversation, a resolved complaint, a collected payment or a notification delivered to the Owner. No actual send is enabled.

## Bounded sandbox acknowledgements

The original sandbox dispatcher now bounds provider acknowledgement bodies at64KiB using both declared size and streamed bytes. Oversized, malformed or interrupted responses retain unknown delivery and the original message lease; no automatic retransmission or fabricated success.16 linked protocol, HTTP and durable-ingress cases passed, including the original encrypted local archive restore. The native test adapter was required because the existing Docker exec temporary area is full; no hosted cleanup or restore occurred. TypeScript and provider-free build passed. This remains inactive and does not prove a real provider connection, original external-author thread integration or customer delivery.

## Exact envelope-to-event binding

The inactive sink now verifies the complete normalized event set against its retained original envelope before acknowledging a commit. Event identity, actual author, timestamp, type/text, media/context references and delivery status/error code must match original provider facts; omitted or repeated normalized events refuse. This supplements the existing exact-envelope checksum and HTTP HMAC boundary; the sink alone does not claim to verify Meta signatures or approved routing configuration. Configured company hints remain unresolved and manual source linkage is still required.

Twenty-four linked protocol/HTTP/ingress/original-text/media cases pass. Ten explicit mutation/omission/duplication variants roll back all technical event/envelope rows, including a mismatch after an earlier event insert. Existing rebundled signed retries, unresolved shared-centre routing, changed-provider-content conflict, actual-author linkage, isolated restore and original money/permissions/history checks remain. TypeScript/build and189 root cases pass. No real provider, phone, message, hosted schema or operating database was used. Original media attachment storage and outbound integration remain incomplete.
