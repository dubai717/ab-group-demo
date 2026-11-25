# Cross-branch cash collection review

An active employee with the explicit company grant can look up the remaining balance of one invoice by invoice and legal company ID. The response contains the invoice number, currency, balance, and the employee's verified receiving site. It contains no customer record or journal data.

The employee reports cash actually received against that invoice and site. PostgreSQL validates the exact relationship and amount and permits the employee to see their own reports only while the eligible grant remains active. A report has no accounting effect. An independent active Owner confirms the counted amount. The original transaction then creates the receipt, invoice allocation, posted journal and custody movement in the company that owns the debt. The reporting employee holds the cash custody and the Owner remains the author of the posting. The report can produce only one posting. The existing original handover, recipient confirmation and company bank deposit workflow remains in use.

The SQL is a review candidate. The API defaults to disabled and accepts the isolated fixture database naming convention only. Deployment, broader delegation and exceptions, UI and end-to-end acceptance of the complete company scope remain pending.

The scope composition fixture includes separate card reconciliation, payroll decision and personnel library version relationships. Each relationship validates its original parents in the same tenant. Payroll also verifies employee and month. The original application action checks and current company boundaries remain in effect. The full scope activation gate remains closed while other relationships are unresolved.
