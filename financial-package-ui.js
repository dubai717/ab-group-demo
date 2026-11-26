/* Financial controls reuse the existing ledger, shared forms and floating records. */
(function (root) {
    'use strict';
    const t = (a, b) => getLocale() === 'ar' ? a : b, e = v => WorkspaceUI.esc(v ?? ''), date = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
    let ctx = null, docType = 'Invoice', docPage = 0, docResult = null, docLoading = false, docError = '', docContext = '', docRequest = 0;
    const names = { 'cost-centres':['مراكز التكلفة','Cost centres'], taxes: ['إعداد الضرائب والمراجعة', 'Tax preparation and review'], priorities: ['إدارة أولويات توزيع التحصيلات', 'Collection allocation priorities'], compliance: ['المصاريف الإدارية لعدم الالتزام بالمتطلبات', 'Administrative noncompliance expenses'], entitlements: ['علاقات الاستحقاق والدورية', 'Entitlements and recurrence'], documents: ['المستندات المالية', 'Financial documents'] };
    const categories = { number_fee: ['رسوم اللوحات', 'Plate fees'], card: ['تسوية بطاقات', 'Card settlement'], intercompany: ['تحويلات بين الشركات', 'Intercompany transfers'], commission: ['عمولات — تصنيف قائم', 'Commissions — existing classification'], circular: ['رسوم التعميم', 'Circular fees'], insurance: ['التأمين', 'Insurance'], gps: ['خدمات التتبع', 'Tracking services'], service: ['إيرادات الخدمات', 'Service revenue'], expense: ['مصروفات', 'Expenses'], loan: ['أصل تمويل / مستحق عميل', 'Financing principal / customer receivable'], finance: ['تمويل تعاقدي', 'Contractual financing'], work_amount: ['أمانات ومبالغ محصلة نيابة عن العميل', 'Amounts held/collected for customers'], registration: ['رسوم تسجيل', 'Registration fees'], salik: ['سالك — مبالغ مستردة', 'Salik recoverable charges'], fine: ['مخالفات — مبالغ مستردة', 'Recoverable fines'], investor: ['مستحقات المستثمرين', 'Investor entitlements'], general: ['بنود خدمات أخرى', 'Other service items'] };
    const statusWords = { Unpaid: ['غير مسدد', 'Unpaid'], Partial: ['سداد جزئي', 'Partially paid'], Paid: ['مسدد', 'Paid'], Pending: ['معلق', 'Pending'], Review: ['قيد المراجعة', 'In review'], Approved: ['معتمد', 'Approved'], Cleared: ['محصل فعلياً', 'Cleared'], Cancelled: ['ملغى', 'Cancelled'], Corrected: ['مصحح', 'Corrected'], WrittenOff: ['مشطوب دفترياً — دون تنازل قانوني', 'Written off — no legal waiver'], PartiallyWrittenOff: ['شطب دفتري جزئي', 'Partial accounting write-off'], Discount: ['خصم غير نقدي', 'Noncash discount'], Posted:['مرحّل','Posted'],Recorded: ['مسجل', 'Recorded'] };
    const statusLabel = v => statusWords[v] ? t(...statusWords[v]) : v;
    const recurrence = { none: ['مرة واحدة', 'One time'], monthly: ['شهري', 'Monthly'], annual: ['سنوي', 'Annual'], contract: ['حسب جدول العقد', 'Contract schedule'] };
    const f = (name, ar, en, type = 'text', value = '', options, required = true) => ({ name, ar, en, type, value, options, required });
    const choices = o => Object.entries(o).map(([id, v]) => ({ id, name: t(...v) }));
    const itemName = r => getLocale() === 'ar' ? r.name_ar : r.name_en;
    const button = (action, title, id = '') => `<button type="button" class="secondary-btn" data-fp="${action}" data-id="${e(id)}">${e(title)}</button>`;
    const can = key => ctx?.book.rights.includes('ledger_' + key), options = () => ctx.book.finance_items.map(r => ({ id: r.id, name: itemName(r) }));
    const accounts = () => ctx.book.finance_accounts.filter(r => r.active).map(r => ({ id: r.id, name: getLocale() === 'ar' ? r.name_ar : r.name_en }));
    const call = (path, method, body, key) => ctx.api('package/' + path, method, body, key), confirmChange = () => confirm(t('راجع التغييرات. هل تؤكد حفظها؟ لن يُغير الحفظ تحصيلات سابقة.', 'Review the changes. Confirm saving? Previous collections will remain unchanged.'));
    const msg = err => ({ invalidCostCentre:t('اختر مركز تكلفة نشطاً تابعاً للشركة.','Choose an active cost centre for this company.'),duplicateCostCentre:t('يوجد مركز تكلفة بالاسم نفسه.','A cost centre with this name already exists.'), vehicleFollowupPolicyRequired: t('رسوم المركبة والفئة تُحسب بعد أكثر من 60 يوماً وفي أول الشهر فقط.', 'Vehicle/category fees use more than 60 days and month start only.'), pvDraftGuardReviewRequired: t('تعديل مبلغ سند الصرف محمي بحارس قاعدة البيانات. جرى تجهيز التغيير للمراجعة المالية دون تطبيقه.', 'Payment amount amendment is protected by the database guard. The change is prepared for financial review, without applying it.'), financialActivationRequired: t('التطبيق المالي يتطلب موافقة المالك المحددة. بقيت البيانات والأرصدة محفوظة.', 'Financial activation requires specific owner approval. Data and balances remain intact.'), revisionConflict: t('تغيرت البيانات؛ حدّث المعاينة وأعد المحاولة.', 'Data changed. Refresh the preview and retry.'), retroactiveFinancialRuleForbidden: t('لا يجوز تاريخ سريان سابق دون اعتماد مالي محدد.', 'A past effective date requires specific financial approval.'), principalMappingReviewRequired: t('أصل التمويل وأموال الغير تحتاج ربطاً محاسبياً معتمداً، ولا يجوز تسجيلها إيراداً للخدمات.', 'Principal and third-party funds require an approved accounting mapping and cannot be service revenue.'), accountMappingRequired: t('اختر ربطاً محاسبياً معتمداً من الإعدادات المتقدمة.', 'Choose an approved accounting mapping in advanced settings.'), unsafeInvoiceCancellation: t('لا يمكن إلغاء فاتورة مرتبطة بتحصيل أو تسوية، أو فاتورة مستحقة حالياً.', 'A due, collected or adjusted invoice cannot be cancelled.'), overlappingEntitlement: t('توجد علاقة استحقاق متداخلة للبند والعميل.', 'An overlapping entitlement exists for this customer and item.') })[err.message] || t('تعذر إتمام العملية. البيانات المدخلة محفوظة: ', 'Operation failed. Inputs remain: ') + err.message;
    function scopedForm(title, fields, save) { const company = ctx.co, actor = ABCentral.actor.id; return CenterForms.form(title, fields, (d, key) => { if (ctx?.co !== company || ABCentral.actor?.id !== actor)
        throw Error(t('تغير نطاق العمل؛ أعد فتح النموذج.', 'Scope changed. Reopen the form.')); return save(d, key); }); }
    async function safely(fn) { try {
        return await fn();
    }
    catch (err) {
        throw Object.assign(Error(msg(err)), { fieldErrors: err.fieldErrors });
    } }
    function table(key, rows, cols, actions = () => '', open) { return FinancialTables.table(ctx.scope, [...cols.map(([, title]) => title), t('الإجراءات', 'Actions')], rows.map(r => [...cols.map(([name]) => e(WorkspaceUI.dateTime(r[name]))), (open ? `<button hidden type="button" data-fp-open="${e(r.id)}" data-kind="${key}">${t('تفاصيل', 'Details')}</button>` : '') + actions(r)]), { key: 'package:' + key, columns: [...cols.map(([name]) => name), null], rawRows: rows, companyId: ctx.co }); }
    function detail(title, pairs) { const d = document.createElement('dialog'); d.className = 'record-form-dialog'; d.dataset.centerOwned = '1'; d.innerHTML = '<h2>' + e(title) + '</h2>' + RecordLayout.values(pairs) + `<button class="secondary-btn" data-close>${t('إغلاق', 'Close')}</button>`; document.body.append(d); d.querySelector('[data-close]').onclick = () => { d.close(); d.remove(); }; FloatingRecords.open(d); return d; }
    function itemEditor(existing) {
        const d = existing?.details || {}, fields = [f('nameAr', 'الاسم العربي', 'Arabic name', 'text', existing?.name_ar || ''), f('nameEn', 'الاسم الإنجليزي', 'English name', 'text', existing?.name_en || ''), f('category', 'التصنيف المالي', 'Financial classification', 'text', existing?.category || 'general', choices({ ...categories, ...Object.fromEntries(ctx.book.finance_items.filter(r => !categories[r.category]).map(r => [r.category, [r.category, r.category]])) })), f('templateItemId', 'استخدام الربط المعتمد من بند مماثل (اختياري)', 'Use approved mapping from a similar item (optional)', 'text', '', options(), false), f('recurrence', 'دورية الاستحقاق', 'Recurrence', 'text', d.recurrence || 'none', choices(recurrence)), f('recurringAmount', 'المبلغ الافتراضي', 'Default amount', 'text', d.recurringAmount || '0'), f('recurrenceStart','تاريخ بدء الدورية','Recurrence start date','date',d.recurrenceStart||'',null,false), f('invoice', 'السماح بالفوترة', 'Allow invoicing', 'checkbox', d.invoice ?? true), f('receipt', 'السماح بالقبض', 'Allow receipts', 'checkbox', d.receipt ?? true), f('payment', 'السماح بالصرف', 'Allow payment', 'checkbox', d.payment ?? false), f('annualMonth', 'أساس شهر الاستحقاق السنوي', 'Annual due month basis', 'text', String(d.annualMonth || 0), [{ id: '0', name: t('شهر تسجيل المركبة — اليوم الأول من الشهر', 'Vehicle registration month — first day of month') }, ...Array.from({ length: 12 }, (_, i) => ({ id: String(i + 1), name: new Intl.DateTimeFormat(getLocale() === 'ar' ? 'ar-AE' : 'en', { month: 'long' }).format(new Date(2026, i, 1)) }))]), ...['receivableId', 'revenueId', 'expenseId', 'payableId'].map((key, i) => ({ ...f(key, ['حساب المستحقات', 'حساب الإيرادات أو أمانات العميل', 'حساب المصروف', 'حساب الدائنين'][i], ['Receivables account', 'Income / customer liability account', 'Expense account', 'Payables account'][i], 'text', d[key] || '', accounts(), false), group: 'accounting', groupTitle: ['الربط المحاسبي — إعدادات متقدمة', 'Accounting mapping — advanced settings'] })), { ...f('taxRate', 'نسبة الضريبة المعتمدة', 'Approved tax rate', 'text', d.taxRate || '0'), group: 'accounting', groupTitle: ['الربط المحاسبي — إعدادات متقدمة', 'Accounting mapping — advanced settings'] }, { ...f('taxAccountId', 'حساب الضريبة', 'Tax account', 'text', d.taxAccountId || '', accounts(), false), group: 'accounting', groupTitle: ['الربط المحاسبي — إعدادات متقدمة', 'Accounting mapping — advanced settings'] }];
        const dialog = scopedForm(t(existing ? 'تعديل البند — الرمز ثابت' : 'تعريف بند مالي — الرمز يولد تلقائياً', existing ? 'Edit item — fixed internal code' : 'Define financial item — code generated automatically'), fields, async (values, key) => safely(async () => { const payload = { ...d, ...values, annualMonth: Number(values.annualMonth), priority: existing?.priority ?? 100, companyIds: d.companyIds || [ctx.co], active: existing?.active ?? true, methods: d.methods || ['manual', 'automatic', 'bulk'] }; if (existing)
            payload.code = existing.code;
            if(!payload.recurrenceStart)delete payload.recurrenceStart;
            for (const k of Object.keys(payload))
            if (k.endsWith('Id') && !payload[k])
                delete payload[k]; await ctx.api(existing ? 'items/' + existing.id : 'items', existing ? 'PATCH' : 'POST', payload, key); await ctx.refresh(); }));
        const group = dialog.querySelector('.record-field-group');
        if (group) {
            const details = document.createElement('details');
            details.className = 'full';
            details.innerHTML = '<summary>' + e(t('الربط المحاسبي — إعدادات متقدمة', 'Accounting mapping — advanced settings')) + '</summary>';
            group.replaceWith(details);
            details.append(group);
            group.querySelector('legend').hidden = true;
        }
        const toggle = () => { const form = dialog.querySelector('form'); for (const key of ['receivableId', 'revenueId'])
            form.elements[key].closest('label').hidden = !form.elements.invoice.checked; for (const key of ['expenseId', 'payableId'])
            form.elements[key].closest('label').hidden = !form.elements.payment.checked; form.elements.annualMonth.closest('label').hidden = form.elements.recurrence.value !== 'annual' || !existing || d.recurrenceBinding === 'explicit'; };
        dialog.querySelector('form').onchange = ev => { if (ev.target.name === 'templateItemId') {
            const source = ctx.book.finance_items.find(x => x.id === ev.target.value), form = dialog.querySelector('form');
            if (source) {
                form.elements.category.value = source.category;
                for (const key of ['receivableId', 'revenueId', 'expenseId', 'payableId', 'taxAccountId', 'taxRate'])
                    if (form.elements[key])
                        form.elements[key].value = source.details[key] || '';
            }
        } toggle(); };
        toggle();
        return dialog;
    }
    function itemPanel(context) { ctx = context; return (can('item_manage') ? button('new-item', t('تعريف بند مالي', 'Define financial item')) : '') + table('items', ctx.book.finance_items.map(r => ({ ...r, displayName: itemName(r), recurrenceName: t(...(recurrence[r.details.recurrence] || recurrence.none)), state: r.active ? t('نشط', 'Active') : t('غير نشط', 'Inactive') })), [['displayName', t('البند', 'Item')], ['recurrenceName', t('دورية الاستحقاق', 'Recurrence')], ['state', t('الحالة', 'Status')]], () => '', true); }
    function body(tab, context) {
        ctx = context;
        const state = ctx.book.package;
        if (!names[tab])
            return null;
        const intro = `<p class="notice">${t('إعدادات ومعاينات؛ تفعيل الأثر المالي الجديد يحتاج موافقة المالك المحددة. الحفظ لا يعيد توزيع تحصيلات سابقة.', 'Configuration and previews. New financial effects require specific owner approval. Saving does not reallocate previous collections.')}</p>`;
        if(tab==='cost-centres')return `<p class="notice">${t('تخصيص اختياري للقيود اليدوية الجديدة؛ لا يعاد تصنيف القيود السابقة.','Optional attribution for new manual journals; historical entries are not reclassified.')}</p>`+(can('configure')?button('cost-centre-new',t('إضافة مركز تكلفة','Add cost centre')):'')+table('cost-centres',(state.costCentres||[]).map(r=>({...r,displayName:getLocale()==='ar'?r.nameAr:r.nameEn,state:r.active?t('نشط','Active'):t('غير نشط','Inactive')})),[['displayName',t('الاسم','Name')],['state',t('الحالة','Status')]],()=>'',true);
        if (tab === 'taxes') {
            const cfg=state.taxPreparation;
            return `<p class="notice">${t('مسودة إعدادات مستقلة للشركة؛ لا تغيّر ضرائب الفواتير أو الأرصدة ولا تقدم إقراراً. الفوترة الإلكترونية غير متصلة.', 'Company-specific draft settings. No invoice tax, balance or filing changes. Electronic invoicing is not connected.')}</p>` +
                `<p>${t('رقم التسجيل الضريبي', 'TRN')}: ${e(cfg?.trn || t('غير مضبوط', 'Not configured'))} — ${t('فترات VAT', 'VAT periods')}: ${cfg?.vatPeriods.length || 0} — ${t('فترات ضريبة الشركات', 'Corporate tax periods')}: ${cfg?.corporatePeriods.length || 0}</p>` +
                (can('configure') ? button('tax-edit',t('إعداد الشركة والفترات', 'Company and periods'))+button('tax-mapping',t('تصنيف بند للمراجعة', 'Review item classification'))+button('tax-adjustment',t('تسوية ضريبية مقترحة', 'Proposed tax adjustment')) : '')+
                button('tax-bridge',t('تسوية الربح المحاسبي والدخل المقترح', 'Accounting profit reconciliation'))+
                table('tax-mappings',(cfg?.mappings || []).map(r=>({...r,id:r.itemId,categoryLabel:t(...taxCategories[r.category]),ratePercent:r.rateBasisPoints==null?'—':r.rateBasisPoints/100,displayName:itemName(ctx.book.finance_items.find(x=>x.id===r.itemId)||{nameAr:'غير متاح',nameEn:'Unavailable'})})),[['displayName',t('البند','Item')],['categoryLabel',t('التصنيف المقترح','Proposed classification')],['ratePercent',t('المعدل المقترح %','Proposed rate %')],['reason',t('سبب التصنيف','Classification reason')]],()=>'',true);
        }
        if (tab === 'priorities') {
            const ids = state.priority?.itemIds || ctx.book.finance_items.slice().sort((a, b) => a.priority - b.priority).map(r => r.id), ordered = [...ids, ...ctx.book.finance_items.map(r => r.id).filter(id => !ids.includes(id))];
            return intro + `<form id="fp-priority"><label><input type="checkbox" name="enabled" ${state.priority?.requestedEnabled ? 'checked' : ''}>${t('تفعيل الأولوية للدفعات غير المخصصة', 'Enable priority for unspecified payments')}</label><ol data-priority-list>${ordered.map(id => { const r = ctx.book.finance_items.find(r => r.id === id); return r ? `<li data-item="${e(id)}"><label><input type="checkbox" name="included" ${ids.includes(id)?'checked':''}>${e(itemName(r))}</label>${can('configure') ? button('up', t('للأعلى', 'Move up'), id) + button('down', t('للأسفل', 'Move down'), id) : ''}</li>` : ''; }).join('')}</ol><p>${t('الحالة المالية الفعلية', 'Actual financial state')}: ${!state.approved.priority || !state.priority ? t('الأولوية الرقمية السابقة محفوظة؛ الترتيب الجديد لم يفعّل مالياً.', 'Existing numeric priorities are preserved; the new order is not financially activated.') : state.priority.enabled ? t('الترتيب الجديد مفعل للمستحقات العامة غير المخصصة. قواعد العقود محفوظة.', 'New order active for unallocated general receivables. Contract rules are preserved.') : t('التوزيع بالأولوية معطل للمستحقات العامة؛ يلزم تخصيص فواتير صراحة.', 'Priority allocation disabled for general receivables; select invoices explicitly.')}</p>${can('configure') ? '<button type="submit" class="primary-btn">' + t('معاينة وحفظ الترتيب', 'Review and save order') + '</button>' : ''}<p role="alert"></p></form>`;
        }
        if (tab === 'compliance') {
            const rows = state.feeRules.map(r => ({ ...r, companyName: getLocale() === 'ar' ? ctx.company?.arabicName : ctx.company?.englishName, displayName: ctx.book.finance_items.find(x => x.id === r.itemId) ? itemName(ctx.book.finance_items.find(x => x.id === r.itemId)) : t('بند غير متاح', 'Unavailable item'), repeatName: r.repeat === 'once' ? t('مرة واحدة', 'One time') : t('شهري', 'Monthly'), unitName: r.unit === 'vehicle_category' ? t('كل مركبة وفئة — أكثر من 60 يوماً، أول الشهر', 'Vehicle/category — over 60 days, month start') : r.unit === 'customer_item' ? t('رصيد البند للعميل', 'Customer item balance') : t('كل مستحق مستقل', 'Each receivable'), state: r.enabled ? t('مفعل', 'Enabled') : t('معطل', 'Disabled') }));
            return intro + button('monthly-review',t('معاينة إقفال الشهر','Preview month close')) +
                (can('configure')&&ABCentral.actor.roleId==='owner'?button('monthly-new',t('إعداد متابعة شهرية','Configure monthly follow-up')):'') +
                table('monthly-followup',(state.monthlyFollowups||[]).map(r=>({...r,displayName:itemName(ctx.book.finance_items.find(x=>x.id===r.itemId)||{})})),
                  [['displayName',t('البند الأساسي','Base item')],['amount',t('الرسم','Fee')],['effectiveOn',t('السريان','Effective date')]],
                  r=>can('configure')&&ABCentral.actor.roleId==='owner'?button('monthly-edit',t('تعديل','Edit'),r.itemId):'') +
                (can('configure') ? button('fee-new', t('إضافة قاعدة رسوم', 'Add fee rule')) : '') + table('fees', rows, [['displayName', t('البند', 'Item')], ['companyName', t('الشركة', 'Company')], ['delayMonths', t('مدة التأخر بالأشهر', 'Delay months')], ['amount', t('الرسوم AED', 'Fee AED')], ['unitName', t('وحدة الاحتساب', 'Calculation unit')], ['repeatName', t('التكرار', 'Recurrence')], ['effectiveOn', t('السريان', 'Effective date')], ['state', t('الحالة', 'State')]], r => can('configure') ? button('fee-status', r.enabled ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable'), r.id) : '', true);
        }
        if (tab === 'entitlements')
            return intro + (can('configure') ? button('relation-new', t('ربط استحقاق فعلي', 'Link actual entitlement')) : '') + button('relation-preview', t('معاينة الاستحقاقات', 'Preview entitlements')) + table('relations', state.relations.map(r => ({ ...r, customerName: ctx.customers.find(c => c.id === r.customerId)?.name || t('غير متاح في نطاق العرض', 'Unavailable in scope'), itemName: ctx.book.finance_items.find(x => x.id === r.itemId) ? itemName(ctx.book.finance_items.find(x => x.id === r.itemId)) : t('غير متاح', 'Unavailable'), state: r.enabled ? t('مفعل', 'Enabled') : t('معطل', 'Disabled') })), [['itemName', t('البند', 'Item')], ['customerName', t('العميل', 'Customer')], ['amount', t('المبلغ', 'Amount')], ['anchorOn', t('بداية الاستحقاق', 'First due date')], ['untilOn', t('نهاية العلاقة', 'Relationship end')], ['state', t('الحالة', 'State')]], r => can('configure') ? button('relation-status', r.enabled ? t('تعطيل', 'Disable') : t('تفعيل', 'Enable'), r.id) : '', true);
        if (tab === 'documents') {
            const key = ctx.co + ':' + docType + ':' + docPage + ':' + ABCentral.actor.id;
            if (docContext !== key) {
                docContext = key;
                docResult = null;
                docError = '';
                docLoading = true;
                const owner = ABCentral.actor.id, request = ++docRequest, api = ctx.api, query = new URLSearchParams({ companyId: ctx.co, type: docType, page: docPage });
                const current = () => request === docRequest && owner === ABCentral.actor?.id && docContext === key;
                queueMicrotask(async () => { try {
                    const r = await api('package/documents?' + query);
                    if (current())
                        docResult = r;
                }
                catch (err) {
                    if (current())
                        docError = msg(err);
                }
                finally {
                    if (current()) {
                        docLoading = false;
                        if (app.state.currentPage === 'financialManagement') render();
                    }
                } });
            }
            return `<label>${t('نوع المستند', 'Document type')}<select class="input" id="fp-document-type">${['Invoice', 'RV', 'Discount', 'PV', 'Deposit'].map(k => `<option ${docType === k ? 'selected' : ''} value="${k}">${e(({ Invoice: t('فاتورة', 'Invoice'), RV: t('سند قبض', 'Receipt voucher'), Discount: t('خصم', 'Discount'), PV: t('سند صرف', 'Payment voucher'), Deposit: t('سند إيداع', 'Deposit') })[k])}</option>`).join('')}</select></label>${docError ? '<p role="alert">' + e(docError) + '</p>' : docLoading ? '<p role="status">' + t('جارٍ تحميل المستندات...', 'Loading documents...') + '</p>' : table('documents', (docResult?.rows || []).map(r => ({ ...r,id:r.rowKey||r.id,number: r.number || t('غير مسجل', 'Not recorded'), status: statusLabel(r.status), companyName: getLocale() === 'ar' ? r.companyNameAr : r.companyNameEn })), [['number', t('رقم المستند', 'Document number')], ['companyName', t('الشركة', 'Company')], ['customerName', t('العميل', 'Customer')], ['amount', t('المبلغ', 'Amount')], ['status', t('الحالة', 'State')], ['createdByName', t('أنشأه', 'Created by')]], () => '', true)}<p>${t('عدد النتائج', 'Result count')}: ${docResult?.count ?? '—'}</p>${button('doc-prev', t('السابق', 'Previous'))}${button('doc-next', t('التالي', 'Next'))}`;
        }
    }
    const taxCategories={standard:['خاضع بمعدل مقترح','Proposed standard rate'],zero:['صفري','Zero-rated'],exempt:['معفى','Exempt'],outside_scope:['خارج النطاق','Outside scope'],reverse_charge:['احتساب عكسي — مراجعة','Reverse charge — review'],review:['غير محسوم','Unresolved']};
    function taxValue() { const c=ctx.book.package.taxPreparation; return {companyId:ctx.co,revision:c?.revision||0,trn:c?.trn||'',vatPeriods:c?.vatPeriods||[],corporatePeriods:c?.corporatePeriods||[],mappings:c?.mappings||[],adjustments:c?.adjustments||[],notes:c?.notes||'',confirm:true}; }
    async function saveTax(value,patch,key){await call('tax-config','POST',{...value,...patch},key);await ctx.refresh();}
    function taxEditor(){const old=taxValue(),v=old.vatPeriods[0],c=old.corporatePeriods[0];return scopedForm(t('إعداد ضريبي — مسودة للمراجعة','Tax configuration — review draft'),[f('trn','رقم TRN — 15 رقماً','TRN — 15 digits','text',old.trn),f('vatFrom','بداية أول فترة VAT','First VAT period start','date',v?.from||'',null,false),f('vatTo','نهاية أول فترة VAT','First VAT period end','date',v?.to||'',null,false),f('corporateFrom','بداية أول فترة ضريبة شركات','First corporate period start','date',c?.from||'',null,false),f('corporateTo','نهاية أول فترة ضريبة شركات','First corporate period end','date',c?.to||'',null,false),f('notes','ملاحظات المراجعة','Review notes','textarea',old.notes,null,false)],async(d,key)=>safely(async()=>{
        if(Boolean(d.vatFrom)!==Boolean(d.vatTo)||Boolean(d.corporateFrom)!==Boolean(d.corporateTo))throw Error(t('أكمل بداية ونهاية الفترة معاً','Complete both period dates'));
        await saveTax(old,{trn:d.trn,notes:d.notes,vatPeriods:d.vatFrom?[{from:d.vatFrom,to:d.vatTo},...old.vatPeriods.slice(1)]:old.vatPeriods,corporatePeriods:d.corporateFrom?[{from:d.corporateFrom,to:d.corporateTo},...old.corporatePeriods.slice(1)]:old.corporatePeriods},key);
    }));}
    function taxMappingEditor(r){const old=taxValue();if(!old.trn)throw Error(t('أدخل إعداد الشركة أولاً','Configure the company first'));return scopedForm(t('تصنيف بند — لا يغيّر الفواتير','Item classification — no invoice changes'),[f('itemId','البند','Item','text',r?.itemId||'',options()),f('category','التصنيف المقترح','Proposed classification','text',r?.category||'review',choices(taxCategories)),f('rate','المعدل المقترح % — يترك فارغاً عند عدم الحسم','Proposed rate % — blank if unresolved','text',r?.rateBasisPoints==null?'':r.rateBasisPoints/100,null,false),f('inputRecovery','استرداد المدخلات المقترح','Proposed input recovery','text',r?.inputRecovery||'review',choices({review:['مراجعة','Review'],recoverable:['قابل للاسترداد','Recoverable'],blocked:['غير قابل للاسترداد','Blocked'],partial:['جزئي — مراجعة','Partial — review']})),f('reason','سبب التصنيف','Classification reason','textarea',r?.reason||'')],async(d,key)=>safely(async()=>{if(d.rate!==''&&!/^\d{1,3}(\.\d{1,2})?$/.test(d.rate))throw Error(t('أدخل نسبة صحيحة حتى منزلتين عشريتين','Enter a rate with at most two decimals'));const value={itemId:d.itemId,category:d.category,rateBasisPoints:d.rate===''?null:Math.round(Number(d.rate)*100),inputRecovery:d.inputRecovery,reason:d.reason};await saveTax(old,{mappings:[...old.mappings.filter(x=>x.itemId!==d.itemId),value]},key);}));}
    function taxAdjustmentEditor(){const old=taxValue();if(!old.trn)throw Error(t('أدخل إعداد الشركة أولاً','Configure the company first'));return scopedForm(t('تسوية مقترحة — دون قيد أو إقرار','Proposed adjustment — no posting or filing'),[f('from','بداية الفترة','Period start','date',old.corporatePeriods[0]?.from||''),f('to','نهاية الفترة','Period end','date',old.corporatePeriods[0]?.to||''),f('direction','الأثر المقترح','Proposed effect','text','add',choices({add:['إضافة','Add'],deduct:['استبعاد','Deduct']})),f('amount','المبلغ AED','Amount AED'),f('reason','السبب','Reason','textarea'),f('evidenceVersionId','مرجع إصدار المستند إن توفر','Document version reference if available','text','',null,false)],async(d,key)=>safely(()=>saveTax(old,{adjustments:[...old.adjustments,{...d,id:crypto.randomUUID(),evidenceVersionId:d.evidenceVersionId||null}]},key)));}
    function taxBridgeEditor(){return scopedForm(t('معاينة ضريبة الشركات — دون اعتماد نهائي','Corporate tax preview — not final approval'),[f('from','من','From','date',ctx.book.package.taxPreparation?.corporatePeriods[0]?.from||date()),f('to','إلى','To','date',ctx.book.package.taxPreparation?.corporatePeriods[0]?.to||date())],async(d)=>safely(async()=>{const r=await call('tax-bridge?'+new URLSearchParams({companyId:ctx.co,...d}),'GET');detail(t('تسوية مقترحة — ليست إقراراً','Proposed reconciliation — not a filing'),[[t('الربح المحاسبي AED','Accounting profit AED'),r.accountingProfit],[t('الإضافات المقترحة','Proposed additions'),r.proposedAdditions],[t('الاستبعادات المقترحة','Proposed deductions'),r.proposedDeductions],[t('الدخل المقترح للمراجعة','Proposed income for review'),r.proposedTaxableIncome],[t('الضريبة المستحقة','Tax due'),t('غير معتمدة — لا تُحسب تلقائياً','Not approved — not calculated automatically')]]);}));}
    function feeEditor(r) { const fields = [f('itemId', 'البند الأصلي', 'Original item', 'text', r?.itemId || '', options()), f('feeItemId', 'بند الرسوم المستقل المرتبط بحساب الإيرادات', 'Separate fee item mapped to income', 'text', r?.feeItemId || '', options()), f('delayMonths', 'مدة التأخر بالأشهر', 'Delay months', 'number', r?.delayMonths || 2), f('amount', 'قيمة الرسوم بالدرهم', 'Fee AED', 'text', r?.amount || '10'), f('repeat', 'طريقة التكرار', 'Recurrence', 'text', r?.repeat || 'once', choices({ once: ['مرة واحدة', 'Once'], monthly: ['شهرياً', 'Monthly'] })), f('unit', 'وحدة الاحتساب', 'Calculation unit', 'text', r?.unit || 'customer_item', choices({ customer_item: ['إجمالي رصيد البند للعميل', 'Customer item balance'], invoice: ['كل مستحق مستقل', 'Each receivable'], vehicle_category: ['كل مركبة وفئة — أكثر من 60 يوماً، أول الشهر', 'Vehicle/category — over 60 days, month start'] })), f('effectiveOn', 'تاريخ السريان المستقبلي', 'Prospective effective date', 'date', date()), f('contractEvidenceId', 'المستند التعاقدي المعتمد', 'Approved contractual evidence', 'text', r?.contractEvidenceId || '', ctx.docs), f('notes', 'الشروط والملاحظات', 'Conditions and notes', 'textarea', r?.notes || '', null, false)]; return scopedForm(t('قاعدة رسوم — تحفظ معطلة افتراضياً', 'Fee rule — saved disabled by default'), fields, async (d, key) => safely(async () => { if (!confirmChange())
        throw Error(t('لم يتم التأكيد', 'Not confirmed')); await call(r ? 'fees/' + r.id : 'fees', r ? 'PATCH' : 'POST', { ...d, companyId: ctx.co, delayMonths: d.unit === 'vehicle_category' ? 2 : Number(d.delayMonths), repeat: d.unit === 'vehicle_category' ? 'monthly' : d.repeat, revision: r?.revision || 0, enabled: r?.enabled || false, confirm: true }, key); await ctx.refresh(); })); }
    function costCentreEditor(r){return scopedForm(t('مركز التكلفة','Cost centre'),[f('nameAr','الاسم العربي','Arabic name','text',r?.nameAr||''),f('nameEn','الاسم الإنجليزي','English name','text',r?.nameEn||''),f('active','نشط','Active','checkbox',r?r.active:true),f('reason','سبب التغيير','Change reason')],(d,key)=>safely(async()=>{await call('cost-centres','POST',{companyId:ctx.co,...(r?{id:r.id}:{}),revision:r?.revision||0,nameAr:d.nameAr,nameEn:d.nameEn,active:!!d.active,reason:d.reason},key);await ctx.refresh();}));}
    function bind(context) {
        ctx = context;
        const host = document.querySelector('.ld-section');
        if (!host)
            return;
        CenterForms.bindSnapshots(host);
        host.querySelectorAll('[data-fp-open]').forEach(opener => opener.onclick = () => openRow(opener.dataset.kind, opener.dataset.fpOpen));
        host.querySelectorAll('[data-fp]').forEach(b => b.onclick = async (ev) => { ev.stopPropagation(); if (b.disabled)
            return; const action = b.dataset.fp, key = b.dataset.id; b.disabled = true; try {
            if(action==='cost-centre-new'){costCentreEditor();return;}
            if(action==='tax-edit'){taxEditor();return;}
            if(action==='tax-mapping'){taxMappingEditor();return;}
            if(action==='tax-adjustment'){taxAdjustmentEditor();return;}
            if(action==='tax-bridge'){taxBridgeEditor();return;}
            if (action === 'new-item') {
                itemEditor();
                return;
            }
            if(action==='monthly-new'||action==='monthly-edit'){
                const old=ctx.book.package.monthlyFollowups?.find(r=>r.itemId===key);
                const baseItems=ctx.book.finance_items.filter(r=>r.category!=='monthly_followup'&&(!old||r.id===old.itemId))
                    .map(r=>({id:r.id,name:itemName(r)}));
                const income=ctx.book.finance_accounts.filter(r=>r.active&&r.kind==='income'&&(!old||r.id===old.incomeAccountId))
                    .map(r=>({id:r.id,name:itemName(r)}));
                scopedForm(t('مصاريف المتابعة الشهرية','Monthly follow-up expenses'),[
                    f('itemId','البند الأساسي','Base item','text',old?.itemId||'',baseItems),
                    f('incomeAccountId','حساب الإيراد','Income account','text',old?.incomeAccountId||'',income),
                    f('amount','الرسم بالدرهم','Fee in AED','text',old?.amount||''),
                    f('effectiveOn','تاريخ السريان','Effective date','date',date()),
                    f('condition','شرط الاحتساب','Charge condition','text',old?.condition||'any_unpaid',[
                        {id:'any_unpaid',name:t('أي رصيد مستحق عند الإقفال','Any unpaid balance at close')},
                        {id:'double_fee',name:t('الرصيد لا يقل عن ضعفي الرسم','Balance at least twice the fee')},
                    ]),
                    f('enabled','تفعيل القاعدة المعتمدة','Enable approved rule','checkbox',old?.enabled||false),
                ],(d,requestKey)=>safely(async()=>{
                    await call('monthly-followup','POST',{...d,companyId:ctx.co,revision:old?.revision||0,confirm:true},requestKey);
                    await ctx.refresh();
                }));
                return;
            }
            if(action==='monthly-review'){
                const requestCompany=ctx.co,actor=ABCentral.actor.id;
                const plan=await call('monthly-followup/preview?'+new URLSearchParams({companyId:requestCompany}));
                if(ctx.co!==requestCompany||ABCentral.actor.id!==actor)return;
                const dialog=detail(t('معاينة إقفال الشهر','Month close preview'),[
                    [t('تاريخ الإقفال','Close date'),plan.closeOn],
                    ...plan.rows.map(row=>[itemName(ctx.book.finance_items.find(i=>i.id===row.itemId)||{}),
                        row.customerId+' · '+row.amount+' AED']),
                ]);
                if(can('invoice_create')&&ABCentral.actor.roleId==='owner'&&ctx.book.package.approved['monthly-followup']&&plan.rows.length){
                    const apply=document.createElement('button');
                    apply.type='button';
                    apply.className='primary-btn';
                    apply.textContent=t('تأكيد إصدار الفواتير','Confirm issuing invoices');
                    const error=document.createElement('p');
                    error.setAttribute('role','alert');
                    dialog.append(apply,error);
                    const requestKey=crypto.randomUUID();
                    apply.onclick=async()=>{
                        if(ctx.co!==requestCompany||ABCentral.actor.id!==actor||!confirmChange())return;
                        apply.disabled=true;
                        try{
                            await call('monthly-followup/close','POST',{companyId:requestCompany,digest:plan.digest,confirm:true},requestKey);
                            dialog.close();
                            dialog.remove();
                            await ctx.refresh();
                        }catch(err){error.textContent=msg(err);apply.disabled=false;}
                    };
                }
                return;
            }
            if (action === 'fee-new') {
                feeEditor();
                return;
            }
            if (action === 'up' || action === 'down') {
                const li = b.closest('li'), other = action === 'up' ? li.previousElementSibling : li.nextElementSibling;
                if (other) {
                    if (action === 'up')
                        li.parentNode.insertBefore(li, other);
                    else
                        li.parentNode.insertBefore(other, li);
                }
                return;
            }
            if (action === 'fee-status') {
                const r = ctx.book.package.feeRules.find(r => r.id === key);
                if (!confirmChange())
                    return;
                const { companyId, itemId, feeItemId, delayMonths, amount, repeat, unit, contractEvidenceId, notes, revision } = r;
                await call('fees/' + key, 'PATCH', { companyId, itemId, feeItemId, delayMonths, amount, repeat, unit, contractEvidenceId, notes, revision, effectiveOn: date(), enabled: !r.enabled, confirm: true }, crypto.randomUUID());
                await ctx.refresh();
                return;
            }
            if (action === 'relation-status') {
                const r = ctx.book.package.relations.find(r => r.id === key);
                if (!confirmChange())
                    return;
                await call('relations/' + key + '/status', 'POST', { companyId: ctx.co, enabled: !r.enabled, revision: r.revision, confirm: true }, crypto.randomUUID());
                await ctx.refresh();
                return;
            }
            if (action === 'relation-preview') {
                const result = await call('recurring/preview', 'POST', { companyId: ctx.co }, crypto.randomUUID());
                detail(t('معاينة فقط — لا فواتير جديدة', 'Preview only — no invoices created'), result.rows.map(r => [r.dueOn, r.amount + ' ' + r.currency]));
                return;
            }
            if (action === 'relation-new') {
                scopedForm(t('علاقة استحقاق معتمدة — دون إنشاء تلقائي عند الحفظ', 'Approved entitlement — saving does not issue invoices'), [f('customerId', 'العميل', 'Customer', 'text', '', ctx.customers), f('vehicleId', 'المركبة إن انطبقت', 'Vehicle if applicable', 'text', '', ctx.vehicles, false), f('itemId', 'البند الدوري', 'Recurring item', 'text', '', options()), f('amount', 'المبلغ — فارغ لاستخدام الافتراضي للبند', 'Amount — leave blank for item default', 'text', '', null, false), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('effectiveOn', 'سريان العلاقة', 'Effective date', 'date', date()), f('anchorOn', 'تاريخ الاستحقاق الأول', 'First due date', 'date', date()), f('untilOn', 'نهاية العلاقة', 'Relationship end', 'date', '', null, false), f('dateBasis', 'أساس تاريخ الاستحقاق', 'Due date basis', 'text', 'relationship_start', choices({ relationship_start: ['بداية العلاقة', 'Relationship start'], vehicle_registration: ['تسجيل المركبة', 'Vehicle registration'], specific: ['تاريخ محدد', 'Specific date'] })), f('proration', 'الجزء الأول وفق العقد', 'First period per contract', 'text', 'none', choices({ none: ['دون تجزئة', 'No proration'], calendar_days: ['أيام التقويم وفق مستند العقد', 'Calendar days per contract evidence'] })), f('contractEvidenceId', 'دليل الاستحقاق التعاقدي', 'Contractual entitlement evidence', 'text', '', ctx.docs), f('notes', 'شروط العلاقة', 'Entitlement terms', 'textarea')], async (d, k) => safely(async () => { if (!d.untilOn)
                    delete d.untilOn; if (!d.amount)
                    delete d.amount; if (!d.vehicleId)
                    delete d.vehicleId; await call('relations', 'POST', { ...d, companyId: ctx.co, enabled: false, confirm: true }, k); await ctx.refresh(); }));
                return;
            }
            if (action === 'doc-prev' || action === 'doc-next') {
                if (action === 'doc-prev' && docPage > 0)
                    docPage--;
                if (action === 'doc-next' && docResult && (docPage + 1) * 100 < docResult.count)
                    docPage++;
                docContext = '';
                render();
            }
        }
        catch (err) {
            const box = document.getElementById('ld-notice');
            if (box)
                box.textContent = msg(err);
        }
        finally {
            if (b.isConnected)
                b.disabled = false;
        } });
        const priority = host.querySelector('#fp-priority');
        if (priority)
            priority.onsubmit = async (ev) => { ev.preventDefault(); if (priority.dataset.busy || !confirmChange())
                return; priority.dataset.busy = '1'; const b = priority.querySelector('[type=submit]'); b.disabled = true; try {
                await call('priority', 'POST', { companyId: ctx.co, enabled: priority.elements.enabled.checked, itemIds: [...priority.querySelectorAll('[data-item]')].filter(li=>li.querySelector('[name=included]').checked).map(li => li.dataset.item), revision: ctx.book.package.priority?.revision || 0, confirm: true }, crypto.randomUUID());
                await ctx.refresh();
            }
            catch (err) {
                priority.querySelector('[role=alert]').textContent = msg(err);
            }
            finally {
                delete priority.dataset.busy;
                if (b.isConnected)
                    b.disabled = false;
            } };
        const picker = host.querySelector('#fp-document-type');
        if (picker)
            picker.onchange = () => { docType = picker.value; docPage = 0; docContext = ''; render(); };
    }
    function openRow(kind, id) { if(kind==='cost-centres'){const r=ctx.book.package.costCentres.find(x=>x.id===id);if(can('configure'))costCentreEditor(r);else detail(t('مركز التكلفة','Cost centre'),[[t('الاسم','Name'),getLocale()==='ar'?r.nameAr:r.nameEn]]);return;} if (kind === 'items') {
        const r = ctx.book.finance_items.find(r => r.id === id);
        if (can('item_manage'))
            itemEditor(r);
        else
            detail(t('بيانات البند', 'Item details'), [[t('الاسم', 'Name'), itemName(r)], [t('الدورية', 'Recurrence'), t(...(recurrence[r.details.recurrence] || recurrence.none))]]);
        return;
    } if(kind==='tax-mappings'){const r=ctx.book.package.taxPreparation?.mappings.find(x=>x.itemId===id);if(can('configure'))taxMappingEditor(r);return;
    } if (kind === 'fees') {
        const r = ctx.book.package.feeRules.find(r => r.id === id);
        if (can('configure')) {
            const dialog = feeEditor(r);
            const p = document.createElement('button');
            p.type = 'button';
            p.className = 'secondary-btn';
            p.textContent = t('معاينة أثر القاعدة فقط', 'Preview rule effect only');
            p.onclick = async () => { p.disabled = true; try {
                const preview = await call('fees/' + id + '/preview', 'POST', { companyId: ctx.co }, crypto.randomUUID());
                detail(t('الأصل والرسوم — معاينة دون ترحيل', 'Principal and fees — preview without posting'), preview.rows.flatMap(x => [[t('الرصيد الأصلي', 'Original balance'), x.baseOutstanding], [t('الرسم المنفصل', 'Separate fee'), x.amount], [t('الاستحقاق', 'Due'), x.dueOn]]));
            }
            catch (err) {
                dialog.querySelector('[role=alert]').textContent = msg(err);
            }
            finally {
                p.disabled = false;
            } };
            dialog.append(p);
        }
        else
            detail(t('قاعدة الرسوم', 'Fee rule'), [[t('المبلغ', 'Amount'), r.amount], [t('مدة التأخر بالأشهر', 'Delay months'), r.delayMonths], [t('السريان', 'Effective date'), WorkspaceUI.date(r.effectiveOn)], [t('الشروط', 'Conditions'), r.notes]]);
        return;
    } if (kind === 'relations') {
        const r = ctx.book.package.relations.find(r => r.id === id);
        detail(t('علاقة الاستحقاق', 'Entitlement'), [[t('المبلغ', 'Amount'), r.amount], [t('بداية الاستحقاق', 'First due date'), r.anchorOn], [t('نهاية العلاقة', 'Relationship end'), r.untilOn], [t('الشروط', 'Terms'), r.notes]]);
        return;
    } if (kind === 'documents') {
        const r=docResult.rows.find(r=>(r.rowKey||r.id)===id), d = detail(t('ملف المستند المالي', 'Financial document'), [[t('الرقم', 'Number'), r.number], [t('الشركة', 'Company'), getLocale() === 'ar' ? r.companyNameAr : r.companyNameEn], [t('العميل', 'Customer'), r.customerName], [t('رقم العميل', 'Customer number'), r.customerNumber], [t('اللوحة', 'Plate'), r.plate], [t('المبلغ', 'Amount'), r.amount], [t('التاريخ', 'Date'), WorkspaceUI.dateTime(r.date)], [t('البيان', 'Description'), r.description], [t('أنشأه', 'Created by'), r.createdByName], [t('وقت الإنشاء', 'Created at'), WorkspaceUI.dateTime(r.createdAt)], [t('اعتمده', 'Approved by'), r.approvedByName], [t('الحالة', 'State'), statusLabel(r.status)], [t('تاريخ الاستحقاق', 'Due date'), WorkspaceUI.date(r.dueOn)], [t('المحصّل', 'Collected'), r.paid], [t('الخصومات', 'Discounts'), r.credited], [t('الرصيد القانوني', 'Legal balance'), r.outstanding], [t('الرصيد الدفتري', 'Book balance'), r.bookOutstanding], [t('آخر تعديل بواسطة', 'Last modified by'), r.lastModifiedByName], [t('تاريخ آخر تعديل', 'Last modified at'), WorkspaceUI.dateTime(r.lastModifiedAt)], [t('الملاحظات','Notes'),r.notes],[t('مصدر القيد','Source journal'),r.sourceJournalNumber?'#'+r.sourceJournalNumber:null],[t('الحساب البنكي','Bank account'),r.bankAccountName],[t('مصدر أموال الإيداع — حامل العهدة','Deposit source — custodian'),r.sourceOfFunds], ...(r.feeOrigin ? [[t('المستحقات الأصلية المرتبطة', 'Linked original invoices'), r.feeOrigin.invoiceNumbers?.map(n => '#' + n).join('، ')], [t('الرصيد الأصلي وقت الرسوم', 'Original balance at fee assessment'), r.feeOrigin.baseOutstanding]] : [])]);
        if (r.draftAmendable && can(r.type === 'PV' ? 'voucher_create' : 'deposit')) {
            const amend = document.createElement('button');
            amend.type = 'button';
            amend.className = 'secondary-btn';
            amend.textContent = t('معاينة تعديل المسودة قبل الترحيل', 'Preview amendment before posting');
            amend.onclick = () => scopedForm(amend.textContent, [f('amount', 'المبلغ الجديد', 'New amount', 'text', r.amount), f('effectiveOn', 'تاريخ المستند', 'Document date', 'date', date()), ...(r.type === 'PV' ? [f('beneficiary', 'المستفيد', 'Beneficiary', 'text', r.beneficiary || '')] : [f('bankAccountId', 'الحساب البنكي', 'Bank account', 'text', r.bankAccountId || '', ctx.book.banks.map(b => ({ id: b.id, name: b.accountName }))), f('reference', 'المرجع البنكي', 'Bank reference', 'text', r.reference || '')]), f('notes', 'سبب التعديل', 'Amendment reason', 'textarea')], async (values, key) => safely(async () => { const data = { ...values, type: r.type, documentId: r.id, companyId: ctx.co, confirm: true }, preview = await call('drafts/preview', 'POST', data, key + '-preview'); if (!confirm(t('تأكيد تعديل المسودة دون حركة نقدية؟', 'Confirm draft amendment without cash movement?') + ' ' + preview.before.amount + ' → ' + preview.after.amount))
                throw Error(t('لم يتم التأكيد', 'Not confirmed')); await call('drafts/confirm', 'POST', { data, digest: preview.digest }, key); docContext = ''; d.close(); d.remove(); await ctx.refresh(); }));
            d.append(amend);
        }
        const note = document.createElement('button');
        note.className = 'secondary-btn';
        note.textContent = t('تصحيح الملاحظات مع حفظ الأصل', 'Correct notes while preserving original');
        note.onclick = () => scopedForm(note.textContent, [f('notes', 'ملاحظات التصحيح', 'Correction notes', 'textarea', r.notes || ''), ...(can('journal_approve') ? [f('correctionJournalId', 'قيد تصحيحي مرحّل مرتبط (اختياري)', 'Linked posted correction journal (optional)', 'text', '', ctx.book.finance_journals.filter(j => j.status === 'Posted').map(j => ({ id: j.id, name: '#' + j.number })), false)] : [])], async (values, key) => safely(async () => { await call('documents/notes', 'POST', { companyId: ctx.co, type: r.type, documentId:r.id,sourceKind:r.sourceKind||'native',notes:values.notes, revision: r.revision, ...(values.correctionJournalId ? { correctionJournalId: values.correctionJournalId } : {}), confirm: true }, key); docContext = ''; d.close(); d.remove(); await ctx.refresh(); }));
        if(r.canAnnotate)
            d.append(note);
        if (r.type === 'Invoice' && !r.contractBound && can('collect') && Number(r.outstanding) > 0) {
            const receipt = document.createElement('button');
            receipt.className = 'primary-btn';
            receipt.textContent = t('تسجيل قبض لهذه الفاتورة', 'Record receipt for this invoice');
            receipt.onclick = async () => { d.close(); d.remove(); await LedgerUI.openCollection({ companyId: ctx.co, customerId: r.customerId, vehicleId: r.vehicleId, currency: r.currency, targetInvoiceId: r.id }); };
            d.append(receipt);
        }
        if (r.adjustments?.length) {
            const changes = document.createElement('section');
            changes.innerHTML = '<h3>' + e(t('سجل المعالجات المرتبطة', 'Linked adjustments')) + '</h3>' + RecordLayout.values(r.adjustments.map(a => [a.number + ' — ' + a.kind, a.amount + ' — ' + a.reason]));
            d.append(changes);
        }
        if (r.type === 'Invoice' && !r.contractBound && can('invoice_correct')) {
            for (const kind of ['Discount', 'Cancel', 'BadDebt']) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'secondary-btn';
                b.textContent = kind === 'Discount' ? t('خصم', 'Discount') : kind === 'Cancel' ? t('إلغاء فاتورة غير مستحقة', 'Cancel unearned invoice') : t('ديون معدومة', 'Bad debt');
                b.onclick = () => scopedForm(b.textContent, [f('amount', 'المبلغ', 'Amount', 'text', r.amount), f('reason', 'السبب الإلزامي', 'Required reason', 'textarea'), f('effectiveOn', 'تاريخ المعالجة', 'Effective date', 'date', date()), ...(kind === 'BadDebt' ? [f('writeOffAccountId', 'حساب مصروف الديون المعدومة المعتمد', 'Approved bad-debt expense account', 'text', '', accounts())] : [])], async (values, key) => safely(async () => { const data = { ...values, companyId: ctx.co, kind, items: [{ invoiceId: r.id, amount: values.amount }], confirm: true }; delete data.amount; const preview = await call('adjustments/preview', 'POST', data, key + '-preview'); if (!confirm(t('تأكيد الأثر المحاسبي دون تحصيل نقدي؟', 'Confirm the accounting effect without cash collection?') + '\n' + preview.rows.map(x => x.requestedAmount + ' ' + x.currency).join('\n')))
                    throw Error(t('لم يتم التأكيد', 'Not confirmed')); await call('adjustments/confirm', 'POST', { data, digest: preview.digest }, key); docContext = ''; d.close(); d.remove(); await ctx.refresh(); }));
                d.append(b);
            }
        }
    } }
    root.FinancialPackageUI = { names, body, bind, itemPanel, reset() { ++docRequest; ctx = null; docContext = ''; docResult = null; docLoading = false; } };
})(globalThis);
