# Individual dashboard inheritance — unpublished build

Extends the original dashboard settings keys, Owner review/apply routes, permission transaction lock, data resolvers and employee permission form. No new permission catalogue, financial ledger or automatic migration is introduced.

An explicitly reviewed version2 employee record stores independent additions and denials for indicators, detail actions and panels. New standard items arrive unless explicitly denied; additions remain when a standard changes. Per-item Inherit removes only that item's exception. Stored detail preferences stay latent when a standard hides an indicator. In the employee form, explicitly removing an indicator also denies its drill-down, preserving the original safe behavior; adding it again does not silently reopen details. Role company/unit bounds still intersect employee bounds; original domain authorization, API and RLS remain mandatory.

Existing version1 records retain their restrictive semantics until an Owner explicitly reviews and saves their conversion. Old-client writes cannot overwrite version2 records. The review binds the assigned role, baseline version and user record version. Standard updates include each affected employee's before/after view and retained exception counts; their review hash rejects an intervening individual edit. Full employee reset clears the overlay to inheritance while retaining the assigned standard and work scope.

The existing bilingual employee form keeps +/×, checkboxes, original financial/chart previews and adds explicit exception labels and per-item inheritance. Restore clicks remain draft-only until review/confirmation; cancel preserves saved exceptions. No widget addition grants a bank/customer/financial data permission.

Local evidence: fourteen focused native cases passed, covering original dashboard boundaries, inherited additions/denials, legacy compatibility, changed standard/individual review rejection, full reset and unchanged financial journals. The actual AR/EN browser journey passed at1440/768/390 pixels; it checks saved additions/denials, arrival of new standard indicators and canceled per-item restores. Full browser regression and final-head CI are recorded separately in ACCEPTANCE.json. Earlier failing expectation of403 on the generic bank register was corrected to its original safe empty200 contract with actual hidden bank records present; the explicit dashboard bank/customer source still returns403. No authority guard was weakened.

Not deployed. Remaining geographic scope, broader operational acceptance and protected SQL approval remain separate work. PR115 and all original data are unchanged.

The first broad browser run passed26 journeys and then caught a real UI regression: removing/readding a widget restored inherited drill-down. The form was corrected to record the original explicit detail denial on removal. The original failing assertion remains unchanged; focused reruns are recorded separately, not represented as a successful final broad run.

New inheritance writes now require the separate reviewed original-settings guard; see DASHBOARD-SETTINGS-GUARD.md. Unapproved/missing protection retains the legacy path or makes existing version2 records read-only. No host installation or automatic conversion occurred.
