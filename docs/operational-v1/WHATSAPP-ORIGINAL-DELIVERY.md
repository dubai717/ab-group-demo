# Retained original delivery proof — isolated, read-only, unpublished

A new original dispatch lease captures its exact provider account, phone number, recipient and legal company inside the encrypted existing settings receipt. This is prospective only. Historical receipts lacking that binding remain unverified; no backfill or guessed customer match is performed.

The inline conversation review has a manual retained-delivery check. The GET route rechecks the active actual Owner and original thread/message and runs in a read-only repeatable snapshot. It does not contact Meta or update a message, ledger, consent or dispatch. Unknown/abandoned attempts without a provider ID cannot adopt a later event or resend.

For an accepted dispatch, statuses must match the captured provider/account/message/recipient and the original retained raw envelope/hash. Conflicting duplicates, corrupted envelopes or exceeded bounds fail closed. Wrong recipients, pre-lease dates or future dates remain review items. Existing monotonic delivery rules preserve delivered/read evidence against stale sent/failed notifications. Provider acceptance is separate from delivery/reading; none is proof of a financial payment.

Reads are bounded: 1,000 normalized status rows, 4 MiB ciphertext, 16 KiB per status, 8 MiB total distinct retained envelope ciphertext; each envelope is read once per manual check. Larger histories need an indexed source adapter rather than unbounded scans or deletion. This scalability work remains partial. No polling or external send was added.

Linked original dispatch, retained message, management API, media and reply tests passed 11 cases before the additional integrity-budget assertions. AR/EN original-dialog tests passed three widths and explicitly verified unknown evidence and a signed synthetic original read event, also after current opt-out. Final linked evidence is recorded in ACCEPTANCE.json. No hosted schema, permissions, real messages or operating data changed.

Still missing: employee-purpose authority, technical acknowledgement recovery when the original human loses access, indexed status lookup, official provider and template review, financial/document reminders, owner personal notification delivery and complete release acceptance. These are not marked complete by the local tests.
