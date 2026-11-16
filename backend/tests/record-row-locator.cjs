// Exercise the visible row through Playwright, retaining non-table links as independent controls.
exports.recordRow=locator=>locator.locator('xpath=ancestor::tr[1] | self::*[not(ancestor::tr)]');
