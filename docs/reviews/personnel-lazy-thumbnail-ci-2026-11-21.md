# Personnel thumbnail acceptance — CI 44937627058

The draft check failed in `personnel-directory.browser.cjs`, waiting for the first canvas below `[data-staff-thumbnail]`. No failed finance acceptance step preceded it. The same unmodified journey passed locally, confirming the test's viewport-dependent precondition.

`AttachmentViewer.thumbnails` intentionally waits for an IntersectionObserver intersection (120px margin). Images use `img`; only a PDF uses `canvas`. Waiting for an unspecified canvas without bringing a particular PDF host into view depends on document order, layout and scroll position. Eagerly downloading every employee attachment would change the product and increase transfer volume.

The acceptance now reads the synthetic employee's clean PDF version from its original document metadata, scrolls that exact host into view as a user would, then verifies its rendered canvas. No timeout increase, force click, random retry, provider credential, permission change or protected-run rerun/cancellation was used. Local isolated personnel journey passed with the precise lazy-load precondition.

This is a browser acceptance correction, not a change to document loading, data, renderer security, user permissions or deployment gates.
