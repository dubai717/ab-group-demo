# Original custody handover child scope — review only

`backend/review/company-scope-handover-items.sql` extends the existing restrictive company upper bound to the original FK-only `finance_handover_items`. Both the original handover and receipt must be visible under their existing RLS, with matching tenant and company. A multi-company employee cannot create a cross-company child simply because both parents are individually visible. The existing Owner all-company source behavior is preserved.

Installation requires the reviewed technical owner, existing restrictive parent policies and a non-owner/non-bypass runtime. No grant, privileged function, role or financial data is created or changed. Original append-only SELECT/INSERT privileges remain; no UPDATE/DELETE is added. This SQL is excluded from automatic migration manifests and has not been installed on Supabase. Full scope readiness remains false.

The original API still enforces the actual sender, named receiver, authority, pending state, current holder, cheque state and deposit controls. This candidate does not grant cross-branch collection or own-custody access and does not transfer cash or accept a handover.

Eight linked synthetic tests passed: this candidate, original statement-child scope and original finance integration. They cover scoped/empty/unknown actor and wrong tenant, actual Owner view, multi-company mismatched parents, denied deletion and unchanged original source rows/grants. Original integration also confirms sender retains custody until named receiver acceptance, rejection preserves holder and deposit posts once. Local disposable fixtures only; no hosted or historical operation.
