# Explicit reset to the assigned job standard

Build/review only. No hosted data, rights, migration, merge or deployment changed.

The reset action extends the original Owner permission review and reuses its pre-model permission mutation lock, original roles, direct grant rows, encrypted denial book, company overrides and dashboard restrictions. A separate concurrency regression confirms that the existing lock already rejects one of two approvals from the same original revision; it was reused rather than replaced.

An account must already have an explicitly assigned managed standard linked to an active recorded position. Owner/self targets, an unassigned standard, active downstream grants and unknown legacy company overrides fail closed. The reset never infers a role from an HR position or changes the assigned role, company/unit access scope, employee profile or financial records.

Fresh review includes original direct grants (including bank permissions), individual denials, company overrides, user dashboard restrictions and the current standard. A reason and confirmation are mandatory. The hash binds user revision, permission version, reason, user and standard dashboard versions. Removing user dashboard restrictions stores the original neutral restriction, so existing role restrictions and domain/RLS permissions remain authoritative. Standard definitions and all other users remain unchanged.

The original transaction logically revokes only that user's direct grants, records denial history, restores company override inheritance, neutralizes the user dashboard restriction and increments the user revision once. A failed dashboard write rolls the entire operation back. The same idempotency receipt recovers an uncertain result. A no-op reset keeps the revision unchanged while recording its explicit review.

The employee screen opens an original security review window; the underlying employee permission editor is held inert while it is open, including after a locale redraw. Canceling retains its unsaved parent draft. The reason and fresh review survive preview failure. After an uncertain apply the original request/key and read-only inputs remain held; cancel/close are disabled until result verification. Once saving is acknowledged, failed readback retries only the read, not another write. Reads and final bootstrap have bounded timeouts. The shared review's hold behavior is enabled only for this action.

Local focused acceptance:15 server cases passed, including the3 new reset cases and existing permission/denial/concurrency regressions. The first setup attempt used a nonexistent bank action and was corrected to the existing bank_edit; no permission catalog or protection was weakened. The actual AR/EN browser journey passed at1440/768/390, including canceled parent draft, preview503 trace, actual committed response loss, same body/key after locale change and acknowledged GET-only readback recovery. The first browser attempt omitted selecting the existing Customers matrix section and was corrected without product changes.

The full server suite passed761 cases. The final26-journey browser suite also passed after the original component-preview extension. Four additional standalone override-model tests passed separately; that model is not wired. Source is prepared for PR116; no deployment is authorized. Full widget exception inheritance, geographic scope and broader operational acceptance remain unfinished. This action does not complete the operational release or the separate financial95 program.

### Audit reason verification
The original immutable audit stream now retains an encrypted reset reason alongside its digest, including resets without denial changes. Only Owner audit views decode it; other views strip the envelope. Unreadable envelopes are marked without hiding the audit event. Historical records are not rewritten. The denial-writer event describes only its own grant behavior, while the full-reset event records actual revocations.

Validation: 15 focused native cases passed after the audit wording correction. Four further cases passed after encrypted reason retention, including actual Owner audit readback and ciphertext-at-rest checks. The earlier 761-case full native and 26 browser runs precede these final audit-only changes; final-commit CI remains required.
