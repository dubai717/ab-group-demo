# Original execution chronology — source preparation only

`originalVehicleExecutionProof` reads one authorized original request, its single Held/Settled fund record and immutable original approval/receipt events. It checks tenant/company/request identity, positive matching financing amount/currency, receipt actor/receiver, fund ID and received amount. It returns a bounded internal date/source-hash proof, never a new approval or financial write. No HTTP route, execution hook or live policy is installed by this module.

The chronology comes from original database timestamps. An entered payment `date`, request description, task creation or display metadata cannot backdate actual execution. Source events must order request→approval→fund creation→matched receipt, without future timestamps. Dubai dates use the actual +04:00 boundary. Missing, mismatched, hidden or oversized sources yield no exemption proof. A request payload over64KiB, event over64KiB, over2,000 relevant events or over1MiB of relevant ciphertext cannot be silently accepted. The byte/count preflight is followed by an exact bounded read; an inconsistent count/size also refuses proof.

The original `evaluateServiceEligibility` remains the only policy evaluator. The helper does not decide that historical execution is exempt by itself. Its `sourceVerified` means a coherent original chronology, not a legal/financial approval, bank reconciliation or a hosted signed attestation.

## Synthetic acceptance

`service-execution-proof.test.ts` uses a newly allocated isolated database. The original January display date with a receipt actually confirmed today stays today's execution. Additional explicit historical fixture copies are appended without updating any original immutable row/trigger: a receipt at20:00 UTC is the following Dubai day and cannot qualify as before a policy effective that day. An earlier verified execution qualifies under the original evaluator for a later policy date. A mismatching received amount, other tenant or missing request produces no proof. Source record/grant/financial counts remain unchanged during all reads. The native case and TypeScript pass.

## Remaining dependencies

Cash has no purchase-fund receipt, and bank-direct finance may have no employee custody. Their original actual start/bank evidence requires separate reviewed adapters; this helper deliberately does not invent either. Registration/disbursement hooks, real executor action authorization, old-task/return/delegation continuity, cancellation/restart cases, policy activation and complete source/dependency/rollback acceptance remain unfinished. No source proof alone enables an operating database or exempts an unverified request. Only newly allocated synthetic fixture copies were used; no historical operating record was changed.
