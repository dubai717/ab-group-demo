# Original client context ordering and retained reporting reference

Two independent actual synthetic browser failures were reproduced:

1. A user with explicit reports-scope assignment authority edited an account whose existing reporting root was outside the visible directory. The editable select silently displayed an empty value. It now retains the original reference using a neutral bilingual label, without exposing the hidden account name, adding an account to the directory or changing source authorization. A different profile field was saved and the original manager was verified through a fresh Owner bootstrap. Arabic/English layouts at1440/768/390 passed.
2. An actual older bootstrap response held at the browser could overwrite a newer response after the Owner revoked a grant. The existing loader now accepts only its newest request generation. Login, logout and view-as transitions invalidate earlier generations before issuing their requests. The held-response test verifies both revoked-grant readback and no restoration after logout. This changes client ordering, not server permissions, session issuance or financial data.

No hosted source data, PR115, deployment or protected workflow was changed. Original APIs remain the enforcement boundary. This does not claim a complete same-actor authorization-cache audit: shared cache invalidation after confirmed reduced permissions is implemented in AUTHORITY-CACHE.md; other source adapters and geographic access remain to review.

Evidence: work/operational-evidence/hidden-manager-before.log (real pre-fix assertion), hidden-manager-final.log (post-fix success), bootstrap-order-before.log (real stale-grant assertion), bootstrap-order-after.log (post-fix held response and logout success). Earlier harness errors involving an unavailable GET endpoint or wrong grant projection are not acceptance evidence.

Final local regression: all22 operational UI journeys,189 root/deployment pure checks, and provider-free compiled runtime build passed. These results include the current browser-only changes; no new native server logic was introduced. Current-head GitHub CI is separate evidence.
