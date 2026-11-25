# Original company file preview and protected apply code

Owner-only CSV/XLSX preview reuses original parsers, company creation validation and directory facts. It is bounded to200 source rows, rejects unknown columns/malformed encodings/quotes and reports required/date errors, actual possible matches and source duplicates. Prepared company rows live in cloned state, so preview cannot leave temporary companies in the model or database. Source names and leading-zero licence text are preserved according to original validation.

Preview is explicitly excluded from request_dedup caching and enforced in a repeatable-read/read-only transaction. The original API test verifies settings and unchanged receipt count. There is no new role, automatic financial classification or membership.

The first06c353d preview checkpoint had no apply path; later code now provides an **off-by-default** original-writer/receipt apply path with isolated acceptance. See [COMPANY-IMPORT-APPLY.md](COMPANY-IMPORT-APPLY.md) for current controls, recovery and limits. This distinction preserves the historical source/evidence pins in BUILD-STATE.json.

Current ordinary runtime still displays preview only. No real import or hosted activation occurred. Remaining entity adapters, centre/private scope and integrated release acceptance remain engineering work.
