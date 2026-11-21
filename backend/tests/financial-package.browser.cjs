const { chromium } = require('playwright'), assert = require('node:assert/strict'), fs = require('node:fs');
(async () => {
    const f = JSON.parse(fs.readFileSync('work/financial-package-fixture.json')), browser = await chromium.launch({ executablePath: process.env.AB_BROWSER_EXECUTABLE || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] }), p = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('dialog', d => d.accept());
    const tab = async (id) => { await p.locator('[data-ld=tab][data-id="' + id + '"]').click(); await p.locator('.ld-section').waitFor(); const ready = { setup: '[data-fp=new-item]', priorities: '#fp-priority', compliance: '[data-fp=fee-new]', documents: '#fp-document-type' }[id]; if (ready)
        await p.locator(ready).waitFor(); };
    try {
        await p.goto('http://127.0.0.1:3646');
        await p.fill('#username', f.username);
        await p.fill('#password', f.password);
        await p.locator('#login-form [type=submit]').click();
        await p.locator('.stats-grid').waitFor();
        await p.locator('[data-page=financialManagement]').click();
        await p.locator('#ld-company').selectOption(f.companyId);
        await require('./company-tax.browser.cjs')(p,f);
        await require('./cost-centres.browser.cjs')(p,f);
        await tab('setup');
        assert.equal(await p.locator('[data-ft-search]').count(), 1, 'one shared search for accounts and financial items');
        assert.equal(await p.locator('.ld-section table').count(), await p.locator('.ld-section [data-ft-table] table').count(), 'all setup tables use the financial adapter');
        await p.locator('[data-fp=new-item]').click();
        let dialog = p.locator('dialog[open]').last();
        assert.equal(await dialog.locator('[name=code]').count(), 0);
        assert.equal(await dialog.locator('[name=priority]').count(), 0);
        await dialog.locator('[name=nameAr]').fill('بند واجهة الحزمة');
        await dialog.locator('[name=nameEn]').fill('Financial package UI item');
        await dialog.locator('[name=category]').selectOption('general');
        await dialog.locator('[name=recurrence]').selectOption('monthly');
        await dialog.locator('[name=recurringAmount]').fill('50');
        await dialog.locator('details summary').click();
        await dialog.locator('[name=receivableId]').selectOption(f.receivableId);
        await dialog.locator('[name=revenueId]').selectOption(f.incomeId);
        await dialog.locator('[type=submit]').click();
        await dialog.waitFor({ state: 'detached' });
        const item = await p.evaluate(async (co) => (await ABCentral.api('ledger/workbench?companyId=' + co)).finance_items.find(r => r.name_en === 'Financial package UI item'), f.companyId);
        assert(item);
        assert.match(item.code, /^FI-\d+/);
        assert.equal(item.details.recurrenceBinding, 'explicit');
        await p.locator('[data-ft-search] [name=q]').fill('Financial package UI item');
        await p.locator('[data-ft-search] button').click();
        await p.locator('[data-ft-table="package:items"] [data-fp-open="' + item.id + '"]').locator('xpath=ancestor::tr').locator('td').first().click();
        dialog = p.locator('dialog[open]').last();
        assert.equal(await dialog.locator('[name=nameEn]').inputValue(), 'Financial package UI item', 'row action is rebound after shared filtering');
        await dialog.locator('[data-cancel]').click();
        await p.locator('[data-ft-search] [name=q]').fill('');
        await p.locator('[data-ft-search] button').click();
        await tab('priorities');
        const before = await p.locator('[data-priority-list] [data-item]').evaluateAll(xs => xs.map(x => x.dataset.item));
        const index = before.indexOf(item.id);
        assert(index > 0);
        await p.locator('[data-item="' + item.id + '"] [data-fp=up]').click();
        await p.locator('#fp-priority [name=enabled]').check();
        let unblock, observed;const blocked=new Promise(r=>unblock=r),refreshObserved=new Promise(r=>observed=r);let holdRefresh=true;await p.route('**/api/ledger/package/state?**',async route=>{if(holdRefresh){holdRefresh=false;observed();await blocked;}await route.continue();});
        await p.locator('#fp-priority [type=submit]').click();await refreshObserved;await p.evaluate(()=>render());assert.equal(await p.locator('#fp-priority').count(),0,'no partially loaded financial model is interactive');unblock();await p.locator('#fp-priority').waitFor();await p.unroute('**/api/ledger/package/state?**');
        await p.waitForFunction(async (co) => !!(await ABCentral.api('ledger/package/state?companyId=' + co)).priority, f.companyId);
        const state = await p.evaluate(co => ABCentral.api('ledger/package/state?companyId=' + co), f.companyId);
        assert.equal(state.priority.itemIds[index - 1], item.id);
        assert.equal(state.priority.requestedEnabled, true);
        assert.equal(state.priority.enabled, false);
        await tab('compliance');
        await p.locator('[data-fp=fee-new]').click();
        dialog = p.locator('dialog[open]').last();
        await dialog.locator('[name=itemId]').selectOption(f.itemId);
        await dialog.locator('[name=feeItemId]').selectOption(item.id);
        await dialog.locator('[name=contractEvidenceId]').selectOption(f.proofId);
        await dialog.locator('[type=submit]').click();
        await dialog.waitFor({ state: 'detached' });
        const rules = await p.evaluate(co => ABCentral.api('ledger/package/state?companyId=' + co), f.companyId);
        assert.equal(rules.feeRules.length, 1);
        const rule = rules.feeRules[0];
        assert.equal(rule.enabled, false);
        await p.locator('[data-fp-open="' + rule.id + '"]').locator('xpath=ancestor::tr').locator('td').first().click();
        dialog = p.locator('dialog[open]').last();
        assert.equal(await dialog.locator('[name=amount]').inputValue(), '10');
        assert.equal(await dialog.locator('[name=unit]').inputValue(), 'customer_item');
        await dialog.locator('[data-cancel]').click();
        await p.locator('[data-fp=fee-status]').click();
        await p.locator('#ld-notice').filter({ hasText: /موافقة|approval/ }).waitFor();
        assert.equal(await p.locator('dialog[open]').count(), 0);
        await tab('documents');
        await p.locator('[data-fp-open="' + f.invoiceId + '"]').waitFor({ state: 'attached' });
        await p.locator('[data-fp-open="' + f.invoiceId + '"]').locator('xpath=ancestor::tr').locator('td').first().click();
        dialog = p.locator('dialog[open]').last();
        assert((await dialog.innerText()).includes('450.000'));
        await dialog.getByRole('button', { name: /^خصم$|^Discount$/ }).click();
        let edit = p.locator('dialog[open]').last();
        await edit.locator('[name=amount]').fill('10');
        await edit.locator('[name=reason]').fill('Synthetic verified noncash discount');
        let releaseInvoice, invoiceObserved; const delayedInvoice = new Promise(r => releaseInvoice = r), invoiceStarted = new Promise(r => invoiceObserved = r); let holdInvoice = true;
        await p.route('**/api/ledger/package/documents?**', async route => { const url = new URL(route.request().url()); if (holdInvoice && url.searchParams.get('type') === 'Invoice') { holdInvoice = false; const response = await route.fetch(); invoiceObserved(); await delayedInvoice; await route.fulfill({response}); } else await route.continue(); });
        await edit.locator('[type=submit]').click();
        await edit.waitFor({ state: 'detached' });
        await invoiceStarted;
        try {
            await p.locator('#fp-document-type').selectOption('Discount');
            await p.waitForFunction(() => document.querySelector('[data-ft-table="package:documents"] tbody')?.innerText.includes('DS-'));
        } finally { releaseInvoice(); }
        await p.unrouteAll({behavior:'wait'});
        await p.waitForFunction(() => document.querySelector('#fp-document-type')?.value === 'Discount' && document.querySelector('[data-ft-table="package:documents"] tbody')?.innerText.includes('DS-'));

        const documents = await p.evaluate(co => ABCentral.api('ledger/package/documents?companyId=' + co + '&type=Discount'), f.companyId);
        assert.equal(documents.rows.length, 1);
        assert(documents.rows[0].number.startsWith('DS-'));
        for (const type of ['RV', 'PV', 'Deposit']) {
            await p.locator('#fp-document-type').selectOption(type);
            await p.waitForFunction(() => document.querySelector('[data-ft-table="package:documents"] [data-fp-open]'));
            const docs = await p.evaluate(({ co, type }) => ABCentral.api('ledger/package/documents?companyId=' + co + '&type=' + type), { co: f.companyId, type });
            assert.equal(docs.rows.length, 1);
            assert(docs.rows[0].number);
            assert(docs.rows[0].createdByName);
            await p.locator('[data-fp-open]').first().locator('xpath=ancestor::tr').locator('td').first().click();
            dialog = p.locator('dialog[open]').last();
            assert.equal(await dialog.getByRole('button', { name: /^Cancel$|^إلغاء$/ }).count(), 0);
            await dialog.locator('[data-close]').click();
        }
        for (const locale of ['ar', 'en']) {
            await p.evaluate(l => setLocale(l), locale);
            for (const width of [1440, 768, 390]) {
                await p.setViewportSize({ width, height: 950 });
                await tab('compliance');
                assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), locale + ' ' + width);
                await tab('priorities');
                assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), locale + ' priorities ' + width);
            }
        }
        assert.deepEqual(errors, []);
        console.log('PASS financial package actual UI: delayed Invoice to Discount switch ignores stale response, atomic delayed model refresh, auto-code item save/readback, collapsed accounting mapping, priority reordering/draft gate, disabled fee rule/row/activation denial, Invoice/RV/Discount/PV/Deposit metadata, noncash discount, no noninvoice Cancel, AR/EN desktop/tablet/mobile.');
    }
    catch (e) {
        await p.screenshot({ path: 'work/financial-package-failure.png' });
        console.error('FAIL FINANCIAL_PACKAGE:', e.stack);
        console.error(await p.locator('[role=alert],#ld-notice').allTextContents());
        process.exitCode = 1;
    }
    finally {
        await browser.close();
    }
})();
