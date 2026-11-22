# Financial evidence retains its original company context — build only

The existing financial document upload read the browser File asynchronously, then took the current global company for its POST. A real browser held that read, switched companies and observed one attempted POST to the new company. The test intercepted and rejected it, so no wrongly scoped document was stored. This reproduced the cause independently of missing fields or server authority.

The candidate captures company, actor and UI epoch before reading. It refuses dispatch if that context changes and uses the captured company in the original documents endpoint. It rechecks success and failure before updating the notice, drafts or refresh. Existing server document permissions, scanning, encrypted object storage and archive/version semantics are unchanged.

A second actual browser case lets the original synthetic upload commit in the old company, holds the response, switches companies and edits a new draft. Releasing the response does not clear that draft or display the old success there. Exactly one original document stays in its original company; none appears in the other company.

The candidate was served only to this isolated browser while the tracked E60 source remained immutable for its full native run. The browser fixture used an independently allocated loopback5443 PostgreSQL with bounded256MB tmpfs, fake Auth/object storage/scanner and no cloud connections. The same test then passed against the actual tracked candidate, without a substituted script. The corrected original test still reproduced the old dispatch bug. Harness readiness waits for actual DOM replacement after both company and persisted-tab changes; HTTP arrival alone is insufficient.

No schema, financial entry, grant, historical attachment, Original Supabase, delivery job or Render setting is changed by this fix.
