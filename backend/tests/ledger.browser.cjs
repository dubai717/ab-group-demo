const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
(async () => { const f = JSON.parse(fs.readFileSync('work/ledger-browser-fixture.json')), browser = await chromium.launch({ executablePath: process.env.AB_BROWSER_EXECUTABLE || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox'] }), p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = []; p.on('pageerror', x => errors.push(x.message)); try {
    await p.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (/ledger|finance|receipt|invoice|draft|password|token|session|customer/i.test(k))
        throw Error('Sensitive browser persistence'); return original.call(this, k, v); }; });
    await p.goto('http://127.0.0.1:3500');
    await p.fill('#username', f.username);
    await p.fill('#password', f.password);
    await p.locator('#login-form [type=submit]').click();
    await p.locator('.stats-grid').waitFor();
    if (f.schema)
        f.customerId = await p.evaluate(async (co) => (await ABCentral.api('customers', 'POST', { profile: { fullName: 'Synthetic financial browser ' + Date.now(), companyId: co, type: 'owner', status: 'Active' } }, crypto.randomUUID())).id, f.companyId);
    await p.locator('[data-page="financialManagement"]').click();
    if (!f.schema) {
        await p.getByText(/الترحيل المالي 012|Financial migration 012/).waitFor();
        assert.equal(await p.locator('[data-ld-form="invoice"]').count(), 0);
    }
    else {
        await p.locator('#ld-company').waitFor();await p.evaluate(async co=>{LedgerUI.reset();await LedgerUI.openNotification(co);},f.otherCompanyId);await p.waitForFunction(co=>document.querySelector('#ld-company')?.value===co,f.otherCompanyId);
        await p.locator('#ld-company').selectOption(f.companyId);
        await p.locator('[data-ld="tab"][data-id="invoices"]').click();
        const form = p.locator('[data-ld-form="invoice"]');
        await form.waitFor();
        await form.locator('[name="customerId"]').selectOption(f.customerId);
        await form.locator('[name="itemId"]').selectOption(f.itemId);
        await form.locator('[name="amount"]').fill('1000.001');
        await form.locator('[name="sourceKey"]').fill('browser-' + Date.now());
        await form.locator('[type="submit"]').click();
        await p.getByRole('cell', { name: '1000.001', exact: true }).first().waitFor();
        await p.locator('[data-ld="tab"][data-id="collect"]').click();
        const filter = p.locator('[data-ld-form="collection-filter"]');
        await filter.locator('[name="customerId"]').selectOption(f.customerId);
        await filter.locator('[type="submit"]').click();
        const collect = p.locator('[data-ld-form="collect"]');
        await collect.locator('[name="customerId"]').selectOption(f.customerId);
        await collect.locator('[name="amount"]').fill('600');
        await collect.locator('[name="selectedItem"]').check();
        await collect.locator('[name="take-' + f.itemId + '"]').fill('600');
        await collect.locator('[type="submit"]').click();
        await p.getByRole('cell', { name: '600', exact: false }).first().waitFor();
        await p.reload();
        await p.locator('[data-page="financialManagement"]').click();
        await p.locator('#ld-company').waitFor();
        await p.locator('#ld-company').selectOption(f.companyId);
        await p.locator('[data-ld="tab"][data-id="invoices"]').click();
        await p.getByRole('cell', { name: '400.001', exact: true }).waitFor();
        for (const tab of ['custody', 'deposits', 'vouchers', 'funds', 'cards', 'journals', 'setup', 'reports', 'closing', 'reconciliation', 'work', 'intercompany']) {
            await p.locator('[data-ld="tab"][data-id="' + tab + '"]').click();
            await p.locator('.ld-section').waitFor();
        }
        for (const width of [1440, 1024, 768, 390]) {
            await p.setViewportSize({ width, height: 900 });
            for (let n = 0; n < 2; n++) {
                assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'horizontal overflow ' + width);
                await p.locator('[data-action="toggle-language"]').click();
            }
        }
        await p.locator('[data-ld="tab"][data-id="dashboard"]').click();
        await p.emulateMedia({ colorScheme: 'dark' });
        await p.screenshot({ path: 'work/ledger-phone-dark.png', fullPage: false });
        await p.emulateMedia({ colorScheme: 'light' });
        await p.setViewportSize({ width: 1440, height: 1000 });
        await p.screenshot({ path: 'work/ledger-desktop.png', fullPage: false });
    }
    assert.deepEqual(errors, []);
    console.log(f.schema ? 'PASS financial browser: central invoice, partial cash collection, save/reload exact outstanding, operational tabs, bilingual desktop/tablet/phone; no JS errors or sensitive localStorage.' : 'PASS financial schema gate: previous login/dashboard retained, explicit 012 notice, no false financial save.');
}
catch (err) {
    await p.screenshot({ path: 'work/ledger-browser-failure.png', fullPage: false });
    console.error(err);
    process.exitCode = 1;
}
finally {
    await browser.close();
} })();
