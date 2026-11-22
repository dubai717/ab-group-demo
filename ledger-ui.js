/* Central financial UI. Drafts are memory-only; saving is acknowledged only by server commit. */
(function (root) {
    'use strict';
    let preferencesLoaded = false;
    let cap = null, book = null, co = '', tab = 'dashboard', actor = '', epoch = 0, busy = false, notice = '', customers = [], vehicles = [], docs = [], bills = [], report = null, preview = null, selected = '', drafts = {}, context = null, importJob = null, importInputRevision=0, reportInputRevision=0, closingInputRevision=0;
    const t = (a, b) => getLocale() === 'ar' ? a : b, e = x => WorkspaceUI.esc(x ?? ''), now = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date()), L = LedgerPolicy;
    const labels = { receivables:['مستحقات العملاء','Customer receivables'], dashboard: ['الرقابة المالية', 'Financial control'], invoices: ['الفواتير', 'Invoices'], collect: ['تنظيم تحصيل', 'Organize collection'], custody: ['العهد والتسليم', 'Custody & handover'], deposits: ['الإيداعات', 'Deposits'], vouchers: ['سندات الصرف المعلقة', 'Pending payment vouchers'], funds: ['الصناديق والنثريات', 'Funds & petty cash'], cards: ['بطاقات الائتمان', 'Credit cards'], journals: ['القيود', 'Journals'], reports: ['القوائم والتقارير', 'Statements & reports'], work: ['Work Amount', 'Work Amount'], intercompany: ['التحويلات بين الشركات', 'Intercompany transfers'], reconciliation: ['المطابقة البنكية والبطاقات', 'Bank/card reconciliation'], setup: ['دليل الحسابات والبنود', 'Accounts & financial items'], import: ['استيراد الفواتير', 'Invoice import'], closing: ['الإغلاق المالي', 'Financial closing'] };
    Object.assign(labels,FinancialPackageUI.names);
    const navigationTabs=Object.keys(labels);
    Object.assign(labels,{financierLabelAr:['جهة التمويل — من العقد الأصلي','Financier — original contract'],financierLabelEn:['جهة التمويل — من العقد الأصلي','Financier — original contract']});
    const words = {cost_centre_id:['مرجع مركز التكلفة','Cost centre reference'],cost_centre_name_ar:['مركز التكلفة بالعربية','Arabic cost centre'],cost_centre_name_en:['مركز التكلفة بالإنجليزية','English cost centre'],income:['الإيرادات','Income'],expense:['المصروفات','Expenses'],net:['الصافي','Net'],company_id:['الشركة','Company'], id: ['المرجع', 'Reference'], invoiceNumber: ['رقم الفاتورة', 'Invoice number'], receipt_number: ['رقم السند', 'Receipt number'], number: ['الرقم', 'Number'], amount: ['المبلغ', 'Amount'], paid: ['المحصل', 'Paid'], outstanding: ['المستحق', 'Outstanding'], status: ['الحالة', 'Status'], currency: ['العملة', 'Currency'], kind: ['النوع', 'Type'], name: ['الاسم', 'Name'], name_ar: ['الاسم العربي', 'Arabic name'], name_en: ['الاسم الإنجليزي', 'English name'], code: ['الرمز', 'Code'], balance: ['الرصيد', 'Balance'], refill: ['التغذية المطلوبة', 'Refill required'], actual: ['المستلم فعلياً', 'Actually received'], debit: ['مدين', 'Debit'], credit: ['دائن', 'Credit'], net: ['الصافي', 'Net'], company_id: ['الشركة', 'Company'], holder_id: ['الموظف', 'Employee'], dueOn: ['الاستحقاق', 'Due date'], last_four: ['آخر أربعة أرقام', 'Last four'], payment_state: ['حالة التحصيل', 'Collection state'], Active: ['نشط', 'Active'], Pending: ['معلق', 'Pending'], Approved: ['معتمد', 'Approved'], Paid: ['مسدد', 'Paid'], Review: ['للمراجعة', 'Review'], Cleared: ['محصل فعلياً', 'Cleared'], Returned: ['مرتجع', 'Returned'], Partial: ['مسدد جزئياً', 'Partial'], Unpaid: ['غير مسدد', 'Unpaid'], Posted: ['مرحل', 'Posted'], Draft: ['مسودة', 'Draft'], Cancelled: ['ملغى', 'Cancelled'], Corrected: ['مصحح', 'Corrected'] };
    Object.assign(words,{petty:['عهدة نثرية','Petty fund'],line_no:['السطر','Line'],effective_on:['التاريخ','Date'],matched_amount:['المطابق AED','Matched AED'],remaining_amount:['فرق المطابقة AED','Reconciliation difference AED']});
    Object.assign(words,{unpostedJournals:['قيود غير مرحلة','Unposted journals'],pendingVouchers:['سندات صرف معلقة','Pending payment vouchers'],pendingDeposits:['إيداعات تنتظر التحقق','Deposits awaiting verification'],openCustody:['عهد غير مسواة','Unsettled custody'],openCheques:['شيكات لم تُحسم','Unresolved cheques'],bankReconciliationRequired:['مطابقة بنكية مطلوبة','Bank reconciliation required'],pendingBankOperations:['عمليات بنكية مسودة','Draft bank operations'],missingCustomerInvoices:['مدفوعات عميل دون فاتورة مرتبطة','Customer outlays without linked invoices'],unsettledIntercompany:['تحويلات شركات غير مكتملة','Unsettled intercompany transfers'],unreconciledCards:['بطاقات غير مطابقة','Unreconciled cards'],unpostedInvoiceAdjustments:['تسويات فواتير دون قيد مطابق','Invoice adjustments without matching posting'],unclassifiedInvoices:['فواتير غير مصنفة','Unclassified invoices'],companyName:['الشركة','Company'],accountNumber:['رقم الحساب','Account number'],accountName:['اسم الحساب','Account name'],accountType:['نوع الحساب','Account type'],reciprocalStatus:['حالة الحساب المتبادل','Reciprocal account treatment']});
    const label = k => labels[k] ? t(...labels[k]) : words[k] ? t(...words[k]) : k;
    Object.assign(words, { cash: ['نقد', 'Cash'], cheque: ['شيك', 'Cheque'], transfer: ['تحويل بنكي', 'Bank transfer'], manual: ['يدوي', 'Manual'], automatic: ['تلقائي بالأولوية', 'Automatic by priority'], monthly: ['شهري', 'Monthly'], annual: ['سنوي', 'Annual'], none: ['بدون تكرار', 'No recurrence'], trial: ['ميزان المراجعة', 'Trial balance'], balance: ['الميزانية العمومية', 'Balance sheet'], profit: ['الربح والخسارة', 'Profit and loss'], cashflow: ['حركات نقدية مصنفة', 'Classified cash movements'], ledger: ['الأستاذ العام', 'General ledger'], journal: ['اليومية', 'Journal'], receivables: ['المستحقات وأعمار الديون', 'Receivables and ageing'], custody: ['العهد', 'Custody'], vouchers: ['سندات الصرف', 'Payment vouchers'], cards: ['البطاقات', 'Cards'], kpi: ['وقائع الأداء', 'Performance facts'], vat: ['تقرير ضريبة إداري', 'Tax management report'], asset: ['أصل', 'Asset'], liability: ['التزام', 'Liability'], equity: ['حقوق الملكية', 'Equity'], income: ['إيراد', 'Income'], expense: ['مصروف', 'Expense'] });
    Object.assign(words, { collections: ['التحصيل الفعلي', 'Actual collections'], deposits: ['الإيداعات', 'Deposits'], cheques: ['الشيكات', 'Cheques'], funds: ['الصناديق', 'Funds'], intercompany: ['الحسابات المتقابلة', 'Intercompany'], installments: ['التمويلات والأقساط', 'Financing & installments'], adjustments: ['الخصومات والشطب', 'Credits & write-offs'], 'cost-centres':['مراكز التكلفة','Cost centres'],profitability: ['ربحية البنود', 'Item profitability'] });
    const errors = {groupReciprocalReviewRequired:['الحسابات المتبادلة غير متوازنة؛ عالج المصادر الأصلية قبل إغلاق المجموعة. لم يُنشأ إغلاق جديد.','Reciprocal balances do not match. Review original sources before group closing; no new closing was created.'],legacyGroupClosingReviewRequired:['سجل الإغلاق السابق لا يتضمن فحص المصدر الجديد؛ يحتاج مراجعة مستقلة دون تعديله.','The prior closing lacks the new source review and needs separate review without rewriting history.'],companyNotClosed:['أغلق كل شركة بعد اجتياز قائمتها قبل إغلاق المجموعة.','Each company must pass its checklist and close before group closing.'],reportCompaniesRequired:['اختر شركة واحدة على الأقل لعرض التقرير.','Select at least one company for this report.'],originalCreditSourceReviewRequired:['يلزم مراجعة المستند الأصلي وروابطه وقيوده قبل تجهيز مصدر الإشعار الدائن.','Review the original document, links and journals before preparing its credit source.'],creditSourceNotCompanySale:['مصدر المعالجة لا يثبت بيعاً للشركة؛ لا يُعامل أصل التمويل أو الأمانة كإشعار ضريبي تلقائياً.','This source does not establish a company sale; financing principal or third-party funds are not automatically a tax credit.'],originalInvoiceCorrectionSourceReviewRequired:['الربط الحالي لا يطابق قيد الفاتورة الأصلي؛ راجع مصدر الضريبة والحسابات قبل التصحيح. لم يُسجل خصم جديد.','Current mapping does not match the original invoice journal; review recorded tax and accounts before correction. No new credit was posted.'],invoiceImportResultReviewRequired:['تعذر مطابقة نتيجة الاستيراد مع الفواتير الأصلية؛ راجع سجل العملية قبل أي محاولة إصدار جديدة.','The import result could not be matched to its original invoices; review the source record before issuing again.'],requestTimeout:['انتهت مهلة انتظار الرد؛ المدخلات محفوظة. أعد المعاينة من الملف نفسه للتحقق من حالته.','Response deadline reached; inputs remain. Preview the same file again to verify its state.'],requestUnavailable:['تعذر الاتصال بالخادم؛ الملف والمدخلات باقيان. أعد المعاينة عند عودة الاتصال.','The server could not be reached; file and inputs remain. Preview again when connectivity returns.'],importOutcomeUncertain:['تعذر تأكيد نتيجة الخادم. المدخلات باقية؛ أعد المحاولة من المعاينة نفسها لاستعادة النتيجة دون مطالبة ثانية.','Server outcome could not be confirmed. Inputs remain; retry this same preview to recover the result without a second charge.'],importInputsChanged:['تغير الملف أو خياراته أثناء المعاينة؛ بقيت المدخلات، أعد المعاينة قبل الاعتماد.','File or options changed during preview; inputs remain. Preview again before approval.'],vehicleChargeSourceReviewRequired:['راجع مسؤولية العميل والشركة والمصدر الأصلي قبل الاعتماد؛ لم تُسجل فاتورة.', 'Review customer/company responsibility and original source before approval; no invoice was posted.'],vehicleChargeVehicleRequired:['المخالفة المستوردة تحتاج رقم المركبة الأصلية الصحيح والعميل المسؤول عنها.', 'An imported traffic fine requires the correct original vehicle and responsible customer.'],vehicleChargeDateRequired:['أدخل تاريخ المخالفة الأصلي الصحيح، وليس تاريخاً مستقبلياً أو تاريخ الاستحقاق، بعملة AED.', 'Provide the valid original violation date, not a future date or the due date, in AED.'],vehicleChargeResponsibilityReviewRequired:['تاريخ التسجيل أو نهاية العلاقة غير مكتمل؛ لا يمكن إسناد المخالفة تلقائياً.', 'Registration/relationship dates are incomplete; the fine cannot be attributed automatically.'],vehicleChargeBoundaryReviewRequired:['المخالفة في يوم انتقال أو انتهاء العلاقة أو بعده؛ يلزم تحديد المسؤولية قبل الفوترة.', 'The violation is on or after a transfer/end boundary; responsibility needs review before billing.'],vehicleChargeReferenceConflict:['مرجع المخالفة مستخدم ببيانات مختلفة؛ صحح المصدر دون إنشاء مطالبة ثانية.', 'The violation reference has conflicting data; correct the source without creating a second charge.'],legacyVehicleChargeSourceReviewRequired:['السجل السابق لا يملك مطابقة مؤرخة موثقة؛ يلزم مراجعته دون إعادة كتابته أو إصدار فاتورة ثانية.', 'The prior record lacks a verified dated source; review it without rewriting it or issuing another invoice.'],vehicleChargeMappingReviewRequired:['يلزم بند مخالفة معتمد وحساب أمانة مستقل؛ لا تُسجل مبالغ الغير كإيراد أو ضريبة تلقائية.', 'A reviewed fine item and separate third-party liability are required; do not record third-party money as automatic revenue or tax.'],vehicleChargePreviewErrors:['توجد أخطاء في ملف المخالفات؛ صححها وأعد المعاينة قبل اعتماد الملف.', 'The traffic-fine file has errors; correct and preview it again before approval.'],legacyRecurringCompanyReviewRequired:['هذه علاقة سابقة بين شركتين لم تكن تُفوتر؛ يلزم اعتماد معالجة مستقبلية محددة دون تعديل تاريخها.','This legacy cross-company relation was not invoiced; a specifically reviewed future treatment is required without changing its history.'],financialSourceReviewRequired:['مرجع السجل المالي لا يطابق نطاق الشركة أو يحتاج مراجعة؛ لم تتغير البيانات.','The financial source reference does not match company scope or needs review; data remains unchanged.'],staleSession:["تغير المستخدم أو نطاق الشركة؛ أعد فتح التقرير.","User or company scope changed. Reopen the report."],cashFundAccountRequired:["اختر حساب أصل نقدي مستقلاً؛ حساب البنك أو الذمم أو العهد الرقابية لا يصلح لهذا الصندوق.","Choose a dedicated cash asset account. Bank, receivable and custody control accounts cannot be used for this fund."],receivableCashRoleConflict:["حساب مستحقات العميل يجب أن يكون مستقلاً عن البنك والصناديق وحسابات الضبط؛ راجع الربط المحاسبي للبند.","Customer receivables must be separate from banks, funds and control accounts. Review the item accounting mapping."],fundAccountHistoryReviewRequired:["الحساب يحتوي حركات سابقة؛ يلزم مراجعة رصيده قبل إسناده إلى صندوق جديد. لم تتغير الحركات أو العهد.","This account has prior entries. Review its balance before assigning a new fund. Entries and custody remain unchanged."],fundAccountRoleReviewRequired:["تعذر التحقق الكامل من استخدام الحساب؛ يلزم مراجعة دليل البنود قبل إنشاء الصندوق.","Account use could not be fully verified. Review the financial item guide before creating the fund."],commitmentVoucherMismatch:['سند الصرف لا يطابق الالتزام المعتمد؛ يلزم التصحيح قبل الاعتماد أو الدفع.','The payment voucher does not match its approved commitment; correct it before approval or payment.'],invalidCostCentre:['اختر مركز تكلفة نشطاً تابعاً للشركة.','Choose an active cost centre for this company.'],amountMismatch:['مجموع المبالغ المختارة لا يطابق الإجمالي؛ راجع مبلغ كل سند والمبلغ المطلوب.','Selected receipt amounts do not match the total. Check each amount and the requested total.'],receiptMismatchReviewRequired:['توجد فروق في قراءة الإيصال؛ صحح بيانات الإيداع أو اطلب معالجة رقابية موثقة وفق كشف البنك.','Receipt facts differ. Correct the deposit or request a documented authorized resolution against the bank record.'],duplicateDepositEvidence:['صورة الإيصال مرتبطة بإيداع آخر؛ لم تُنشأ حركة أو عهدة جديدة.','This receipt image belongs to another deposit; no new movement or custody was created.'], ledgerSchemaPending: ['الترحيل المالي 012 لم يُعتمد أو يُطبّق بعد. تبقى الوحدات السابقة متاحة.', 'Financial migration 012 has not been approved/applied. Previous modules remain available.'], accountMappingRequired: ['أكمل ربط الحسابات المحاسبية لهذا البند والشركة والعملة.', 'Complete account mappings for this item, company and currency.'], priorityOverrideRequired: ['يوجد بند أعلى أولوية؛ استخدم التوزيع التلقائي أو تفويض تجاوز الأولوية مع السبب.', 'A higher priority item is due. Use automatic allocation or delegated override with a reason.'], documentQuarantined: ['المستند محجور حتى فحصه فعلياً.', 'Evidence is quarantined until actually scanned.'], periodClosed: ['الفترة المالية مغلقة؛ استخدم فترة مفتوحة.', 'Financial period is closed; use an open period.'], closingChecklistIncomplete: ['توجد التزامات أو مطابقات معلقة؛ راجع قائمة الإغلاق.', 'Outstanding obligations or reconciliations prevent closing.'], denied: ['الإجراء خارج نطاق التفويض.', 'Action is outside delegated scope.'], duplicate: ['المستند أو المرجع موجود؛ لم ينشأ تكرار.', 'Document/reference already exists; no duplicate created.'], insufficientCustody: ['الرصيد المتاح في العهدة غير كافٍ.', 'Available custody is insufficient.'], unresolvedDifference: ['توجد فروقات تحتاج مراجعة فعلية.', 'Unresolved differences require actual review.'] };
    Object.assign(words,{ownership:['ملكية البطاقة','Card ownership'],companyName:['الشركة','Company'],cardAttributedPayments:['مدفوعات البطاقة المعتمدة','Verified card payments'],personalExcluded:['شخصي مستبعد','Personal excluded'],ownerPayableBalance:['رصيد مستحق للمالك','Owner payable balance'],company:['بطاقة شركة','Company card'],personal_owner:['بطاقة المالك الشخصية','Owner personal card']});
    Object.assign(errors,{issuerPaymentReviewRequired:['راجع إثبات سداد البنك المصدر بعد اختيار السطر والمرجع.','Review the verified issuer payment after choosing the line and reference.'],issuerPaymentSchemaReviewRequired:['ربط سداد البنك المصدر ينتظر اعتماد امتداد المخطط؛ لا تستخدم سند تسوية المالك بدلاً منه.','Issuer payment matching awaits reviewed schema activation. Do not substitute an Owner reimbursement.'],issuerPaymentAlreadyReconciled:['هذا الدفع مطابق بالفعل؛ لا يمكن استخدامه لسطر آخر.','This issuer payment is already matched and cannot be used on another line.'],ownerCardPaymentProofRequired:['تسوية الشركة للمالك ليست سداداً للبنك المصدر؛ يلزم إثبات سداد البطاقة ومطابقته.','A company reimbursement is not payment to the issuer. Verified card-payment evidence must be reconciled.'],pettyExpenseReviewRequired:['أرسل المستند للمراجعة المستقلة واختر الاعتماد المطابق قبل الصرف.','Request independent review and select its matching approval before spending.'],pettyExpenseReviewMismatch:['بيانات المصروف لا تطابق الاعتماد؛ احتفظنا بالمدخلات.','Expense data differs from its approval; inputs are retained.'],pettyExpenseReviewerRequired:['يلزم مراجع مستقل نشط ومخول.','An active authorized independent reviewer is required.'],ownerSignatureRequired:['يلزم طلب تسوية معتمد وموقع من صاحب البطاقة.','An approved settlement signed by the card Owner is required.'],ownerChequeDepositVerificationRequired:['يلزم تأكيد استلام الشيك والتحقق المستقل من إيداعه قبل التسوية البنكية.','Confirm cheque receipt and independently verify its deposit before bank settlement.'],ownerSettlementWorkflowRequired:['استخدم طلب تسوية المالك وتوقيعه وسند الصرف المرتبط به.','Use the signed Owner settlement and its linked payment voucher.'],ownerChequeReturnReviewRequired:['الشيك في عهدة موظف أو موقوف؛ يلزم إجراء مراجعة أو إرجاع موثق.','The cheque is held or stopped; a documented review or return is required.'],ownerPayableBalanceReviewRequired:['الرصيد الفعلي للمالك لا يغطي السند؛ راجع المدفوعات والتسويات قبل إعادة المحاولة.','The actual Owner payable does not cover this voucher; review payments and settlements.'],personalCardReviewRequired:['يلزم مستند مفحوص وتأكيد الدفع الفعلي وأساس مراجعة الضريبة.','Provide clean evidence, actual-payment verification and a tax review basis.'],dedicatedOwnerPayableRequired:['اختر حساب التزام مستقلاً لمستحقات المالك، غير مستخدم للدائنين أو البطاقة التجارية.','Choose a dedicated owner-payable account, separate from trade creditors or company cards.'],personalCardOwnerReviewRequired:['تفاصيل البطاقة الشخصية ومراجعتها متاحة للمالك في هذه المرحلة.','Personal card details and review are restricted to the Owner at this stage.'],personalCardSettlementWorkflowRequired:['تسوية المالك تتطلب مسار الطلب والتوقيع والعهدة المستقل؛ لا يصدر سند للبنك المصدر من هذا الإجراء.','Owner reimbursement requires its separate request, signature and custody workflow; this action does not pay the card issuer.'],walletAssetRequired:['يلزم أصل محفظة مستقل ومعتمد، بعيداً عن النقد وذمم العملاء والموظفين.','Use a reviewed dedicated wallet asset, separate from cash and customer/staff receivables.'],personalCardCustomerInvoiceRequired:['اختر الفاتورة الأصلية المطابقة للعميل والمركبة والمبلغ. الحالات غير المفوترة تحتاج مراجعة مستقلة.','Select the original matching customer/vehicle invoice and amount. Unbilled cases need separate review.'],pettyReceiptAlreadyUsed:['استخدم هذا المستند في مصروف سابق؛ راجع السند الأصلي ولا تصرفه مجدداً.','This evidence was used for an earlier expense; review the original voucher.'],
      salikMonthlyImportRequired:['استخدم تجميع سالك الشهري مع تاريخ ومرجع كل عملية.','Use monthly Salik grouping with each transaction date and reference.'],
      salikPassThroughMappingReviewRequired:['يلزم اعتماد ربط سالك بحساب مبالغ مستحقة للغير ومعالجة ضريبية مناسبة؛ لم تصدر فاتورة.','Review the toll payable mapping and tax treatment before issuing an invoice.'],
      salikResponsibilityBoundaryReviewRequired:['تاريخ العملية في يوم انتهاء العلاقة أو بعده؛ يلزم التحقق من مسؤولية العميل عند الانتقال قبل الفوترة.','The transaction is on or after the relationship end day; verify responsibility at the transition before invoicing.'],
      salikResponsibilityReviewRequired:['تعذر إثبات مسؤولية العميل والشركة في تاريخ العملية؛ راجع العلاقة الأصلية.','Customer/company responsibility at the transaction date requires review.'],
      salikMonthlyAlreadyIssued:['صدرت فاتورة لهذا الشهر والمركبة. العمليات الإضافية تحتاج إجراء تصحيح معتمداً.','An invoice already exists for this vehicle/month. Additional transactions require approved correction.'],
      salikTransactionConflict:['مرجع عملية سالك موجود ببيانات مختلفة؛ راجعه قبل الاعتماد.','This toll reference exists with different details; review before committing.'],
      salikPreviewErrors:['توجد أخطاء في المعاينة؛ صححها وأعد المعاينة دون فقدان الملف الأصلي.','Preview contains errors; correct and preview again. The original file is retained.'],
      salikMonthlyTermsDiffer:['تختلف البنود أو تواريخ الاستحقاق لعمليات الشهر نفسه؛ يلزم اعتمادها قبل التجميع.','Monthly transactions have different items or due dates; review before grouping.'],
      salikResponsibilitySplitReviewRequired:['تتغير مسؤولية المركبة خلال الشهر؛ يلزم تحديد المعالجة المعتمدة.','Vehicle responsibility changes within the month; an approved treatment is required.']
    });
    Object.assign(errors,{discountOwnerReviewRequired:['الخصم يتجاوز صلاحية الموظف وفق سياسة مستقبلية معتمدة؛ يلزم قرار المالك على الفاتورة الأصلية.','The discount exceeds staff authority under an approved future policy; Owner review on the original invoice is required.'],discountPolicyReviewRequired:['نسخة سياسة الخصم أو اعتمادها تحتاج مراجعة؛ لم يسجل خصم.','The discount policy version or approval needs review; no discount was recorded.'],discountCurrencyPolicyReviewRequired:['العملة تحتاج مراجعة سياسة الخصم المعتمدة؛ لم يسجل خصم.','The currency needs approved discount policy review; no discount was recorded.']});
    Object.assign(errors,{insufficientWalletAssetBalance:['رصيد أصل المحفظة أو المبلغ غير المفوتر غير كافٍ؛ لم تحفظ العملية.','The prepaid or unbilled asset balance is insufficient; nothing was posted.'],walletInvoiceSourceMismatch:['بيانات الاستهلاك لا تطابق عملية سالك الأصلية؛ لم تصدر الفاتورة.','Consumption differs from the original toll source; no invoice was issued.'],walletSourceConflict:['مرجع الاستهلاك موجود ببيانات مختلفة؛ راجعه دون إنشاء نسخة أخرى.','The consumption reference exists with different data; review without duplicating.'],prospectiveWalletConfigurationRequired:['يلزم ربط مستقبلي وحسابان منفصلان دون تعديل التاريخ.','Use prospective configuration and distinct accounts without historical changes.'],walletConsumptionDateRequired:['تاريخ الاستهلاك يجب أن يقع بعد سريان الربط وألا يكون مستقبلياً.','Consumption must be on/after configuration and not in the future.'],reservedPrepaidAsset:['هذا الحساب مخصص لأصل المحفظة أو المبالغ غير المفوترة؛ اختر حساباً مستقلاً.','This account is reserved for prepaid or unbilled assets; use a separate account.']});
    Object.assign(errors,{fundRecipientConfirmationRequired:['هذه العهدة تتطلب تأكيد الموظف؛ استخدم إجراء تسليم العهدة بدلاً من التغذية المباشرة.','This fund requires its holder’s receipt. Use the employee handover instead of direct refill.']});
    Object.assign(labels,{company_name_ar:['الشركة','Company'],company_name_en:['الشركة','Company'],holder_name_ar:['الموظف المسؤول','Responsible employee'],holder_name_en:['الموظف المسؤول','Responsible employee']});
    Object.assign(labels,{journal_reference:['رقم القيد','Journal number'],journal_number:['رقم القيد','Journal number'],operation_reference:['مرجع العملية البنكية','Bank operation reference'],date:['التاريخ','Date']});
    const message = x => errors[x] ? t(...errors[x]) : t('تعذر الحفظ. راجع البيانات والصلاحيات؛ بقيت المدخلات في النموذج.', 'Save failed. Check fields and permissions; input remains in this form.') + ' (' + x + ')';
    const api = async (path, method = 'GET', data, key, options) => {
        const n=epoch,who=ABCentral.actor?.id,scope=co,valid=()=>n===epoch&&who===ABCentral.actor?.id&&scope===co;try{const r=await ABCentral.api('ledger/'+path,method,data,key,options);if(!valid())throw Error('staleSession');return r;}catch(err){if(!valid())throw Error('staleSession');throw err;}
    };
    Object.assign(words,{source_reference:['المرجع الأصلي','Original reference'],occurred_on:['تاريخ الواقعة','Transaction date'],customer_number:['رقم العميل الأصلي','Original customer number'],vehicle_number:['رقم المركبة الأصلي','Original vehicle number']});
    Object.assign(labels,{source_name:['البطاقة أو الحساب','Card or account'],opening_balance:['الرصيد الافتتاحي','Opening balance'],closing_balance:['الرصيد الختامي','Closing balance'],splitNumber:['الجزء','Split'],customerName:['العميل','Customer'],companyName:['الشركة','Company'],vehicleNumber:['رقم المركبة','Vehicle file'],invoiceNumber:['رقم الفاتورة','Invoice number'],billingState:['حالة الفوترة','Billing state'],unbilledAmount:['المبلغ غير المفوتر AED','Unbilled amount AED']});
    Object.assign(errors,{reservedOwnerDisbursementAsset:['هذا الحساب مخصص لمدفوعات العملاء قبل الفوترة؛ لا تخلطه بالمبيعات أو النقد.','This account is reserved for unbilled customer outlays; keep it separate from sales and cash.'],prospectiveOwnerDisbursementConfigurationRequired:['راجع الربط المستقبلي للبند والشركة وبطاقة المالك قبل تسجيل الدفع.','Review the prospective item/company/Owner-card mapping before recording payment.'],newOwnerDisbursementAssetRequired:['اختر حساب أصل مستقل جديداً دون أرصدة تاريخية أو ربط بعهد أو مستحقات عملاء.','Choose a new dedicated asset without historical balances, custody or customer AR mappings.'],ownerDisbursementItemReviewRequired:['يلزم مراجعة بند الاسترداد وربطه المحاسبي وضريبته قبل المتابعة.','Review the recovery item, accounting mapping and tax classification before proceeding.'],ownerDisbursementExpenseReviewRequired:['حدد حساب مصروف معتمداً للخصم من مستحق دفعه المالك فعلياً.','Select the reviewed expense for discounts on an actual Owner-fronted recovery.'],ownerDisbursementMappingChanged:['تغير الربط المحاسبي؛ يلزم مراجعة المصدر قبل المتابعة.','The accounting mapping changed; review the source before proceeding.'],ownerDisbursementConfigurationImmutable:['الربط المعتمد محفوظ؛ لا يمكن تغييره بصمت أو تطبيقه بأثر رجعي.','The reviewed mapping is preserved and cannot be silently changed or backdated.'],ownerDisbursementCancellationReviewRequired:['هذه الفاتورة مرتبطة بمبلغ دُفع فعلياً نيابة عن العميل؛ يلزم اعتماد طريقة استرداده أو تصحيحه قبل الإلغاء.','This invoice is linked to an actual customer outlay; review recovery/correction before cancellation.'],ownerDisbursementInvoiceMismatch:['الفاتورة لا تطابق الشركة والعميل والمركبة والبند والمبلغ الأصلي.','The invoice does not match the original company, customer, vehicle, item and amount.']});
    Object.assign(errors,{writeoffRecoveryAccountingReviewRequired:['للفاتورة شطب محاسبي مسجل؛ يلزم إجراء استرداد أو تصحيح معتمد قبل خصم جديد. لم تتغير الأرصدة.','This invoice has a recorded book writeoff; use a reviewed recovery/correction before another discount. Balances remain unchanged.']});
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
    const registerScope=()=>`ledger:${tab}:${co}${tab==='collect'?':'+getLocale():''}${tab==='reports'?':'+JSON.stringify([drafts.report?.kind||'trial',drafts.report?.from||'',drafts.report?.to||'',drafts.report?.companies||'',drafts.report?.currency||'',drafts.report?.groupBy||'day',Boolean(drafts.report?.consolidated),getLocale()]):''}`;
    function table(rows,columns,actions){const source=Object.keys(book||{}).find(k=>book[k]===rows&&Array.isArray(book[k]))||(rows===bills?'invoices':null),key=rows===report?.rows?'report':undefined;return FinancialTables.table(registerScope(),[...columns.map(label),...(actions?[t('الإجراء','Action')]:[])],rows.map(r=>[...columns.map(k=>e(rows===report?.rows?reportOutputCell(r,k,report.companies):k==='holder_id'?book.users.find(u=>u.id===r[k])?.name||r[k]:['status','kind','payment_state','ownership'].includes(k)?label(r[k]):r[k])),...(actions?[actions(r)]:[])]),{title:label(tab),key,ignoreSearch:!source&&key!=='report',columns:[...columns,...(actions?[null]:[])],rawRows:rows,source,endpoint:'ledger/register-view',companyId:co,canExport:allowed('report')&&allowed('export'),canPrint:allowed('report')&&allowed('export'),display:(k,v)=>key==='report'?reportOutputCell({[k]:v},k,report?.companies||[]):k==='holder_id'?book.users.find(u=>u.id===v)?.name||v:['status','kind','payment_state','ownership'].includes(k)?label(v):v});}
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
        customers = results[0].status === 'fulfilled' ? (results[0].value.rows||[]).map(r=>({...r,name:r.fullName||r.name||''})) : [];
        vehicles = results[1].status === 'fulfilled' ? (results[1].value.rows || []).map(r => ({ ...r, name: '#' + r.fileNumber + ' ' + (r.plate || '') })) : [];
        docs = results[2].status === 'fulfilled' ? results[2].value.map(r => ({ id: r.versionId, name: r.title + ' v' + r.version + ' — ' + r.scanStatus })) : [];
    }
    async function load(preserveTab=false) {
        if (busy)
            return;
        busy = true;
        const host=document.querySelector('.ld-section');if(host){host.inert=true;host.setAttribute('aria-busy','true');}
        book=null;
        const n = epoch;
        try {
            cap = await api('capabilities');
            if (cap.available && !preferencesLoaded) {
                const p = await api('preferences');
                preferencesLoaded = true;
                if (!context && preserveTab!==true && cap.companies.some(c => c.id === p.companyId)) {
                    co = p.companyId;
                    if (labels[p.tab])
                        tab = p.tab;
                }
            }
            if (!co || !cap.companies.some(c => c.id === co))
                co = cap.companies[0]?.id || '';
            if (cap.available && co) {
                const nextBook = await api('workbench?companyId=' + co);nextBook.custodyDetails=await api('custody/details?companyId='+co);nextBook.package=await api('package/state?companyId='+co);
                await references();
                if (context || tab === 'invoices')
                    bills = (await api('invoices?' + new URLSearchParams({ companyId: co, ...(context?.customerId ? { customerId: context.customerId } : {}), ...(context?.vehicleId ? { vehicleId: context.vehicleId } : {}) }))).rows;
                if (tab === 'collect')
                    bills = context ? bills.filter(r => r.customer_id === context.customerId && r.vehicle_id === (context.vehicleId || null) && (!context.targetInvoiceId || r.id===context.targetInvoiceId)) : [];
                book=nextBook;
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
    function reset() { closingInputRevision++;reportInputRevision++;importInputRevision++;ReceivablesUI.reset();FinancialPackageUI.reset();epoch++; preferencesLoaded = false; cap = book = null; co = ''; actor = ''; busy = false; customers = []; vehicles = []; docs = []; bills = []; report = preview = importJob = context = null; drafts = {}; notice = ''; tab = 'dashboard'; }
    const packageContext=()=>({co,book,api,refresh,customers,vehicles,docs,scope:registerScope(),company:cap?.companies?.find(r=>r.id===co)});
    function importPreviewResults(){if(!importJob)return '';const fine=importJob.vehicleChargeSourceVersion===1,blocked=fine&&importJob.rows.some(r=>r.error&&r.error!=='duplicate'),rows=importJob.rows.map(r=>({line:r.line,status:r.error?(r.error==='duplicate'?t('مكرر — لن ينشأ مجدداً','Duplicate — will not be reissued'):message(r.error)):t('جاهز','Ready'),amount:r.data?.amount,source_reference:r.data?.sourceKey||r.original?.sourceKey||'',occurred_on:r.vehicleCharge?.occurredOn||r.original?.occurredOn||'',customer_number:r.sourceLabels?.customerNumber||'',vehicle_number:r.sourceLabels?.vehicleNumber||''}));return '<section data-invoice-import-review>'+(importJob.mode==='monthly_salik_v1'?'<p>'+t('سالك شهري:','Monthly Salik:')+' '+e(importJob.groups?.length||0)+' '+t('فاتورة مقترحة.','proposed invoices.')+' '+(importJob.groupError?e(message(importJob.groupError)):'')+'</p>':'')+(fine?'<p class="notice">'+t('مطابقة تاريخ الواقعة بالمركبة والعميل والشركة الأصليين؛ لا إنشاء فاتورة من حدود غير محسومة.','Original transaction date is matched to the original vehicle, customer and company; uncertain boundaries cannot issue an invoice.')+'</p>':'')+table(rows,['line','status','amount',...(fine?['source_reference','occurred_on','customer_number','vehicle_number']:[])])+(importJob.status==='Completed'?'<p class="notice">'+t('سبق اعتماد هذا الملف؛ استُعيدت نتيجته دون إنشاء فواتير جديدة.','This file was previously committed; its result was recovered without new invoices.')+'</p>':blocked?'<p role="alert">'+e(message('vehicleChargePreviewErrors'))+'</p>':!allowed('invoice_create')?'<p class="notice">'+t('المعاينة متاحة؛ اعتماد إصدار الفواتير يتطلب موظفاً مخولاً.','Preview is available; invoice issuance requires an authorized employee.')+'</p>':btn('import-commit',t('اعتماد السجلات الصحيحة','Commit valid rows')))+'</section>';}

    function body() {
        const packageBody=FinancialPackageUI.body(tab,packageContext());if(packageBody!==null)return packageBody;
        const items = book.finance_items, accounts = accountOptions();
        if (tab === 'dashboard')
            return `<p>${t('الأرصدة من قيود فعلية؛ العملات والشركات منفصلة. الشيك المعلق لا يسدد فاتورة. قراءة الإيصالات محلية وللمراجعة فقط؛ الربط المصرفي وWhatsApp غير مفعّلين.', 'Balances come from actual entries; companies/currencies stay separate. Pending cheques do not pay invoices. Receipt extraction is local and review-only; bank feeds and WhatsApp are inactive.')}</p><div class="ve-summary">${[['collect', t('سندات القبض', 'Receipts'), book.receipts.length], ['custody', t('العهد المفتوحة', 'Open custody'), book.custody.length], ['vouchers', t('صرف معلق', 'Pending vouchers'), book.finance_vouchers.filter(v => v.status === 'Pending').length], ['deposits', t('إيداعات للمراجعة', 'Deposits in review'), book.finance_deposits.filter(v => v.status === 'Review').length], ['cards', t('البطاقات', 'Cards'), book.finance_cards.length]].map(([v, title, n]) => '<article>' + btn(['vouchers','deposits'].includes(v)?'dashboard-source':'tab', title + ' — ' + n, v) + '</article>').join('')}</div>${btn('run-recurring', t('إصدار البنود الدورية المعرفة', 'Issue configured recurring items'))}${btn('reminders', t('فحص مواعيد الإيداع والبطاقات', 'Check deposit/card deadlines'))}<p>${t('التنبيهات المجدولة تحتاج تفعيل عامل التشغيل؛ هذا الزر ينفذ الفحص الفعلي الآن.', 'Scheduled reminders require an enabled worker; this button performs an actual check now.')}</p>`;
        if (tab === 'invoices')
            return form('invoice', t('فاتورة مستقلة لكل بند', 'Separate invoice per item'), [...refFields(), ...itemFields(), f('amount', 'المبلغ', 'Amount'), f('currency', 'العملة', 'Currency', 'text', 'AED'), ...dateFields(), f('sourceKey', 'مرجع مصدر فريد', 'Unique source reference'), f('description', 'الوصف', 'Description', 'textarea', '', null, false)], undefined, 'invoice_create') + table(bills, ['invoiceNumber', 'name_en', 'dueOn', 'amount', 'paid', 'outstanding', 'status'], r => (r.financial_source?.startsWith('salik-monthly-v1:')?btn('salik-details',t('تفاصيل عمليات سالك','Toll transaction details'),r.id):'')+(book.finance_items.find(it=>it.id===r.item_id)?.category==='fine'?btn('vehicle-charge-source',t('مراجعة مصدر المخالفة','Review violation source'),r.id):'')+btn('invoice-correct', t('تصحيح دون حذف', 'Correct without deleting'), r.id)) + form('adopt', t('تصنيف فاتورة مركبة قائمة في الدفتر (غير مسددة وغير معدلة)', 'Classify existing vehicle invoice (unpaid/unadjusted)'), [f('invoiceId', 'مرجع الفاتورة القائمة', 'Existing invoice reference'), ...itemFields(), f('issuedOn', 'تاريخ التصنيف المحاسبي', 'Accounting classification date', 'date', now()), f('confirmHistoricalClassification', 'تأكيد مراجعة التصنيف', 'Confirm classification review', 'checkbox', false)], undefined, 'journal_approve');
        if(tab==='receivables')return ReceivablesUI.body();
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
            return btn('credit-apply', t('تطبيق رصيد دائن سابق', 'Apply existing credit')) + form('collection-filter', t('عرض المستحقات', 'Load dues'), [...refFields(), f('currency', 'العملة', 'Currency', 'text', context?.currency||'AED')], t('عرض', 'Show')) + form('collect', t('تحديد البنود وطريقة واحدة للعملية', 'Select items and one payment method'), [...refFields(), f('currency', 'العملة', 'Currency', 'text', context?.currency||'AED'), f('receivedOn', 'تاريخ القبض', 'Receipt date', 'date', now()), f('method', 'وسيلة الدفع', 'Payment method', 'select', 'cash', choice(['cash', 'cheque', 'transfer'])), f('mode', 'التوزيع', 'Allocation', 'select', 'manual', choice(context?.targetInvoiceId?['manual']:['manual', 'automatic'])), f('amount', 'إجمالي العملية', 'Batch total'), f('operationId', 'التحويل المصرفي المعتمد (للتحويل فقط)', 'Approved bank receipt (transfer only)', 'text', '', null, false), f('overridePriority', 'تجاوز الأولوية بتفويض', 'Delegated priority override', 'checkbox', false), f('reason', 'سبب التجاوز', 'Override reason', 'text', '', null, false), f('chequeNumber', 'رقم الشيك (للشيك فقط)', 'Cheque number (cheque only)', 'text', '', null, false), f('bankAccountId', 'حساب إيداع الشيك', 'Cheque deposit account', 'select', '', book.banks, false), f('beneficiary', 'اسم مقدم الشيك', 'Cheque payer', 'text', '', null, false), ...dateFields()], t('تنظيم سند مستقل لكل بند', 'Create separate receipt per item'), 'collect', `<div class="full">${rows.map(r => `<label class="ld-item"><input type="checkbox" name="selectedItem" value="${e(r.id)}"/>${e(r.name)} — ${L.money(r.amount)}<input class="input" name="take-${e(r.id)}" value="${L.money(r.amount)}" aria-label="${t('المبلغ المطلوب', 'Requested amount')}" /></label>`).join('') || '<p>' + t('لا توجد فواتير مصنفة. صنّف فواتير المركبة أولاً؛ لا تُنشأ مستحقات افتراضية.', 'No classified invoices. Classify vehicle invoices first; no fabricated dues.') + '</p>'}${book.package?.approved.priority?`<fieldset><legend>${t('تخصيص صريح لكل فاتورة','Explicit invoice allocation')}</legend><label><input type="checkbox" name="useInvoiceAllocations">${t('استخدام مبالغ الفواتير المحددة أدناه','Use selected invoice amounts below')}</label>${bills.filter(r=>L.units(r.outstanding)>0n).map(r=>`<label><input type="checkbox" name="selectedInvoice" value="${e(r.id)}">#${e(r.invoiceNumber)} — ${e(r.name_en)}<input class="input" name="invoice-take-${e(r.id)}" value="${e(r.outstanding)}" aria-label="${t('مبلغ الفاتورة','Invoice amount')}"></label>`).join('')}</fieldset>`:''}</div>`) + table(book.receipts, ['receipt_number', getLocale()==='ar'?'financierLabelAr':'financierLabelEn', 'kind', 'amount', 'currency', 'payment_state'], r => r.payment_state === 'Pending' ? btn('cheque-resolve', t('تأكيد التحصيل / الارتجاع', 'Confirm clearing / return'), r.id) : '');
        }
        if (tab === 'custody')
            return table(book.custody, ['holder_id', 'kind', 'amount', 'currency']) + form('route', t('مسار التسليم والبديل المؤقت', 'Handover route / temporary substitute'), [f('senderId', 'المسلّم', 'Sender', 'select', '', users()), f('receiverId', 'المستلم', 'Receiver', 'select', '', users()), f('effectiveOn', 'سريان المسار', 'Effective date', 'date', now()), f('untilOn', 'انتهاء البديل (اختياري)', 'Substitute end (optional)', 'date', '', null, false)], undefined, 'configure') + form('handover', t('طلب تسليم من عهدتي', 'Request handover from my custody'), [f('receiverId', 'المستلم المخول', 'Authorized recipient', 'select', '', (book.custodyRecipients||[]).map(u=>({id:u.id,name:getLocale()==='ar'?u.nameAr:u.nameEn}))), f('kind', 'وسيلة العهدة', 'Custody method', 'select', 'cash', choice(['cash', 'cheque'])), f('amount', 'المبلغ', 'Amount'), f('currency', 'العملة', 'Currency', 'text', 'AED')], undefined, 'hand_over', `<fieldset class="full"><legend>${t('سندات من عهدتي — اختياري، وإلا يطبق الترتيب الأصلي','Receipts in my custody — optional, otherwise original order applies')}</legend>${(book.custodyDetails?.receipts||[]).map(r=>`<label class="rb-invoice"><input type="checkbox" name="handoverReceipt" value="${e(r.receiptId)}">${e(label(r.kind))} · RV-${e(r.receiptNumber)} · ${e(r.amount)} ${e(r.currency)}<input class="input" name="handover-amount-${e(r.receiptId)}" value="${e(r.amount)}" aria-label="${t('مبلغ التسليم','Handover amount')}"></label>`).join('')}</fieldset>`) + table(book.finance_custody_transfers, ['id', 'amount', 'actual', 'currency', 'status'], r => r.status === 'Pending' ? btn('receive', t('تأكيد المستلم الفعلي', 'Acknowledge actual receipt'), r.id) : '');
        if (tab === 'deposits')
            return form('deposit', t('إيداع جزئي أو كامل — لا يغلق العهدة قبل التأكيد', 'Partial/full deposit — custody stays open until confirmed'), [f('bankAccountId', 'الحساب النشط', 'Active account', 'select', '', book.banks.filter(b => b.status === 'Active')), ...amounts(), proofField(), f('reference', 'مرجع الإيداع', 'Deposit reference')], undefined, 'deposit',`<div class="full">${btn('deposit-review',t('قراءة بيانات الإيصال ومراجعتها','Read and review receipt data'))}<p data-deposit-review role="status"></p><small>${t('الصورة أو قراءة PDF ليست إثبات وصول للبنك؛ يلزم التحقق المالي المعتمد.','Image/PDF extraction does not prove bank receipt; authorized financial verification is required.')}</small></div>`) + form('document', t('رفع مستند مالي إلى الأرشيف الخاص', 'Upload financial evidence to private archive'), [f('title', 'عنوان المستند', 'Document title'), f('date', 'تاريخ المستند', 'Document date', 'date', now()), f('file', 'PDF أو صورة', 'PDF or image', 'file')]) + table(book.finance_deposits, ['id', 'amount', 'confirmed', 'currency', 'status'], r => r.status === 'Review' ? btn('deposit-confirm', t('مراجعة يدوية وتأكيد مبلغ', 'Manual review / confirm amount'), r.id) : '');
        if (tab === 'vouchers')
            return form('voucher', t('سند صرف — يبقى معلقاً حتى الاعتماد', 'Payment voucher — pending approval'), [...itemFields(), f('customerId', 'العميل إن انطبق', 'Customer if applicable', 'select', '', customers, false), f('amount', 'المبلغ', 'Amount'), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('issuedOn', 'تاريخ السند', 'Voucher date', 'date', now()), f('beneficiary', 'المستفيد', 'Beneficiary'), f('reason', 'السبب', 'Reason')], undefined, 'voucher_create') + `<form data-ld-form="approval">${FinancialTables.table(registerScope(),['✓',label('number'),label('amount'),label('status'),t('الإجراء','Action')],book.finance_vouchers.map(r=>[`<input type="checkbox" name="voucherId" value="${e(r.id)}" ${r.status!=='Pending'?'disabled':''}/>`,`${e(r.number)}${r.details.beneficiary?' — '+e(r.details.beneficiary):''}`,`${e(r.amount)} ${e(r.currency)}`,label(r.status),(r.status==='Pending'&&!r.cheque_id?btn('prepare',t('تجهيز الشيك','Prepare cheque'),r.id):r.status==='Approved'?btn('settle',t('تأكيد صرف البنك','Confirm bank clearing'),r.id):'')]),{key:'vouchers',columns:[null,'number','amount','status',null],rawRows:book.finance_vouchers,source:'finance_vouchers',endpoint:'ledger/register-view',companyId:co,canExport:allowed('report')&&allowed('export'),canPrint:allowed('report')&&allowed('export'),display:(k,v)=>k==='status'?label(v):v})}<label><input type="checkbox" name="signedEvidence" required/>${t('تحققت من التوقيع والمستند', 'I verified signature/evidence')}</label><button class="primary-btn">${t('اعتماد المحدد — معاينة', 'Approve selected — preview')}</button></form>${preview ? `<section class="ld-confirm"><h3>${t('تأكيد الاعتماد النهائي', 'Final approval confirmation')}</h3><p>${preview.count} — ${Object.entries(preview.totals).map(([k, v]) => e(k) + ': ' + e(v)).join(' | ')}</p>${table(preview.vouchers, ['number', 'beneficiary', 'amount', 'currency'])}${btn('approval-confirm', t('تأكيد الاعتماد النهائي', 'Confirm final approval'))}</section>` : ''}`;
        if (tab === 'funds')
            return form('fund', t('إنشاء صندوق دون افتتاحي مفترض', 'Create fund with explicit opening balance'), [f('name', 'اسم الصندوق', 'Fund name'), f('kind', 'النوع', 'Type', 'select', 'petty', choice(['cash', 'petty'])), f('holderId', 'المسؤول', 'Responsible employee', 'select', '', users()), f('chartId', 'حساب الصندوق', 'Fund ledger account', 'select', '', accounts), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('ceiling', 'السقف', 'Ceiling', 'text', '500'), f('threshold', 'حد التنبيه', 'Refill threshold', 'text', '200'), f('openingBalance', 'افتتاحي فعلي', 'Actual opening balance', 'text', '0'), f('openingEquityId', 'حساب مقابل الافتتاحي', 'Opening equity account', 'select', '', accounts, false), f('effectiveOn', 'التاريخ', 'Date', 'date', now())], undefined, 'fund_manage') + table(book.finance_funds, ['name', 'kind', 'balance', 'refill', 'currency'], r => (r.active&&r.kind==='petty'&&r.currency==='AED'&&allowed('fund_manage')?btn('fund-limit',t('سقف العهدة','Fund ceiling'),r.id):'')+(r.active&&r.kind==='petty'&&r.currency==='AED'&&allowed('fund_manage')&&r.holder_id!==ABCentral.actor?.id?btn('fund-handover',t('تسليم عهدة للموظف','Hand over employee fund'),r.id):'')+(r.kind==='petty'&&r.currency==='AED'&&(r.holder_id===ABCentral.actor?.id||allowed('fund_manage'))?btn('fund-handover-history',t('سجل التسليم والاستلام','Handover history'),r.id):'')+(r.kind==='petty'&&ABCentral.actor?.roleId==='owner'?btn('fund-review-config',t('إعداد المراجعة المستقلة','Configure independent review'),r.id):'')+(r.active&&allowed('petty_spend')&&(r.holder_id===ABCentral.actor?.id||allowed('fund_manage'))?btn('fund-spend', t('صرف', 'Spend'), r.id):'') + (r.active&&allowed('fund_manage')?btn('fund-refill', t('تغذية', 'Refill'), r.id):'') + (allowed('petty_spend')&&(r.holder_id===ABCentral.actor?.id||allowed('fund_manage'))?btn('fund-count', t('جرد فعلي', 'Physical count'), r.id):'') + (allowed('fund_manage')&&allowed('settle')?btn('fund-count-settle', t('تسوية جرد معتمدة', 'Approve count adjustment'), r.id):''));
        if (tab === 'cards')
            return form('card', t('بطاقة — آخر أربعة أرقام فقط', 'Card — last four digits only'), [f('ownership','ملكية البطاقة','Card ownership','select','company',choice(ABCentral.actor?.roleId==='owner'?['company','personal_owner']:['company'])),f('holderId', 'المسؤول', 'Responsible employee', 'select', '', users()), f('bankName', 'البنك', 'Bank'), f('lastFour', 'آخر أربعة أرقام', 'Last four'), f('name', 'اسم البطاقة', 'Card name'), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('dueDay', 'يوم الاستحقاق الفعلي', 'Actual due day', 'number', '15'), f('liabilityId', 'حساب الالتزام — ذمة مستقلة للمالك عند اختيار بطاقته الشخصية', 'Liability — dedicated owner payable for a personal card', 'select', '', accounts)], undefined, 'cards') + table(book.finance_cards, ['name', 'ownership', 'last_four', 'currency'], r => (r.ownership==='personal_owner'?btn('owner-outlay-config',t('ربط مدفوعات العملاء قبل الفوترة','Configure customer outlays before invoicing'),r.id)+btn('owner-outlay-history',t('مدفوعات العملاء قيد الفوترة','Customer outlays awaiting invoicing'),r.id)+btn('personal-wallet',t('تحديد أصل محفظة مستقل','Configure dedicated wallet asset'),r.id)+btn('wallet-config',t('ربط استهلاك المحفظة','Configure wallet consumption'),r.id)+btn('wallet-consume',t('تسجيل استهلاك سالك','Record actual toll consumption'),r.id)+btn('wallet-history',t('سجل استهلاك المحفظة','Wallet consumption history'),r.id)+btn('personal-owner-balances',t('مستحقات المالك حسب الشركة','Owner payables by company'),r.id):'')+btn('card-charge', t('تسجيل مصروف وتوزيعه', 'Record and allocate charge'), r.id) + (r.active&&r.currency==='AED'&&allowed('statement_upload')?btn('card-statement-import',t('استيراد كشف CSV / Excel','Import CSV / Excel statement'),r.id):'')+ btn('card-statement', t('إدخال كشف يدوي', 'Enter statement manually'), r.id)) + table(book.finance_card_charges, ['reference', 'amount', 'currency'], r => btn('card-details', t('التوزيع والفواتير', 'Splits and invoices'), r.id));
        if (tab === 'work')
            return form('work', t('شيك العميل — إجمالي السندات يساوي الشيك', 'Customer cheque — receipts must equal its total'), [...refFields(), f('workItemId', 'بند Work Amount المرتبط بأمانة العميل', 'Work Amount customer liability item', 'select', '', items.filter(i => i.category === 'work_amount')), f('priorItemId', 'بند المستحقات السابقة', 'Prior dues item', 'select', '', items), f('priorAmount', 'المستحقات السابقة', 'Prior dues'), f('workAmount', 'صافي Work Amount المحسوب يدوياً', 'Manually calculated net Work Amount'), f('amount', 'إجمالي الشيك', 'Cheque total'), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('receivedOn', 'تاريخ الاستلام', 'Receipt date', 'date', now()), f('bankAccountId', 'حساب التحصيل', 'Clearing account', 'select', '', book.banks), f('chequeNumber', 'رقم الشيك', 'Cheque number'), f('beneficiary', 'مقدم الشيك', 'Cheque payer'), ...dateFields(), f('payoutReason', 'سبب صرف الصافي', 'Net payout reason')], undefined, 'collect');
        if (tab === 'intercompany')
            return form('intercompany', t('تحويل بشيك وحسابات متقابلة', 'Cheque transfer with reciprocal current accounts'), [f('toCompanyId', 'الشركة المستفيدة', 'Beneficiary company', 'select', '', cap.companies.filter(c => c.id !== co)), f('toBankAccountId', 'مرجع حساب الشركة المستفيدة', 'Beneficiary bank account reference'), ...itemFields(), ...amounts(), f('sourceDueFromId', 'حساب مستحق من الشركة المستفيدة', 'Source due-from account', 'select', '', accounts), f('destinationDueToId', 'مرجع حساب مستحق للشركة المصدر', 'Destination due-to account reference'), f('reason', 'السبب', 'Reason')], undefined, 'intercompany') + table(book.finance_intercompany, ['id', 'state', 'voucher_id'], r => r.state !== 'Deposited' ? btn('intercompany-deposit', t('تأكيد إيداع المستفيد بعد صرف البنك', 'Confirm beneficiary deposit after bank clearing'), r.id) : '');
        if (tab === 'reconciliation')
            return form('bank-statement', t('كشف بنكي — المرفق الأصلي مع مراجعة يدوية', 'Bank statement — original evidence and manual review'), [f('bankAccountId', 'الحساب', 'Account', 'select', '', book.banks), f('periodFrom', 'من', 'From', 'date', now().slice(0, 7) + '-01'), f('periodTo', 'إلى', 'To', 'date', now()), f('openingBalance', 'الافتتاحي', 'Opening', 'text', '0'), f('closingBalance', 'الختامي', 'Closing'), proofField(), f('csv', 'الحركات CSV: date,amount,reference', 'Rows CSV: date,amount,reference', 'textarea')], undefined, 'statement_upload') + table(book.finance_statements, ['source_name', 'period_from', 'period_to', 'opening_balance', 'closing_balance', 'status'], r => btn('statement-open', t('عرض ومطابقة', 'Open and reconcile'), r.id));
        if (tab === 'journals')
            return form('journal', t('قيد يدوي متوازن — يحتاج اعتماداً', 'Balanced manual journal — approval required'), [f('currency', 'العملة', 'Currency', 'text', 'AED'), f('effectiveOn', 'التاريخ', 'Date', 'date', now()), f('reason', 'السبب', 'Reason'),f('costCentreId','مركز التكلفة (اختياري)','Cost centre (optional)','select','',(book.package.costCentres||[]).filter(r=>r.active).map(r=>({id:r.id,name:getLocale()==='ar'?r.nameAr:r.nameEn})),false)], undefined, 'journal_create', journalRows()) + table(book.finance_journals, ['number', 'effective_on', 'status', 'currency'], r => r.status === 'Draft' ? btn('journal-post', t('اعتماد وترحيل', 'Approve and post'), r.id) : btn('journal-reverse', t('قيد عكسي', 'Reverse journal'), r.id));
        if (tab === 'reports')
            return form('report', t('تقارير من القيود والمستندات الفعلية', 'Reports from actual entries and documents'), [f('groupBy', 'تجميع التحصيل', 'Collections grouping', 'select', 'day', choice(['day', 'month', 'year', 'employee', 'item'])), f('kind', 'التقرير', 'Report', 'select', 'trial', choice(['trial', 'balance', 'profit', 'cashflow', 'ledger', 'journal', 'receivables', 'custody', 'vouchers', 'cards', 'kpi', 'vat', 'collections', 'deposits', 'cheques', 'funds', 'intercompany', 'installments', 'adjustments', 'profitability','cost-centres'])), f('from', 'من', 'From', 'date', now().slice(0, 4) + '-01-01'), f('to', 'إلى', 'To', 'date', now()), f('currency', 'العملة (اختياري)', 'Currency (optional)', 'text', '', null, false)], t('عرض التقرير', 'Show report'), 'report', `<details class="full"><summary>${t('الشركات المصرح بها', 'Authorized companies')}</summary>${cap.companies.map(c => `<label><input type="checkbox" name="reportCompany" value="${c.id}" ${(drafts.report?.companies!==undefined?drafts.report.companies.split(',').includes(c.id):c.id===co)?'checked':''}/>${e(getLocale()==='ar'?c.arabicName||c.englishName:c.englishName||c.arabicName)}</label>`).join('')}</details><label class="full"><input type="checkbox" name="consolidated" ${drafts.report?.consolidated?'checked':''} ${!['trial','balance','profit'].includes(drafts.report?.kind||'trial')?'disabled':''}/>${t('عرض موحد للمجموعة — يتطلب جميع الشركات النشطة المصرح بها','Group view — requires all authorized active companies')}</label>`) + (report ? `<section data-ld-report-result><p>${e(report.statementScope||report.scope)} — ${t('فواتير غير مصنفة', 'Unclassified invoices')}: ${report.unclassifiedInvoices}</p>${allowed('export')?btn('export-csv', 'CSV')+btn('export-excel', 'Excel')+btn('print', t('طباعة / PDF', 'Print / PDF')):''}${reportSummary(report)}${table(report.rows, reportColumns(report.rows))}</section>` : '');
        if (tab === 'setup')
            return setup() + table(book.finance_accounts, ['code', 'name_ar', 'name_en', 'kind', 'active'], r => btn('account-edit', t('تعديل / تفعيل', 'Edit / activate'), r.id)) + FinancialPackageUI.itemPanel(packageContext());
        if (tab === 'import')
            return (allowed('invoice_import')?btn('import-template-xlsx',t('تنزيل قالب Excel','Download Excel template'))+btn('import-template-csv',t('تنزيل قالب CSV','Download CSV template')):'')+form('import-preview', t('معاينة CSV / Excel — المطابقة قبل الاعتماد', 'Preview CSV / Excel — match before commit'), [f('importMode','طريقة التجميع','Import grouping','select','rows',[{id:'rows',name:t('فواتير مستقلة','Separate invoices')},{id:'monthly_salik',name:t('سالك شهري لكل مركبة','Monthly Salik per vehicle')}]),f('sourceResponsibilityReviewed','راجعت مسؤولية العميل والشركة بتاريخ سالك أو المخالفة','I reviewed customer/company responsibility at the toll or violation dates','checkbox','',null,false),f('occurredOn','عمود التاريخ الأصلي — مطلوب لسالك والمخالفات','Original transaction date column — required for tolls and traffic fines','text','occurredOn',null,false),f('file', 'ملف الفواتير الأصلي', 'Original invoice file', 'file'), ...['sourceKey', 'customerNumber', 'vehicleNumber', 'plate', 'itemCode', 'amount', 'currency', 'dueOn'].map(k => f(k, label(k), k, 'text', k, null, !['vehicleNumber', 'plate'].includes(k)))], t('معاينة', 'Preview'), 'invoice_import') + importPreviewResults();
        if (tab === 'closing')
            return form('closing-review', t('قائمة الإغلاق قبل الاعتماد', 'Closing checklist before approval'), [f('month', 'أول يوم من الشهر', 'First day of month', 'date', now().slice(0, 7) + '-01'),f('closingScope','نطاق الإغلاق','Closing scope','select','company',[{id:'company',name:t('الشركة الحالية','Current company')},...(allowed('group_close')?[{id:'group',name:t('جميع شركات المجموعة النشطة','All active group companies')}]:[])])], t('فحص النواقص', 'Review blockers'), 'close') + (report?.format==='AB-GROUP-CLOSE-SOURCE-1'?groupClosingSummary(report):report?.problems ? `<section data-closing-review-result><p>${Object.entries(report.problems).map(([k, n]) => e(label(k)) + ': ' + e(n)).join(' | ') || t('اجتازت قائمة الفحص', 'Checklist passed')}</p>${report.canClose ? btn('close-confirm', t('اعتماد إغلاق الشهر', 'Approve monthly close')) : ''}</section>` : '') + table(book.finance_periods, ['month', 'created_at']);
        return '';
    }
    function journalRows() { return '<div class="full ld-lines">' + [0, 1, 2, 3].map(i => `<div class="ld-row">${field(f('chart' + i, 'الحساب', 'Account', 'select', '', accountOptions(), i < 2), 'journal')}${field(f('debit' + i, 'مدين', 'Debit', 'text', '0', null, i < 2), 'journal')}${field(f('credit' + i, 'دائن', 'Credit', 'text', '0', null, i < 2), 'journal')}</div>`).join('') + '</div>'; }
    function setup() { const a = defs(), charts = accountOptions(); return form('account', t('حساب موحد — مرتبط بالشركات المختارة', 'Shared account — mapped to selected companies'), [f('nameAr', 'الاسم العربي', 'Arabic name'), f('nameEn', 'الاسم الإنجليزي', 'English name'), f('kind', 'الطبيعة', 'Nature', 'select', 'asset', choice(['asset', 'liability', 'equity', 'income', 'expense'])), f('parentId', 'حساب رئيسي (اختياري)', 'Parent (optional)', 'select', '', a, false), f('currency', 'العملة', 'Currency', 'text', 'AED'), f('bankAccountId', 'ربط حساب بنكي (اختياري)', 'Map existing bank (optional)', 'select', '', book.banks, false), f('eliminate', 'حساب متبادل بين الشركات', 'Intercompany elimination account', 'checkbox', false)], undefined, 'account_manage') + form('config', t('ربط عهدة الشركة والتقويم', 'Company custody mappings and calendar'), [f('currency', 'العملة', 'Currency', 'text', 'AED'), f('custodyAccountId', 'حساب عهدة النقد', 'Cash custody account', 'select', book.config.custodyAccountId || '', charts), f('chequeTransitAccountId', 'حساب الشيكات قيد التحصيل', 'Cheque transit account', 'select', book.config.chequeTransitAccountId || '', charts), f('customerCreditAccountId', 'أمانات وأرصدة العملاء الدائنة', 'Customer credit/liability', 'select', book.config.customerCreditAccountId || '', charts), f('automaticFinanceJobs', 'تمكين الجدولة للشركة بعد تفعيل عامل الخادم', 'Enable company scheduling after server worker activation', 'checkbox', book.config.automaticFinanceJobs || false), f('depositDays', 'مهلة الإيداع بأيام العمل', 'Deposit working days', 'number', book.config.depositDays || 1), f('holidays', 'العطلات: تاريخ واحد في كل سطر', 'Holidays: one date per line', 'textarea', (book.config.holidays || []).join('\n'), null, false)], undefined, 'configure'); }
    function renderPage() {
        if(report?.presentation==='human_statement_v1'&&report.statementLocale!==getLocale()){report=null;reportInputRevision++;}
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
        if (!cap || busy)
            return '<section class="content-panel" role="status">' + t('جارٍ التحقق…', 'Checking…') + '</section>';
        if (!cap.available)
            return `<section class="content-panel"><h2>${t('الإدارة المالية', 'Financial management')}</h2><p>${message('ledgerSchemaPending')}</p></section>`;
        if (!book)
            return `<section class="content-panel"><p role="alert">${e(notice || t('لا توجد شركة مفوضة', 'No authorized company'))}</p>${btn('reload',t('تحديث','Refresh'))}</section>`;
        const registerContent=body();return `<section class="content-panel ld-section"><h2>${t('الإدارة المالية والتحصيل والخزينة', 'Finance, collections and treasury')}</h2><nav class="workspace-toolbar">${navigationTabs.map(k => btn('tab', label(k), k)).join('')}</nav><div class="fw-actions"><label>${t('الشركة القانونية', 'Legal company')}<select class="input" id="ld-company">${opts(cap.companies, co)}</select></label>${btn('reload', t('تحديث', 'Refresh'))}</div><p id="ld-notice" role="status" aria-live="polite">${e(notice)}</p>${registerContent.includes('data-ft-table')?FinancialTables.search(registerScope()):''}<div id="ld-body">${registerContent}</div><div id="ld-dialog"></div></section>`;
    }
    function dialog(title, key, fields, extra = '') { document.querySelector('#ld-dialog').innerHTML = '<h3>' + e(title) + '</h3>' + form(key, title, fields, undefined, null, extra).replace('<details class="ld-form-section"', '<details open class="ld-form-section"'); bindForms(); document.querySelector('#ld-dialog').scrollIntoView({ block: 'nearest' }); }
    const serialize = form => {
        const fd=new FormData(form), d = Object.fromEntries(fd);
        if(form.dataset.ldForm==='report'){d.companies=fd.getAll('reportCompany').join(',');delete d.reportCompany;}
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
    function show(err) { notice = message(err.message);if(typeof err.reference==='string'&&/^(?:req-[A-Za-z0-9_-]{1,80}|client-[A-Fa-f0-9-]{36})$/.test(err.reference))notice+=' · '+t('مرجع المتابعة: ','Reference: ')+err.reference;const target=document.getElementById('ld-notice');if(target)target.textContent = notice; }
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
        if(key==='issuer-payment-match'){if(form._issuerReviewed!==d.lineId+':'+d.issuerPaymentReference.trim())throw Error('issuerPaymentReviewRequired');endpoint='card-statements/'+report.statement.id+'/match';payload={pairs:[{lineId:d.lineId,issuerPaymentReference:d.issuerPaymentReference.trim()}]};}
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
            const original=book.finance_items.find(i=>i.id===selected);payload={...original.details,...d,code:original.code,priority:original.priority};
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
            if(d.useInvoiceAllocations){payload.allocations=fd.getAll('selectedInvoice').map(id=>({invoiceId:id,amount:fd.get('invoice-take-'+id)}));payload.mode='manual';delete payload.targetInvoiceId;}
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
            payload = { ...d, companyId: co };const receipts=fd.getAll('handoverReceipt').map(receiptId=>({receiptId,amount:fd.get('handover-amount-'+receiptId)}));if(receipts.length)payload.receipts=receipts;
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
            const requestCompany=co,requestActor=ABCentral.actor?.id,requestEpoch=epoch;
            const current=()=>requestCompany===co&&requestActor===ABCentral.actor?.id&&requestEpoch===epoch;
            const file = fd.get('file');
            if (!file || !file.size || file.size > 10 * 1024 * 1024)
                throw Error('invalidFile');
            const bytes = new Uint8Array(await file.arrayBuffer());
            if(!current())throw Error('staleSession');
            let binary = '';
            for (const b of bytes)
                binary += String.fromCharCode(b);
            try{await ABCentral.api('documents', 'POST', { companyId: requestCompany, category: 'other', title: d.title, date: d.date, name: file.name, mime: file.type, base64: btoa(binary) });}catch(err){if(!current())throw Error('staleSession');throw err;}
            if(!current())throw Error('staleSession');
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
            if(!payload.reviewId)delete payload.reviewId;
            endpoint = 'funds/' + selected + '/spend';
        }
        if (key === 'fund-refill') {
            endpoint = 'funds/' + selected + '/refill';
        }
        if (key === 'card') {
            endpoint = 'cards';
            payload = { ...d, companyId: co, dueDay: Number(d.dueDay) };
        }
        if(key==='owner-outlay-config'){if(!d.confirm)throw Error(t('يلزم اعتماد الربط والمصروف صراحة.','Explicitly confirm the reviewed mappings and discount expense.'));endpoint='owner-customer-outlays/configure';payload={...d,companyId:co,cardId:selected,confirm:true};}
        if(key==='wallet-config'){if(!d.confirm)throw Error(t('يلزم اعتماد الربط المستقبلي.','Confirm prospective mapping.'));endpoint='owner-wallets/configure';payload={...d,companyId:co,prepaidOnly:true,confirm:true};}
        if(key==='wallet-consume'){if(!d.actualConsumptionVerified)throw Error(t('أكد الاستهلاك الفعلي والإثبات.','Confirm actual consumption and evidence.'));endpoint='owner-wallets/consumption';payload={...d,companyId:co,actualConsumptionVerified:true};}
        if(key==='personal-wallet'){if(!d.confirm)throw Error(t('يلزم تأكيد مراجعة الحساب المستقل.','Confirm the dedicated account review.'));endpoint='cards/'+selected+'/wallets';payload={companyId:co,definitionId:d.definitionId,reason:d.reason,confirm:true};}
        if (key === 'card-charge'||key==='personal-card-charge') {
            endpoint = 'cards/' + selected + '/charges';
            const splits = [];
            for (let i = 0; form.elements['splitCompany' + i]; i++) {
                if (!fd.get('splitCompany' + i))
                    continue;
                const row = { companyId: fd.get('splitCompany' + i), itemId: fd.get('splitItem' + i), amount: fd.get('splitAmount' + i) };
                for (const [prop, name] of [['customerId', 'splitCustomer'], ['vehicleId', 'splitVehicle'], ['invoiceId', 'splitInvoice'], ['dueToAccountId', 'splitDueTo'], ['issuerDueFromAccountId', 'splitDueFrom'],['purpose','splitPurpose'],['counterpartDefinitionId','splitCounterpart']])
                    if (fd.get(name + i))
                        row[prop] = fd.get(name + i);
                if(key==='personal-card-charge'&&row.invoiceId){const inv=form._personalOptions?.get(row.companyId)?.invoices.find(r=>r.id===row.invoiceId);if(!inv)throw Error(t('أعد اختيار الفاتورة في نطاق الشركة.','Select an invoice in the company scope.'));row.customerId=inv.customer_id;if(inv.vehicle_id)row.vehicleId=inv.vehicle_id;row.itemId=inv.item_id;}
                splits.push(row);
            }
            payload = { amount: d.amount, paidOn: d.paidOn, reference: d.reference, beneficiary: d.beneficiary, splits };
            if (d.documentVersionId)
                payload.documentVersionId = d.documentVersionId;
            if(key==='personal-card-charge'){if(!d.actualPaymentVerified)throw Error(t('يلزم التحقق من الدفع الفعلي.','Verify actual payment first.'));payload.personalReview={actualPaymentVerified:true,taxReviewReason:d.taxReviewReason};}
        }
        if (key === 'card-statement') {
            endpoint = 'cards/' + selected + '/statements';
            payload = { periodFrom: d.periodFrom, periodTo: d.periodTo, openingBalance: d.openingBalance, closingBalance: d.closingBalance, documentVersionId: d.documentVersionId, lines: FinancePolicy.parseCsv(d.csv).map(r => ({ date: r.date, amount: r.amount, reference: r.reference })) };
        }
        if (key === 'card-vouchers') {
            endpoint = 'card-statements/' + report.statement.id + '/vouchers';
        }
        if (key === 'card-link') {
            endpoint = 'card-splits/' + selected + '/invoice';payload={invoiceId:d.invoiceId};
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
            payload = { companyId: co, currency: d.currency, effectiveOn: d.effectiveOn, reason: d.reason, ...(d.costCentreId?{costCentreId:d.costCentreId}:{}), lines };
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
            drafts.report = { ...d, companies: fd.getAll('reportCompany').join(',') };
            if(!drafts.report.companies)throw Error('reportCompaniesRequired');
            await loadReport('json', 0);
            return;
        }
        if (key === 'closing-review') {
            const revision=closingInputRevision,locale=getLocale(),result=await api((d.closingScope==='group'?'group-closing-review?':'closing-review?')+new URLSearchParams(d.closingScope==='group'?{month:d.month}:{companyId:co,month:d.month}));
            if(revision!==closingInputRevision||locale!==getLocale())throw Error('staleSession');report=result;
            render();
            return;
        }
        if (key === 'import-preview') {
            const requestCompany=co,requestActor=ABCentral.actor?.id,requestEpoch=epoch,inputRevision=importInputRevision,file = fd.get('file');
            if (!file || !file.size || file.size > 5e6)
                throw Error('invalidFile');
            const bytes = new Uint8Array(await file.arrayBuffer());
            if(requestCompany!==co||requestActor!==ABCentral.actor?.id||requestEpoch!==epoch)throw Error('staleSession');if(inputRevision!==importInputRevision)throw Error('importInputsChanged');
            let raw = '';
            for (const b of bytes)
                raw += String.fromCharCode(b);
            const mapping = {};
            for (const k of ['sourceKey', 'customerNumber', 'vehicleNumber', 'plate', 'itemCode', 'amount', 'currency', 'dueOn'])
                mapping[k] = d[k] || '';
            const monthly=d.importMode==='monthly_salik';mapping.occurredOn=d.occurredOn||'';
            if(monthly){delete mapping.plate;mapping.occurredOn=d.occurredOn;if(!fd.has('sourceResponsibilityReviewed'))throw Error(t('يجب مراجعة مسؤولية العميل والشركة عن عمليات سالك أولاً.','Review customer/company responsibility for the toll transactions first.'));}
            const result = await api(monthly?'invoice-imports/monthly-salik':'invoice-imports', 'POST', { companyId: co, name: file.name, format: file.name.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv', base64: btoa(raw), mapping,...(monthly?{sourceResponsibilityReviewed:true}:{sourceResponsibilityReviewed:fd.has('sourceResponsibilityReviewed'),resultRecoveryVersion:2}) }, form._key ??= crypto.randomUUID(),{timeoutMs:45000});
            if(requestCompany!==co||requestActor!==ABCentral.actor?.id||requestEpoch!==epoch)throw Error('staleSession');if(inputRevision!==importInputRevision)throw Error('importInputsChanged');importJob={...result,_companyId:requestCompany,_actorId:requestActor};
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
            if(form.dataset.ldForm==='import-preview'&&drafts['import-preview']?.file instanceof File&&drafts['import-preview'].file.size<=5e6){const transfer=new DataTransfer();transfer.items.add(drafts['import-preview'].file);form.elements.file.files=transfer.files;}
            form.oninput = (ev) => { if(form.dataset.ldForm==='closing-review'){closingInputRevision++;report=null;document.querySelector('[data-closing-review-result]')?.remove();}if(form.dataset.ldForm==='report'){if(ev.target?.name==='kind'){const box=form.elements.consolidated;box.disabled=!['trial','balance','profit'].includes(ev.target.value);if(box.disabled)box.checked=false;}if(ev.target?.name==='consolidated'&&ev.target.checked)form.querySelectorAll('[name=reportCompany]').forEach(x=>{const company=cap.companies.find(c=>c.id===x.value);if(company?.status==='Active')x.checked=true;});reportInputRevision++;report=null;document.querySelector('[data-ld-report-result]')?.remove();} drafts[form.dataset.ldForm] = serialize(form);if(form.dataset.ldForm==='import-preview'){importInputRevision++;delete form._key;importJob=null;document.querySelector('[data-invoice-import-review]')?.remove();} };
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
    function groupClosingSummary(result){return '<section data-closing-review-result><p>'+e(t('فحص المجموعة من المصادر الأصلية؛ لا قيد جديد أو إقرار ضريبي.','Group review of original sources; no new journal or tax return.'))+'</p><p>'+e(result.periodEnded?t('انتهت الفترة','Period ended'):t('الفترة لم تنتهِ','Period has not ended'))+'</p>'+(result.alreadyClosed?'<p>'+e(t('يوجد إغلاق مسجل لهذه الفترة؛ لا ينشأ سجل آخر.','A closing is already recorded for this period; no second record is created.'))+'</p>':'')+(result.legacyClosingReviewRequired?'<p>'+e(message('legacyGroupClosingReviewRequired'))+'</p>':'')+result.companyReviews.map(r=>'<p>'+e(getLocale()==='ar'?r.companyNameAr:r.companyNameEn)+' — '+e(r.periodId?t('مغلقة','Closed'):t('لم تغلق','Not closed'))+' · '+e(Object.entries(r.problems).map(([k,v])=>label(k)+': '+v).join(' · ')||t('اجتازت الفحص','Checklist passed'))+'</p>').join('')+'<p>'+e(result.reciprocal.balanced?t('الحسابات المتبادلة المعتمدة متوازنة حسب العملة.','Configured reciprocal balances match by currency.'):t('حسابات متبادلة غير متوازنة؛ الإغلاق ممنوع.','Unbalanced reciprocal accounts; closing is blocked.'))+' '+e(Object.entries(result.reciprocal.byCurrency).map(([c,v])=>v+' '+c).join(' · '))+'</p>'+(result.canClose?btn('close-confirm',t('اعتماد إغلاق المجموعة','Approve group closing')):'')+'</section>'; }
    function reportSummary(result){const values=Object.entries(result.profitByCurrency||{}).length?result.profitByCurrency:result.totals;return '<p data-statement-totals>'+e(t('صافي الصفوف المحددة حسب العملة: ','Selected-row net by currency: '))+e(Object.entries(values||{}).map(([currency,amount])=>amount+' '+currency).join(' · ')||'—')+'</p>'; }
    function reportColumns(rows,kind=drafts.report?.kind,metadata=report){if(metadata?.presentation==='human_statement_v1')return metadata.statementColumns;if(['journal','ledger'].includes(kind))return ['date','company_id','journal_reference','operation_reference','code',getLocale()==='ar'?'name_ar':'name_en','debit','credit','currency'];return kind==='funds'?[getLocale()==='ar'?'company_name_ar':'company_name_en',getLocale()==='ar'?'holder_name_ar':'holder_name_en','name','kind','balance','refill','currency','ceiling','threshold','active']:Object.keys(rows[0]||{}).filter(k=>!['payload_cipher'].includes(k)).slice(0,12);}
    function reportOutputCell(row,key,companyList=cap?.companies||[]){if(key==='journal_number')return row[key]?'JV-'+row[key]:'—';if(key==='date')return row[key]?WorkspaceUI.date(row[key]):'—';if(key==='holder_id')return book.users.find(u=>u.id===row[key])?.name||'—';if(key==='company_id'){const company=companyList.find(c=>c.id===row[key]);return(getLocale()==='ar'?company?.nameAr||company?.arabicName:company?.nameEn||company?.englishName)||'—';}return ['status','kind','payment_state','ownership'].includes(key)?label(row[key]):row[key]??'';}
    async function loadReport(format = 'json', page = 0) {
        const generation=epoch,requestActor=ABCentral.actor?.id,requestCompany=co,requestLocale=getLocale(),revision=reportInputRevision;
        const d = drafts.report || {}, q = { companies: d.companies || co, from: d.from || now().slice(0, 4) + '-01-01', to: d.to || now(), kind: d.kind || 'trial', format, page: '0',...FinancialTables.state(registerScope(),'report') };
        if(['trial','balance','profit'].includes(q.kind)){q.presentation='human_statement_v1';q.locale=requestLocale;if(d.consolidated)q.consolidated='true';}
        if (d.groupBy)
            q.groupBy = d.groupBy;
        if (d.currency)
            q.currency = d.currency;
        const result = await api('reports?' + new URLSearchParams(q));
        if(generation!==epoch||requestActor!==ABCentral.actor?.id||requestCompany!==co||requestLocale!==getLocale()||revision!==reportInputRevision)throw Error('staleSession');
        {const current=FinancialTables.state(registerScope(),'report');if(current.search!==q.search||current.grid!==q.grid)throw Error('staleSession');}
        if(format==='print'){const columns=reportColumns(result.rows,q.kind,result),companyNames=result.companies.map(c=>getLocale()==='ar'?c.nameAr:c.nameEn).join(' / '),range=q.kind==='funds'?t('الأرصدة حتى ','Balances through ')+q.to:q.from+' — '+q.to,title=t('التقرير المالي','Financial report')+' — '+label(q.kind)+'\n'+companyNames+' · '+range+'\n'+t('وفق النطاق والفلاتر المحددة؛ ليس إقفالاً مالياً أو إقراراً ضريبياً معتمداً.','Selected scope and filters; not a certified closing or tax return.')+'\n'+(result.statementScope||result.scope)+'\n'+t('صافي الصفوف المحددة: ','Selected-row net: ')+Object.entries(Object.keys(result.profitByCurrency||{}).length?result.profitByCurrency:result.totals||{}).map(([currency,amount])=>amount+' '+currency).join(' · ')+'\n'+t('فواتير غير مصنفة: ','Unclassified invoices: ')+result.unclassifiedInvoices+' · '+t('تسويات غير مرحلة: ','Unposted adjustments: ')+result.unpostedInvoiceAdjustments;await RegisterExport.run({title,columns:columns.map(label),rows:result.rows.map(row=>columns.map(k=>reportOutputCell(row,k,result.companies)))},'print');return;}
        if (format === 'csv' || format === 'excel') {
            download(result);
            return;
        }
        report = result;
        render();
    }
    function download(r) { const u = URL.createObjectURL(new Blob([r.data], { type: r.mime })), a = document.createElement('a'); a.href = u; a.download = r.filename; a.click(); setTimeout(() => URL.revokeObjectURL(u), 1000); }
    async function personalCardDialog(cardId){
        const company=co,who=ABCentral.actor.id,cache=new Map(),load=async id=>{if(!cache.has(id))cache.set(id,await api('cards/'+cardId+'/personal-options?companyId='+id));return cache.get(id);},initial=await load(co);if(company!==co||who!==ABCentral.actor.id)return;
        const named=rows=>(rows||[]).map(r=>({id:r.id,name:getLocale()==='ar'?r.nameAr:r.nameEn})),invoiceOptions=rows=>rows.map(r=>({id:r.id,name:'INV-'+r.invoiceNumber+' · C-'+r.customerNumber+(r.vehicleNumber?' · V-'+r.vehicleNumber:'')+' · '+r.amount+' AED'})),fields=[f('amount','إجمالي عملية البطاقة AED','Total card transaction AED'),f('paidOn','تاريخ الدفع الفعلي','Actual payment date','date',now()),f('reference','مرجع عملية البطاقة الفريد','Unique card transaction reference'),f('beneficiary','المورد أو المستفيد','Merchant or beneficiary'),proofField(),f('taxReviewReason','أساس مراجعة التصنيف والضريبة — لا مطالبة VAT آلية','Classification and tax review basis — no automatic VAT claim'),f('actualPaymentVerified','تحققت من الدفع الفعلي والمستند','I verified actual payment and evidence','checkbox',false)];
        const purposes=[{id:'business_expense',name:t('مصروف أعمال','Business expense')},{id:'customer_disbursement',name:t('مدفوع عن عميل — فاتورة قائمة','Customer payment — existing invoice')},{id:'customer_unbilled',name:t('مدفوع عن عميل — قبل الفوترة','Customer payment — before invoicing')},{id:'wallet_topup',name:t('تعبئة محفظة — أصل مستقل','Wallet top-up — separate asset')},{id:'personal',name:t('شخصي — مستبعد من ذمة الشركات','Personal — excluded from company debt')}];
        const rowHTML=i=>'<fieldset class="ld-row" data-personal-split="'+i+'"><legend>'+t('جزء العملية ','Transaction split ')+(i+1)+'</legend>'+[f('splitCompany'+i,'الشركة المستفيدة','Beneficiary company','select',i===0?co:'',cap.companies,i===0),f('splitPurpose'+i,'تصنيف العملية','Purpose','select','business_expense',purposes),f('splitItem'+i,'البند المالي','Financial item','select','',named(initial.items),i===0),f('splitAmount'+i,'مبلغ الجزء AED','Split amount AED','text','',null,i===0),f('splitCustomerSearch'+i,'بحث عن العميل بالاسم أو رقم الملف','Find customer by name or file number','search','',null,false),f('splitCustomer'+i,'العميل المسؤول','Responsible customer','select','',customers,false),f('splitVehicleSearch'+i,'بحث عن مركبة العميل برقم الملف أو اللوحة','Find customer vehicle by file number or plate','search','',null,false),f('splitVehicle'+i,'المركبة — عند انطباقها','Vehicle — when applicable','select','',[],false),f('splitInvoice'+i,'الفاتورة الأصلية للمدفوع عن العميل','Original customer disbursement invoice','select','',invoiceOptions(initial.invoices),false),f('splitCounterpart'+i,'أصل المحفظة — للتعبئة فقط','Wallet asset — top-ups only','select','',named(initial.wallets),false)].map(x=>field(x,'personal-card-charge')).join('')+'</fieldset>';
        dialog(t('بطاقة المالك — لا حساب بنكي للشركة أو تحصيل للعميل','Owner card — no company bank or customer receipt'),'personal-card-charge',fields,[0,1,2].map(rowHTML).join('')+'<button type="button" class="secondary-btn" data-add-personal-split>'+t('إضافة جزء آخر','Add another split')+'</button>');
        const form=document.querySelector('[data-ld-form=personal-card-charge]');form._personalOptions=cache;let count=3;const current=()=>form.isConnected&&co===company&&ABCentral.actor.id===who;
        function bindRow(i){const el=name=>form.elements[name+i],state={customerSequence:0,vehicleSequence:0};
            const apply=()=>{const purpose=el('splitPurpose').value,active=!!el('splitCompany').value,data=cache.get(el('splitCompany').value)||initial,item=el('splitItem'),previous=item.value;item.innerHTML=opts(named(purpose==='customer_unbilled'?data.unbilledItems:data.items),previous);item.required=active;el('splitAmount').required=active;for(const [name,visible]of [['splitInvoice',purpose==='customer_disbursement'],['splitCounterpart',purpose==='wallet_topup'],['splitCustomer',purpose==='customer_unbilled'],['splitCustomerSearch',purpose==='customer_unbilled'],['splitVehicle',purpose==='customer_unbilled'],['splitVehicleSearch',purpose==='customer_unbilled']]){const input=el(name);input.closest('label').hidden=!visible;input.disabled=!visible;input.required=active&&visible&&['splitInvoice','splitCounterpart','splitCustomer'].includes(name);if(!visible)input.value='';}};
            const loadVehicles=async()=>{const sequence=++state.vehicleSequence,client=el('splitCustomer').value,legal=el('splitCompany').value,query=el('splitVehicleSearch').value;if(!client||!legal){el('splitVehicle').innerHTML=opts([],'');return;}try{const result=await ABCentral.api('vehicles?'+new URLSearchParams({companies:legal,customerId:client,limit:'50',q:query}));if(!current()||sequence!==state.vehicleSequence||client!==el('splitCustomer').value||legal!==el('splitCompany').value)return;el('splitVehicle').innerHTML=opts((result.rows||[]).map(v=>({id:v.id,name:'#'+v.fileNumber+' '+(v.plate||'')})),'');}catch(err){if(current())show(err);}};
            el('splitPurpose').onchange=apply;el('splitCompany').onchange=async()=>{const input=el('splitCompany'),legal=input.value;if(!legal){apply();return;}input.disabled=true;try{const data=await load(legal);if(!current()||input.value!==legal)return;el('splitInvoice').innerHTML=opts(invoiceOptions(data.invoices),'');el('splitCounterpart').innerHTML=opts(named(data.wallets),'');el('splitVehicle').innerHTML=opts([],'');apply();if(el('splitCustomer').value)await loadVehicles();}catch(err){show(err);}finally{input.disabled=false;}};
            el('splitCustomer').onchange=()=>{el('splitVehicleSearch').value='';return loadVehicles();};el('splitCustomerSearch').oninput=()=>{clearTimeout(state.customerTimer);const query=el('splitCustomerSearch').value.trim();if(query.length<2)return;state.customerTimer=setTimeout(async()=>{const sequence=++state.customerSequence;try{const result=await ABCentral.api('customers?'+new URLSearchParams({q:query,limit:'50',statuses:'Active'}));if(!current()||sequence!==state.customerSequence||query!==el('splitCustomerSearch').value.trim())return;const previous=el('splitCustomer').value,old=[...el('splitCustomer').options].find(o=>o.value===previous),options=(result.rows||[]).map(c=>({id:c.id,name:'#'+c.fileNumber+' '+(c.fullName||c.name||'')}));if(old?.value&&!options.some(r=>r.id===old.value))options.unshift({id:old.value,name:old.textContent});el('splitCustomer').innerHTML=opts(options,previous);}catch(err){if(current())show(err);}},350);};
            el('splitVehicleSearch').oninput=()=>{clearTimeout(state.vehicleTimer);state.vehicleTimer=setTimeout(loadVehicles,350);};apply();
        }
        for(const i of[0,1,2])bindRow(i);form.querySelector('[data-add-personal-split]').onclick=()=>{if(count>=100)return;const button=form.querySelector('[data-add-personal-split]');button.insertAdjacentHTML('beforebegin',rowHTML(count));bindRow(count++);WorkspaceUI.enhance();if(count>=100)button.disabled=true;};WorkspaceUI.enhance();
    }
    function bindRegisterActions(host=document){host.querySelectorAll('[data-ld]').forEach(button => button.onclick = async () => {
            const action = button.dataset.ld, key = button.dataset.id;
            try {
                if(action==='dashboard-source'){
                    const selection={vouchers:{source:'finance_vouchers',status:'Pending'},deposits:{source:'finance_deposits',status:'Review'}}[key];if(!selection)throw Error('invalid');
                    tab=key;FinancialTables.selectSource(registerScope(),selection.source,{version:2,values:{status:[selection.status]}});
                    if(!ABCentral.viewAs)await api('preferences','POST',{companyId:co,tab},crypto.randomUUID());report=null;preview=null;render();return;
                }
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
                if(action==='import-template-xlsx'||action==='import-template-csv'){const company=co,session=ABCentral.actor?.id,r=await api('invoice-imports/template?'+new URLSearchParams({companyId:co,format:action.endsWith('xlsx')?'xlsx':'csv',mode:document.querySelector('[name=importMode]')?.value||'rows'}));if(company!==co||session!==ABCentral.actor?.id)throw Error('staleSession');download({...r,data:Uint8Array.from(atob(r.base64),x=>x.charCodeAt(0))});return;}
                if(action==='vehicle-charge-source'){const company=co,actor=ABCentral.actor.id,r=await api('invoices/'+key+'/vehicle-charge-source');if(company!==co||actor!==ABCentral.actor?.id)throw Error('staleSession');const host=document.querySelector('#ld-dialog');if(!r.available){host.innerHTML='<p class="notice">'+e(message(r.reasonCode))+'</p>';return;}host.innerHTML=(!r.currentResponsibilityMatches?'<p class="notice">'+t('تغير سياق المصدر بعد الإصدار؛ بقيت النسخة الأصلية والفاتورة محفوظتين دون تعديل مالي تلقائي.','Source context changed after issuance; the original source and invoice remain preserved without automatic financial correction.')+'</p>':'')+'<h3>'+t('مصدر المخالفة الأصلي — للقراءة فقط','Original violation source — read only')+'</h3><p class="notice">'+t('مطابقة مسؤولية مؤرخة وليست إثبات تحصيل العميل أو سداد الجهة أو اعتماداً ضريبياً.','Dated responsibility evidence; not proof of customer collection, government payment or tax approval.')+'</p>'+RecordLayout.values([[t('المرجع الأصلي','Original reference'),r.reference],[t('تاريخ المخالفة','Violation date'),WorkspaceUI.date(r.occurredOn)],[t('المبلغ AED','Amount AED'),r.amount],[t('تاريخ الاستحقاق','Due date'),WorkspaceUI.date(r.dueOn)],[t('بداية التسجيل في نسخة المصدر','Registration start in source version'),WorkspaceUI.date(r.registeredOn)],[t('نهاية العلاقة المسجلة في نسخة المصدر','Relationship end recorded in source version'),r.recordedRelationshipEnds.map(d=>WorkspaceUI.date(d)).join('، ')||t('لا يوجد إنهاء مؤرخ في هذه النسخة','No dated end in this source version')],[t('مراجعة المصدر','Source review'),WorkspaceUI.dateTime(r.sourceReviewedAt)]]);return;}
                if(action==='salik-details'){const company=co,r=await api('invoices/'+key+'/salik-details');if(company!==co)throw Error('staleSession');document.querySelector('#ld-dialog').innerHTML='<h3>'+t('تفاصيل سالك الشهرية','Monthly toll transaction details')+'</h3>'+table(r.transactions,['reference','occurredOn','dueOn','amount']);return;}
                if(action==='fund-limit'){await PettyFundUI.limit(key,refresh);return;}
                if(action==='fund-handover'){await PettyFundUI.prepare(key,refresh);return;}
                if(action==='fund-handover-history'){await PettyFundUI.history(key);return;}
                if(action==='deposit-review'){const formEl=document.querySelector('[data-ld-form=deposit]'),d=Object.fromEntries(new FormData(formEl));const review=await api('deposit-receipt-review','POST',{companyId:co,bankAccountId:d.bankAccountId,documentVersionId:d.documentVersionId,amount:d.amount,effectiveOn:d.effectiveOn,reference:d.reference},crypto.randomUUID());document.querySelector('[data-deposit-review]').textContent=t('مراجعة فقط — لا اعتماد بنكي. ','Review only — no bank verification. ')+t('الفروق: ','Differences: ')+review.differences.map(k=>({bank:t('البنك','Bank'),amount:t('المبلغ','Amount'),account:t('الحساب','Account'),date:t('التاريخ','Date'),reference:t('المرجع','Reference')})[k]||'—').join('، ')+(review.confidence!=null?' · '+t('جودة القراءة: ','Reading quality: ')+review.confidence+'%':'')+t('؛ بيانات ناقصة: ','; missing fields: ')+review.missing.map(k=>({bank:t('البنك','Bank'),amount:t('المبلغ','Amount'),account:t('الحساب','Account'),date:t('التاريخ','Date'),reference:t('المرجع','Reference')})[k]||'—').join('، ')+(review.facts?' · '+Object.entries(review.facts).filter(([k,v])=>k!=='ambiguous'&&v!=null).map(([k,v])=>({bank:t('البنك','Bank'),amount:t('المبلغ','Amount'),account:t('الحساب','Account'),date:t('التاريخ','Date'),reference:t('المرجع','Reference')})[k]+': '+v).join(' · '):t(' · لم تُستخرج بيانات موثوقة؛ يلزم التدقيق اليدوي.',' · Reliable facts were not extracted; manual review is required.'));return;}
                if (action === 'reload') {
                    await refresh();
                    return;
                }
                if (action === 'run-recurring') {
                    const r = await api('recurring/run', 'POST', { companyId: co }, crypto.randomUUID());
                    notice = t('فواتير جديدة: ', 'New invoices: ') + r.issued + t(' — بحاجة مراجعة: ', ' — review required: ') + r.skipped+(r.reviewRequired?.length?t(' — علاقات سابقة تحتاج مراجعة نطاق الشركة، ولم تُفوتر.',' — legacy company-scope relations require review and were not invoiced.'):'');
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
                    if(button._saving)return;if(!importJob||importJob._companyId!==co||importJob._actorId!==ABCentral.actor?.id)throw Error('staleSession');button._saving=true;button.disabled=true;const sourceForm=document.querySelector('[data-ld-form=import-preview]'),recoverable=importJob.vehicleChargeSourceVersion===1||importJob.resultRecoveryVersion===2,requestCompany=co,requestActor=ABCentral.actor.id;if(sourceForm)sourceForm.inert=true;
                    try{let r;try{r=await api('invoice-imports/'+importJob.id+'/commit','POST',{},crypto.randomUUID(),recoverable?{timeoutMs:90000}:undefined);}catch(err){if(recoverable&&(err.status>=500||['requestTimeout','requestUnavailable'].includes(err.message)))throw Object.assign(Error('importOutcomeUncertain'),{reference:err.reference||'client-'+crypto.randomUUID()});throw err;}const success=t('تم إنشاء ','Created ')+r.created.length+t(' — مكرر ',' — duplicate ')+r.duplicate+t(' — معزول ',' — rejected ')+r.rejected;notice=success;importJob=null;delete drafts['import-preview'];try{await refresh();if(requestCompany===co&&requestActor===ABCentral.actor?.id&&!book){notice=success+' — '+t('تعذر تحديث الجدول؛ اضغط تحديث.','Table refresh unavailable; use Refresh.');render();}}catch(err){if(requestCompany===co&&requestActor===ABCentral.actor?.id){notice=success+' — '+t('تعذر تحديث الجدول؛ اضغط تحديث.','Table refresh unavailable; use Refresh.');render();}}}finally{button._saving=false;if(button.isConnected)button.disabled=false;if(sourceForm?.isConnected)sourceForm.inert=false;}
                    return;
                }
                if (action === 'journal-post') {
                    await api('journals/' + key + '/post', 'POST', {}, crypto.randomUUID());
                    await refresh();
                    return;
                }
                if (action === 'close-confirm') {
                    if(!report?.canClose)throw Error('closingChecklistIncomplete');const source=report,revision=closingInputRevision,locale=getLocale();await api(source.format==='AB-GROUP-CLOSE-SOURCE-1'?'group-close':'close', 'POST', source.format==='AB-GROUP-CLOSE-SOURCE-1'?{companyIds:source.companies,month:source.month,confirm:true}:{ companyId: co, month: source.month, confirm: true }, crypto.randomUUID());
                    if(revision!==closingInputRevision||locale!==getLocale())throw Error('staleSession');notice=t('تم حفظ إغلاق الفترة؛ لا يُعد إقراراً ضريبياً.','Period closing saved; this is not a tax return.');
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
                    if(!allowed('report')||!allowed('export'))throw Error('denied');
                    await loadReport('print');
                    return;
                }
                selected = key;
                if (action === 'intercompany-deposit')
                    dialog(t('تأكيد إيداع الشركة المستفيدة', 'Confirm beneficiary deposit'), action, [f('effectiveOn', 'تاريخ البنك', 'Bank date', 'date', now()), f('bankConfirmation', 'مرجع البنك', 'Bank confirmation'), proofField()]);
                if (action === 'statement-open') {
                    report = await api('statements/' + key);
                    const st = report.statement;
                    document.querySelector('#ld-dialog').innerHTML = '<h3>' + t('مراجعة الكشف', 'Statement review') + '</h3>' + table(report.lines, st.card_id?['line_no','effective_on','amount','matched_amount','remaining_amount','reference']:['id','effective_on','amount','reference','entry_id']) + form('statement-match', t('مطابقة السطر بالمستند الفعلي', 'Match statement line to actual document'), [f('lineId', 'السطر', 'Statement line', 'select', '', report.lines.map(r => ({ ...r, name: r.line_no + ' — ' + r.amount + ' — ' + r.reference }))), f('entryId', 'الحركة الفعلية', 'Actual ledger/charge', 'select', '', (st.card_id ? [...report.charges, ...(report.paymentVouchers || []).map(v => ({ ...v, id: 'voucher:' + v.id, amount: '-' + v.amount, reference: t('سداد بطاقة', 'Card payment') }))] : report.entries).map(r => ({ ...r, name: (r.reference || r.id) + ' — ' + (r.amount || r.debit + '/' + r.credit) })))]) + (report.issuerPaymentMatching&&st.status==='Review'?form('issuer-payment-match',t('مطابقة إثبات سداد البنك المصدر المستقل','Match independently verified issuer payment'),[f('lineId','سطر ائتمان البنك','Issuer credit line','select','',report.lines.filter(r=>String(r.amount).startsWith('-')).map(r=>({id:r.id,name:r.line_no+' — '+r.amount+' AED — '+r.reference}))),f('issuerPaymentReference','مرجع إثبات السداد المعتمد','Verified issuer payment reference')],undefined,null,btn('issuer-payment-review',t('مراجعة إثبات السداد','Review payment proof'),st.id)+'<p data-issuer-payment-review role="status"></p>'):'') + btn('statement-approve', t('اعتماد بعد زوال الفروقات', 'Approve after differences resolved'), st.id) + (st.card_id ? (book.finance_cards.find(c=>c.id===st.card_id)?.ownership==='personal_owner'?'<p>'+t('تسوية مستحقات المالك وتوقيعه مسار مستقل عن سداد البنك المصدر للبطاقة.','Owner reimbursement/signature is separate from payment to the card issuer.')+'</p>':form('card-vouchers', t('إنشاء سند صرف مجمع لكل شركة', 'Create consolidated voucher per company'), itemFields())) : '');
                    bind();
                    const issuerForm=document.querySelector('[data-ld-form=issuer-payment-match]');if(issuerForm){const invalidate=()=>{issuerForm._issuerReviewed=null;issuerForm.querySelector('[type=submit]').disabled=true;issuerForm.querySelector('[data-issuer-payment-review]').textContent='';};invalidate();issuerForm.addEventListener('input',invalidate);issuerForm.addEventListener('change',invalidate);}
                    return;
                }
                if(action==='issuer-payment-review'){const form=document.querySelector('[data-ld-form=issuer-payment-match]');if(!form?.reportValidity())return;const reference=form.elements.issuerPaymentReference.value.trim(),lineId=form.elements.lineId.value;button.disabled=true;try{const review=await api('card-statements/'+key+'/issuer-payment-review?'+new URLSearchParams({reference}));if(!form.isConnected||reference!==form.elements.issuerPaymentReference.value.trim()||lineId!==form.elements.lineId.value)return;if(review.alreadyMatched&&!review.sameStatement)throw Error('issuerPaymentAlreadyReconciled');form.querySelector('[data-issuer-payment-review]').textContent=review.reference+' · '+WorkspaceUI.date(review.paidOn)+' · '+review.amount+' AED · '+t('إثبات مستقل؛ لا قيد أو سند جديد.','Independent proof; no new journal or voucher.');form._issuerReviewed=lineId+':'+reference;form.querySelector('[type=submit]').disabled=false;}finally{if(button.isConnected)button.disabled=false;}return;}
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
                    dialog(t('تعديل بند مع حماية التصنيف المستخدم', 'Edit item with protected used mappings'), action, [f('nameAr', 'الاسم العربي', 'Arabic name', 'text', a.name_ar), f('nameEn', 'الاسم الإنجليزي', 'English name', 'text', a.name_en), f('active', 'نشط', 'Active', 'checkbox', a.active), f('recurringAmount', 'المبلغ الدوري المستقبلي', 'Future recurring amount', 'text', a.details.recurringAmount), f('taxRate', 'نسبة الضريبة', 'Tax rate', 'text', a.details.taxRate), f('taxAccountId', 'حساب الضريبة', 'Tax account', 'select', a.details.taxAccountId || '', defs(), false)]);
                }
                if (action === 'invoice-correct')
                    dialog(t('تصحيح الفاتورة دون حذف', 'Correct invoice without deletion'), action, [f('amount', 'مبلغ التصحيح', 'Correction amount'), f('effectiveOn', 'تاريخ القيد', 'Accounting date', 'date', now()), f('reason', 'السبب', 'Reason')]);
                if (action === 'receive')
                    dialog(t('المبلغ المستلم فعلياً فقط', 'Actual amount received only'), action, [f('actual', 'المستلم فعلياً', 'Actually received'), f('reason', 'تفاصيل الاستلام والفرق', 'Receipt/difference details')]);
                if (action === 'deposit-confirm')
                    dialog(t('تحقق يدوي من الإيصال والحساب والتاريخ', 'Manual evidence/account/date verification'), action, [f('confirmedAmount', 'المبلغ المؤكد فقط', 'Confirmed amount only'), f('effectiveOn', 'تاريخ البنك', 'Bank date', 'date', now()), f('bankConfirmation', 'مرجع التحقق البنكي', 'Bank verification reference'), f('accountAndDateVerified', 'تحققت من الحساب والتاريخ', 'Account and date verified', 'checkbox', false),f('receiptMismatchReason','سبب موثق لمعالجة اختلاف قراءة الإيصال — للمخول رقابياً فقط','Documented receipt-reading discrepancy reason — authorized control only','textarea','',null,false)]);
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
                if(action==='fund-review-config'){await PettyExpenseUI.configure(key,()=>load());return;}
                if (action === 'fund-spend'){
                    dialog(t('صرف ضمن التفويض — مراجعة بشرية للمستند', 'Delegated expense — human evidence review'), action, [...itemFields(), f('amount', 'المبلغ', 'Amount'), f('reason', 'السبب وأساس الاعتماد', 'Reason and approval basis'), f('effectiveOn', 'التاريخ', 'Date', 'date', now()),proofField()],'<div class="full"><button type="button" data-petty-review>'+t('قراءة المستند ومراجعة الفروق','Read evidence and review differences')+'</button><div data-petty-review-result role="status"></div></div>');
                    const form=document.querySelector('[data-ld-form=fund-spend]'),company=co,reviewButton=form.querySelector('[data-petty-review]');if(book.finance_funds.find(r=>r.id===key)?.kind==='petty')PettyExpenseUI.bindSpend(form,key,serialize,()=>load()).catch(show);reviewButton.onclick=async()=>{if(reviewButton.disabled)return;reviewButton.disabled=true;try{const d=serialize(form),r=await api('funds/'+key+'/receipt-review','POST',{documentVersionId:d.documentVersionId,amount:d.amount,effectiveOn:d.effectiveOn},crypto.randomUUID());if(!form.isConnected||company!==co)return;const target=form.querySelector('[data-petty-review-result]');target.innerHTML='<p>'+t('قراءة مقترحة فقط؛ لا اعتماد أو معالجة ضريبية تلقائية.','Advisory extraction only; no automatic approval or tax treatment.')+'</p>'+Object.entries(r.facts||{}).filter(([k,v])=>k!=='ambiguous'&&v!=null).map(([k,v])=>'<p>'+e(({amount:t('الإجمالي','Total'),taxAmount:t('الضريبة الظاهرة','Printed tax'),supplier:t('المورد','Supplier'),date:t('التاريخ','Date'),reference:t('مرجع الفاتورة','Invoice reference'),trn:'TRN'})[k]||k)+': '+e(v)+'</p>').join('')+'<p>'+t('فروق: ','Differences: ')+e(r.differences.map(k=>({amount:t('المبلغ','Amount'),date:t('التاريخ','Date'),taxAmount:t('الضريبة','Tax')})[k]||k).join('، ')||'—')+(r.duplicate?' · '+t('المستند مستخدم سابقاً؛ يمنع الصرف المكرر.','Evidence already used; duplicate spending is blocked.'):'')+'</p><p>'+t('بنود مقترحة للمراجعة: ','Suggested items for review: ')+e(r.suggestions.map(it=>getLocale()==='ar'?it.nameAr:it.nameEn).join('، ')||t('يلزم التصنيف اليدوي','Manual classification required'))+'</p><p>'+t('الأرصدة والتغذية لا تتغير بالقراءة. الغموض أو النقص يحتاج مراجعة المسؤول.','Extraction does not change balances or refill funds. Missing or ambiguous evidence requires supervisor review.')+'</p>';}catch(err){show(err);}finally{reviewButton.disabled=false;}};
                }
                if (action === 'fund-refill')
                    dialog(t('تغذية إلى السقف دون تكرار مصروف', 'Refill to ceiling without duplicate expense'), action, [f('sourceFundId', 'الصندوق المصدر', 'Source fund', 'select', '', book.finance_funds.filter(x => x.id !== key)), f('amount', 'مبلغ الإعادة إلى السقف', 'Amount restoring ceiling'), f('effectiveOn', 'التاريخ', 'Date', 'date', now()), f('reason', 'السبب', 'Reason')]);
                if (action === 'journal-reverse')
                    dialog(t('قيد عكسي يحفظ الأصل', 'Reversal preserving original'), action, [f('effectiveOn', 'تاريخ العكس', 'Reversal date', 'date', now()), f('reason', 'السبب', 'Reason')]);
                if (action === 'cheque-resolve')
                    dialog(t('نتيجة البنك الفعلية', 'Actual bank result'), action, [f('outcome', 'النتيجة', 'Outcome', 'select', 'Collected', choice(['Collected', 'Returned'])), f('effectiveOn', 'التاريخ', 'Date', 'date', now()), f('bankConfirmation', 'مرجع البنك', 'Bank confirmation'), f('reason', 'السبب', 'Reason')]);
                if(action==='personal-owner-balances'){const company=co,r=await api('cards/'+key+'/owner-balances');if(company!==co)return;document.querySelector('#ld-dialog').innerHTML='<h3>'+t('مستحقات المالك — أرصدة فعلية دون قبض جديد','Owner payables — actual balances without a new receipt')+'</h3>'+table(r.rows.map(row=>({companyName:getLocale()==='ar'?row.nameAr:row.nameEn,cardAttributedPayments:row.cardAttributedPayments,personalExcluded:row.personalExcluded,ownerPayableBalance:row.ownerPayableBalance})),['companyName','cardAttributedPayments','personalExcluded','ownerPayableBalance'])+'<p>'+t('الرصيد من أستاذ حساب المالك؛ المبالغ المنسوبة للبطاقة ليست مطالبة إضافية. طلب التسوية والعهدة مسار مستقل.','Balance is from the Owner payable ledger. Card attribution is not an additional claim. Reimbursement/custody remains a separate workflow.')+'</p>';return;}
                if(action==='wallet-config'||action==='wallet-consume'||action==='wallet-history'){
                 const scope=co,options=await api('owner-wallets/options?companyId='+co);if(scope!==co)return;const named=rows=>rows.map(r=>({id:r.id,name:getLocale()==='ar'?r.nameAr:r.nameEn}));
                 if(action==='wallet-history'){const result=await api('owner-wallets/consumption?companyId='+co);if(scope!==co)return;const rows=result.rows.map(r=>({reference:r.reference,occurredOn:r.occurredOn,amount:r.amount,status:r.invoiceId?t('ربط بالفاتورة الأصلية','Cleared against original invoice'):t('استهلاك بانتظار الفاتورة','Consumed, awaiting invoice')}));document.querySelector('#ld-dialog').innerHTML='<h3>'+t('استهلاك المحفظة — ليس قبضاً أو مستحقاً جديداً للمالك','Wallet consumption — no customer receipt or new Owner debt')+'</h3>'+table(rows,['reference','occurredOn','amount','status']);return;}
                 if(action==='wallet-config'){dialog(t('ربط مستقبلي لمحفظة مسبقة الدفع — دون ترحيل أرصدة','Prospective prepaid wallet mapping — no balance migration'),action,[f('walletDefinitionId','أصل المحفظة المعتمد','Reviewed prepaid wallet','select','',named(options.wallets)),f('unbilledDefinitionId','أصل مستقل جديد لمبالغ العملاء غير المفوترة','New dedicated unbilled customer recovery asset','select','',book.finance_accounts.filter(r=>r.kind==='asset').map(r=>({id:r.id,name:getLocale()==='ar'?r.name_ar:r.name_en}))),f('effectiveOn','تاريخ السريان المستقبلي','Prospective effective date','date',now()),proofField(),f('reason','أساس اعتماد الفصل المحاسبي','Accounting separation review'),f('confirm','أعتمد الربط للمستقبل ومنع الرصيد السالب؛ لا تعديل للتاريخ','Approve prospective mapping and no overdraft; history remains unchanged','checkbox',false)]);return;}
                 const configured=new Set(options.configurations.filter(r=>r.effectiveOn<=now()).map(r=>r.walletDefinitionId));dialog(t('استهلاك سالك فعلي — يفصل عن التعبئة والفاتورة','Actual toll consumption — separate from funding and invoicing'),action,[f('walletDefinitionId','المحفظة المعتمدة','Reviewed wallet','select','',named(options.wallets.filter(r=>configured.has(r.id)))),f('customerId','العميل المسؤول وقت الحركة','Customer responsible at transaction date','select','',customers),f('vehicleId','المركبة المسجلة','Registered vehicle','select','',vehicles),f('itemId','بند سالك الأصلي','Original toll item','select','',book.finance_items.filter(r=>r.category==='salik').map(r=>({id:r.id,name:getLocale()==='ar'?r.name_ar:r.name_en}))),f('reference','مرجع عملية سالك الفريد كما سيظهر في ملف الاستيراد','Unique toll reference matching the monthly source file'),f('occurredOn','تاريخ الاستهلاك الفعلي','Actual toll date','date',now()),f('amount','المبلغ الفعلي AED','Actual amount AED'),proofField(),f('reason','أساس المطابقة والمراجعة','Source matching and review basis'),f('actualConsumptionVerified','تحققت من الاستهلاك الفعلي والمستند ومسؤولية العميل','I verified actual consumption, evidence and customer responsibility','checkbox',false)]);return;
                }
                if(action==='owner-outlay-config'){const items=book.finance_items.filter(r=>r.active&&r.details.invoice&&r.details.receipt&&Number(r.details.taxRate||0)===0&&book.finance_accounts.some(a=>a.id===r.details.revenueId&&a.kind==='liability'));dialog(t('ربط مستقبلي فقط — دون اعتماد ضريبي أو ترحيل تاريخي','Prospective mapping only — no tax approval or historical migration'),action,[f('itemId','بند الاسترداد الأصلي — ليس إيراد مبيعات','Original recovery item — not sales revenue','select','',items),f('unbilledDefinitionId','أصل مستقل جديد للمدفوعات غير المفوترة','New dedicated unbilled outlay asset','select','',book.finance_accounts.filter(a=>a.active&&a.kind==='asset')),f('discountExpenseDefinitionId','مصروف الخصم عند التنازل عن مبلغ مدفوع فعلياً','Discount expense for an actual fronted recovery','select','',book.finance_accounts.filter(a=>a.active&&a.kind==='expense')),f('effectiveOn','تاريخ السريان','Effective date','date',now()),proofField(),f('reason','أساس مراجعة الربط ومصروف الخصم — لا استرداد ضريبي آلي','Mapping and discount expense basis — no automatic tax recovery'),f('confirm','راجعت الفصل بين الأصل وذمة المالك والعميل ومصروف الخصم','I reviewed separation of asset, Owner debt, customer AR and discount expense','checkbox',false)]);return;}
                if(action==='owner-outlay-history'){const company=co,r=await api('owner-customer-outlays?companyId='+co);if(company!==co)return;document.querySelector('#ld-dialog').innerHTML='<h3>'+t('مدفوعات فعلية قبل فوترة العميل — ليست قبضاً منه','Actual outlays before customer invoicing — not customer receipts')+'</h3>'+table(r.rows.filter(r=>r.cardId===key).map(r=>({...r,billingState:r.reviewRequired?t('فرق يحتاج مراجعة المصدر','Source reconciliation required'):r.invoiceId?t('ربطت بالفاتورة الأصلية','Linked to original invoice'):t('قيد الفوترة — أصل مستقل','Unbilled — separate asset')})),['reference','paidOn','amount','unbilledAmount','billingState']);return;}
                if(action==='personal-wallet'){dialog(t('أصل محفظة معتمد — لا تعبئة أو قيد عند الحفظ','Reviewed wallet asset — saving does not fund or post'),action,[f('definitionId','حساب أصل المحفظة المستقل','Dedicated wallet asset account','select','',book.finance_accounts.filter(r=>r.kind==='asset').map(r=>({id:r.id,name:getLocale()==='ar'?r.name_ar:r.name_en}))),f('reason','أساس مراجعة استقلال الحساب','Dedicated account review basis'),f('confirm','أؤكد مراجعة الحساب واستقلاله عن النقد والذمم','I reviewed separation from cash and receivables','checkbox',false)]);return;}
                if(action==='card-charge'&&book.finance_cards.find(r=>r.id===key)?.ownership==='personal_owner'){await personalCardDialog(key);return;}
                if (action === 'card-charge')
                    dialog(t('مصروف بطاقة وتوزيع متوازن', 'Card charge with balanced allocation'), action, [f('amount', 'إجمالي العملية', 'Transaction total'), f('paidOn', 'تاريخ الدفع', 'Payment date', 'date', now()), f('reference', 'المرجع الفريد', 'Unique reference'), f('beneficiary', 'الجهة المستفيدة', 'Merchant')], '<div class="full">' + [0, 1, 2].map(i => '<fieldset class="ld-row"><legend>' + t('توزيع ', 'Split ') + (i + 1) + '</legend>' + [f('splitCompany' + i, 'الشركة', 'Company', 'select', i === 0 ? co : '', cap.companies, i === 0), f('splitItem' + i, 'البند', 'Item', 'select', '', book.finance_items, i === 0), f('splitAmount' + i, 'المبلغ', 'Amount', 'text', '', null, i === 0), f('splitCustomer' + i, 'العميل (إن انطبق)', 'Customer (if applicable)', 'select', '', customers, false), f('splitVehicle' + i, 'المركبة', 'Vehicle', 'select', '', vehicles, false), f('splitInvoice' + i, 'مرجع فاتورة قائمة', 'Existing invoice reference', 'text', '', null, false), f('splitDueTo' + i, 'حساب مستحق للجهة المالكة للبطاقة', 'Due-to issuer account', 'text', '', null, false), f('splitDueFrom' + i, 'حساب مستحق من الشركة المستفيدة', 'Issuer due-from account', 'text', '', null, false)].map(x => field(x, action)).join('') + '</fieldset>').join('') + '</div>');
                if(action==='card-statement-import'){await CardStatementImportUI.open(key,docs,async()=>{if(allowed('reconcile'))tab='reconciliation';await load();},co);return;}
                if (action === 'card-statement')
                    dialog(t('كشف بطاقة — قراءة يدوية آمنة عند غياب OCR', 'Card statement — safe manual review without OCR'), action, [f('periodFrom', 'من', 'From', 'date', now().slice(0, 7) + '-01'), f('periodTo', 'إلى', 'To', 'date', now()), f('openingBalance', 'الافتتاحي', 'Opening', 'text', '0'), f('closingBalance', 'الختامي', 'Closing'), proofField(), f('csv', 'الحركات CSV: date,amount,reference', 'Rows CSV: date,amount,reference', 'textarea')]);
                if (action === 'card-details') {
                    const details = await api('card-charges/' + key);
                    document.querySelector('#ld-dialog').innerHTML = table(details.splits.map((r,i)=>({...r,splitNumber:i+1,customerName:r.customer_name,companyName:cap.companies.find(c=>c.id===r.company_id)?.[getLocale()==='ar'?'arabicName':'englishName']||'',vehicleNumber:r.vehicle_number||'—',invoiceNumber:r.invoice_number?'INV-'+r.invoice_number:'—'})), ['splitNumber','companyName','customerName','vehicleNumber','amount','invoiceNumber'], r => r.customer_id && !r.invoice_id ? btn('card-link', t('ربط الفاتورة المطلوبة', 'Link required invoice'), r.id) : '');
                    bind();
                }
                if (action === 'card-link'){const choices=await api('card-splits/'+key+'/invoice-options');dialog(t('ربط الفاتورة الأصلية المطابقة — دون إنشاء فاتورة ثانية','Link matching original invoice — no second invoice'),action,[f('invoiceSearch','بحث برقم الفاتورة عند الحاجة','Find invoice by number if needed','search','',null,false),f('invoiceId','الفاتورة الأصلية للشركة والعميل والمبلغ نفسه','Original invoice for the same company, customer and amount','select','',choices.rows.map(r=>({id:r.id,name:'INV-'+r.number+' — '+r.amount+' AED'})))]);const form=document.querySelector('[data-ld-form=card-link]');let timer,sequence=0;form.elements.invoiceSearch.oninput=()=>{clearTimeout(timer);const query=form.elements.invoiceSearch.value.trim().replace(/^INV-/i,'');if(query&&!/^\d{1,18}$/.test(query))return;timer=setTimeout(async()=>{const n=++sequence;try{const result=await api('card-splits/'+key+'/invoice-options'+(query?'?q='+encodeURIComponent(query):''));if(!form.isConnected||selected!==key||n!==sequence)return;form.elements.invoiceId.innerHTML=opts(result.rows.map(r=>({id:r.id,name:'INV-'+r.number+' — '+r.amount+' AED'})),'');}catch(err){if(form.isConnected)show(err);}},350);};} 
            }
            catch (err) {
                if (err.message !== 'staleSession')
                    show(err);
            } finally {FinancialTables.bind(document.querySelector('.ld-section'),bindRegisterActions);}
        });FinancialPackageUI.bind(packageContext());}
 function bind() {
        if (app.state.currentPage !== 'financialManagement')
            return;
        document.getElementById('ld-company')?.addEventListener('change', async (ev) => { epoch++; busy = false; co = ev.target.value; context = null; report = null;closingInputRevision++;reportInputRevision++; preview = null; importJob=null; importInputRevision++;notice=''; drafts = {}; bills = []; await refresh(); });
        FinancialTables.bind(document.querySelector(".ld-section"),bindRegisterActions);
        bindForms();
        bindRegisterActions();
        FinancialPackageUI.bind(packageContext());
        WorkspaceUI.enhance();
        if(tab==='receivables')ReceivablesUI.bind();
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
    root.LedgerUI = {openOwnerSettlements:async(companyId)=>{if(actor!==ABCentral.actor?.id){reset();actor=ABCentral.actor?.id;}context={companyId};co=companyId;tab='owner-settlements';app.state.currentPage='financialManagement';await load();context=null;},openReceivables:async(customerId,sourceScroll=0)=>{if(actor!==ABCentral.actor?.id){reset();actor=ABCentral.actor?.id;}context=null;ReceivablesUI.prepare(customerId,sourceScroll);tab='receivables';app.state.currentPage='financialManagement';await load(true);},openVouchers:async(companyId)=>{if(actor!==ABCentral.actor?.id){reset();actor=ABCentral.actor?.id;}context={companyId};co=companyId;tab='vouchers';app.state.currentPage='financialManagement';await load();context=null;}, openNotification: async (companyId) => { if(actor!==ABCentral.actor?.id){reset();actor=ABCentral.actor?.id;}context={companyId};co = companyId; tab = 'dashboard'; app.state.currentPage = 'financialManagement'; await load();context=null; }, render: renderPage, bind, reset, openCollection, canEnter: () => ABCentral?.enabled && (getCurrentUser()?.roleId === 'owner' || (ABCentral.grants || []).some(g => g.userId === ABCentral.actor?.id && g.entry?.action?.startsWith('ledger_'))) };
})(globalThis);
