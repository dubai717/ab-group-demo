# Automatic account numbering and daily form cleanup

The existing account-creation API now generates a native `AC-` number when omitted. It reuses the existing transaction-bound document counter, advances beyond existing automatic-format codes and preserves explicit historical/API codes. Concurrent account creation is serialized by the existing counter; the database unique constraint remains authoritative.

The daily account form no longer requests a manual code. The retained legacy financial-item editor no longer offers numeric priority or editable immutable code; it sends the original code/priority from the loaded record. Separate priority management remains the only priority-editing path. Existing ledger/report account numbers remain visible where useful.

Acceptance: a native concurrent three-account test passed uniqueness, manual historical `AC-000500` followed by automatic `AC-000501`, unchanged old codes/entries and denial for an unauthorized employee. Actual browser passed creation without a code field, central readback and displayed generated account number. No balances or live permissions were changed. This bundle is not deployed.
