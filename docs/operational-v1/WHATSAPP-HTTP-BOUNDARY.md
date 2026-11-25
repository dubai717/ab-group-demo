# Official WhatsApp webhook HTTP boundary — inactive, synthetic acceptance only

`whatsapp-webhook-boundary.ts` reuses the existing official Cloud API signature/challenge/normalization contract. It is **not registered by app.ts or server.ts**, has no environment reader and supports only disabled/sandbox modes. No provider account, phone, callback URL, secret, subscription, TLS or external sender has been configured.

The plugin-scoped raw JSON parser preserves exact signed bytes without replacing the original login/API parser. Verification returns only the numeric challenge after checking the configured token. Signed events must match configured provider account/number; unknown/duplicate/invalid binding configurations and whitespace secrets are rejected. Input is bounded to2 MB and the existing normalized1000-event limit.

A successful HTTP response requires an explicitly supplied sink to report that its transaction committed. Missing/failed/ambiguous processing is not falsely acknowledged. There are at most four actual pending sink calls; timed-out work retains its capacity slot until it really settles, rather than admitting unbounded overlapping work. Overload returns a retriable503; a five-second deadline aborts the signal without assuming that a late commit did not occur. Stable original per-message deduplication keys must be honored by the future original-message sink. No random retry, polling or sender impersonation is added. Errors contain only a reference, not payload, telephone, secret or provider error details.

## Evidence

`whatsapp-webhook-boundary.test.ts` uses Fastify injection and an explicit **in-memory contract double**, not a real provider or claimed durable database integration. It checks exact raw signatures including whitespace, configured source, challenge, original JSON parser, disabled absence, size bound, safe failures, timeout/actual capacity and invalid binding configuration. Existing outbound/window/consent/language/notice/lease/status tests are rerun.12 cases passed; current TypeScript and provider-free build passed. The sink Set in the test proves stable key delivery only, not actual persistence or recoverability.

Protocol reference checked24 November2026: [Meta webhook setup/signature/verification](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/). No archived Meta Node SDK dependency was installed. Provider-specific retries/pricing/account eligibility are not inferred from generic Graph documentation. Before live setup, verify current WhatsApp-specific requirements, supported Graph version and valid public HTTPS, and redact verification-token queries at every logging layer.

## Remaining engineering, distinct from credentials/approval

The current original `communication_messages` schema enforces channel=internal and a non-null staff sender. Inbound customer messages must not be inserted as if written by the Owner or a staff member. A reviewed compatible extension for external author/provenance, original message/event persistence and durable deduplication is still required, along with authorized matching/unmatched review, actual media handling, original conversation/Case/Task workflow, recipient-scope refresh, delivery/status history and UI acceptance. This HTTP component does not complete those requirements.

Approved official provider/number, consent/templates/use-case and real protected configuration remain external prerequisites. Owner notices currently have a tested controlled-summary formatter, not a real personal-WhatsApp delivery. No external send, original database change, historical update, activation, migration or deployment has occurred.

## Shared centre number

A new centre binding accepts a unique configured companyIds routing set. Signed incoming messages/statuses carry companyId=null and companyResolved=false; changing the routing-list order does not change original event deduplication. The old explicit single-company form stays compatible but is also marked unresolved. These are routing metadata, not proof of the legal company or user access. Outbound preparation with a centre binding requires an explicit original source company in its configured set **and** existing authorization/consent/use-case/template checks. No default legal company is chosen. Full original-source/centre-inbox matching and durable persistence remain engineering work, not completed by this contract. The latest original-communications/protocol/HTTP run passed26 cases.
