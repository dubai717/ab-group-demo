/* Central financial UI. Drafts are memory-only; saving is acknowledged only by server commit. */
(function (root) {
    'use strict';
    let preferencesLoaded = false;
    let cap = null, book = null, co = '', tab = 'dashboard', actor = '', epoch = 0, busy = false, notice = '', customers = [], vehicles = [], docs = [], bills = [], report = null, preview = null, selected = '', drafts = {}, context = null, importJob = null;
    const t = (a, b) => getLocale() === 'ar' ? a : b, e = x => WorkspaceUI.esc(x ?? ''), now = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date()), L = LedgerPolicy;
    const labels = { dashboard: ['الرقابة المالية', 'Financial control'], invoices: ['الفواتير', 'Invoices'], collect: ['تنظيم تحصيل', 'Organize collection'], custody: ['العهد والتسليم', 'Custody & handover'], deposits: ['الإيداعات', 'Deposits'], vouchers: ['سندات الصرف المعلقة', 'Pending payment vouchers'], funds: ['الصناديق والنثريات', 'Funds & petty cash'], cards: ['بطاقات الائتمان', 'Credit cards'], journals: ['القيود', 'Journals'], reports: ['القوائم والتقارير', 'Statements & reports'], work: ['Work Amount', 'Work Amount'], intercompany: ['التحويلات بين الشركات', 'Intercompany transfers'], reconciliation: ['المطابقة البنكية والبطاقات', 'Bank/card reconciliation'], setup: ['دليل الحسابات والبنود', 'Accounts & financial items'], import: ['استيراد الفواتير', 'Invoice import'], closing: ['الإغلاق المالي', 'Financial closing'] };
    const words = { id: ['المرجع', 'Reference'], invoiceNumber: ['رقم الفاتورة', 'Invoice number'], receipt_number: ['رقم السند', 'Receipt number'], number: ['الرقم', 'Number'], amount: ['المبلغ', 'Amount'], paid: ['المحصل', 'Paid'], outstanding: ['المستحق', 'Outstanding'], status: ['الحالة', 'Status'], currency: ['العملة', 'Currency'], kind: ['النوع', 'Type'], name: ['الاسم', 'Name'], name_ar: ['الاسم العربي', 'Arabic name'], name_en: ['الاسم الإنجليزي', 'English name'], code: ['الرمز', 'Code'], balance: ['الرصيد', 'Balance'], refill: ['التغذية المطلوبة', 'Refill required'], actual: ['المستلم فعلياً', 'Actually received'], debit: ['مدين', 'Debit'], credit: ['دائن', 'Credit'], net: ['الصافي', 'Net'], company_id: ['الشركة', 'Company'], holder_id: ['الموظف', 'Employee'], dueOn: ['الاستحقاق', 'Due date'], last_four: ['آخر أربعة أرقام', 'Last four'], payment_state: ['حالة التحصيل', 'Collection state'], Active: ['نشط', 'Active'], Pending: ['معلق', 'Pending'], Approved: ['معتمد', 'Approved'], Paid: ['مسدد', 'Paid'], Review: ['للمراجعة', 'Review'], Cleared: ['محصل فعلياً', 'Cleared'], Returned: ['مرتجع', 'Returned'], Partial: ['مسدد جزئياً', 'Partial'], Unpaid: ['غير مسدد', 'Unpaid'], Posted: ['مرحل', 'Posted'], Draft: ['مسودة', 'Draft'], Cancelled: ['ملغى', 'Cancelled'], Corrected: ['مصحح', 'Corrected'] };
    const label = k => labels[k] ? t(...labels[k]) : words[k] ? t(...words[k]) : k;
    Object.assign(words, { cash: ['نقد', 'Cash'], cheque: ['شيك', 'Cheque'], transfer: ['تحويل بنكي', 'Bank transfer'], manual: ['يدوي', 'Manual'], automatic: ['تلقائي بالأولوية', 'Automatic by priority'], monthly: ['شهري', 'Monthly'], annual: ['سنوي', 'Annual'], none: ['بدون تكرار', 'No recurrence'], trial: ['ميزان المراجعة', 'Trial balance'], balance: ['الميزانية العمومية', 'Balance sheet'], profit: ['الربح والخسارة', 'Profit and loss'], cashflow: ['حركات نقدية مصنفة', 'Classified cash movements'], ledger: ['الأستاذ العام', 'General ledger'], journal: ['اليومية', 'Journal'], receivables: ['المستحقات وأعمار الديون', 'Receivables and ageing'], custody: ['العهد', 'Custody'], vouchers: ['سندات الصرف', 'Payment vouchers'], cards: ['البطاقات', 'Cards'], kpi: ['وقائع الأداء', 'Performance facts'], vat: ['تقرير ضريبة إداري', 'Tax management report'], asset: ['أصل', 'Asset'], liability: ['التزام', 'Liability'], equity: ['حقوق الملكية', 'Equity'], income: ['إيراد', 'Income'], expense: ['مصروف', 'Expense'] });
    Object.assign(words, { collections: ['التحصيل الفعلي', 'Actual collections'], deposits: ['الإيداعات', 'Deposits'], cheques: ['الشيكات', 'Cheques'], funds: ['الصناديق', 'Funds'], intercompany: ['الحسابات المتقابلة', 'Intercompany'], installments: ['التمويلات والأقساط', 'Financing & installments'], adjustments: ['الخصومات والشطب', 'Credits & write-offs'], profitability: ['ربحية البنود', 'Item profitability'] });
    const errors = { ledgerSchemaPending: ['الترحيل المالي 012 لم يُعتمد أو يُطبّق بعد. تبقى الوحدات السابقة متاحة.', 'Financial migration 012 has not been approved/applied. Previous modules remain available.'], accountMappingRequired: ['أكمل ربط الحسابات المحاسبية لهذا البند والشركة والعملة.', 'Complete account mappings for this item, company and currency.'], priorityOverrideRequired: ['يوجد بند أعلى أولوية؛ استخدم التوزيع التلقائي أو تفويض تجاوز الأولوية مع السبب.', 'A higher priority item is due. Use automatic allocation or delegated override with a reason.'], documentQuarantined: ['المستند محجور حتى فحصه فعلياً.', 'Evidence is quarantined until actually scanned.'], periodClosed: ['الفترة المالية مغلقة؛ استخدم فترة مفتوحة.', 'Financial period is closed; use an open period.'], closingChecklistIncomplete: ['توجد التزامات أو مطابقات معلقة؛ راجع قائمة الإغلاق.', 'Outstanding obligations or reconciliations prevent closing.'], denied: ['الإجراء خارج نطاق التفويض.', 'Action is outside delegated scope.'], duplicate: ['المستند أو المرجع موجود؛ لم ينشأ تكرار.', 'Document/reference already exists; no duplicate created.'], insufficientCustody: ['الرصيد المتاح في العهدة غير كافٍ.', 'Available custody is insufficient.'], unresolvedDifference: ['توجد فروقات تحتاج مراجعة فعلية.', 'Unresolved differences require actual review.'] };
    const message = x => errors[x] ? t(...errors[x]) : t('تعذر الحفظ. راجع البيانات والصلاحيات؛ بقيت المدخلات في النموذج.', 'Save failed. Check fields and permissions; input remains in this form.') + ' (' + x + ')';
    const api = async (path, method = 'GET', data, key) => {
        const n = epoch, who = ABCentral.actor?.id, r = await ABCentral.api('ledger/' + path, method, data, key);
        if (n !== epoch || who !== ABCentral.actor?.id)
            throw Error('staleSession');
        return r;
    };
    const allowed = x => book?.rights.includes('ledger_' + x), opts = (rows, value) => '<option value="">—</option>' + rows.map(r => `<option value="${e(r.id)}" ${String(r.id) === String(value) ? 'selected' : ''}>${e(r.name || r.name_en || r.englishName || r.accountName || r.title || r.fullName || r.fileNumber || r.id)}</option>`).join('');
    const choice = values => values.map(v => ({ id: v, name: v === 'balance' ? t('الميزانية العمومية', 'Balance sheet') : label(v) }));
    function f(name, ar, en, type = 'text', value = '', options = null, required = true) { return { name, title: t(ar, en), type, value, options, required }; }
    function field(x, key) { const v = drafts[key]?.[x.name] ?? x.value, required = x.required ? 'required' : ''; return `<label>${e(x.title)}${x.required ? ' *' : ''}${x.options ? `<select class="input" name="${x.name}" ${required}>${opts(x.options, v)}</select>` : x.type === 'checkbox' ? `<input type="checkbox" name="${x.name}" ${v ? 'checked' : ''} />` : x.type === 'textarea' ? `<textarea class="input" name="${x.name}" ${required}>${e(v)}</textarea>` : `<input class="input" name="${x.name}" type="${x.type}" value="${x.type === 'file' ? '' : e(v)}" ${required} ${x.type === 'file' ? 'accept=".csv,.xlsx,.pdf,.png,.jpg,.jpeg,.webp"' : ''} />`}</label>`; }
    function form(key, title, fields, button = t('حفظ البيانات', 'Save data'), right = null, extra = '') {
        if (right && !allowed(right))
            return '';
        return `<details class="ld-form-section" ${['collect', 'collection-filter', 'invoice'].includes(key) ? 'open' : ''}><summary>${e(title)}</summary><form class="form-grid ld-form" data-ld-form="${key}">${fields.map(x => field(x, key)).join('')}${extra}<div class="full"><button class="primary-btn" type="submit">${e(button)}</button></div></form></details>`;
    }
    const btn = (action, text, id = '') => `<button class="ghost-btn" type="button" data-ld="${action}" data-id="${e(id)}">${e(text)}</button>`;
    const registerScope=()=>`ledger:${tab}:${co}${tab==='reports'?':'+JSON.stringify([drafts.report?.kind||'trial',drafts.report?.from||'',drafts.report?.to||'',drafts.report?.companies||'',drafts.report?.currency||'',drafts.report?.groupBy||'day']):''}`;
    function table(rows,columns,actions){const source=Object.keys(book||{}).find(k=>book[k]===rows&&Array.isArray(book[k]))||(rows===bills?'invoices':null),key=rows===report?.rows?'report':undefined;return FinancialTables.table(registerScope(),[...columns.map(label),...(actions?[t('الإجراء','Action')]:[])],rows.map(r=>[...columns.map(k=>e(k==='holder_id'?book.users.find(u=>u.id===r[k])?.name||r[k]:['status','kind','payment_state'].includes(k)?label(r[k]):r[k])),...(actions?[actions(r)]:[])]),{key,ignoreSearch:!source&&key!=='report',columns:[...columns,...(actions?[null]:[])],rawRows:rows,source,endpoint:'ledger/register-view',companyId:co,canExport:allowed('report')&&allowed('export'),canPrint:allowed('report')&&allowed('print'),display:(k,v)=>k==='holder_id'?book.users.find(u=>u.id===v)?.name||v:['status','kind','payment_state'].includes(k)?label(v):v});}
    const amounts = () => [f('amount', 'المبلغ', 'Amount', 'text', ''), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('effectiveOn', 'تاريخ العملية', 'Effective date', 'date', now())];
    const itemFields = () => [f('itemId', 'البند المالي', 'Financial item', 'select', '', book.finance_items)];
    const dateFields = () => [f('issuedOn', 'تاريخ الإصدار', 'Issue date', 'date', now()), f('dueOn', 'تاريخ الاستحقاق', 'Due date', 'date', now())];
    const refFields = () => [f('customerId', 'العميل', 'Customer', 'select', context?.customerId || '', customers), f('vehicleId', 'المركبة (اختياري)', 'Vehicle (optional)', 'select', context?.vehicleId || '', vehicles, false)];
    const proofField = () => f('documentVersionId', 'المستند — محجور حتى الفحص', 'Evidence — quarantined until scanned', 'select', '', docs);
    const accountOptions = () => book.finance_chart.map(r => ({ ...r, name: r.code + ' — ' + r.name_en + ' ' + r.currency }));
    const defs = () => book.finance_accounts.map(r => ({ ...r, name: r.code + ' — ' + r.name_en }));
    const users = () => book.users;
    async function references() {
        const n = epoch, who = ABCentral.actor?.id;
        const results = await Promise.allSettled([ABCentral.api('customers?limit=100'), ABCentral.api('vehicles?companies=' + co + '&limit=100'), ABCentral.api('documents?companyId=' + co)]);
        if (n !== epoch || who !== ABCentral.actor?.id)
            return;
        customers = results[0].status === 'fulfilled' ? results[0].value.rows || [] : [];
        vehicles = results[1].status === 'fulfilled' ? (results[1].value.rows || []).map(r => ({ ...r, name: '#' + r.fileNumber + ' ' + (r.plate || '') })) : [];
        docs = results[2].status === 'fulfilled' ? results[2].value.map(r => ({ id: r.versionId, name: r.title + ' v' + r.version + ' — ' + r.scanStatus })) : [];
    }
    async function load() {
        if (busy)
            return;
        busy = true;
        const n = epoch;
        try {
            cap = await api('capabilities');
            if (cap.available && !preferencesLoaded) {
                const p = await api('preferences');
                preferencesLoaded = true;
                if (!context && cap.companies.some(c => c.id === p.companyId)) {
                    co = p.companyId;
                    if (labels[p.tab])
                        tab = p.tab;
                }
            }
            if (!co || !cap.companies.some(c => c.id === co))
                co = cap.companies[0]?.id || '';
            if (cap.available && co) {
                book = await api('workbench?companyId=' + co);
                await references();
                if (context || tab === 'invoices')
                    bills = (await api('invoices?' + new URLSearchParams({ companyId: co, ...(context?.customerId ? { customerId: context.customerId } : {}), ...(context?.vehicleId ? { vehicleId: context.vehicleId } : {}) }))).rows;
                if (tab === 'collect')
                    bills = context ? bills.filter(r => r.customer_id === context.customerId && r.vehicle_id === (context.vehicleId || null) && (!context.targetInvoiceId || r.id===context.targetInvoiceId)) : [];
            }
        }
        catch (err) {
            if (n === epoch)
                notice = message(err.message);
        }
        finally {
            if (n === epoch) {
                busy = false;
                if (app.state.currentPage === 'financialManagement')
                    render();
            }
        }
    }
    function reset() { epoch++; preferencesLoaded = false; cap = book = null; co = ''; actor = ''; busy = false; customers = []; vehicles = []; docs = []; bills = []; report = preview = importJob = context = null; drafts = {}; notice = ''; tab = 'dashboard'; }
    function body() {
        const items = book.finance_items, accounts = accountOptions();
        if (tab === 'dashboard')
            return `<p>${t('الأرصدة من قيود فعلية؛ العملات والشركات منفصلة. الشيك المعلق لا يسدد فاتورة. OCR والربط المصرفي وWhatsApp غير مفعلة.', 'Balances come from actual entries; companies/currencies stay separate. Pending cheques do not pay invoices. OCR, bank feeds and WhatsApp are inactive.')}</p><div class="ve-summary">${[['collect', t('سندات القبض', 'Receipts'), book.receipts.length], ['custody', t('العهد المفتوحة', 'Open custody'), book.custody.length], ['vouchers', t('صرف معلق', 'Pending vouchers'), book.finance_vouchers.filter(v => v.status === 'Pending').length], ['deposits', t('إيداعات للمراجعة', 'Deposits in review'), book.finance_deposits.filter(v => v.status === 'Review').length], ['cards', t('البطاقات', 'Cards'), book.finance_cards.length]].map(([v, title, n]) => '<article>' + btn('tab', title + ' — ' + n, v) + '</article>').join('')}</div>${btn('run-recurring', t('إصدار البنود الدورية المعرفة', 'Issue configured recurring items'))}${btn('reminders', t('فحص مواعيد الإيداع والبطاقات', 'Check deposit/card deadlines'))}<p>${t('التنبيهات المجدولة تحتاج تفعيل عامل التشغيل؛ هذا الزر ينفذ الفحص الفعلي الآن.', 'Scheduled reminders require an enabled worker; this button performs an actual check now.')}</p>`;
        if (tab === 'invoices')
            return form('invoice', t('فاتورة مستقلة لكل بند', 'Separate invoice per item'), [...refFields(), ...itemFields(), f('amount', 'المبلغ', 'Amount'), f('currency', 'العملة', 'Currency', 'text', 'AED'), ...dateFields(), f('sourceKey', 'مرجع مصدر فريد', 'Unique source reference'), f('description', 'الوصف', 'Description', 'textarea', '', null, false)], undefined, 'invoice_create') + table(bills, ['invoiceNumber', 'name_en', 'dueOn', 'amount', 'paid', 'outstanding', 'status'], r => btn('invoice-correct', t('تصحيح دون حذف', 'Correct without deleting'), r.id)) + form('adopt', t('تصنيف فاتورة مركبة قائمة في الدفتر (غير مسددة وغير معدلة)', 'Classify existing vehicle invoice (unpaid/unadjusted)'), [f('invoiceId', 'مرجع الفاتورة القائمة', 'Existing invoice reference'), ...itemFields(), f('issuedOn', 'تاريخ التصنيف المحاسبي', 'Accounting classification date', 'date', now()), f('confirmHistoricalClassification', 'تأكيد مراجعة التصنيف', 'Confirm classification review', 'checkbox', false)], undefined, 'journal_approve');
        if (tab === 'collect') {
            if (!context)
                bills = [];
            const grouped = new Map();
            for (const bill of bills.filter(b => L.units(b.outstanding) > 0n)) {
                const k = bill.item_id;
                if (!grouped.has(k))
                    grouped.set(k, { id: k, name: bill.name_en, amount: 0n });
                grouped.get(k).amount += L.units(bill.outstanding);
            }
            const rows = [...grouped.values()];
            return btn('credit-apply', t('تطبيق رصيد دائن سابق', 'Apply existing credit')) + form('collection-filter', t('عرض المستحقات', 'Load dues'), [...refFields(), f('currency', 'العملة', 'Currency', 'text', context?.currency||'AED')], t('عرض', 'Show')) + form('collect', t('تحديد البنود وطريقة واحدة للعملية', 'Select items and one payment method'), [...refFields(), f('currency', 'العملة', 'Currency', 'text', context?.currency||'AED'), f('receivedOn', 'تاريخ القبض', 'Receipt date', 'date', now()), f('method', 'وسيلة الدفع', 'Payment method', 'select', 'cash', choice(['cash', 'cheque', 'transfer'])), f('mode', 'التوزيع', 'Allocation', 'select', 'manual', choice(context?.targetInvoiceId?['manual']:['manual', 'automatic'])), f('amount', 'إجمالي العملية', 'Batch total'), f('operationId', 'التحويل المصرفي المعتمد (للتحويل فقط)', 'Approved bank receipt (transfer only)', 'text', '', null, false), f('overridePriority', 'تجاوز الأولوية بتفويض', 'Delegated priority override', 'checkbox', false), f('reason', 'سبب التجاوز', 'Override reason', 'text', '', null, false), f('chequeNumber', 'رقم الشيك (للشيك فقط)', 'Cheque number (cheque only)', 'text', '', null, false), f('bankAccountId', 'حساب إيداع الشيك', 'Cheque deposit account', 'select', '', book.banks, false), f('beneficiary', 'اسم مقدم الشيك', 'Cheque payer', 'text', '', null, false), ...dateFields()], t('تنظيم سند مستقل لكل بند', 'Create separate receipt per item'), 'collect', `<div class="full">${rows.map(r => `<label class="ld-item"><input type="checkbox" name="selectedItem" value="${e(r.id)}"/>${e(r.name)} — ${L.money(r.amount)}<input class="input" name="take-${e(r.id)}" value="${L.money(r.amount)}" aria-label="${t('المبلغ المطلوب', 'Requested amount')}" /></label>`).join('') || '<p>' + t('لا توجد فواتير مصنفة. صنّف فواتير المركبة أولاً؛ لا تُنشأ مستحقات افتراضية.', 'No classified invoices. Classify vehicle invoices first; no fabricated dues.') + '</p>'}</div>`) + table(book.receipts, ['receipt_number', 'kind', 'amount', 'currency', 'payment_state'], r => r.payment_state === 'Pending' ? btn('cheque-resolve', t('تأكيد التحصيل / الارتجاع', 'Confirm clearing / return'), r.id) : '');
        }
        if (tab === 'custody')
            return table(book.custody, ['holder_id', 'kind', 'amount', 'currency']) + form('route', t('مسار التسليم والبديل المؤقت', 'Handover route / temporary substitute'), [f('senderId', 'المسلّم', 'Sender', 'select', '', users()), f('receiverId', 'المستلم', 'Receiver', 'select', '', users()), f('effectiveOn', 'سريان المسار', 'Effective date', 'date', now()), f('untilOn', 'انتهاء البديل (اختياري)', 'Substitute end (optional)', 'date', '', null, false)], undefined, 'configure') + form('handover', t('طلب تسليم من عهدتي', 'Request handover from my custody'), [f('receiverId', 'المستلم المحدد', 'Nominated recipient', 'select', '', users()), f('kind', 'وسيلة العهدة', 'Custody method', 'select', 'cash', choice(['cash', 'cheque'])), f('amount', 'المبلغ', 'Amount'), f('currency', 'العملة', 'Currency', 'text', 'AED')], undefined, 'hand_over') + table(book.finance_custody_transfers, ['id', 'amount', 'actual', 'currency', 'status'], r => r.status === 'Pending' ? btn('receive', t('تأكيد المستلم الفعلي', 'Acknowledge actual receipt'), r.id) : '');
        if (tab === 'deposits')
            return form('deposit', t('إيداع جزئي أو كامل — لا يغلق العهدة قبل التأكيد', 'Partial/full deposit — custody stays open until confirmed'), [f('bankAccountId', 'الحساب النشط', 'Active account', 'select', '', book.banks.filter(b => b.status === 'Active')), ...amounts(), proofField(), f('reference', 'مرجع الإيداع', 'Deposit reference')], undefined, 'deposit') + form('document', t('رفع مستند مالي إلى الأرشيف الخاص', 'Upload financial evidence to private archive'), [f('title', 'عنوان المستند', 'Document title'), f('date', 'تاريخ المستند', 'Document date', 'date', now()), f('file', 'PDF أو صورة', 'PDF or image', 'file')]) + table(book.finance_deposits, ['id', 'amount', 'confirmed', 'currency', 'status'], r => r.status === 'Review' ? btn('deposit-confirm', t('مراجعة يدوية وتأكيد مبلغ', 'Manual review / confirm amount'), r.id) : '');
        if (tab === 'vouchers')
            return form('voucher', t('سند صرف — يبقى معلقاً حتى الاعتماد', 'Payment voucher — pending approval'), [...itemFields(), f('customerId', 'العميل إن انطبق', 'Customer if applicable', 'select', '', customers, false), f('amount', 'المبلغ', 'Amount'), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('issuedOn', 'تاريخ السند', 'Voucher date', 'date', now()), f('beneficiary', 'المستفيد', 'Beneficiary'), f('reason', 'السبب', 'Reason'), f('sourceKey', 'مرجع الاستحقاق الفريد', 'Unique entitlement reference')], undefined, 'voucher_create') + `<form data-ld-form="approval">${FinancialTables.table(registerScope(),['✓',label('number'),label('amount'),label('status'),t('الإجراء','Action')],book.finance_vouchers.map(r=>[`<input type="checkbox" name="voucherId" value="${e(r.id)}" ${r.status!=='Pending'?'disabled':''}/>`,`${e(r.number)}${r.details.beneficiary?' — '+e(r.details.beneficiary):''}`,`${e(r.amount)} ${e(r.currency)}`,label(r.status),(r.status==='Pending'&&!r.cheque_id?btn('prepare',t('تجهيز الشيك','Prepare cheque'),r.id):r.status==='Approved'?btn('settle',t('تأكيد صرف البنك','Confirm bank clearing'),r.id):'')+(['Pending','Approved'].includes(r.status)?btn('cancel-voucher',t('إلغاء موثق','Documented cancellation'),r.id):'')]),{key:'vouchers',columns:[null,'number','amount','status',null],rawRows:book.finance_vouchers,source:'finance_vouchers',endpoint:'ledger/register-view',companyId:co,canExport:allowed('report')&&allowed('export'),canPrint:allowed('report')&&allowed('print'),display:(k,v)=>k==='status'?label(v):v})}<label><input type="checkbox" name="signedEvidence" required/>${t('تحققت من التوقيع والمستند', 'I verified signature/evidence')}</label><button class="primary-btn">${t('اعتماد المحدد — معاينة', 'Approve selected — preview')}</button></form>${preview ? `<section class="ld-confirm"><h3>${t('تأكيد الاعتماد النهائي', 'Final approval confirmation')}</h3><p>${preview.count} — ${Object.entries(preview.totals).map(([k, v]) => e(k) + ': ' + e(v)).join(' | ')}</p>${table(preview.vouchers, ['number', 'beneficiary', 'amount', 'currency'])}${btn('approval-confirm', t('تأكيد الاعتماد النهائي', 'Confirm final approval'))}</section>` : ''}`;
        if (tab === 'funds')
            return form('fund', t('إنشاء صندوق دون افتتاحي مفترض', 'Create fund with explicit opening balance'), [f('name', 'اسم الصندوق', 'Fund name'), f('kind', 'النوع', 'Type', 'select', 'petty', choice(['cash', 'petty'])), f('holderId', 'المسؤول', 'Responsible employee', 'select', '', users()), f('chartId', 'حساب الصندوق', 'Fund ledger account', 'select', '', accounts), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('ceiling', 'السقف', 'Ceiling', 'text', '1000'), f('threshold', 'حد التنبيه', 'Refill threshold', 'text', '200'), f('openingBalance', 'افتتاحي فعلي', 'Actual opening balance', 'text', '0'), f('openingEquityId', 'حساب مقابل الافتتاحي', 'Opening equity account', 'select', '', accounts, false), f('effectiveOn', 'التاريخ', 'Date', 'date', now())], undefined, 'fund_manage') + table(book.finance_funds, ['name', 'kind', 'balance', 'refill', 'currency'], r => btn('fund-spend', t('صرف', 'Spend'), r.id) + btn('fund-refill', t('تغذية', 'Refill'), r.id) + btn('fund-count', t('جرد فعلي', 'Physical count'), r.id) + btn('fund-count-settle', t('تسوية جرد معتمدة', 'Approve count adjustment'), r.id));
        if (tab === 'cards')
            return form('card', t('بطاقة — آخر أربعة أرقام فقط', 'Card — last four digits only'), [f('holderId', 'المسؤول', 'Responsible employee', 'select', '', users()), f('bankName', 'البنك', 'Bank'), f('lastFour', 'آخر أربعة أرقام', 'Last four'), f('name', 'اسم البطاقة', 'Card name'), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('dueDay', 'يوم الاستحقاق الفعلي', 'Actual due day', 'number', '15'), f('liabilityId', 'حساب التزام البطاقة', 'Card liability account', 'select', '', accounts)], undefined, 'cards') + table(book.finance_cards, ['name', 'last_four', 'currency'], r => btn('card-charge', t('تسجيل مصروف وتوزيعه', 'Record and allocate charge'), r.id) + btn('card-statement', t('كشف شهري', 'Monthly statement'), r.id)) + table(book.finance_card_charges, ['reference', 'amount', 'currency'], r => btn('card-details', t('التوزيع والفواتير', 'Splits and invoices'), r.id));
        if (tab === 'work')
            return form('work', t('شيك العميل — إجمالي السندات يساوي الشيك', 'Customer cheque — receipts must equal its total'), [...refFields(), f('workItemId', 'بند Work Amount المرتبط بأمانة العميل', 'Work Amount customer liability item', 'select', '', items.filter(i => i.category === 'work_amount')), f('priorItemId', 'بند المستحقات السابقة', 'Prior dues item', 'select', '', items), f('priorAmount', 'المستحقات السابقة', 'Prior dues'), f('workAmount', 'صافي Work Amount المحسوب يدوياً', 'Manually calculated net Work Amount'), f('amount', 'إجمالي الشيك', 'Cheque total'), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('receivedOn', 'تاريخ الاستلام', 'Receipt date', 'date', now()), f('bankAccountId', 'حساب التحصيل', 'Clearing account', 'select', '', book.banks), f('chequeNumber', 'رقم الشيك', 'Cheque number'), f('beneficiary', 'مقدم الشيك', 'Cheque payer'), ...dateFields(), f('payoutReason', 'سبب صرف الصافي', 'Net payout reason')], undefined, 'collect');
        if (tab === 'intercompany')
            return form('intercompany', t('تحويل بشيك وحسابات متقابلة', 'Cheque transfer with reciprocal current accounts'), [f('toCompanyId', 'الشركة المستفيدة', 'Beneficiary company', 'select', '', cap.companies.filter(c => c.id !== co)), f('toBankAccountId', 'مرجع حساب الشركة المستفيدة', 'Beneficiary bank account reference'), ...itemFields(), ...amounts(), f('sourceDueFromId', 'حساب مستحق من الشركة المستفيدة', 'Source due-from account', 'select', '', accounts), f('destinationDueToId', 'مرجع حساب مستحق للشركة المصدر', 'Destination due-to account reference'), f('reason', 'السبب', 'Reason')], undefined, 'intercompany') + table(book.finance_intercompany, ['id', 'state', 'voucher_id'], r => r.state !== 'Deposited' ? btn('intercompany-deposit', t('تأكيد إيداع المستفيد بعد صرف البنك', 'Confirm beneficiary deposit after bank clearing'), r.id) : '');
        if (tab === 'reconciliation')
            return form('bank-statement', t('كشف بنكي — المرفق الأصلي مع مراجعة يدوية', 'Bank statement — original evidence and manual review'), [f('bankAccountId', 'الحساب', 'Account', 'select', '', book.banks), f('periodFrom', 'من', 'From', 'date', now().slice(0, 7) + '-01'), f('periodTo', 'إلى', 'To', 'date', now()), f('openingBalance', 'الافتتاحي', 'Opening', 'text', '0'), f('closingBalance', 'الختامي', 'Closing'), proofField(), f('csv', 'الحركات CSV: date,amount,reference', 'Rows CSV: date,amount,reference', 'textarea')], undefined, 'statement_upload') + table(book.finance_statements, ['id', 'period_from', 'period_to', 'status'], r => btn('statement-open', t('عرض ومطابقة', 'Open and reconcile'), r.id));
        if (tab === 'journals')
            return form('journal', t('قيد يدوي متوازن — يحتاج اعتماداً', 'Balanced manual journal — approval required'), [f('currency', 'العملة', 'Currency', 'text', 'AED'), f('effectiveOn', 'التاريخ', 'Date', 'date', now()), f('reason', 'السبب', 'Reason')], undefined, 'journal_create', journalRows()) + table(book.finance_journals, ['number', 'effective_on', 'status', 'currency'], r => r.status === 'Draft' ? btn('journal-post', t('اعتماد وترحيل', 'Approve and post'), r.id) : btn('journal-reverse', t('قيد عكسي', 'Reverse journal'), r.id));
        if (tab === 'reports')
            return form('report', t('تقارير من القيود والمستندات الفعلية', 'Reports from actual entries and documents'), [f('groupBy', 'تجميع التحصيل', 'Collections grouping', 'select', 'day', choice(['day', 'month', 'year', 'employee', 'item'])), f('kind', 'التقرير', 'Report', 'select', 'trial', choice(['trial', 'balance', 'profit', 'cashflow', 'ledger', 'journal', 'receivables', 'custody', 'vouchers', 'cards', 'kpi', 'vat', 'collections', 'deposits', 'cheques', 'funds', 'intercompany', 'installments', 'adjustments', 'profitability'])), f('from', 'من', 'From', 'date', now().slice(0, 4) + '-01-01'), f('to', 'إلى', 'To', 'date', now()), f('currency', 'العملة (اختياري)', 'Currency (optional)', 'text', '', null, false)], t('عرض التقرير', 'Show report'), 'report', `<details class="full"><summary>${t('الشركات المصرح بها', 'Authorized companies')}</summary>${cap.companies.map(c => `<label><input type="checkbox" name="reportCompany" value="${c.id}" ${c.id === co ? 'checked' : ''}/>${e(c.englishName || c.arabicName)}</label>`).join('')}</details>`) + (report ? `<p>${e(report.scope)} — ${t('فواتير غير مصنفة', 'Unclassified invoices')}: ${report.unclassifiedInvoices}</p>${btn('export-csv', 'CSV')}${btn('export-excel', 'Excel')}${btn('print', t('طباعة / PDF', 'Print / PDF'))}${table(report.rows, report.rows[0] ? Object.keys(report.rows[0]).filter(k => !['payload_cipher'].includes(k)).slice(0, 12) : [])}` : '');
        if (tab === 'setup')
            return setup() + table(book.finance_accounts, ['code', 'name_ar', 'name_en', 'kind', 'active'], r => btn('account-edit', t('تعديل / تفعيل', 'Edit / activate'), r.id)) + table(items, ['code', 'name_ar', 'name_en', 'priority', 'active'], r => btn('item-edit', t('تعديل / تفعيل', 'Edit / activate'), r.id));
        if (tab === 'import')
            return form('import-preview', t('معاينة CSV / Excel — المطابقة قبل الاعتماد', 'Preview CSV / Excel — match before commit'), [f('file', 'ملف الفواتير الأصلي', 'Original invoice file', 'file'), ...['sourceKey', 'customerNumber', 'vehicleNumber', 'plate', 'itemCode', 'amount', 'currency', 'dueOn'].map(k => f(k, label(k), k, 'text', k, null, !['vehicleNumber', 'plate'].includes(k)))], t('معاينة', 'Preview'), 'invoice_import') + (importJob ? table(importJob.rows.map(r => ({ line: r.line, status: r.error || 'Ready', amount: r.data?.amount })), ['line', 'status', 'amount']) + btn('import-commit', t('اعتماد السجلات الصحيحة', 'Commit valid rows')) : '');
        if (tab === 'closing')
            return form('closing-review', t('قائمة الإغلاق قبل الاعتماد', 'Closing checklist before approval'), [f('month', 'أول يوم من الشهر', 'First day of month', 'date', now().slice(0, 7) + '-01')], t('فحص النواقص', 'Review blockers'), 'close') + (report?.problems ? `<p>${Object.entries(report.problems).map(([k, n]) => e(k) + ': ' + e(n)).join(' | ') || t('اجتازت قائمة الفحص', 'Checklist passed')}</p>${report.canClose ? btn('close-confirm', t('اعتماد إغلاق الشهر', 'Approve monthly close')) : ''}` : '') + table(book.finance_periods, ['month', 'created_at']);
        return '';
    }
    function journalRows() { return '<div class="full ld-lines">' + [0, 1, 2, 3].map(i => `<div class="ld-row">${field(f('chart' + i, 'الحساب', 'Account', 'select', '', accountOptions(), i < 2), 'journal')}${field(f('debit' + i, 'مدين', 'Debit', 'text', '0', null, i < 2), 'journal')}${field(f('credit' + i, 'دائن', 'Credit', 'text', '0', null, i < 2), 'journal')}</div>`).join('') + '</div>'; }
    function setup() { const a = defs(), charts = accountOptions(); return form('account', t('حساب موحد — مرتبط بالشركات المختارة', 'Shared account — mapped to selected companies'), [f('code', 'الرمز', 'Code'), f('nameAr', 'الاسم العربي', 'Arabic name'), f('nameEn', 'الاسم الإنجليزي', 'English name'), f('kind', 'الطبيعة', 'Nature', 'select', 'asset', choice(['asset', 'liability', 'equity', 'income', 'expense'])), f('parentId', 'حساب رئيسي (اختياري)', 'Parent (optional)', 'select', '', a, false), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('bankAccountId', 'ربط حساب بنكي (اختياري)', 'Map existing bank (optional)', 'select', '', book.banks, false), f('eliminate', 'حساب متبادل بين الشركات', 'Intercompany elimination account', 'checkbox', false)], undefined, 'account_manage') + form('item', t('تعريف بند مالي', 'Define financial item'), [f('code', 'الرمز', 'Code'), f('nameAr', 'الاسم العربي', 'Arabic name'), f('nameEn', 'الاسم الإنجليزي', 'English name'), f('category', 'التصنيف', 'Category'), f('priority', 'الأولوية', 'Priority', 'number', '100'), f('recurrence', 'التكرار', 'Recurrence', 'select', 'none', choice(['none', 'monthly', 'annual'])), f('recurringAmount', 'المبلغ الدوري (صفر لإيقافه)', 'Recurring amount (zero disables)', 'text', '0'), f('annualMonth', 'شهر سنوي: صفر يتبع تسجيل المركبة', 'Annual month: zero follows registration', 'number', '0'), f('invoice', 'يسمح بالفواتير', 'Allow invoices', 'checkbox', true), f('receipt', 'يسمح بالقبض', 'Allow receipts', 'checkbox', true), f('payment', 'يسمح بالصرف', 'Allow payments', 'checkbox', true), ...['receivableId', 'revenueId', 'expenseId', 'payableId'].map((k, i) => f(k, ['حساب المستحقات', 'الإيراد أو أمانة العميل', 'المصروف', 'حساب الدائنين'][i], ['Receivables account', 'Income or customer liability', 'Expense account', 'Payables account'][i], 'select', '', a, false))], undefined, 'item_manage') + form('config', t('ربط عهدة الشركة والتقويم', 'Company custody mappings and calendar'), [f('currency', 'العملة', 'Currency', 'text', 'AED'), f('custodyAccountId', 'حساب عهدة النقد', 'Cash custody account', 'select', book.config.custodyAccountId || '', charts), f('chequeTransitAccountId', 'حساب الشيكات قيد التحصيل', 'Cheque transit account', 'select', book.config.chequeTransitAccountId || '', charts), f('customerCreditAccountId', 'أمانات وأرصدة العملاء الدائنة', 'Customer credit/liability', 'select', book.config.customerCreditAccountId || '', charts), f('automaticFinanceJobs', 'تمكين الجدولة للشركة بعد تفعيل عامل الخادم', 'Enable company scheduling after server worker activation', 'checkbox', book.config.automaticFinanceJobs || false), f('depositDays', 'مهلة الإيداع بأيام العمل', 'Deposit working days', 'number', book.config.depositDays || 1), f('holidays', 'العطلات: تاريخ واحد في كل سطر', 'Holidays: one date per line', 'textarea', (book.config.holidays || []).join('\n'), null, false)], undefined, 'configure'); }
    function renderPage() {
        FinancialTables.begin(registerScope());
        const who = ABCentral?.actor?.id;
        if (actor !== who) {
            reset();
            actor = who;
        }
        if (!ABCentral?.enabled)
            return `<section class="content-panel"><p>${t('الإدارة المالية تتطلب اتصال Backend الآمن؛ لا حفظ محلياً.', 'Financial management requires the secure backend; no local persistence.')}</p></section>`;
        if (!cap && !busy)
            queueMicrotask(load);
        if (!cap || busy && !book)
            return '<section class="content-panel" role="status">' + t('جارٍ التحقق…', 'Checking…') + '</section>';
        if (!cap.available)
            return `<section class="content-panel"><h2>${t('الإدارة المالية', 'Financial management')}</h2><p>${message('ledgerSchemaPending')}</p></section>`;
        if (!book)
            return `<section class="content-panel"><p role="alert">${e(notice || t('لا توجد شركة مفوضة', 'No authorized company'))}</p></section>`;
        const registerContent=body();return `<section class="content-panel ld-section"><h2>${t('الإدارة المالية والتحصيل والخزينة', 'Finance, collections and treasury')}</h2><nav class="workspace-toolbar">${Object.keys(labels).map(k => btn('tab', label(k), k)).join('')}</nav><div class="fw-actions"><label>${t('الشركة القانونية', 'Legal company')}<select class="input" id="ld-company">${opts(cap.companies, co)}</select></label>${btn('reload', t('تحديث', 'Refresh'))}</div><p id="ld-notice" role="status" aria-live="polite">${e(notice)}</p>${registerContent.includes('data-ft-table')?FinancialTables.search(registerScope()):''}<div id="ld-body">${registerContent}</div><div id="ld-dialog"></div></section>`;
    }
    function dialog(title, key, fields, extra = '') { document.querySelector('#ld-dialog').innerHTML = '<h3>' + e(title) + '</h3>' + form(key, title, fields, undefined, null, extra).replace('<details class="ld-form-section"', '<details open class="ld-form-section"'); bindForms(); document.querySelector('#ld-dialog').scrollIntoView({ block: 'nearest' }); }
    const serialize = form => {
        const d = Object.fromEntries(new FormData(form));
        form.querySelectorAll('input[type="checkbox"]').forEach(x => {
            if (!['selectedItem', 'voucherId', 'reportCompany'].includes(x.name))
                d[x.name] = x.checked;
        });
        for (const k of Object.keys(d))
            if (k.endsWith('Id') && !d[k])
                delete d[k];
        return d;
    };
    async function refresh() { book = null; await load(); }
    function show(err) { notice = message(err.message); document.getElementById('ld-notice').textContent = notice; }
    async function submit(form) {
        const key = form.dataset.ldForm, d = serialize(form), fd = new FormData(form);
        drafts[key] = { ...d };
        let endpoint = '', payload = d, refreshAfter = true, httpMethod = 'POST';
        const date = d.effectiveOn || now();
        if (key === 'work') {
            endpoint = 'work-amount';
            payload = { collection: { companyId: co, customerId: d.customerId, vehicleId: d.vehicleId || null, currency: d.currency, receivedOn: d.receivedOn, method: 'cheque', mode: 'manual', amount: d.amount, items: [{ itemId: d.priorItemId, amount: d.priorAmount }, { itemId: d.workItemId, amount: d.workAmount }], cheque: { bankAccountId: d.bankAccountId, number: d.chequeNumber, beneficiary: d.beneficiary, issuedOn: d.issuedOn, dueOn: d.dueOn } }, workItemId: d.workItemId, workAmount: d.workAmount, dueOn: d.dueOn, payoutReason: d.payoutReason };
        }
        if (key === 'intercompany') {
            endpoint = 'intercompany';
            payload = { ...d, companyId: co };
        }
        if (key === 'intercompany-deposit') {
            endpoint = 'intercompany/' + selected + '/deposit';
        }
        if (key === 'bank-statement') {
            endpoint = 'bank-statements';
            payload = { ...d, companyId: co };
        }
        if (key === 'statement-match') {
            const st = report.statement;
            if (st.card_id) {
                endpoint = 'card-statements/' + st.id + '/match';
                payload = { pairs: [{ lineId: d.lineId, ...(d.entryId.startsWith('voucher:') ? { voucherId: d.entryId.slice(8) } : { chargeId: d.entryId }) }] };
            }
            else {
                endpoint = 'bank-statement-lines/' + d.lineId + '/match';
                payload = { entryId: d.entryId };
            }
        }
        if (key === 'credit-apply') {
            endpoint = 'credits/apply';
            payload = { ...d, companyId: co };
        }
        if (key === 'account-edit') {
            endpoint = 'accounts/' + selected;
            httpMethod = 'PATCH';
        }
        if (key === 'item-edit') {
            endpoint = 'items/' + selected;
            httpMethod = 'PATCH';
            payload = { ...book.finance_items.find(i => i.id === selected).details, ...d, priority: Number(d.priority) };
        }
        if (key === 'invoice') {
            endpoint = 'invoices';
            payload = { ...d, companyId: co };
        }
        if (key === 'adopt') {
            endpoint = 'invoices/adopt';
        }
        if (key === 'collection-filter') {
            const requested={companyId:co,customerId:d.customerId,vehicleId:d.vehicleId,currency:d.currency};
            let nextBills=(await api('invoices?' + new URLSearchParams({ companyId: co, customerId: d.customerId, ...(d.vehicleId ? { vehicleId: d.vehicleId } : {}), currency: d.currency }))).rows.filter(r => r.vehicle_id === (d.vehicleId || null));
            if(tab!=='collect'||app.state.currentPage!=='financialManagement')return;
            if(form.isConnected&&(form.elements.customerId.value!==d.customerId||(form.elements.vehicleId.value||null)!==(d.vehicleId||null)))throw Error('loadDuesForSelectedCustomer');
            if(context?.targetInvoiceId&&requested.customerId===context.customerId&&(requested.vehicleId||null)===(context.vehicleId||null)){requested.targetInvoiceId=context.targetInvoiceId;nextBills=nextBills.filter(r=>r.id===context.targetInvoiceId);}context=requested;bills=nextBills;notice=t('تم تحميل المستحقات للعميل والمركبة المحددين.','Dues loaded for the selected customer and vehicle.');
            render();
            return;
        }
        if (key === 'collect') {
            if (!context || d.customerId !== context.customerId || (d.vehicleId || null) !== (context.vehicleId || null))
                throw Error('loadDuesForSelectedCustomer');
            endpoint = 'collections';
            payload = { companyId: co, customerId: d.customerId, vehicleId: d.vehicleId || null, currency: d.currency, receivedOn: d.receivedOn, method: d.method, mode: d.mode, amount: d.amount, items: fd.getAll('selectedItem').map(id => ({ itemId: id, amount: fd.get('take-' + id) })), overridePriority: d.overridePriority, reason: d.reason || '' };
            if(context.targetInvoiceId)payload.targetInvoiceId=context.targetInvoiceId;
            if (d.method === 'transfer')
                payload.operationId = d.operationId;
            if (d.method === 'cheque')
                payload.cheque = { bankAccountId: d.bankAccountId, number: d.chequeNumber, beneficiary: d.beneficiary, issuedOn: d.issuedOn, dueOn: d.dueOn };
        }
        if (key === 'route') {
            endpoint = 'custody/routes';
            payload = { ...d, companyId: co };
            if (!payload.untilOn)
                delete payload.untilOn;
        }
        if (key === 'handover') {
            endpoint = 'custody/handovers';
            payload = { ...d, companyId: co };
        }
        if (key === 'receive') {
            endpoint = 'custody/handovers/' + selected + '/receive';
        }
        if (key === 'deposit') {
            endpoint = 'deposits';
            payload = { ...d, companyId: co };
        }
        if (key === 'deposit-confirm') {
            endpoint = 'deposits/' + selected + '/confirm';
        }
        if (key === 'document') {
            const file = fd.get('file');
            if (!file || !file.size || file.size > 10 * 1024 * 1024)
                throw Error('invalidFile');
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = '';
            for (const b of bytes)
                binary += String.fromCharCode(b);
            await ABCentral.api('documents', 'POST', { companyId: co, category: 'other', title: d.title, date: d.date, name: file.name, mime: file.type, base64: btoa(binary) });
            notice = t('رُفع إلى الأرشيف الخاص؛ حالة الفحص محفوظة فعلياً.', 'Uploaded to private archive; actual scan state is retained.');
            drafts[key] = {};
            await refresh();
            return;
        }
        if (key === 'voucher') {
            endpoint = 'vouchers';
            payload = { ...d, companyId: co };
        }
        if (key === 'prepare') {
            endpoint = 'vouchers/' + selected + '/prepare';
        }
        if (key === 'approval') {
            preview = await api('vouchers/approval-preview', 'POST', { ids: fd.getAll('voucherId'), signedEvidence: d.signedEvidence }, form._key ??= crypto.randomUUID());
            render();
            return;
        }
        if (key === 'settle') {
            endpoint = 'vouchers/' + selected + '/settle';
        }
        if (key === 'cancel-voucher') {
            endpoint = 'vouchers/' + selected + '/cancel';
        }
        if (key === 'fund') {
            endpoint = 'funds';
            payload = { ...d, companyId: co };
        }
        if (key === 'fund-count') {
            endpoint = 'funds/' + selected + '/count';
        }
        if (key === 'fund-count-settle') {
            endpoint = 'funds/' + selected + '/counts/' + d.countId + '/settle';
            delete payload.countId;
        }
        if (key === 'fund-spend') {
            endpoint = 'funds/' + selected + '/spend';
        }
        if (key === 'fund-refill') {
            endpoint = 'funds/' + selected + '/refill';
        }
        if (key === 'card') {
            endpoint = 'cards';
            payload = { ...d, companyId: co, dueDay: Number(d.dueDay) };
        }
        if (key === 'card-charge') {
            endpoint = 'cards/' + selected + '/charges';
            const splits = [];
            for (let i = 0; form.elements['splitCompany' + i]; i++) {
                if (!fd.get('splitCompany' + i))
                    continue;
                const row = { companyId: fd.get('splitCompany' + i), itemId: fd.get('splitItem' + i), amount: fd.get('splitAmount' + i) };
                for (const [prop, name] of [['customerId', 'splitCustomer'], ['vehicleId', 'splitVehicle'], ['invoiceId', 'splitInvoice'], ['dueToAccountId', 'splitDueTo'], ['issuerDueFromAccountId', 'splitDueFrom']])
                    if (fd.get(name + i))
                        row[prop] = fd.get(name + i);
                splits.push(row);
            }
            payload = { amount: d.amount, paidOn: d.paidOn, reference: d.reference, beneficiary: d.beneficiary, splits };
            if (d.documentVersionId)
                payload.documentVersionId = d.documentVersionId;
        }
        if (key === 'card-statement') {
            endpoint = 'cards/' + selected + '/statements';
            payload = { periodFrom: d.periodFrom, periodTo: d.periodTo, openingBalance: d.openingBalance, closingBalance: d.closingBalance, documentVersionId: d.documentVersionId, lines: FinancePolicy.parseCsv(d.csv).map(r => ({ date: r.date, amount: r.amount, reference: r.reference })) };
        }
        if (key === 'card-vouchers') {
            endpoint = 'card-statements/' + report.statement.id + '/vouchers';
        }
        if (key === 'card-link') {
            endpoint = 'card-splits/' + selected + '/invoice';
        }
        if (key === 'cheque-resolve') {
            const r = book.receipts.find(r => r.id === selected), batch = await api('receipt-batches/' + r.batch_id);
            endpoint = 'cheques/' + batch.chequeId + '/resolve';
        }
        if (key === 'invoice-correct') {
            endpoint = 'invoices/' + selected + '/correct';
        }
        if (key === 'journal') {
            endpoint = 'journals';
            const lines = [];
            for (let i = 0; form.elements['chart' + i]; i++)
                if (fd.get('chart' + i))
                    lines.push({ chartId: fd.get('chart' + i), debit: fd.get('debit' + i), credit: fd.get('credit' + i) });
            payload = { companyId: co, currency: d.currency, effectiveOn: d.effectiveOn, reason: d.reason, lines };
        }
        if (key === 'journal-reverse') {
            endpoint = 'journals/' + selected + '/reverse';
        }
        if (key === 'account') {
            endpoint = 'accounts';
            payload = { ...d, companyIds: [co], eliminate: d.eliminate };
        }
        if (key === 'item') {
            endpoint = 'items';
            payload = { ...d, companyIds: [co], priority: Number(d.priority), annualMonth: Number(d.annualMonth), active: true, methods: ['manual', 'automatic', 'bulk'] };
        }
        if (key === 'config') {
            endpoint = 'configuration';
            payload = { ...d, companyId: co, depositDays: Number(d.depositDays), workdays: book.config.workdays || [1, 2, 3, 4, 5], holidays: d.holidays.split(/\r?\n/).map(x => x.trim()).filter(Boolean) };
        }
        if (key === 'report') {
            drafts.report = { ...d, companies: fd.getAll('reportCompany').join(',') || co };
            await loadReport('json', 0);
            return;
        }
        if (key === 'closing-review') {
            report = await api('closing-review?' + new URLSearchParams({ companyId: co, month: d.month }));
            render();
            return;
        }
        if (key === 'import-preview') {
            const file = fd.get('file');
            if (!file || !file.size || file.size > 5e6)
                throw Error('invalidFile');
            const bytes = new Uint8Array(await file.arrayBuffer());
            let raw = '';
            for (const b of bytes)
                raw += String.fromCharCode(b);
            const mapping = {};
            for (const k of ['sourceKey', 'customerNumber', 'vehicleNumber', 'plate', 'itemCode', 'amount', 'currency', 'dueOn'])
                mapping[k] = d[k] || '';
            importJob = await api('invoice-imports', 'POST', { companyId: co, name: file.name, format: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv', base64: btoa(raw), mapping }, form._key ??= crypto.randomUUID());
            render();
            return;
        }
        if (!endpoint)
            throw Error('unsupportedAction');
        const result = await api(endpoint, httpMethod, payload, form._key ??= crypto.randomUUID());
        notice = t('تم الحفظ في قاعدة البيانات المركزية.', 'Saved in the central database.');
        if (result.receipts)
            notice += ' ' + t('عدد السندات: ', 'Receipts: ') + result.receipts.length;
        drafts[key] = {};
        if (refreshAfter)
            await refresh();
    }
    function bindForms() {
        document.querySelectorAll('[data-ld-form]').forEach(form => {
            form.oninput = () => { drafts[form.dataset.ldForm] = serialize(form); };
            form.onsubmit = async (ev) => {
                ev.preventDefault();
                if (form._saving)
                    return;
                form._saving = true;
                const button = form.querySelector('[type="submit"]') || form.querySelector('button.primary-btn');
                if (button)
                    button.disabled = true;
                try {
                    await submit(form);
                }
                catch (err) {
                    if (err.message !== 'staleSession')
                        show(err);
                }
                finally {
                    form._saving = false;
                    if (button?.isConnected)
                        button.disabled = false;
                }
            };
        });
    }
    async function loadReport(format = 'json', page = 0) {
        const d = drafts.report || {}, q = { companies: d.companies || co, from: d.from || now().slice(0, 4) + '-01-01', to: d.to || now(), kind: d.kind || 'trial', format, page: '0',...FinancialTables.state(registerScope(),'report') };
        if (d.groupBy)
            q.groupBy = d.groupBy;
        if (d.currency)
            q.currency = d.currency;
        const result = await api('reports?' + new URLSearchParams(q));
        if (format === 'csv' || format === 'excel') {
            download(result);
            return;
        }
        report = result;
        render();
    }
    function download(r) { const u = URL.createObjectURL(new Blob([r.data], { type: r.mime })), a = document.createElement('a'); a.href = u; a.download = r.filename; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
    function bindRegisterActions(host=document){host.querySelectorAll('[data-ld]').forEach(button => button.onclick = async () => {
            const action = button.dataset.ld, key = button.dataset.id;
            try {
                if (action === 'tab') {
                    tab = key;
                    if(!ABCentral.viewAs)await api('preferences', 'POST', { companyId: co, tab: key }, crypto.randomUUID());
                    report = null;
                    preview = null;
                    if (['invoices', 'collect'].includes(tab))
                        await load();
                    else
                        render();
                    return;
                }
                if (action === 'reload') {
                    await refresh();
                    return;
                }
                if (action === 'run-recurring') {
                    const r = await api('recurring/run', 'POST', { companyId: co }, crypto.randomUUID());
                    notice = t('فواتير جديدة: ', 'New invoices: ') + r.issued + t(' — بحاجة مراجعة: ', ' — review required: ') + r.skipped;
                    await refresh();
                    return;
                }
                if (action === 'reminders') {
                    const r = await api('reminders/run', 'POST', { companyId: co }, crypto.randomUUID());
                    notice = t('اكتمل فحص المواعيد. تنبيهات: ', 'Deadline check complete. Reminders: ') + r.emitted;
                    render();
                    return;
                }
                if (action === 'approval-confirm') {
                    await api('vouchers/approval-confirm', 'POST', { batchId: preview.id, digest: preview.digest, confirm: true }, crypto.randomUUID());
                    preview = null;
                    notice = t('تم الاعتماد؛ صرف الشيك منفصل.', 'Approved; bank clearing remains separate.');
                    await refresh();
                    return;
                }
                if (action === 'import-commit') {
                    const r = await api('invoice-imports/' + importJob.id + '/commit', 'POST', {}, crypto.randomUUID());
                    notice = t('تم إنشاء ', 'Created ') + r.created.length + t(' — مكرر ', ' — duplicate ') + r.duplicate + t(' — معزول ', ' — rejected ') + r.rejected;
                    importJob = null;
                    await refresh();
                    return;
                }
                if (action === 'journal-post') {
                    await api('journals/' + key + '/post', 'POST', {}, crypto.randomUUID());
                    await refresh();
                    return;
                }
                if (action === 'close-confirm') {
                    await api('close', 'POST', { companyId: co, month: report.month, confirm: true }, crypto.randomUUID());
                    report = null;
                    await refresh();
                    return;
                }
                if (action === 'export-csv' || action === 'export-excel') {
                    await loadReport(action === 'export-csv' ? 'csv' : 'excel', report?.page || 0);
                    return;
                }
                if (action === 'report-next' || action === 'report-prev') {
                    const next = (report?.page || 0) + (action === 'report-next' ? 1 : -1);
                    if (next >= 0 && next * 200 < report.total)
                        await loadReport('json', next);
                    return;
                }
                if (action === 'print') {
                    document.body.classList.add('ld-print');
                    window.print();
                    document.body.classList.remove('ld-print');
                    return;
                }
                selected = key;
                if (action === 'intercompany-deposit')
                    dialog(t('تأكيد إيداع الشركة المستفيدة', 'Confirm beneficiary deposit'), action, [f('effectiveOn', 'تاريخ البنك', 'Bank date', 'date', now()), f('bankConfirmation', 'مرجع البنك', 'Bank confirmation'), proofField()]);
                if (action === 'statement-open') {
                    report = await api('statements/' + key);
                    const st = report.statement;
                    document.querySelector('#ld-dialog').innerHTML = '<h3>' + t('مراجعة الكشف', 'Statement review') + '</h3>' + table(report.lines, ['id', 'effective_on', 'amount', 'reference', 'entry_id']) + form('statement-match', t('مطابقة السطر بالمستند الفعلي', 'Match statement line to actual document'), [f('lineId', 'السطر', 'Statement line', 'select', '', report.lines.map(r => ({ ...r, name: r.line_no + ' — ' + r.amount + ' — ' + r.reference }))), f('entryId', 'الحركة الفعلية', 'Actual ledger/charge', 'select', '', (st.card_id ? [...report.charges, ...(report.paymentVouchers || []).map(v => ({ ...v, id: 'voucher:' + v.id, amount: '-' + v.amount, reference: t('سداد بطاقة', 'Card payment') }))] : report.entries).map(r => ({ ...r, name: (r.reference || r.id) + ' — ' + (r.amount || r.debit + '/' + r.credit) })))]) + btn('statement-approve', t('اعتماد بعد زوال الفروقات', 'Approve after differences resolved'), st.id) + (st.card_id ? form('card-vouchers', t('إنشاء سند صرف مجمع لكل شركة', 'Create consolidated voucher per company'), itemFields()) : '');
                    bind();
                    return;
                }
                if (action === 'statement-approve') {
                    await api((report.statement.card_id ? 'card-statements/' : 'bank-statements/') + key + '/approve', 'POST', {}, crypto.randomUUID());
                    await refresh();
                    return;
                }
                if (action === 'credit-apply')
                    dialog(t('تطبيق أمانة سابقة دون قبض جديد', 'Apply existing customer credit without new money'), action, [...refFields(), f('sourceReceiptId', 'سند القبض الأصلي ذو الفائض', 'Original receipt containing excess credit'), ...itemFields(), ...amounts(), f('reason', 'السبب', 'Reason')]);
                if (action === 'account-edit') {
                    const a = book.finance_accounts.find(r => r.id === key);
                    dialog(t('تعديل حساب دون تغيير طبيعته', 'Edit account without changing its nature'), action, [f('nameAr', 'الاسم العربي', 'Arabic name', 'text', a.name_ar), f('nameEn', 'الاسم الإنجليزي', 'English name', 'text', a.name_en), f('active', 'نشط', 'Active', 'checkbox', a.active)]);
                }
                if (action === 'item-edit') {
                    const a = book.finance_items.find(r => r.id === key);
                    dialog(t('تعديل بند مع حماية التصنيف المستخدم', 'Edit item with protected used mappings'), action, [f('code', 'الرمز', 'Code', 'text', a.code), f('nameAr', 'الاسم العربي', 'Arabic name', 'text', a.name_ar), f('nameEn', 'الاسم الإنجليزي', 'English name', 'text', a.name_en), f('priority', 'الأولوية', 'Priority', 'number', a.priority), f('active', 'نشط', 'Active', 'checkbox', a.active), f('recurringAmount', 'المبلغ الدوري المستقبلي', 'Future recurring amount', 'text', a.details.recurringAmount), f('taxRate', 'نسبة الضريبة', 'Tax rate', 'text', a.details.taxRate), f('taxAccountId', 'حساب الضريبة', 'Tax account', 'select', a.details.taxAccountId || '', defs(), false)]);
                }
                if (action === 'invoice-correct')
                    dialog(t('تصحيح الفاتورة دون حذف', 'Correct invoice without deletion'), action, [f('amount', 'مبلغ التصحيح', 'Correction amount'), f('effectiveOn', 'تاريخ القيد', 'Accounting date', 'date', now()), f('reason', 'السبب', 'Reason')]);
                if (action === 'receive')
                    dialog(t('المبلغ المستلم فعلياً فقط', 'Actual amount received only'), action, [f('actual', 'المستلم فعلياً', 'Actually received'), f('reason', 'تفاصيل الاستلام والفرق', 'Receipt/difference details')]);
                if (action === 'deposit-confirm')
                    dialog(t('تحقق يدوي من الإيصال والحساب والتاريخ', 'Manual evidence/account/date verification'), action, [f('confirmedAmount', 'المبلغ المؤكد فقط', 'Confirmed amount only'), f('effectiveOn', 'تاريخ البنك', 'Bank date', 'date', now()), f('bankConfirmation', 'مرجع التحقق البنكي', 'Bank verification reference'), f('accountAndDateVerified', 'تحققت من الحساب والتاريخ', 'Account and date verified', 'checkbox', false)]);
                if (action === 'prepare')
                    dialog(t('تجهيز الشيك', 'Prepare cheque'), action, [f('bankAccountId', 'الحساب', 'Account', 'select', '', book.banks), f('chequeNumber', 'رقم الشيك', 'Cheque number'), ...dateFields(), proofField()]);
                if (action === 'settle')
                    dialog(t('تأكيد الصرف المصرفي الفعلي', 'Confirm actual bank clearing'), action, [f('effectiveOn', 'تاريخ البنك', 'Bank date', 'date', now()), f('bankConfirmation', 'مرجع البنك', 'Bank confirmation')]);
                if (action === 'cancel-voucher')
                    dialog(t('إلغاء موثق', 'Documented cancellation'), action, [f('effectiveOn', 'تاريخ التصحيح', 'Correction date', 'date', now()), f('reason', 'السبب', 'Reason'), f('bankStopConfirmed', 'تأكدت من إيقاف الشيك إن وجد', 'Verified cheque stop if applicable', 'checkbox', false)]);
                if (action === 'fund-count')
                    dialog(t('جرد دون إدانة أو خصم آلي', 'Count without automatic liability/payroll deduction'), action, [f('actual', 'المبلغ الموجود فعلياً', 'Actual cash counted'), f('effectiveOn', 'تاريخ الجرد', 'Count date', 'date', now()), f('reason', 'تفاصيل الجرد', 'Count notes')]);
                if (action === 'fund-count-settle')
                    dialog(t('اعتماد الفرق بعد التحقق', 'Approve difference after verification'), action, [f('countId', 'الجرد المسجل', 'Recorded count', 'select', '', book.finance_kpi_facts.filter(r => r.kind === 'fund_count_reported' && r.details.fundId === key).map(r => ({ ...r, name: r.id + ' — ' + r.details.actual }))), f('counterpartId', 'حساب الفرق المعتمد', 'Approved difference account', 'select', '', accountOptions()), f('effectiveOn', 'تاريخ القيد', 'Posting date', 'date', now()), f('reason', 'أساس التحقق والاعتماد', 'Verification and approval basis'), f('confirm', 'تأكيد بعد التحقق', 'Confirm verified', 'checkbox', false)]);
                if (action === 'fund-spend')
                    dialog(t('صرف ضمن التفويض', 'Delegated fund expenditure'), action, [...itemFields(), f('amount', 'المبلغ', 'Amount'), f('reason', 'السبب', 'Reason'), f('effectiveOn', 'التاريخ', 'Date', 'date', now())]);
                if (action === 'fund-refill')
                    dialog(t('تغذية إلى السقف دون تكرار مصروف', 'Refill to ceiling without duplicate expense'), action, [f('sourceFundId', 'الصندوق المصدر', 'Source fund', 'select', '', book.finance_funds.filter(x => x.id !== key)), f('amount', 'مبلغ الإعادة إلى السقف', 'Amount restoring ceiling'), f('effectiveOn', 'التاريخ', 'Date', 'date', now()), f('reason', 'السبب', 'Reason')]);
                if (action === 'journal-reverse')
                    dialog(t('قيد عكسي يحفظ الأصل', 'Reversal preserving original'), action, [f('effectiveOn', 'تاريخ العكس', 'Reversal date', 'date', now()), f('reason', 'السبب', 'Reason')]);
                if (action === 'cheque-resolve')
                    dialog(t('نتيجة البنك الفعلية', 'Actual bank result'), action, [f('outcome', 'النتيجة', 'Outcome', 'select', 'Collected', choice(['Collected', 'Returned'])), f('effectiveOn', 'التاريخ', 'Date', 'date', now()), f('bankConfirmation', 'مرجع البنك', 'Bank confirmation'), f('reason', 'السبب', 'Reason')]);
                if (action === 'card-charge')
                    dialog(t('مصروف بطاقة وتوزيع متوازن', 'Card charge with balanced allocation'), action, [f('amount', 'إجمالي العملية', 'Transaction total'), f('paidOn', 'تاريخ الدفع', 'Payment date', 'date', now()), f('reference', 'المرجع الفريد', 'Unique reference'), f('beneficiary', 'الجهة المستفيدة', 'Merchant')], '<div class="full">' + [0, 1, 2].map(i => '<fieldset class="ld-row"><legend>' + t('توزيع ', 'Split ') + (i + 1) + '</legend>' + [f('splitCompany' + i, 'الشركة', 'Company', 'select', i === 0 ? co : '', cap.companies, i === 0), f('splitItem' + i, 'البند', 'Item', 'select', '', book.finance_items, i === 0), f('splitAmount' + i, 'المبلغ', 'Amount', 'text', '', null, i === 0), f('splitCustomer' + i, 'العميل (إن انطبق)', 'Customer (if applicable)', 'select', '', customers, false), f('splitVehicle' + i, 'المركبة', 'Vehicle', 'select', '', vehicles, false), f('splitInvoice' + i, 'مرجع فاتورة قائمة', 'Existing invoice reference', 'text', '', null, false), f('splitDueTo' + i, 'حساب مستحق للجهة المالكة للبطاقة', 'Due-to issuer account', 'text', '', null, false), f('splitDueFrom' + i, 'حساب مستحق من الشركة المستفيدة', 'Issuer due-from account', 'text', '', null, false)].map(x => field(x, action)).join('') + '</fieldset>').join('') + '</div>');
                if (action === 'card-statement')
                    dialog(t('كشف بطاقة — قراءة يدوية آمنة عند غياب OCR', 'Card statement — safe manual review without OCR'), action, [f('periodFrom', 'من', 'From', 'date', now().slice(0, 7) + '-01'), f('periodTo', 'إلى', 'To', 'date', now()), f('openingBalance', 'الافتتاحي', 'Opening', 'text', '0'), f('closingBalance', 'الختامي', 'Closing'), proofField(), f('csv', 'الحركات CSV: date,amount,reference', 'Rows CSV: date,amount,reference', 'textarea')]);
                if (action === 'card-details') {
                    const details = await api('card-charges/' + key);
                    document.querySelector('#ld-dialog').innerHTML = table(details.splits, ['id', 'amount', 'invoice_id'], r => r.customer_id && !r.invoice_id ? btn('card-link', t('ربط الفاتورة المطلوبة', 'Link required invoice'), r.id) : '');
                    bind();
                }
                if (action === 'card-link')
                    dialog(t('إكمال الفاتورة الناقصة', 'Complete missing invoice'), action, [f('invoiceId', 'مرجع الفاتورة الصحيحة', 'Correct invoice reference')]);
            }
            catch (err) {
                if (err.message !== 'staleSession')
                    show(err);
            } finally {FinancialTables.bind(document.querySelector('.ld-section'),bindRegisterActions);}
        });}
 function bind() {
        if (app.state.currentPage !== 'financialManagement')
            return;
        document.getElementById('ld-company')?.addEventListener('change', async (ev) => { epoch++; busy = false; co = ev.target.value; context = null; report = null; preview = null; drafts = {}; bills = []; await refresh(); });
        FinancialTables.bind(document.querySelector(".ld-section"),bindRegisterActions);
        bindForms();
        bindRegisterActions();
        WorkspaceUI.enhance();
    }
    async function openCollection(data) {
        context = { ...data };
        co = data.companyId;
        tab = 'collect';
        app.state.currentPage = 'financialManagement';
        if (actor !== ABCentral.actor?.id) {
            actor = ABCentral.actor?.id;
            cap = book = null;
        }
        await load();
    }
    root.LedgerUI = {openVouchers:async(companyId)=>{if(actor!==ABCentral.actor?.id){reset();actor=ABCentral.actor?.id;}context={companyId};co=companyId;tab='vouchers';app.state.currentPage='financialManagement';await load();context=null;}, openNotification: async (companyId) => { if(actor!==ABCentral.actor?.id){reset();actor=ABCentral.actor?.id;}context={companyId};co = companyId; tab = 'dashboard'; app.state.currentPage = 'financialManagement'; await load();context=null; }, render: renderPage, bind, reset, openCollection, canEnter: () => ABCentral?.enabled && (getCurrentUser()?.roleId === 'owner' || (ABCentral.grants || []).some(g => g.userId === ABCentral.actor?.id && g.entry?.action?.startsWith('ledger_'))) };
})(globalThis);
