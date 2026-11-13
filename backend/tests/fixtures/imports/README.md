Synthetic Access fixtures only. No production or personal data.

`customers.mdb` is Jet 4 / Access 2000; `customers.accdb` is ACE / Access 2010. Generated locally using Jackcess 4.0.7, Commons Lang 3.18.0, Commons Logging 1.3.5 and Janino 3.1.12 from official Maven Central artifacts (development tools only, never included in the app runtime).

Both contain ActualCustomers and Vehicles, with a ClientKey primary key and a detected relationship. Arabic names, telephone strings, leading-zero identity/plate strings, and a deliberately synthetic PDF stored as raw OLE bytes exercise the reader. No macros, executable objects, linked tables or financial data.

Tested OLE support is limited to raw verified PDF/PNG/JPEG bytes. Wrapped OLE containers fail closed. Complex Access Attachment reading uses the bounded library worker but has not been verified against an independently generated complex-attachment fixture; full ACCDB/Attachment compatibility is not claimed. The supported fallback is XLSX plus a ZIP with one folder per unchanged source/file identifier. Files remain subject to the existing private scan/quarantine flow.
