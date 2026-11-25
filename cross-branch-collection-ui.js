(function(root) {
  'use strict';
  const base = 'ledger/collections/cross-branch-';
  const t = (ar, en) => getLocale() === 'ar' ? ar : en;
  const title = () => t('التحصيل عبر الفروع', 'Cross-branch collection');
  const idPattern = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  const amountPattern = '[0-9]{1,15}([.][0-9]{1,3})?';
  let opened;

  const capability = () => !ABCentral.viewAs && !ABCentral.previewUncertain && ABCentral.actor && ABCentral.crossBranchCollection;
  function entry() {
    return capability() ? `<button type="button" class="ghost-btn" data-cross-branch-collection>${title()}</button>` : '';
  }

  function open() {
    const access = capability();
    if (!access || opened?.isConnected) return;
    const version = ABCentral.authorityVersion;
    const dialog = document.createElement('dialog');
    opened = dialog;
    dialog.dataset.centerOwned = '1';
    dialog.className = 'record-form-dialog cross-branch-collection-dialog';
    const field = (name, label, pattern) =>
      `<label>${label}<input class="input" name="${name}" dir="ltr" pattern="${pattern}" required autocomplete="off"></label>`;
    const checkbox = label => `<label><input name="actual" type="checkbox" required> ${label}</label>`;
    const button = label => `<button class="primary-btn" type="submit">${label}</button>`;
    dialog.innerHTML = `
      <h2>${title()}</h2>
      <form data-lookup class="form-grid">
        ${field('companyId', t('معرّف شركة الدين', 'Debt company ID'), idPattern)}
        ${field('invoiceId', t('معرّف الفاتورة', 'Invoice ID'), idPattern)}
        ${button(t('تحقق من الفاتورة', 'Verify invoice'))}
      </form>
      <form data-report class="form-grid" hidden>
        <p data-invoice></p>
        ${field('amount', t('المبلغ المستلم بالدرهم', 'Cash received in AED'), amountPattern)}
        ${checkbox(t('استلمت هذا المبلغ نقداً', 'I received this amount in cash'))}
        ${button(t('حفظ بلاغ الاستلام', 'Save cash report'))}
      </form>
      <form data-status class="form-grid">
        ${field('reportId', t('معرّف البلاغ', 'Cash report ID'), idPattern)}
        ${button(t('عرض حالة البلاغ', 'Check report status'))}
      </form>
      <p data-record></p>
      ${access.canConfirm ? `<form data-confirm class="form-grid" hidden>
        ${field('amount', t('المبلغ المجرد بالدرهم', 'Independently counted AED amount'), amountPattern)}
        ${checkbox(t('تحققت فعلياً من النقد', 'I independently verified the cash'))}
        ${button(t('تأكيد وترحيل السند', 'Confirm and post receipt'))}
      </form>` : ''}
      <p role="status" aria-live="polite"></p>
      <button class="secondary-btn" type="button" data-close>${t('إغلاق', 'Close')}</button>`;
    const lookup = dialog.querySelector('[data-lookup]');
    const report = dialog.querySelector('[data-report]');
    const status = dialog.querySelector('[data-status]');
    const confirm = dialog.querySelector('[data-confirm]');
    const notice = dialog.querySelector('[role=status]');
    let verified, reviewed, pending, busy = false;
    function close() {
      dialog.remove();
    }
    function requireCurrent() {
      if (version !== ABCentral.authorityVersion || !capability()) {
        close();
        throw Error('staleSession');
      }
    }
    async function request(path, method, data, key) {
      requireCurrent();
      const result = await ABCentral.api(base + path, method, data, key, {timeoutMs: 15000});
      requireCurrent();
      return result;
    }
    async function write(form, path, data) {
      if (!pending) pending = {form, path, data, key: crypto.randomUUID()};
      const attempt = pending;
      try {
        const result = await request(attempt.path, 'POST', attempt.data, attempt.key);
        pending = null;
        return result;
      } catch (error) {
        if ([400, 403, 404, 409, 422].includes(error.status) || error.message === 'crossBranchCollectionNotEnabled') pending = null;
        throw error;
      }
    }
    function controls() {
      for (const form of [lookup, report, status, confirm].filter(Boolean)) {
        for (const input of form.elements)
          input.disabled = busy || !!pending && (form !== pending.form || input.type !== 'submit');
      }
      dialog.querySelector('[data-close]').disabled = busy || !!pending;
    }
    function bind(form, action) {
      form.onsubmit = async event => {
        event.preventDefault();
        if (busy || pending && pending.form !== form) return;
        busy = true;
        notice.textContent = '';
        controls();
        try {
          requireCurrent();
          await action();
        } catch (error) {
          const reason = {
            denied: t('الوصول غير متاح لهذا المرجع.', 'Access is unavailable for this reference.'),
            notFound: t('تعذر العثور على المرجع ضمن صلاحيتك.', 'The reference is unavailable within your access.'),
            crossBranchReceivingSiteChanged: t('تغير موقع الاستلام. أعد التحقق من الفاتورة.', 'Receiving site changed. Verify the invoice again.'),
            amountMismatch: t('المبلغ لا يطابق البلاغ.', 'The amount does not match the report.'),
            independentVerifierRequired: t('يتطلب البلاغ تأكيد مالك مستقل.', 'An independent Owner must confirm this report.'),
            crossBranchIntakeAlreadyPosted: t('رُحّل البلاغ بالفعل. اعرض حالته.', 'This report was already posted. Check its status.'),
          }[error.message];
          notice.textContent = pending
            ? t('تعذر تأكيد النتيجة. أعد الضغط لإرسال الطلب نفسه.', 'The outcome is unconfirmed. Press submit to retry the same request.')
            : reason || t('تعذر إكمال الطلب. تحقق من البيانات وحاول مجدداً.', 'Request could not be completed. Check the inputs and try again.');
        } finally {
          busy = false;
          controls();
        }
      };
    }
    const value = (form, name) => form.elements[name].value.trim();
    bind(lookup, async () => {
      verified = null;
      report.hidden = true;
      report.reset();
      const query = new URLSearchParams({companyId: value(lookup,'companyId'), invoiceId: value(lookup,'invoiceId')});
      verified = await request('invoice?' + query);
      const {invoice, receivedOn} = verified;
      dialog.querySelector('[data-invoice]').textContent = `${t('الفاتورة','Invoice')} #${invoice.number} · ${t('المتبقي','Outstanding')} ${invoice.outstanding} ${invoice.currency} · ${receivedOn}`;
      report.hidden = false;
    });
    lookup.oninput = () => { verified = null; report.hidden = true; };
    bind(report, async () => {
      if (!pending && !verified) return;
      const data = pending?.data || {
        invoiceId: verified.invoice.id, companyId: verified.invoice.companyId,
        receivingSite: verified.receivingSite, receivedOn: verified.receivedOn,
        amount: value(report,'amount'), actualCashReceived: report.elements.actual.checked,
      };
      const result = await write(report, 'intake', data);
      status.elements.reportId.value = result.id;
      report.reset();
      report.hidden = true;
      verified = null;
      notice.textContent = t('حُفظ البلاغ بانتظار التأكيد. شارك معرّفه مع المالك المخوّل.', 'Report saved for confirmation. Share its ID with the authorized Owner.');
    });
    function clearReview() {
      reviewed = null;
      dialog.querySelector('[data-record]').textContent = '';
      if (confirm) { confirm.hidden = true; confirm.reset(); }
    }
    status.oninput = clearReview;
    bind(status, async () => {
      clearReview();
      reviewed = await request('intake/' + encodeURIComponent(value(status,'reportId')));
      const state = reviewed.state === 'posted' ? t('مرحّل', 'Posted') : t('بانتظار التأكيد', 'Awaiting confirmation');
      dialog.querySelector('[data-record]').textContent = `${state} · ${reviewed.amount} AED · ${reviewed.receivedOn} · ${t('فاتورة','Invoice')} ${reviewed.invoiceId} · ${t('شركة الدين','Debt company')} ${reviewed.companyId}`;
      if (confirm) confirm.hidden = reviewed.state !== 'reported' || reviewed.reportedBy === ABCentral.actor.id;
    });
    if (confirm) bind(confirm, async () => {
      if (!pending && !reviewed) return;
      const path = pending?.path || 'intake/' + encodeURIComponent(reviewed.id) + '/post';
      await write(confirm, path, pending?.data || {confirmedAmount: value(confirm,'amount'), confirmActualCash: confirm.elements.actual.checked});
      clearReview();
      notice.textContent = t('تم تأكيد البلاغ وترحيل السند.', 'Report confirmed and receipt posted.');
    });
    dialog.addEventListener('cancel', event => { if (busy || pending) event.preventDefault(); });
    dialog.addEventListener('close', close, {once:true});
    dialog.querySelector('[data-close]').onclick = close;
    document.body.append(dialog);
    dialog.showModal();
  }

  root.CrossBranchCollectionUI = {entry, open};
})(globalThis);
