/* Opt-in, same-origin API adapter. No browser-state import and no local write fallback. */
(function () {
  "use strict";
  const C = (window.ABCentral = {
    enabled: window.AB_CONFIG?.central === true,
    ready: false,
    actor: null,
    areas: [],
    grants: [],
    documents: new Map(),
    enrollment: new Map(),
    notice: "",
    csrf: "",
  });
  if (!C.enabled) return;
  let activeBank = null,
    activeCompany = null,
    activeUser = null;
  const text = (ar, en) => (getLocale() === "ar" ? ar : en);
  const escape = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  async function api(path, method = "GET", body, key) {
    if (key) {
      const digest = new Uint8Array(
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(key + method + path + JSON.stringify(body)),
        ),
      );
      const h = [...digest]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      key =
        h.slice(0, 8) +
        "-" +
        h.slice(8, 12) +
        "-4" +
        h.slice(13, 16) +
        "-8" +
        h.slice(17, 20) +
        "-" +
        h.slice(20, 32);
    }
    const r = await fetch("/api/" + path, {
      method,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-AB-Request": "1",
        ...(C.csrf ? { "X-CSRF-Token": C.csrf } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({ error: "unavailable" }));
      throw Error(d.error || "unavailable");
    }
    return r.json();
  }
  async function load(draw = true) {
    const b = await api("bootstrap");
    C.actor = b.actor;
    C.csrf = b.csrfToken;
    C.areas = b.areas;
    C.grants = b.grants;
    C.audit = b.audit;
    C.summary = b.summary;
    Object.assign(app.state, {
      users: b.users,
      roles: b.roles,
      companies: b.companies,
      departments: b.departments,
      bankAccounts: b.bankAccounts,
      bankReference: b.bankReference,
      bankAccountPurposes: b.bankAccountPurposes,
      bankAccountAudit: b.bankAccountAudit,
      companyDocumentAlertDays: b.companyDocumentAlertDays,
      currentUser: { id: b.actor.id },
    });
    C.ready = true;
    UserManagement.centralSelect(activeUser);
    if (draw) render();
  }
  C.emptyState = () => ({
    users: [],
    roles: [],
    companies: [],
    departments: [],
    tasks: [],
    notificationList: [],
    currentUser: null,
    currentPage: "dashboard",
    companyFilters: { query: "", status: "all", emirate: "all" },
  });
  C.loading = () => {
    document.getElementById("app").textContent =
      "Connecting to the central test backend…";
  };
  C.areaStore = {
    emirateId: (v) =>
      UaeAreaSeed.emirates.find((e) => e.id === v || e.legacy === v)?.id,
    canAdd: () =>
      C.actor?.roleId === "owner" ||
      C.actor?.permissions?.some((p) =>
        ["create_company", "edit_company", "manage_area_reference"].includes(p),
      ),
    local: () => C.areas.filter((a) => a.sourceId === "central-user"),
    getArea: (id) => C.areas.find((a) => a.id === id),
    find: (id, name) =>
      C.areas.find(
        (a) =>
          a.emirateId === id &&
          [a.ar, a.en, ...(a.aliases || [])].some(
            (v) => AreaReference.normalize(v) === AreaReference.normalize(name),
          ),
      ),
    list: (id, q = "") =>
      C.areas.filter(
        (a) =>
          a.emirateId === id &&
          [a.ar, a.en, ...(a.aliases || [])].some((v) =>
            AreaReference.normalize(v).includes(AreaReference.normalize(q)),
          ),
      ),
    selection: (value, id) => {
      const eid = C.areaStore.emirateId(value),
        e = UaeAreaSeed.emirates.find((e) => e.id === eid),
        a = C.areaStore.getArea(id);
      if (!e || (id && a?.emirateId !== eid)) throw Error("invalidSelection");
      return {
        emirate: e.legacy,
        emirateId: eid,
        areaId: id || null,
        region: a?.en || a?.ar || "",
      };
    },
    add: () => {
      throw Error("centralOnly");
    },
  };
  C.bankDocuments = (id) =>
    (C.documents.get("bankAccountId=" + id) || []).map((d) => ({
      ...d,
      id: d.versionId,
      parentId: d.parentVersionId || null,
    }));
  function values(form, disabled = true) {
    return Object.fromEntries(
      [...form.elements]
        .filter(
          (e) =>
            e.name &&
            e.type !== "file" &&
            (disabled || !e.disabled) &&
            e.type !== "checkbox",
        )
        .map((e) => [e.name, e.value]),
    );
  }
  function idempotency(form, slot = "operation") {
    return form.dataset[slot] || (form.dataset[slot] = crypto.randomUUID());
  }
  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  async function upload(owner, file, metadata, key) {
    if (!file || !file.name) return;
    const slots = [
      "tradeLicense",
      "establishmentCard",
      "labourCard",
      "photo",
      "idFront",
      "idBack",
      "passport",
      "contract",
      "driving",
    ];
    if (slots.includes(metadata.category) && !metadata.parentId) {
      const rows = C.documents.get(new URLSearchParams(owner).toString()) || [],
        previous = rows.filter((d) => d.category === metadata.category).at(-1);
      if (previous)
        metadata = {
          ...metadata,
          parentId: previous.id,
          parentVersionId: previous.versionId,
          relation: "version",
        };
    }
    return api(
      "documents",
      "POST",
      {
        ...owner,
        ...(owner.userId && C.enrollment.get(owner.userId)
          ? { enrollmentToken: C.enrollment.get(owner.userId) }
          : {}),
        category: "other",
        title: file.name,
        description: "",
        date: new Date().toISOString().slice(0, 10),
        relation: "related",
        ...metadata,
        name: file.name,
        mime: file.type,
        base64: await readFile(file),
      },
      key,
    );
  }
  async function readDocuments(owner) {
    const q = new URLSearchParams(owner).toString();
    const rows = await api("documents?" + q);
    C.documents.set(q, rows);
    return rows;
  }
  function show(message) {
    C.notice = message;
    let node = document.getElementById("central-notice");
    if (!node) {
      node = document.createElement("p");
      node.id = "central-notice";
      node.className = "company-desc";
      node.setAttribute("role", "status");
      (
        document.querySelector(".main") || document.getElementById("app")
      ).prepend(node);
    }
    node.textContent = message;
  }
  function error(e) {
    show(
      text("لم يُؤكَّد اكتمال العملية: ", "Operation not confirmed: ") +
        e.message,
    );
  }
  function panel(owner, host) {
    if (!host) return;
    const q = new URLSearchParams(owner).toString(),
      rows = C.documents.get(q) || [];
    host.querySelector(".central-documents")?.remove();
    const section = document.createElement("section");
    section.className = "central-documents";
    section.innerHTML = `<h3>${text("المستندات المركزية وإصداراتها", "Central documents and versions")}</h3><p>${text("الإصدارات القديمة محفوظة. التنزيل متاح بعد اجتياز فحص الملفات.", "Previous versions are retained. Download requires a clean file scan.")}</p><div class="table-wrap"><table><tbody>${rows.map((d) => `<tr><td>${escape(d.title)}</td><td>${escape(d.category)}</td><td>v${d.version}</td><td>${escape(rows.find((p) => p.versionId === d.parentVersionId)?.title || "—")}</td><td>${escape(d.createdBy)}</td><td>${escape(d.createdAt)}</td><td>${escape(d.scanStatus)}</td><td><button type="button" class="ghost-btn" data-central-download="${d.versionId}" ${d.scanStatus === "clean" ? "" : "disabled"}>${text("تنزيل / عرض", "Download / view")}</button></td></tr>`).join("")}</tbody></table></div>`;
    if (
      owner.companyId &&
      (C.actor.roleId === "owner" ||
        C.actor.permissions.includes("edit_company"))
    )
      section.innerHTML += `<form id="central-doc-form" data-company="${escape(owner.companyId)}"><div class="form-grid"><label>${text("المستند", "Document")}<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx,.pptx" required /></label><label>${text("العنوان", "Title")}<input class="input" name="title" maxlength="200" required /></label><label>${text("الوصف", "Description")}<input class="input" name="description" maxlength="4000" /></label><label>${text("التاريخ", "Date")}<input class="input" name="date" type="date" required /></label><label>${text("التصنيف", "Category")}<select class="input" name="category">${["original", "annex", "amendment", "correspondence", "other"].map((c) => `<option value="${c}">${escape(c)}</option>`).join("")}</select></label><label>${text("المستند السابق", "Previous document")}<select class="input" name="parentId"><option value="">—</option>${rows.map((d) => `<option value="${d.versionId}">${escape(d.title)} v${d.version}</option>`).join("")}</select></label><label>${text("العلاقة", "Relationship")}<select class="input" name="relation"><option value="related">${text("مستند مرتبط", "Related document")}</option><option value="version">${text("إصدار جديد", "New version")}</option></select></label></div><button type="submit" class="secondary-btn">${text("حفظ المستند على الخادم", "Save document on server")}</button></form>`;
    host.append(section);
  }
  C.bind = () => {
    document.querySelector(".demo-box")?.remove();
    document
      .querySelector(".um-login-setup legend")
      ?.replaceChildren(
        document.createTextNode(
          text(
            "إنشاء بيانات دخول اختبار عبر الخادم",
            "Enroll test sign-in through server",
          ),
        ),
      );
    document
      .querySelectorAll(".um-login-setup .muted,.um-login-setup .um-checkbox")
      .forEach((n) => n.remove());
    document
      .querySelectorAll("#um-demoPassword,#um-demoConfirm")
      .forEach((n) => {
        n.disabled = false;
        n.required = true;
        n.closest(".form-group").querySelector("label").textContent =
          n.id.endsWith("Confirm")
            ? text("تأكيد كلمة المرور", "Confirm password")
            : text(
                "كلمة مرور حساب اختبار مركزي",
                "Central test account password",
              );
      });
    const note = text(
      "وضع مركزي تجريبي: الحفظ عبر الخادم فقط، دون نقل بيانات المتصفح. المستندات قيد الفحص لا تُعرض قبل اعتمادها. خدمات الاستعادة والإرسال والمهام المركزية غير مفعلة في هذه المرحلة.",
      "Central test mode: server-confirmed saves only; browser data is not imported. Quarantined documents cannot be downloaded. Recovery, sending services and central tasks are not enabled in this phase.",
    );
    document
      .querySelectorAll(
        ".bk-page > .company-desc,.company-document-note > .company-desc,.um-page > .company-desc,.cd-profile > .company-desc,.area-reference > .company-desc",
      )
      .forEach((n) => (n.textContent = note));
    if (C.actor) {
      let banner = document.getElementById("central-mode");
      if (!banner) {
        banner = document.createElement("p");
        banner.id = "central-mode";
        banner.className = "company-desc";
        document.querySelector(".main")?.prepend(banner);
      }
      banner.textContent = note;
    }
    if (C.notice) show(C.notice);
    document.querySelectorAll('[data-action="quick-task"]').forEach((b) => {
      b.disabled = true;
      b.title = note;
    });
    document
      .querySelector("#bk-doc-form button[type=submit]")
      ?.replaceChildren(
        document.createTextNode(
          text("حفظ المستندات على الخادم", "Save documents on server"),
        ),
      );
    const userSections = document.querySelectorAll(".um-page > section");
    if (userSections.length) {
      const auditSection = userSections[userSections.length - 1];
      auditSection.querySelector("h2").textContent = text(
        "سجل تدقيق الخادم",
        "Server audit trail",
      );
      const p = auditSection.querySelector("p");
      if (p)
        p.textContent = text(
          "محفوظ في قاعدة البيانات؛ المالك يرى سجل المجموعة والآخرون عملياتهم فقط.",
          "Stored in the database; owner sees group events, others see their own actions.",
        );
    }
    if (activeBank)
      panel(
        { bankAccountId: activeBank },
        document.querySelector(".bk-documents"),
      );
    if (activeCompany)
      panel(
        { companyId: activeCompany },
        document.querySelector(".cd-profile"),
      );
    if (activeUser)
      panel({ userId: activeUser }, document.querySelector(".um-editor"));
  };
  async function saveForm(form) {
    const fd = new FormData(form),
      kind = form.id;
    C.notice = "";
    document.getElementById("central-notice")?.remove();
    const stamp = JSON.stringify(
      [...fd]
        .filter(
          ([k]) => !["password", "demoPassword", "demoConfirm"].includes(k),
        )
        .map(([k, v]) => [
          k,
          typeof v === "string" ? v : [v.name, v.size, v.lastModified],
        ]),
    );
    if (form._centralStamp !== stamp) {
      for (const k of Object.keys(form.dataset))
        if (k !== "centralBusy" && k !== "savedId") delete form.dataset[k];
      form._centralStamp = stamp;
    }
    if (kind === "login-form") {
      await api("login", "POST", {
        username: fd.get("username"),
        password: fd.get("password"),
      });
      await load();
      return;
    }
    if (kind === "company-form" || kind === "cd-profile-form") {
      const data = values(form);
      delete data["baseRole"];
      const old =
        kind === "cd-profile-form" ? activeCompany : form.dataset.savedId;
      const row = app.state.companies.find((c) => c.id === old);
      if (row) data.revision = row.revision;
      const location = C.areaStore.selection(data.emirate, data.areaId);
      Object.assign(data, location);
      const logo = fd.get("logo");
      if (logo?.name) {
        if (
          logo.size > 512000 ||
          !["image/png", "image/jpeg", "image/webp"].includes(logo.type)
        )
          throw Error("Raster logo limit: 500 KB");
        data.logo = "data:" + logo.type + ";base64," + (await readFile(logo));
      }
      const result = await api(
        "companies" + (old ? "/" + old : ""),
        old ? "PATCH" : "POST",
        data,
        idempotency(form),
      );
      form.dataset.savedId = result.id;
      await load(false); // committed metadata survives an attachment failure; do not create it twice on retry
      for (const category of [
        "tradeLicense",
        "establishmentCard",
        "labourCard",
      ]) {
        const file = fd.get("cd-file-" + category);
        if (file?.name)
          await upload(
            { companyId: result.id },
            file,
            { category },
            idempotency(form, "file" + category),
          );
      }
      for (const [i, file] of fd.getAll("documents").entries())
        if (file.name)
          await upload(
            { companyId: result.id },
            file,
            {},
            idempotency(form, "genericFile" + i),
          );
      activeCompany = result.id;
      CompanyDocuments.centralSelect(result.id);
      await readDocuments({ companyId: result.id });
      await load();
    } else if (kind === "bk-account-form") {
      const data = values(form),
        old = activeBank || form.dataset.savedId,
        row = app.state.bankAccounts.find((b) => b.id === old);
      if (row) data.revision = row.revision;
      data.licenseId =
        row && row.companyId === data.companyId
          ? row.licenseId
          : app.state.companies.find((c) => c.id === data.companyId)
              ?.licenseId || null;
      const result = await api(
        "bank-accounts" + (old ? "/" + old : ""),
        old ? "PATCH" : "POST",
        data,
        idempotency(form),
      );
      activeBank = result.id;
      BankAccounts.centralSelect(result.id);
      await readDocuments({ bankAccountId: result.id }).catch(() => []);
      await load();
    } else if (kind === "um-profile") {
      const data = values(form, false);
      data.companyIds = form.elements.companyIds.disabled
        ? undefined
        : fd.getAll("companyIds");
      data.departmentIds = form.elements.departmentIds.disabled
        ? undefined
        : fd.getAll("departmentIds");
      if (activeUser)
        data.revision = app.state.users.find(
          (u) => u.id === activeUser,
        )?.revision;
      else {
        if (fd.get("demoPassword") !== fd.get("demoConfirm"))
          throw Error("mismatch");
        data.password = fd.get("demoPassword");
      }
      delete data.demoPassword;
      delete data.demoConfirm;
      const r = await api(
        "users" + (activeUser ? "/" + activeUser : ""),
        activeUser ? "PATCH" : "POST",
        data,
        idempotency(form),
      );
      activeUser = r.id;
      if (r.enrollmentUploadToken)
        C.enrollment.set(r.id, r.enrollmentUploadToken);
      form.dataset.savedId = r.id;
      await load(false);
      for (const slot of [
        "photo",
        "idFront",
        "idBack",
        "passport",
        "contract",
        "driving",
      ]) {
        const file = fd.get("file-" + slot);
        if (file?.name)
          await upload(
            { userId: r.id },
            file,
            { category: slot },
            idempotency(form, "file" + slot),
          );
      }
      await readDocuments({ userId: r.id }).catch(() => []);
      await load();
    } else if (kind === "um-grant") {
      const scope = String(fd.get("scope"));
      await api(
        "users/" + activeUser + "/grants",
        "POST",
        {
          action: fd.get("action"),
          scope: {
            type: scope,
            id: scope === "group" ? "" : fd.get("scopeId"),
          },
          delegable: fd.get("delegable") === "on",
        },
        idempotency(form),
      );
      await load();
    } else if (kind === "bk-doc-form") {
      const files = [...form.querySelector("input[type=file]").files];
      if (!files.length) throw Error("required");
      for (const [i, file] of files.entries()) {
        const parent = fd.get("parentId-" + i),
          all = C.documents.get("bankAccountId=" + activeBank) || [],
          original = all.find((d) => d.versionId === parent);
        await upload(
          { bankAccountId: activeBank },
          file,
          {
            category: fd.get("category-" + i),
            title: fd.get("title-" + i),
            description: fd.get("description-" + i) || "",
            date: fd.get("date-" + i),
            parentId: original?.id || null,
            parentVersionId: original?.versionId || null,
            relation: fd.get("relation-" + i),
          },
          idempotency(form, "doc" + i),
        );
      }
      await readDocuments({ bankAccountId: activeBank });
      BankAccounts.centralSelect(activeBank);
      await load();
    } else if (kind === "central-doc-form") {
      const owner = { companyId: form.dataset.company },
        rows = C.documents.get(new URLSearchParams(owner).toString()) || [],
        parent = rows.find((d) => d.versionId === fd.get("parentId"));
      await upload(
        owner,
        fd.get("file"),
        {
          title: fd.get("title"),
          description: fd.get("description") || "",
          date: fd.get("date"),
          category: fd.get("category"),
          relation: fd.get("relation"),
          parentId: parent?.id || null,
          parentVersionId: parent?.versionId || null,
        },
        idempotency(form),
      );
      await readDocuments(owner);
      await load();
    } else if (kind === "cd-thresholds") {
      await api(
        "settings/alerts",
        "PATCH",
        { days: fd.get("days") },
        idempotency(form),
      );
      await load();
    }
    show(
      text(
        "تم الحفظ والتحقق على قاعدة بيانات الخادم.",
        "Saved and verified by the server database.",
      ),
    );
  }
  const forms = new Set([
    "login-form",
    "company-form",
    "cd-profile-form",
    "bk-account-form",
    "um-profile",
    "um-grant",
    "bk-doc-form",
    "central-doc-form",
    "cd-thresholds",
  ]);
  document.addEventListener(
    "input",
    () => {
      C.notice = "";
      document.getElementById("central-notice")?.remove();
    },
    true,
  );
  document.addEventListener(
    "submit",
    async (event) => {
      if (!forms.has(event.target.id)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const form = event.target,
        button = form.querySelector("[type=submit]");
      if (form.dataset.centralBusy) return;
      form.dataset.centralBusy = "1";
      if (button) button.disabled = true;
      try {
        await saveForm(form);
      } catch (e) {
        if (form.dataset.savedId)
          show(
            text(
              "حُفظ سجل البيانات، لكن العملية التالية لم تكتمل؛ أعد المحاولة دون إنشاء سجل مكرر: ",
              "The record was committed, but a following step failed; retry without creating another record: ",
            ) + e.message,
          );
        else error(e);
      } finally {
        delete form.dataset.centralBusy;
        if (button?.isConnected) button.disabled = false;
      }
    },
    true,
  );
  document.addEventListener(
    "click",
    async (event) => {
      const b = event.target.closest("button");
      if (!b) return;
      const action = b.dataset.action,
        bk = b.dataset.bk,
        um = b.dataset.um,
        cd = b.dataset.cd;
      if (bk === "new") activeBank = null;
      if (bk === "close") activeBank = null;
      if (um === "new") activeUser = null;
      if (um === "close") activeUser = null;
      if (cd === "close") activeCompany = null;
      if (
        bk === "new" ||
        um === "new" ||
        bk === "close" ||
        um === "close" ||
        cd === "close"
      ) {
        C.notice = "";
        document.getElementById("central-notice")?.remove();
      }
      const special =
        action === "logout" ||
        action === "toggle-company-status" ||
        bk === "open" ||
        um === "profile" ||
        cd === "profile" ||
        um === "status" ||
        um === "revoke" ||
        um === "reset" ||
        bk === "reference" ||
        b.dataset.centralDownload ||
        /^(cd-)?area-save$/.test(b.id) ||
        b.id.endsWith("area-save") ||
        bk === "view-doc" ||
        bk === "download";
      if (!special) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      b.disabled = true;
      try {
        if (action === "logout") {
          await api("logout", "POST", {});
          C.actor = null;
          C.csrf = "";
          C.documents.clear();
          C.enrollment.clear();
          activeBank = activeCompany = activeUser = null;
          BankAccounts.logout();
          CompanyDocuments.logout();
          UserManagement.logout();
          AuthFlows.logout();
          app.state = C.emptyState();
          render();
        } else if (action === "toggle-company-status") {
          const r = app.state.companies.find(
            (c) => c.id === b.dataset.companyId,
          );
          await api("companies/" + r.id, "PATCH", {
            revision: r.revision,
            status: r.status === "Active" ? "Inactive" : "Active",
          });
          await load();
        } else if (bk === "open") {
          activeBank = b.dataset.id;
          await readDocuments({ bankAccountId: activeBank }).catch(() => []);
          BankAccounts.centralSelect(activeBank);
          await load();
        } else if (cd === "profile") {
          activeCompany = b.dataset.company;
          await readDocuments({ companyId: activeCompany }).catch(() => []);
          CompanyDocuments.centralSelect(activeCompany);
          await load();
        } else if (um === "profile") {
          activeUser = b.dataset.id;
          await readDocuments({ userId: activeUser }).catch(() => []);
          await load();
        } else if (um === "status") {
          const r = app.state.users.find((u) => u.id === b.dataset.id);
          await api("users/" + r.id, "PATCH", {
            revision: r.revision,
            status: r.status === "Active" ? "Disabled" : "Active",
          });
          await load();
        } else if (um === "revoke") {
          await api("users/" + activeUser + "/revoke", "POST", {
            grantId: b.dataset.grant,
          });
          await load();
        } else if (um === "reset") {
          show(
            text(
              "خدمة إعادة التعيين غير مفعلة؛ لم يُرسل طلب أو تُغيّر كلمة مرور.",
              "Reset is not configured; no request was sent and no password changed.",
            ),
          );
        } else if (bk === "reference") {
          const kind = document.getElementById("bk-ref-kind").value,
            r = await api("references/" + kind, "POST", {
              ar: document.getElementById("bk-ref-ar").value,
              en: document.getElementById("bk-ref-en").value,
            });
          await load(false);
          const select = document.getElementById(
            kind === "bank" ? "bk-bankId" : "bk-purposeId",
          );
          select.add(new Option(getLocale() === "ar" ? r.ar : r.en, r.id));
          select.value = r.id;
          show(text("حُفظ المرجع على الخادم.", "Reference saved on server."));
        } else if (b.id.endsWith("area-save")) {
          const prefix = b.id.slice(0, -"area-save".length),
            form = b.closest("form"),
            r = await api("areas", "POST", {
              emirateId: C.areaStore.emirateId(form.elements.emirate.value),
              ar: document.getElementById(prefix + "area-name-ar").value,
              en: document.getElementById(prefix + "area-name-en").value,
            });
          await load(false);
          const a = C.areaStore.getArea(r.id),
            select = form.elements.areaId;
          if (![...select.options].some((o) => o.value === r.id))
            select.add(new Option(a.en || a.ar, r.id));
          select.value = r.id;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          document.getElementById(prefix + "area-new").hidden = true;
          show(
            text(
              "حُفظت المنطقة مركزياً واختيرت.",
              "Area saved centrally and selected.",
            ),
          );
        } else {
          let versionId = b.dataset.centralDownload || b.dataset.doc;
          const r = await fetch(
            "/api/documents/" + encodeURIComponent(versionId) + "/file",
            { credentials: "same-origin" },
          );
          if (!r.ok) throw Error((await r.json()).error);
          const url = URL.createObjectURL(await r.blob()),
            a = document.createElement("a");
          a.href = url;
          a.download = "document";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
      } catch (e) {
        error(e);
      } finally {
        if (b.isConnected) b.disabled = false;
      }
    },
    true,
  );
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      await load();
    } catch (e) {
      C.ready = true;
      if (e.message === "loginRequired") {
        C.actor = null;
        render();
      } else {
        C.loading();
        document.getElementById("app").textContent =
          "Central backend unavailable. Reload to retry; browser data was not read or overwritten.";
      }
    }
  });
})();
