const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
(async () => {
  const f = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "../../work/central-browser-fixture.json"),
      ),
    ),
    b = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    }),
    p = await b.newPage({ viewport: { width: 1440, height: 1000 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  try {
    await p.addInitScript(() => {
      localStorage.setItem(
        "ab_group_demo_state_v3",
        "BROWSER-DATA-MUST-REMAIN",
      );
      const read = Storage.prototype.getItem,
        write = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key) {
        if (
          [
            "ab_group_demo_state_v2",
            "ab_group_demo_state_v3",
            "ab_group_demo_accounts_v1",
            "ab_group_area_reference_v1",
          ].includes(key)
        )
          throw Error("Central mode read sensitive browser storage: " + key);
        return read.call(this, key);
      };
      Storage.prototype.setItem = function (key, value) {
        if (
          [
            "ab_group_demo_state_v2",
            "ab_group_demo_state_v3",
            "ab_group_demo_accounts_v1",
            "ab_group_area_reference_v1",
          ].includes(key)
        )
          throw Error("Central mode wrote sensitive browser storage");
        return write.call(this, key, value);
      };
    });
    await p.goto("http://127.0.0.1:3100");
    await p.locator("#login-form").waitFor();
    assert.equal(await p.locator("[data-demo-user]").count(), 0);
    await p.locator("#username").fill(f.username);
    await p.locator("#password").fill(f.password);
    await p.locator("#login-form button[type=submit]").click();
    await p.locator(".stats-grid").waitFor();
    await p.locator('[data-action="toggle-language"]').click();
    await p.locator('[data-page="companies"]').click();
    const unique = Date.now(),
      bban = "033" + String(unique).padStart(16, "0"),
      iban =
        "AE" +
        String(98 - Number(BigInt(bban + "101400") % 97n)).padStart(2, "0") +
        bban;
    await p.evaluate((v) => (window.testUnique = v), unique);
    for (const [k, v] of Object.entries({
      arabicName: "شركة مركزية",
      englishName: "Central UI " + unique,
      companyCode: "UI-" + unique,
      tradeLicenseNumber: "UI-" + unique,
      salikAccountNumber: "000456",
      trafficCode: "000123",
    }))
      await p.locator('#company-form [name="' + k + '"]').fill(v);
    await p.locator("#company-form button[type=submit]").click();
    await p
      .locator("#central-notice")
      .filter({ hasText: "Saved and verified" })
      .waitFor();
    const companyId = await p.evaluate(
      () =>
        app.state.companies.find(
          (c) => c.companyCode === "UI-" + window.testUnique,
        ).id,
    );
    await p
      .locator('[data-cd="profile"][data-company="' + companyId + '"]')
      .click();
    await p
      .locator('#cd-profile-form [name="notes"]')
      .fill("Persisted central note");
    await p.locator("#cd-profile-form button[type=submit]").click();
    await p
      .locator("#central-notice")
      .filter({ hasText: "Saved and verified" })
      .waitFor();
    await p.locator('[data-page="bankAccounts"]').click();
    await p.locator('[data-bk="new"]').click();
    await p.locator("#bk-companyId").selectOption(companyId);
    for (const [k, v] of Object.entries({
      accountName: "Central Bank " + unique,
      accountNumber: String(unique),
      iban,
      openedAt: "2026-01-01",
      relationshipManagerName: "Central Manager",
      relationshipManagerPhone: "+971500000007",
      relationshipManagerEmail: "manager@example.test",
    }))
      await p.locator("#bk-" + k).fill(v);
    await p.locator("#bk-account-form button[type=submit]").click();
    await p
      .locator("#central-notice")
      .filter({ hasText: "Saved and verified" })
      .waitFor();
    const accountId = await p.evaluate(
      () =>
        app.state.bankAccounts.find(
          (a) => a.accountNumber === String(window.testUnique),
        ).id,
    );
    await p.reload();
    await p.locator('[data-page="bankAccounts"]').click();
    await p.locator('[data-bk="open"][data-id="' + accountId + '"]').click();
    assert.equal(
      await p.locator("#bk-relationshipManagerEmail").inputValue(),
      "manager@example.test",
    );
    await p
      .locator("#bk-doc-files")
      .setInputFiles({
        name: "central.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.4 central test"),
      });
    await p.locator('[name="date-0"]').fill("2026-01-01");
    await p.locator("#bk-doc-form button[type=submit]").click();
    await p
      .locator("#central-notice")
      .filter({ hasText: "Saved and verified" })
      .waitFor();
    await p
      .locator(".central-documents")
      .getByText("central.pdf", { exact: true })
      .waitFor();
    await p.reload();
    await p.locator('[data-page="bankAccounts"]').click();
    await p.locator('[data-bk="open"][data-id="' + accountId + '"]').click();
    await p
      .locator(".central-documents")
      .getByText("central.pdf", { exact: true })
      .waitFor();
    await p.locator('[data-page="users"]').click();
    await p.locator('[data-um="new"]').click();
    for (const [k, v] of Object.entries({
      nameAr: "مستخدم مركزي",
      nameEn: "Central Employee",
      username: "ui_" + unique,
      email: "ui_" + unique + "@example.test",
      demoPassword: "Central-User@2026",
      demoConfirm: "Central-User@2026",
    }))
      await p.locator("#um-" + k).fill(v);
    await p.locator("#um-companyIds").selectOption(companyId);
    await p.locator("#um-status").selectOption("Active");
    await p.locator("#um-profile button[type=submit]").click();
    await p
      .locator("#central-notice")
      .filter({ hasText: "Saved and verified" })
      .waitFor();
    await p.setViewportSize({ width: 390, height: 844 });
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await p.locator('[data-action="toggle-language"]').click();
    assert.equal(await p.locator("body").getAttribute("dir"), "rtl");
    assert(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS central UI: server login/cookie, company create/edit, bank/manager create/reload, persistent encrypted document/reload, user enrollment, no sensitive localStorage access, Arabic/English mobile, zero JS errors. Provider is a test double.",
    );
  } catch (e) {
    await p.screenshot({
      path: path.join(__dirname, "../../work/central-failure.png"),
      fullPage: true,
    });
    console.error(await p.locator("body").innerText());
    throw e;
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
