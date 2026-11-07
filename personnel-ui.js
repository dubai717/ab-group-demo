/* Personnel drafts remain in memory. All permissions and saves are checked by the server. */
(function (root) {
    'use strict';
    let taskOverdueOnly=false;
    let filters={employeeIds:null,search:'',companyIds:[],departmentId:'',managerId:'',state:'',jobTitle:''};
    let photoUrl='',photoKey='',registerVisibleIds=null;
    let tablePrefs={};
    let evaluationMonth='',evaluationCompany='',evaluationBoard=[],runRows=[],payrollMonth='';
    let modelCount=1;
    let dashboard = null, admin = null, cap = null, people = null, tasks = [], library = [], selected = null, section = 'employees', panel = 'profile', co = '', actor = '', epoch = 0, busy = false, error = '', success = '', dialog = null, draft = {};
    const t = (a, b) => getLocale() === 'ar' ? a : b, e = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), now = () => new Date().toISOString().slice(0, 10), month = () => now().slice(0, 7) + '-01';
    const words = { employees: ['شؤون الموظفين', 'Personnel'], tasks: ['مهامي', 'My tasks'], library: ['المكتبة المركزية', 'Central library'], profile: ['ملف الموظف', 'Employee profile'], documents: ['الوثائق', 'Documents'], leaves: ['الإجازات', 'Leave'], evaluation: ['تقييم الأداء', 'Performance'], payroll: ['الرواتب', 'Payroll'], clearance: ['نهاية الخدمة والعهد', 'End of service & custody'] };
    const title = k => words[k] ? t(...words[k]) : k, button = (action, label, key = '') => `<button type="button" class="secondary-btn" data-hr="${e(action)}" data-id="${e(key)}">${e(label)}</button>`, rights = r => selected?.rights?.includes('hr_' + r), options = rows => rows.map(r => ({ id: r.id, name: r.name || r.nameEn || r.englishName || r.name_en || r.username || r.title || r.id }));
    function reset() { epoch++;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl=photoKey='';registerVisibleIds=null;evaluationMonth=evaluationCompany='';evaluationBoard=[];runRows=[];payrollMonth='';tablePrefs={};taskOverdueOnly=false;filters={employeeIds:null,search:'',companyIds:[],departmentId:'',managerId:'',state:'',jobTitle:''}; cap = people = selected = admin = dashboard = null; tasks = []; library = []; actor = ''; co = ''; busy = false; error = success = ''; dialog = null; draft = {}; section = 'employees'; panel = 'profile'; }
    async function api(path, method = 'GET', body, key) { const n = epoch, u = ABCentral.actor?.id, r = await ABCentral.api('personnel/' + path, method, body, key); if (n !== epoch || u !== ABCentral.actor?.id)
        throw Error('staleSession'); return r; }
    function redraw() { if (app.state.currentPage === 'personnel' || app.state.currentPage === 'tasks')
        render(); }
    async function load() { if (busy)
        return; busy = true; const n = epoch; try {
        cap = await api('capabilities');
        if (cap.available) {
            people = await api('employees');
            dashboard = await api('dashboard');
            tasks = (await api('tasks')).rows.map(r => ({ ...r, title: r.payload?.title }));
            library = (await api('library')).rows;
            if(selected){const id=selected.id,result=await api('employees/'+id);if(selected?.id===id){selected=result;await loadPhoto(selected);}}
            co = co || cap.companies[0]?.id || '';
            if (co)
                try {
                    admin = await api('company/' + co);
                }
                catch {
                    admin = null;
                }
        }
        if(cap?.available&&section==='evaluations'){evaluationBoard=[];evaluationBoard=(await api('evaluations?'+new URLSearchParams({month:evaluationMonth||month(),...(evaluationCompany?{companyId:evaluationCompany}:{})}))).rows;}if(cap?.available&&section==='payrollRun'&&co){runRows=[];runRows=(await api('payroll-run?'+new URLSearchParams({companyId:co,month:payrollMonth||month()}))).rows;}
        error = '';
    }
    catch (err) {
        if (err.message !== 'staleSession')
            error = err.message;
    }
    finally {
        if (n === epoch) {
            busy = false;
            redraw();
        }
    } }
    const field = (name, ar, en, type = 'text', value = '', opts = null, required = true) => ({ name, label: t(ar, en), type, value, opts, required });
    function fields(defs) { return defs.map(f => { const v = draft[f.name] ?? f.value, req = f.required && f.type!=='checkbox' && !(f.type==='file'&&dialog?.files?.[f.name]) ? 'required' : ''; return `<label>${e(f.label)}${f.required ? ' *' : ''}${f.opts ? `<select class="input" name="${e(f.name)}" ${f.type==='multiselect'?'multiple':''} ${req}>${f.type==='multiselect'?'':'<option value="">—</option>'}${f.opts.map(o => `<option value="${e(o.id)}" ${(Array.isArray(v)?v.includes(o.id):String(o.id)===String(v))?'selected':''}>${e(o.name)}</option>`).join('')}</select>` : f.type === 'checkbox' ? `<input type="checkbox" name="${e(f.name)}" ${v ? 'checked' : ''} />` : f.type === 'textarea' ? `<textarea class="input" name="${e(f.name)}" ${req}>${e(v)}</textarea>` : `<input class="input" type="${f.type}" name="${e(f.name)}" value="${f.type === 'file' ? '' : e(v)}" ${f.type === 'file' ? 'accept=".pdf,.png,.jpg,.jpeg"' : ''} ${req}>`}</label>`; }).join(''); }
    function form(name, ar, en, defs, save) { success = '';
        dialog = { name, label: t(ar, en), defs, save, key: crypto.randomUUID(),files:{} }; draft = {}; redraw(); }
    const choices = vs => vs.map(v => ({ id: v, name: v })), companyField = () => field('companyId', 'الشركة', 'Company', 'text', selected?.companyId || co, options(cap.companies)), employeeField = (name = 'employeeId') => field(name, 'الموظف', 'Employee', 'text', selected?.id || '', options(people?.rows || []));
    function table(rows,columns,actions=()=>'',attrs=''){const key='personnel:'+section+':'+panel+':'+(selected?.id||'')+':'+columns.map(c=>c[0]).join(','),types=Object.fromEntries(columns.map(([col])=>[col,/^(number|task_number|level|score|net|basic|allowances|amount)$/.test(col)?'number':/(_on|_at)$/.test(col)?'date':'text'])),snapshot=RegisterView.select(key,rows,columns.map(c=>c[0]),{query:filters.search,types,search:r=>r}),filtered=snapshot.rows;if(attrs.includes('hr-register'))registerVisibleIds=filtered.map(r=>r.id);return `<div class="table-wrap" data-register-view="${e(key)}"><table class="data-table" ${attrs}><thead><tr>${columns.map(([col,label])=>`<th>${RegisterTools.head(col,label,snapshot.facets[col]||[],snapshot.state,undefined,types[col])}</th>`).join('')}<th>${t('الإجراءات','Actions')}</th></tr></thead><tbody>${filtered.map(r=>`<tr>${columns.map(([col])=>`<td>${e(r[col] instanceof Object?JSON.stringify(r[col]):r[col])}</td>`).join('')}<td>${actions(r)}</td></tr>`).join('')||`<tr><td colspan="${columns.length+1}">${t('لا توجد سجلات ضمن صلاحياتك','No records within your permissions')}</td></tr>`}</tbody></table></div>`;}
    function taskTable() { return button('new-task', t('إضافة مهمة', 'Add task')) + button('refresh', t('تحديث', 'Refresh')) + table(taskOverdueOnly?tasks.filter(r=>!['Completed','Closed'].includes(r.state)&&r.due_on.slice(0,10)<now()):tasks, [['task_number', t('الرقم', 'Number')], ['title', t('المهمة', 'Task')], ['state', t('الحالة', 'State')], ['due_on', t('الاستحقاق', 'Due')], ['level', t('التصعيد', 'Escalation')]], r => (r.source_type==='collection_invoice'?button('collection-attempt',t('متابعة التحصيل','Collection follow-up'),r.id):'') + (!['Completed', 'Closed'].includes(r.state) ? [r.state === 'Open' ? button('task-start', t('بدء', 'Start'), r.id) : '', r.state !== 'Review' ? button('task-submit', t('إرسال للمراجعة', 'Submit for review'), r.id) : button('task-complete', t('تحقق وإنهاء', 'Verify & complete'), r.id), button('task-reassign', t('إعادة إسناد', 'Reassign'), r.id)].join('') : button('task-history', t('السجل', 'History'), r.id))); }
    function filteredPeople(){return (people?.rows||[]).filter(r=>!Array.isArray(filters.employeeIds)||filters.employeeIds.includes(r.id)).map(r=>({...r,companyNames:(r.companyIds||[r.companyId]).map(id=>cap.companies.find(c=>c.id===id)?.name||id).join(' · '),departmentName:people.departments?.find(d=>d.id===r.departmentId)?.name||'',managerName:people.users?.find(u=>u.id===r.managerId)?.name||r.managerId||''}));}
    async function loadPhoto(p){const version=p.documents?.rows?.find(r=>r.kind==='photo'&&r.state==='Approved'&&r.scan_status==='clean'),key=p.id+':'+(version?.version_id||'');if(photoKey===key)return;if(photoUrl)URL.revokeObjectURL(photoUrl);photoUrl='';photoKey=key;if(!version)return;try{const file=await api('employees/'+p.id+'/documents/'+version.version_id);if(selected?.id!==p.id)return;if(!['image/png','image/jpeg'].includes(file.mime))return;photoUrl=URL.createObjectURL(new Blob([Uint8Array.from(atob(file.base64),c=>c.charCodeAt(0))],{type:file.mime}));}catch(err){if(err.message==='staleSession')throw err;}}
    function detail() { if (!selected)
        return ''; const p = selected, nav = people.rows, idx = nav.findIndex(r => r.id === p.id); return `<div class="content-panel"><div class="hr-toolbar">${button('back', t('سجل الموظفين', 'Staff register'))}${idx > 0 ? button('open', t('السابق', 'Previous'), nav[idx - 1].id) : ''}${idx < nav.length - 1 ? button('open', t('التالي', 'Next'), nav[idx + 1].id) : ''}<label>${t('انتقال إلى رقم', 'Jump to number')}<input id="hr-jump" class="input" inputmode="numeric"></label>${button('jump', t('فتح', 'Open'))}</div>${photoUrl?`<img class="hr-photo" src="${e(photoUrl)}" alt="${e(t('الصورة الشخصية','Profile photo'))}" width="96" height="96">`:''}<h2>#${e(p.number)} · ${e(getLocale() === 'ar' ? p.nameAr : p.nameEn)}</h2><div class="hr-toolbar">${Object.keys(words).filter(k => !['employees', 'tasks', 'library'].includes(k)).map(k => button('panel', title(k), k)).join('')}</div>${panel === 'profile' ? `<p>${t('حالة حساب الدخول','Login account state')}: ${e(p.loginAccount?.status||t('غير مرتبط','Not linked'))}</p><dl class="hr-details">${['nameAr', 'nameEn', 'jobTitle', 'hiredOn', 'state', 'phone', 'email', 'nationality'].map(k => `<div><dt>${e(labels[k] || k)}</dt><dd>${e(p[k])}</dd></div>`).join('')}</dl>${rights('edit') ? button('edit', t('تعديل ملف الموظف', 'Edit profile')) + button('assignment', t('إضافة ارتباط بشركة', 'Add company assignment')) : ''}${rights('private') ? button('private', t('الهوية والعقد', 'Identity & contract')) : ''}${rights('account_status') && p.userId ? button('account', t('حالة حساب الدخول', 'Login account state')) : ''}${table(p.assignments, [['company_id', t('الشركة', 'Company')], ['job_title', t('الوظيفة', 'Job')], ['effective_on', t('من', 'From')], ['until_on', t('إلى', 'To')]],r=>rights('evaluation_weights')?button('job-weights',t('أوزان الوظائف','Job weights'),r.company_id):'')}` : panel === 'documents' ? `${p.documents ? `<p>${t('اكتمال الملف', 'File completeness')}: ${e(p.documents.completeness)}%</p>${button('document', t('إضافة وثيقة أو إصدار', 'Add document/version'))}${table(p.documents.rows.map(r => ({ ...r, title: r.payload.title, versionId: r.version_id })), [['kind', t('النوع', 'Kind')], ['title', t('العنوان', 'Title')], ['state', t('المراجعة', 'Review')], ['scan_status', t('الفحص', 'Scan')], ['expires_on', t('الانتهاء', 'Expiry')]], r => button('download', t('تنزيل', 'Download'), r.versionId) + (rights('document_review') && r.state === 'Submitted' ? button('document-review', t('مراجعة', 'Review'), r.versionId) : ''))}` : t('لا توجد صلاحية للاطلاع على الوثائق', 'Document access is restricted')}` : panel === 'leaves' ? `${button('leave', t('طلب إجازة', 'Request leave'))}${rights('edit') ? button('balance', t('تسجيل رصيد موثق', 'Record evidenced balance')) : ''}<p>${t('الرصيد', 'Balance')}: ${e(p.balance)}</p>${table(p.leaves, [['kind', t('النوع', 'Kind')], ['starts_on', t('من', 'From')], ['ends_on', t('إلى', 'To')], ['state', t('الحالة', 'State')]], r => r.state === 'Requested' ? button('leave-decision', t('قرار المسؤول المباشر', 'Direct manager decision'), r.id) : r.state === 'Returned' ? button('leave-resubmit', t('تعديل وإعادة إرسال', 'Edit & resubmit'), r.id) : '')}` : panel === 'evaluation' ? `${button('evaluation', t('معاينة من الأحداث الفعلية', 'Preview actual evidence'))}${rights('evaluation_weights')?button('job-weights',t('أوزان الوظائف المتعددة','Multiple-job weights'),p.companyId):''}${rights('evaluation_visibility')?button('visibility',t('ظهور التقييم للموظف','Employee evaluation visibility')):''}${rights('evaluation_visibility')?button('visibility',t('ظهور التقييم للموظف','Employee evaluation visibility')):''}${rights('evaluation_models') ? button('model', t('نسخة نموذج التقييم', 'Evaluation model version')) : ''}${rights('evaluation_approve') ? button('review', t('اعتماد شهر منتهٍ', 'Approve ended month')) : ''}${rights('coaching') ? button('coaching', t('جلسة أو نتيجة تأهيل', 'Coaching session/outcome')) : ''}${table(p.reviews || [], [['month', t('الشهر', 'Month')], ['score', t('الدرجة / 10000', 'Score / 10000')]])}` : panel === 'payroll' ? `${rights('salary_edit') ? button('compensation', t('نسخة الراتب والتوزيع', 'Compensation version & allocation')) : ''}${rights('awards') || rights('deductions') ? button('decision', t('مكافأة أو خصم قانوني', 'Award or legal deduction')) : ''}${rights('payroll_prepare') ? button('payroll', t('إعداد مسير شهر', 'Prepare monthly payroll')) : ''}${table((p.compensation||[]).map(r=>({...r,basic:r.payload.basic,allowances:r.payload.allowances})),[['effective_on',t('سريان نسخة الراتب','Compensation effective date')],['basic',t('الأساسي','Basic')],['allowances',t('البدلات الثابتة','Fixed allowances')],['currency',t('العملة','Currency')]])}${table(p.payroll || [], [['month', t('الشهر', 'Month')], ['net', t('الصافي', 'Net')], ['state', t('الحالة', 'State')], ['voucher_id', t('سند الصرف', 'Payment voucher')]], r => r.state === 'Draft' && rights('payroll_approve') ? button('payroll-approve', t('اعتماد واستحقاق مالي', 'Approve & accrue'), r.id) : '')}${table((p.decisions||[]).map(r=>({...r,effectiveState:r.voided?t('ملغى بقرار لاحق','Cancelled by later decision'):r.kind==='void'?t('قرار إلغاء','Cancellation record'):r.state})), [['kind', t('النوع', 'Kind')], ['amount', t('القيمة', 'Amount')], ['effectiveState', t('الحالة', 'State')]], r => r.state==='Requested'?button('decision-approve',t('اعتماد','Approve'),r.id):r.state==='Approved'&&r.kind!=='void'&&!r.voided&&!r.consumed?button('decision-void',t('إلغاء بقرار موثق قبل الصرف','Cancel by evidenced decision before payroll'),r.id):'')}` : `${p.endOfService ? button('eos', t('حساب تقديري لنهاية الخدمة', 'End of service estimate')) + button('eos-history', t('تاريخ التقديرات', 'Estimate history')) : ''}${rights('clearance') ? button('clearance', t('فحص إخلاء الطرف', 'Check clearance')) + button('asset', t('تسجيل عهدة أو إعادتها', 'Record/return asset')) + (rights('reserve') ? button('provision', t('قيد مخصص محاسبي موثق', 'Evidenced accounting provision')) : '') : ''}${rights('termination') ? button('termination', t('طلب إنهاء خدمة', 'Termination request')) : ''}<p>${t('لا يتم صرف أو إنهاء أو خصم تلقائياً. يلزم تحقق مالي ومراجعة قانونية.', 'No automatic payment, termination or deduction. Financial verification and legal review are required.')}</p>`}</div>`; }
    const labels = { nameAr: 'الاسم بالعربية / Arabic name', nameEn: 'الاسم بالإنجليزية / English name', jobTitle: 'الوظيفة / Job title', hiredOn: 'التعيين / Hire date', state: 'الحالة / State', phone: 'الهاتف / Phone', email: 'البريد / Email', nationality: 'الجنسية / Nationality' };
    function renderUI(forceTasks = false) {
        if (!ABCentral?.enabled)
            return `<div class="content-panel">${t('شؤون الموظفين المركزية تتطلب Backend؛ لم تُنقل بيانات المتصفح.', 'Central personnel requires Backend; browser data has not been migrated.')}</div>`;
        if (actor !== ABCentral.actor?.id) {
            reset();
            actor = ABCentral.actor?.id || '';
        }
        if (!cap && !busy)
            queueMicrotask(load);
        if (!cap)
            return `<div class="content-panel">${e(error || t('جار التحميل…', 'Loading…'))}</div>`;
        if (!cap.available)
            return `<div class="content-panel" data-hr-pending>${t('الترحيل 013 غير مطبق؛ تبقى الوظائف السابقة متاحة.', 'Migration 013 is not applied; previous functionality remains available.')}</div>`;
        if(!people)return `<div class="content-panel" role="alert">${e(error||t('تعذر تحميل السجل','Register could not be loaded'))}${button('refresh',t('إعادة المحاولة','Retry'))}</div>`;const view = forceTasks ? 'tasks' : section;
        return `<section id="personnel-workspace"><div class="hr-toolbar">${Object.keys(words).slice(0, 3).map(k => button('section', title(k), k)).join('')}${button('evaluations',t('لوحة تقييم الإدارة','Management evaluation board'))}${button('payrollRun',t('مسير رواتب الشركة','Company payroll'))}${button('administration', t('الإعدادات والمتابعات', 'Settings & follow-up'))}${button('export', t('تصدير Excel', 'Export Excel'))}${button('refresh', t('تحديث', 'Refresh'))}</div><p role="status">${e(success)}</p>${error ? `<p role="alert">${e(error)}</p>` : ''}<label>${t('البحث المركزي','Central search')}<input id="hr-search" type="search" class="input" value="${e(filters.search)}"></label>${view==='evaluations'?evaluationView():view==='payrollRun'?payrollRun():view === 'administration' ? administration() : view === 'tasks' ? taskTable() : view === 'library' ? `${button('library-new', t('إضافة سجل مكتبة', 'Create library record'))}${table(library, [['category', t('التصنيف', 'Category')], ['title', t('العنوان', 'Title')]], r => button('library-file', t('إضافة إصدار', 'Add version'), r.id) + (r.versions||[]).map(v=>button('library-download-version',t('تنزيل إصدار ','Download version ')+v.version+' · '+v.scan_status,r.id+'/'+v.version_id)).join(''))}<p>${t('لا يتطلب إقرار قراءة ولا يدخل في التقييم.', 'No reading acknowledgement; excluded from performance scoring.')}</p>` : selected ? detail() : `${dashboard ? `<div class="stats-grid"><button type="button" class="stat-card" data-hr="metric-employees">${t('موظفون مستقلون', 'Unique staff')}: ${e(dashboard.employees)}</button><button type="button" class="stat-card" data-hr="metric-tasks">${t('مهام متأخرة', 'Overdue tasks')}: ${e(dashboard.overdueTasks)}</button><button type="button" class="stat-card" data-hr="metric-documents">${t('ملفات غير مكتملة', 'Incomplete files')}: ${e(dashboard.incompleteFiles)}</button><button type="button" class="stat-card" data-hr="metric-leaves">${t('طلبات إجازة', 'Leave requests')}: ${e(dashboard.leaves)}</button></div>` : ''}${dashboard?.liabilityByCurrency?.length?button('metric-eos',t('التزامات تقديرية لنهاية الخدمة حسب الشركة والعملة','Estimated end of service liabilities by company & currency')):''}${button('new', t('إضافة موظف', 'Add employee'))}${button('delegation', t('تفويض مهام تشغيلية', 'Delegate operational tasks'))}${button('followup', t('معالجة المتابعات', 'Process follow-up'))}${table(filteredPeople(), [['number', t('الرقم', 'Number')], ['nameAr', t('الاسم', 'Name')], ['jobTitle', t('الوظيفة', 'Job')], ['state', t('الحالة', 'State')],['companyNames',t('الشركات','Companies')],['departmentName',t('الإدارة','Department')],['managerName',t('المسؤول المباشر','Direct manager')]], r => button('open', t('فتح', 'Open'), r.id), 'id="hr-register"')}`}${dialog ? `<div class="content-panel"><h3>${e(dialog.label)}</h3><form id="hr-form" class="form-grid">${fields(dialog.defs)}${dialog.name==='model'?button('model-add',t('إضافة معيار','Add criterion'))+button('model-remove',t('إزالة آخر معيار','Remove last criterion')):''}<button type="submit" class="primary-btn">${t('حفظ البيانات', 'Save data')}</button>${button('cancel', t('إلغاء', 'Cancel'))}<p role="alert" id="hr-form-error"></p></form></div>` : ''}<div id="hr-result"></div></section>`;
    }
    function showResult(value){const labels={available:['متاح','Available'],gross:['الاستحقاق الإجمالي التقديري','Estimated gross entitlement'],remaining:['المتبقي','Remaining'],settled:['المدفوع فعلياً','Actually settled'],currency:['العملة','Currency'],estimate:['تقدير يحتاج مراجعة','Estimate requiring review'],reason:['السبب','Reason'],score:['الدرجة من 10000','Score /10000'],models:['النماذج والمعايير','Models & criteria'],criteria:['المعايير والأدلة','Criteria & evidence'],sourceIds:['مراجع الأدلة','Evidence references'],sources:['الأحداث الفعلية','Actual events'],actorId:['منفذ الحدث','Event actor'],createdAt:['تاريخ التسجيل','Recorded at'],sourceKey:['مرجع العملية','Operation reference'],custody:['العهد النقدية والشيكات','Cash & cheque custody'],heldFunds:['الصناديق والعهد المستديمة','Held funds & petty cash'],assets:['العهد العينية','Assigned assets'],tasks:['المهام المفتوحة','Open tasks'],unpaidPayroll:['الرواتب غير المسددة','Unpaid payroll'],financiallyClear:['اكتمال الإخلاء المالي','Financial clearance complete'],automaticKeyAttribution:['ربط المفاتيح آلياً','Automatic key attribution'],requiresManualLegalAndKeyReview:['تلزم مراجعة قانونية ومراجعة المفاتيح','Legal and key review required'],unrecordedPayrollRequiresLegalReview:['تلزم مراجعة أي رواتب غير مسجلة','Unrecorded payroll requires review'],openRecoveries:['مهام استرداد مفتوحة','Open recovery tasks'],payload:['تفاصيل السجل','Record details'],kind:['نوع الحدث','Event kind'],month:['الشهر','Month'],before:['قبل التعديل','Before'],after:['بعد التعديل','After']},html=(v,depth=0)=>{if(v===null||v===undefined)return e(t('غير متاح','Not available'));if(typeof v==='boolean')return e(v?t('نعم','Yes'):t('لا','No'));if(typeof v!=='object')return e(v);if(depth>6)return e(t('تفاصيل إضافية محفوظة في السجل','Further details retained in the record'));if(Array.isArray(v))return v.length?v.map((item,i)=>`<details ${depth<1?'open':''}><summary>${t('سجل','Record')} ${i+1}</summary>${html(item,depth+1)}</details>`).join(''):e(t('لا توجد سجلات','No records'));return '<dl class="hr-details">'+Object.entries(v).map(([key,item])=>`<div><dt>${e(labels[key]?t(...labels[key]):key.replace(/([A-Z])/g,' $1'))}</dt><dd>${html(item,depth+1)}</dd></div>`).join('')+'</dl>';};const target=document.querySelector('#hr-result');if(target)target.innerHTML=html(value);}
    function evaluationView(){return `<div class="hr-toolbar"><label>${t('الشهر','Month')}<input id="hr-evaluation-month" class="input" type="date" value="${e(evaluationMonth||month())}"></label><label>${t('الشركة','Company')}<select id="hr-evaluation-company" class="input"><option value="">${t('جميع الشركات','All companies')}</option>${options(cap.companies).map(r=>`<option value="${e(r.id)}" ${r.id===evaluationCompany?'selected':''}>${e(r.name)}</option>`).join('')}</select></label></div>${table(evaluationBoard.map(r=>({...r,companyName:cap.companies.find(co=>co.id===r.companyId)?.englishName||r.companyId,departmentName:people.departments.find(d=>d.id===r.departmentId)?.name||''})),[['number',t('الرقم','Number')],['nameAr',t('الموظف','Employee')],['companyName',t('الشركة','Company')],['departmentName',t('الإدارة الحالية إن كانت متاحة','Current department if available')],['jobTitle',t('الوظائف في الفترة','Jobs in period')],['currentScore',t('التقييم الحالي /100','Current /100')],['previousScore',t('السابق /100','Previous /100')],['trend',t('الاتجاه','Trend')],['coaching',t('جلسات التوجيه','Coaching sessions')]],r=>button('open',t('الملف والأدلة','Profile & evidence'),r.id))}`;}
    function payrollRun(){return `<div class="content-panel"><div class="hr-toolbar"><label>${t('الشركة','Company')}<select id="hr-run-company" class="input">${options(cap.companies).map(r=>`<option value="${e(r.id)}" ${r.id===co?'selected':''}>${e(r.name)}</option>`).join('')}</select></label><label>${t('أول يوم من الشهر','First day of month')}<input id="hr-run-month" class="input" type="date" value="${e(payrollMonth||month())}"></label>${button('run-prepare',t('إعداد مسير للشركة','Prepare company payroll'))}${button('run-approve',t('اعتماد الكشوف المحددة','Approve selected slips'))}</div>${table(runRows,[['employee_number',t('الرقم','Number')],['employee',t('الموظف','Employee')],['currency',t('العملة','Currency')],['net',t('الصافي','Net')],['state',t('الحالة','State')],['voucher_id',t('سند الصرف','Payment voucher')]],r=>button('open',t('ملف الموظف','Employee profile'),r.employee_id))}<p>${t('اعتماد المسير ينشئ استحقاقاً وسنداً واحداً لكل موظف. الصرف الفعلي يبقى في الإدارة المالية.','Approval creates accrual and one voucher per employee. Actual settlement remains in Finance.')}</p></div>`;}
    function administration() { return `<div class="content-panel"><label>${t('الشركة', 'Company')}<select id="hr-admin-company" class="input">${options(cap.companies).map(r => `<option value="${e(r.id)}" ${r.id === co ? 'selected' : ''}>${e(r.name)}</option>`).join('')}</select></label>${!admin ? t('لا توجد صلاحية إدارية ضمن الشركة.', 'No administrative permission within this company.') : `<div class="hr-toolbar">${button('job-visibility',t('ظهور التقييم حسب الوظيفة','Evaluation visibility by job'))}${admin.config ? button('settings', t('إعدادات وربط مالي', 'Settings & financial mapping')) : ''}${admin.rights.includes('awards') ? button('team-award',t('حافز جماعي','Team award'))+button('incentive-rule', t('قاعدة حوافز اختيارية', 'Optional incentive rule')) : ''}${admin.rights.includes('reserve') ? button('reserve', t('تسجيل احتياطي مرتبط بعملية مالية', 'Reserve linked to financial operation')) : ''}</div>${table(admin.hr_delegations || [], [['state', t('الحالة', 'State')], ['starts_on', t('من', 'From')], ['ends_on', t('إلى', 'To')]], r => ['Active', 'Extended'].includes(r.state) ? button('delegation-decision', t('قرار المالك', 'Owner decision'), r.id) : '')}${table(admin.hr_terminations || [], [['employee_id', t('الموظف', 'Employee')], ['state', t('الحالة', 'State')], ['last_on', t('آخر يوم', 'Last day')]], r => r.state === 'Requested' ? button('termination-approve', t('اعتماد أو رفض', 'Approve/reject'), r.id) : r.state === 'Approved' ? button('termination-settle', t('تسوية بعد إخلاء الطرف', 'Settle after clearance'), r.id) : '')}${table(admin.hr_incentive_rules || [], [['id', t('القاعدة', 'Rule')], ['active', t('مفعلة', 'Enabled')]], r => button('incentive-generate', t('اقتراح حوافز — دون صرف', 'Propose awards — no payment'), r.id))}`}</div>`; }
    const save = (path, body) => api(path, 'POST', body, dialog.key), readFile = async (file) => { const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ''; for (const b of bytes)
        binary += String.fromCharCode(b); return btoa(binary); };
    function employeeForm(edit = false) { const p = edit ? selected : {}, defs = [companyField(), field('nameAr', 'الاسم بالعربية', 'Arabic name', 'text', p.nameAr), field('nameEn', 'الاسم بالإنجليزية', 'English name', 'text', p.nameEn), field('jobTitle', 'الوظيفة', 'Job title', 'text', p.jobTitle), field('hiredOn', 'تاريخ التعيين', 'Hire date', 'date', p.hiredOn || now()), field('managerId', 'المسؤول المباشر', 'Direct manager', 'text', p.managerId, options(people.users), false), field('departmentId', 'الإدارة', 'Department', 'text', p.departmentId, options(people.departments), false), field('nationality', 'الجنسية', 'Nationality', 'text', p.nationality, null, false), field('birthDate', 'الميلاد', 'Date of birth', 'date', p.birthDate, null, false), field('phone', 'الهاتف', 'Phone', 'tel', p.phone, null, false), field('whatsapp', 'واتساب', 'WhatsApp', 'tel', p.whatsapp, null, false), field('email', 'البريد', 'Email', 'email', p.email, null, false), field('address', 'العنوان', 'Address', 'text', p.address, null, false), field('state', 'الحالة الوظيفية', 'Employment state', 'text', p.state || 'Active', choices(['Active', 'OnLeave', 'Notice', 'Ended', 'Inactive']))]; if (!edit)
        defs.push(field('userId', 'ربط حساب دخول قائم (اختياري)', 'Link existing login (optional)', 'text', '', options(people.users), false)); form(edit ? 'edit' : 'new', 'ملف الموظف', 'Employee profile', defs, async (d) => { for (const k of ['managerId', 'departmentId', 'birthDate', 'userId'])
        if (!d[k])
            d[k] = null; if (edit) {
        d.userId = p.userId;
        d.revision = p.revision;
    } return save('employees' + (edit ? '/' + p.id : ''), d); }); }
    function modelForm(){const metrics=['task_on_time','task_late','collection_amount','deposit_amount','invoice_completed','verified_shortage','customer_data','successful_calls','vehicle_registered','key_received','gps_installed','circular_completed','recovery_completed'],defs=[companyField(),field('jobTitle','الوظيفة','Job title','text',selected.jobTitle),field('minimumScore','حد التأهيل من 100','Coaching threshold /100','number',60),field('currency','عملة المعايير المالية (اختيارية)','Financial metric currency (optional)','text','AED',null,false)];for(let i=0;i<modelCount;i++)defs.push(field('metric'+i,'المعيار '+(i+1),'Metric '+(i+1),'text',metrics[i]||metrics[0],choices(metrics)),field('weight'+i,'الوزن من 100%','Weight /100%','number',modelCount===1?100:0),field('target'+i,'الهدف','Target','text','100'),field('samples'+i,'الحد الأدنى للأحداث','Minimum observations','number',1),field('direction'+i,'اتجاه المعيار','Direction','text','higher',choices(['higher','lower'])));form('model','نموذج بأوزان يحددها المخوّل ومجموعها 100%','Explicitly configured weights totaling 100%',defs,d=>{const criteria=[];for(let i=0;i<modelCount;i++)criteria.push({metric:d['metric'+i],weight:Math.round(Number(d['weight'+i])*100),target:d['target'+i],minimumSamples:Number(d['samples'+i]),direction:d['direction'+i]});return save('models',{companyId:d.companyId,jobTitle:d.jobTitle,minimumScore:Math.round(Number(d.minimumScore)*100),...(d.currency?{currency:d.currency}:{}),criteria});});}
    async function action(a, key) {
        const actionEpoch=epoch,actionActor=ABCentral.actor?.id,actionKey=crypto.randomUUID();const save=(path,body)=>{if(actionEpoch!==epoch||actionActor!==ABCentral.actor?.id)throw Error('staleSession');return api(path,'POST',body,actionKey);};
        const p = selected, ep = p ? 'employees/' + p.id : '';
        if(a==='collection-attempt'){await CollectionUI.open(key);return;}
        if(a==='metric-employees'){filters.employeeIds=null;selected=null;section='employees';redraw();return;}if(a==='metric-tasks'){taskOverdueOnly=true;selected=null;section='tasks';redraw();return;}if(a==='metric-documents'){filters.employeeIds=dashboard.incompleteEmployeeIds;selected=null;section='employees';redraw();return;}if(a==='metric-leaves'){document.querySelector('#hr-result').innerHTML=table(dashboard.pendingLeaves||[],[['starts_on',t('من','From')],['ends_on',t('إلى','To')]],r=>button('open-leave',t('فتح طلب الموظف','Open employee request'),r.employee_id));bind();return;}if(a==='metric-eos'){showResult({estimate:true,byCompany:dashboard.liabilityByCompany,byCurrency:dashboard.liabilityByCurrency,unavailableEmployees:dashboard.liabilityIncomplete});return;}
        if(a==='table-sort'){const [table,col]=key.split('|'),pref=tablePrefs[table]||{filters:{},sort:'',dir:1};pref.dir=pref.sort===col?-pref.dir:1;pref.sort=col;tablePrefs[table]=pref;redraw();return;}
        if(a==='evaluations'||a==='payrollRun'){section=a;selected=null;dialog=null;await load();return;}if (a === 'administration') {
            section = 'administration';
            selected = null;
            dialog = null;
            redraw();
            return;
        }
        if (a === 'refresh') {
            await load();
            return;
        }
        if (a === 'cancel') {
            dialog = null;
            redraw();
            return;
        }
        if (a === 'back') {
            selected = null;
            dialog = null;
            redraw();
            return;
        }
        if (a === 'section') {
            section = key;taskOverdueOnly=false;
            selected = null;
            dialog = null;
            app.state.currentPage = key === 'tasks' ? 'tasks' : 'personnel';
            redraw();
            return;
        }
        if (a === 'panel') {
            panel = key;
            dialog = null;
            redraw();
            return;
        }
        if (a === 'open' || a==='open-leave' || a === 'jump') {
            const id = a === 'jump' ? people.rows.find(r => r.number === document.querySelector('#hr-jump').value)?.id : key;
            if (!id)
                throw Error(t('رقم غير متاح ضمن صلاحياتك', 'Number unavailable within your scope'));
            selected = await api('employees/' + id);await loadPhoto(selected);
            panel = a==='open-leave'?'leaves':'profile';
            dialog = null;
            redraw();
            return;
        }
        if (a === 'new' || a === 'edit') {
            employeeForm(a === 'edit');
            return;
        }
        const reason = () => field('reason', 'السبب / المرجع', 'Reason / reference'), date = (name, ar, en, value = now()) => field(name, ar, en, 'date', value,null,value!==''), amount = (name, ar, en, value = '0') => field(name, ar, en, 'text', value);
        if (a === 'assignment')
            form(a, 'ارتباط وظيفي إضافي', 'Additional company assignment', [companyField(), field('jobTitle', 'الوظيفة', 'Job title'), date('effectiveOn', 'من', 'From'), date('untilOn', 'إلى (اختياري)', 'Until (optional)', '')], d => save(ep + '/assignments', { ...d, untilOn: d.untilOn || null }));
        if (a === 'private')
            form(a, 'الهوية والعقد — بيانات مقيدة', 'Identity & contract — restricted', [...['emiratesId', 'passport', 'residence', 'drivingLicense', 'contractType'].map(k => field(k, { emiratesId: 'الهوية الإماراتية', passport: 'جواز السفر', residence: 'الإقامة', drivingLicense: 'رخصة القيادة', contractType: 'نوع العقد' }[k], k, 'text', p.private?.[k], null, false)), field('legalRegime', 'نظام مكافأة نهاية الخدمة', 'End of service regime', 'text', p.private?.legalRegime || 'unconfigured', choices(['unconfigured', 'uae_private_general', 'pension', 'alternative', 'other'])), field('excludedServiceDays', 'أيام مستبعدة موثقة', 'Evidenced excluded days', 'number', p.private?.excludedServiceDays || 0)], d => save(ep + '/private', { ...d, excludedServiceDays: Number(d.excludedServiceDays) }));
        if (a === 'account')
            form(a, 'حالة الدخول — لا تتغير الصلاحيات', 'Login state — permissions unchanged', [field('status', 'الحالة', 'State', 'text', 'Pending', choices(['Active', 'Pending', 'Disabled'])), reason()], d => save(ep + '/account-status', d));
        if (a === 'document' || a === 'library-file') {
            const lib = library.find(r => r.id === key), rows = a === 'document' ? p.documents.rows : lib.versions;
            form(a, 'وثيقة وإصدارات محفوظة', 'Document with preserved versions', [field('kind', 'نوع الوثيقة', 'Document kind', 'text', a === 'document' ? 'identity' : 'manual'), field('title', 'العنوان', 'Title'), field('file', 'PDF / صورة', 'PDF / image', 'file'), date('expiresOn', 'تاريخ الانتهاء (اختياري)', 'Expiry (optional)', ''), ...(a === 'document' ? [field('responsibleId', 'موظف الشركة المسؤول (اختياري)', 'Company responsible employee (optional)', 'text', '', options(people.rows), false), field('companyResponsible', 'الشركة مسؤولة عن التجديد', 'Company is responsible for renewal', 'checkbox', false)] : []), field('parentVersionId', 'إصدار سابق (اختياري)', 'Previous version (optional)', 'text', '', rows.map(r => ({ id: r.version_id, name: (r.payload.title || r.kind) + ' ' + r.version_id })), false)], async (d, formData) => { const f = formData.get('file'); const body = { kind: d.kind, title: d.title, name: f.name, mime: f.type, base64: await readFile(f), expiresOn: d.expiresOn || null, ...(d.parentVersionId ? { parentVersionId: d.parentVersionId } : {}), ...(a === 'document' ? { companyResponsible: d.companyResponsible, ...(d.responsibleId ? { responsibleId: d.responsibleId } : {}) } : {}) }; return save(a === 'document' ? ep + '/documents' : 'library/' + key + '/documents', body); });
        }
        if (a === 'download' || a === 'library-download'||a==='library-download-version') {
            const v = a === 'download' ? await api(ep + '/documents/' + key) : a==='library-download-version'?await api('library/'+key.split('/')[0]+'/documents/'+key.split('/')[1]):await api('library/' + key + '/documents/' + library.find(r => r.id === key).versions[0].version_id), bytes = Uint8Array.from(atob(v.base64), c => c.charCodeAt(0)), url = URL.createObjectURL(new Blob([bytes], { type: v.mime })), link = document.createElement('a');
            if(v.mime==='application/pdf'){URL.revokeObjectURL(url);await AttachmentViewer.show([{name:v.name,load:async()=>new Blob([bytes],{type:v.mime})}]);return;}
            link.href = url;
            link.download = v.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        if (a === 'document-review')
            form(a, 'مراجعة وثيقة مفحوصة', 'Review scanned document', [field('approve', 'اعتماد (إلغاء الاختيار للرفض)', 'Approve (uncheck to reject)', 'checkbox', true), reason()], d => save(ep + '/documents/' + key + '/review', d));
        if (a === 'new-task')
            form(a, 'مهمة تشغيلية', 'Operational task', [companyField(), employeeField(), field('title', 'عنوان المهمة', 'Task title'), field('expectedResult', 'النتيجة الفعلية المطلوبة', 'Required actual outcome'), date('dueOn', 'تاريخ الاستحقاق', 'Due date')], d => save('tasks', d));
        if (a.startsWith('task-')) {
            const task = tasks.find(r => r.id === key);
            if (a === 'task-history') {
                const r = await api('tasks/' + key + '/history');
                showResult(r.rows);
            }
            else
                form(a, 'إجراء مهمة موثق', 'Audited task action', [field('note', 'الملاحظة / إثبات النتيجة', 'Note / outcome evidence'), ...(a === 'task-reassign' ? [employeeField()] : [])], d => save('tasks/' + key + '/action', { ...d, action: a.slice(5), revision: task.revision }));
        }
        if (a === 'leave')
            form(a, 'طلب إجازة إلى المسؤول المباشر', 'Leave request to direct manager', [field('kind', 'النوع', 'Kind', 'text', 'annual', choices(['annual', 'unpaid'])), date('startsOn', 'من', 'From'), date('endsOn', 'إلى', 'To'), field('note', 'الملاحظة', 'Note'), field('suspendAccount', 'إيقاف الدخول عند بدء الإجازة', 'Hold login when leave starts', 'checkbox', true), field('evidenceVersionId', 'وثيقة داعمة (اختيارية)', 'Supporting document (optional)', 'text', '', (p.documents?.rows || []).map(r => ({ id: r.version_id, name: r.payload.title })), false)], d => { if (!d.evidenceVersionId)
                delete d.evidenceVersionId; return save(ep + '/leaves', d); });
        if (a === 'balance')
            form(a, 'رصيد إجازات موثق', 'Evidenced leave balance', [date('effectiveOn', 'تاريخ الاستحقاق', 'Effective date'), field('days', 'الأيام', 'Days', 'number', '0'), field('reference', 'مرجع فريد', 'Unique reference'), reason()], d => save(ep + '/leave-balance', { ...d, days: Number(d.days) }));
        if (a === 'leave-resubmit') {
            const row = p.leaves.find(r => r.id === key);
            form(a, 'تعديل الإجازة المعادة', 'Edit returned leave', [date('startsOn', 'من', 'From', row.starts_on.slice(0, 10)), date('endsOn', 'إلى', 'To', row.ends_on.slice(0, 10)), field('note', 'الملاحظة', 'Note', 'text', row.payload.note)], d => save('leaves/' + key + '/resubmit', { ...d, revision: row.revision }));
        }
        if (a === 'leave-decision') {
            const row = p.leaves.find(r => r.id === key);
            form(a, 'قرار الإجازة', 'Leave decision', [field('state', 'القرار', 'Decision', 'text', 'Approved', choices(['Approved', 'Rejected', 'Returned'])), reason()], d => save('leaves/' + key + '/decision', { ...d, revision: row.revision }));
        }
        if (a === 'evaluation' || a === 'review')
            form(a, 'تقييم من السجلات الفعلية', 'Evaluation from actual records', [companyField(), date('month', 'أول يوم من الشهر', 'First day of month', month()), ...(a === 'review' ? [field('note', 'ملاحظة الاعتماد', 'Approval note')] : [])], async (d) => { if (a === 'review')
                return save(ep + '/reviews', d); const r = await api(ep + '/evaluation?' + new URLSearchParams(d)); return { preview: r }; });
        if (a === 'model') {modelCount=1;modelForm();}
        if (a === 'model-add'||a==='model-remove'){const copy={...draft};modelCount=Math.min(30,Math.max(1,modelCount+(a==='model-add'?1:-1)));modelForm();draft=copy;redraw();}
        if (a === 'coaching')
            form(a, 'التأهيل لا ينهي الخدمة تلقائياً', 'Coaching never automatically terminates employment', [field('reviewId', 'التقييم المعتمد', 'Approved review', 'text', '', p.reviews.map(r => ({ id: r.id, name: r.month }))), field('kind', 'الإجراء', 'Action', 'text', 'session', choices(['session', 'improved', 'escalated'])), date('sessionOn', 'تاريخ الجلسة', 'Session date'), date('reviewOn', 'موعد المراجعة', 'Review date'), field('note', 'الملاحظات والنتيجة', 'Notes and outcome')], d => save(ep + '/coaching', d));
        if (a === 'compensation')
            form(a, 'راتب وتوزيع تكلفة بين الشركات', 'Compensation & company cost allocation', [companyField(), date('effectiveOn', 'سريان النسخة', 'Effective date'), field('currency', 'العملة', 'Currency', 'text', 'AED'), amount('basic', 'الأساسي', 'Basic'), amount('allowances', 'البدلات الثابتة', 'Fixed allowances'), ...cap.companies.map((r, i) => field('allocation_' + r.id, 'نسبة ' + (r.arabicName || r.englishName) + ' من 10000', 'Share ' + r.englishName + ' /10000', 'number', r.id === p.companyId ? 10000 : 0)), reason()], d => { const allocations = cap.companies.map(r => ({ companyId: r.id, bps: Number(d['allocation_' + r.id]) })).filter(r => r.bps > 0); for (const k of Object.keys(d))
                if (k.startsWith('allocation_'))
                    delete d[k]; return save(ep + '/compensation', { ...d, allocations }); });
        if (a === 'decision')
            form(a, 'قرار مالي موثق', 'Documented financial decision', [companyField(), date('month', 'الشهر', 'Month', month()), field('kind', 'النوع', 'Kind', 'text', 'bonus', choices(['bonus', 'allowance', 'deduction', 'correction'])), amount('amount', 'المبلغ', 'Amount'), field('reference', 'مرجع فريد', 'Unique reference'), reason(), field('legalBasis', 'الأساس القانوني للخصم', 'Deduction legal basis', 'text', '', null, false), field('evidenceVersionId', 'إصدار الإثبات', 'Evidence version', 'text', '', null, false), field('counterpartDefinitionId', 'حساب مقابل الخصم', 'Deduction counterpart account', 'text', '', null, false), field('correctedPayrollId', 'مسير سابق للتصحيح', 'Prior payroll to correct', 'text', '', null, false)], d => { for (const k of ['legalBasis', 'evidenceVersionId', 'counterpartDefinitionId', 'correctedPayrollId'])
                if (!d[k])
                    delete d[k]; return save(ep + '/decisions', d); });
        if(a==='decision-void')form(a,'إلغاء مع حفظ القرار الأصلي — غير مسموح بعد استهلاكه في مسير معتمد','Cancel while preserving original — unavailable after approved payroll',[reason()],d=>save('decisions/'+key+'/void',d));
        if (a === 'decision-approve')
            form(a, 'اعتماد القرار المالي', 'Approve financial decision', [field('approve', 'اعتماد', 'Approve', 'checkbox', true), reason()], d => save('decisions/' + key + '/approve', d));
        if (a === 'payroll')
            form(a, 'إعداد مسير — لا يُعد دفعاً', 'Prepare payroll — not a payment', [date('month', 'الشهر', 'Month', month())], d => save(ep + '/payroll', d));
        if (a === 'payroll-approve')
            form(a, 'اعتماد الاستحقاق وسند صرف واحد', 'Approve accrual and one payment voucher', [field('confirm', 'تأكيد الاعتماد', 'Confirm approval', 'checkbox', false)], d => save('payroll/' + key + '/approve', d));
        if (a === 'eos-history') { showResult(await api(ep + '/eos/history')); return; }
        if (a === 'eos' || a === 'clearance') {
            const r = await api(ep + '/' + a);
            showResult(r);
        }
        if (a === 'provision')
            form(a, 'مخصص محاسبي منفصل عن الاستحقاق القانوني', 'Accounting provision separate from legal entitlement', [date('month', 'الشهر', 'Month', month()), amount('amount', 'مبلغ القيد', 'Journal amount'), field('currency', 'العملة', 'Currency', 'text', 'AED'), field('expenseDefinitionId', 'معرف حساب المصروف', 'Expense definition ID'), field('liabilityDefinitionId', 'معرف حساب المخصص', 'Provision liability definition ID'), reason()], d => save(ep + '/provisions', d));
        if (a === 'asset')
            form(a, 'العهدة والسجل المحفوظ', 'Asset custody with retained history', [field('reference', 'مرجع العهدة', 'Asset reference'), field('kind', 'نوع العهدة', 'Asset kind'), field('state', 'الحالة', 'State', 'text', 'Held', choices(['Held', 'Returned'])), field('note', 'الملاحظة', 'Note')], d => save(ep + '/assets', d));
        if (a === 'termination')
            form(a, 'طلب إنهاء خدمة للمراجعة', 'Termination request for review', [field('kind', 'نوع الإنهاء', 'Termination kind', 'text', 'resignation', choices(['resignation', 'company', 'exceptional'])), date('noticeOn', 'تاريخ الإشعار', 'Notice date'), date('lastOn', 'آخر يوم عمل', 'Last working day'), reason(), field('exceptionBasis', 'أساس قانوني للاستثناء إن وجد', 'Exception legal basis if applicable', 'text', '', null, false)], d => save(ep + '/terminations', d));
        if (a === 'library-new')
            form(a, 'سجل في المكتبة المركزية', 'Central library record', [companyField(), field('category', 'التصنيف', 'Category', 'text', 'work_manual'), field('title', 'العنوان', 'Title'), field('description', 'الوصف', 'Description', 'textarea', '', null, false)], d => save('library', d));
        if (a === 'followup')
            form(a, 'متابعة الوثائق والمهام والتصعيد', 'Process documents, tasks & escalation', [companyField(), field('confirm', 'تأكيد المعالجة', 'Confirm processing', 'checkbox', false)], d => save('followup/' + d.companyId, { confirm: d.confirm }));
        if(a==='job-weights'){const companyId=key||p.companyId,jobs=[...new Set([...(companyId===p.companyId?[p.jobTitle]:[]),...p.assignments.filter(r=>r.company_id===companyId).map(r=>r.job_title)])];form(a,'أوزان الوظائف — لا تُفترض أوزان تلقائياً','Job weights — never inferred automatically',[...jobs.map((job,i)=>field('jobWeight'+i,job+' %',job+' %','number',jobs.length===1?100:0)),reason()],d=>save(ep+'/job-weights',{companyId,weights:jobs.map((jobTitle,i)=>({jobTitle,weight:Math.round(Number(d['jobWeight'+i])*100)})).filter(r=>r.weight>0),reason:d.reason}));}
        if(a==='visibility')form(a,'ظهور التقييم للموظف','Employee evaluation visibility',[field('mode','طريقة العرض','Display mode','text','hidden',choices(['hidden','score','details'])),reason()],d=>save(ep+'/visibility',d));
        if(a==='job-visibility')form(a,'ظهور التقييم حسب الوظيفة','Evaluation visibility by job',[companyField(),field('jobTitle','الوظيفة','Job title'),field('mode','طريقة العرض','Display mode','text','hidden',choices(['hidden','score','details'])),reason()],d=>save('job-visibility',d));
        if(a==='team-award')form(a,'حافز جماعي يحتاج اعتماد كل قرار','Team award requiring decision approvals',[companyField(),field('employeeIds','الموظفون — اختيار متعدد','Employees — multiple selection','multiselect',[],options(people.rows)),date('month','الشهر','Month',month()),field('kind','النوع','Kind','text','bonus',choices(['bonus','allowance'])),amount('amount','قيمة لكل موظف','Amount per employee'),field('reference','مرجع جماعي فريد','Unique team reference'),reason()],d=>save('team-awards',d));
        if(a==='run-prepare')form(a,'إعداد كشوف الرواتب دون صرف','Prepare payroll slips without payment',[field('employeeIds','الموظفون — اختيار متعدد','Employees — multiple selection','multiselect',[],options(people.rows)),date('month','الشهر','Month',payrollMonth||month())],d=>save('payroll-run/prepare',{...d,companyId:co}));
        if(a==='run-approve')form(a,'اعتماد كشوف مرتبطة بسندات المرحلة الخامسة','Approve slips linked to phase 5 vouchers',[field('payrollIds','الكشوف المسودة','Draft slips','multiselect',[],runRows.filter(r=>r.state==='Draft').map(r=>({id:r.id,name:r.employee+' '+r.net+' '+r.currency}))),field('confirm','تأكيد الاعتماد','Confirm approval','checkbox',false)],d=>save('payroll-run/approve',{...d,companyId:co}));
        if (a === 'settings') {
            const cfg = admin.config;
            form(a, 'إعدادات — لا تفعل خدمات خارجية', 'Settings — does not activate external services', [...['automaticFollowup', 'incentivesEnabled', 'reserveEnabled'].map(k => field(k, { automaticFollowup: 'متابعة تلقائية (تحتاج عامل الخادم)', incentivesEnabled: 'تمكين قواعد الحوافز', reserveEnabled: 'تمكين تسجيل الاحتياطي' }[k], k, 'checkbox', cfg[k])), ...['orangeDays', 'redDays', 'coachingSessions', 'noticeMonths'].map(k => field(k, { orangeDays: 'أيام التصعيد البرتقالي', redDays: 'أيام التصعيد الأحمر', coachingSessions: 'عدد جلسات التأهيل', noticeMonths: 'أشهر الإشعار الافتراضي' }[k], k, 'number', cfg[k])), field('evaluationVisibility', 'ظهور تقييم الموظف', 'Employee evaluation visibility', 'text', cfg.evaluationVisibility, choices(['hidden', 'score', 'details'])), ...['payrollItemId', 'finalSettlementItemId', 'dueFromDefinitionId', 'dueToDefinitionId'].map(k => field(k, { payrollItemId: 'معرف بند الرواتب المالي', finalSettlementItemId: 'معرف بند التسوية النهائي', dueFromDefinitionId: 'معرف حساب مستحق من', dueToDefinitionId: 'معرف حساب مستحق إلى' }[k], k, 'text', cfg[k], null, false)), field('legalDeductionMaxBps', 'حد الخصم القانوني المعتمد من 10000 (اختياري)', 'Approved legal deduction cap /10000 (optional)', 'number', cfg.legalDeductionMaxBps ?? '', null, false), field('documentDays', 'أيام تنبيه الوثائق مفصولة بفواصل', 'Document warning days separated by commas', 'text', cfg.documentDays.join(','))], d => { const out = { ...cfg, ...d }; for (const k of ['orangeDays', 'redDays', 'coachingSessions', 'noticeMonths'])
                out[k] = Number(out[k]); out.documentDays = d.documentDays.split(',').map(Number); for (const k of ['payrollItemId', 'finalSettlementItemId', 'dueFromDefinitionId', 'dueToDefinitionId'])
                if (!out[k])
                    delete out[k]; if (out.legalDeductionMaxBps === '')
                delete out.legalDeductionMaxBps;
            else
                out.legalDeductionMaxBps = Number(out.legalDeductionMaxBps); return save('settings/' + co, out); });
        }
        if (a === 'delegation-decision')
            form(a, 'قرار المالك — لا عودة تلقائية للمهام', 'Owner decision — tasks never return automatically', [field('action', 'القرار', 'Decision', 'text', 'return', choices(['return', 'extend', 'transfer'])), field('endsOn', 'تاريخ نهاية التمديد (عند التمديد)', 'Extension end (when extending)', 'date', '', null, false), reason()], d => { if (!d.endsOn)
                delete d.endsOn; return save('delegations/' + key + '/decision', d); });
        if (a === 'incentive-rule')
            form(a, 'قاعدة حوافز دون صرف آلي', 'Incentive rule without automatic payment', [field('jobTitle', 'الوظيفة', 'Job title'), field('minimumScore', 'حد الدرجة من 10000', 'Score threshold /10000', 'number', 9000), amount('amount', 'قيمة المكافأة', 'Award amount'), field('active', 'تمكين القاعدة صراحةً', 'Explicitly enable rule', 'checkbox', false), reason()], d => save('incentive-rules', { ...d, companyId: co, minimumScore: Number(d.minimumScore) }));
        if (a === 'incentive-generate')
            form(a, 'حوافز مقترحة تحتاج اعتماداً', 'Proposed awards require approval', [date('month', 'شهر تقييم معتمد', 'Approved evaluation month', month())], d => save('incentive-rules/' + key + '/generate', d));
        if (a === 'termination-approve')
            form(a, 'قرار إنهاء الخدمة', 'Termination decision', [field('approve', 'اعتماد', 'Approve', 'checkbox', false), reason()], d => save('terminations/' + key + '/approve', d));
        if (a === 'termination-settle')
            form(a, 'تسوية قانونية بعد فحص العهد والرواتب', 'Legal settlement after custody and payroll checks', [amount('eosAmount', 'مكافأة نهاية الخدمة', 'End of service amount'), amount('leaveAmount', 'بدل الإجازة المعتمد', 'Approved leave amount'), amount('otherAmount', 'استحقاقات أخرى معتمدة', 'Other approved entitlement'), field('legalBasis', 'الأساس القانوني', 'Legal basis'), field('keysReviewed', 'تحققت من المفاتيح والعهد غير المرتبطة رقمياً', 'Verified keys and custody not digitally attributed', 'checkbox', false), field('legalReviewed', 'أكملت المراجعة القانونية', 'Legal review completed', 'checkbox', false), reason()], d => save('terminations/' + key + '/settle', d));
        if (a === 'reserve')
            form(a, 'سجل احتياطي — لا ينقل أموالاً', 'Reserve record — does not move funds', [amount('amount', 'المبلغ', 'Amount'), field('currency', 'العملة', 'Currency', 'text', 'AED'), date('effectiveOn', 'تاريخ العملية', 'Effective date'), field('maturesOn', 'الاستحقاق (اختياري)', 'Maturity (optional)', 'date', '', null, false), field('operationId', 'معرف عملية مالية معتمدة', 'Approved financial operation ID'), field('bankAccountId', 'معرف الحساب البنكي', 'Bank account ID'), field('term', 'المدة', 'Term'), field('expectedReturn', 'العائد المتفق عليه إن وجد', 'Agreed return if any', 'text', '', null, false), reason()], d => { if (!d.maturesOn)
                delete d.maturesOn; return save('reserves', { ...d, companyId: co }); });
        if (a === 'export') {
            const r = await api('export', 'POST', { companyIds:filters.companyIds.length?filters.companyIds:cap.companies.map(c=>c.id),...Object.fromEntries(['departmentId','managerId','state','search','jobTitle'].filter(k=>filters[k]&&(k!=='search'||registerVisibleIds===null)).map(k=>[k,filters[k]])), employeeIds:registerVisibleIds||filteredPeople().map(r=>r.id),format: 'excel' }, crypto.randomUUID());
            const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(r.base64), c => c.charCodeAt(0))], { type: r.mime })), link = document.createElement('a');
            link.href = url;
            link.download = r.name;
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        }
        if (a === 'delegation')
            form(a, 'تفويض مهام فقط — دون صلاحية توقيع أو عهدة', 'Delegate tasks only — no signature rights or custody', [companyField(), employeeField('originalId'), employeeField('substituteId'), date('startsOn', 'من', 'From'), date('endsOn', 'إلى', 'To'), field('taskId', 'المهمة التشغيلية', 'Operational task', 'text', '', tasks.filter(r => !['Completed', 'Closed'].includes(r.state)).map(r => ({ id: r.id, name: r.title }))), reason()], d => { d.taskIds = [d.taskId]; delete d.taskId; return save('delegations', d); });
    }
    function bind() { if (!['personnel', 'tasks'].includes(app.state.currentPage))
        return; RegisterView.bind(document.getElementById('personnel-workspace'),redraw);document.querySelectorAll('[data-hr]').forEach(b => { if (b.dataset.hrBound)
        return; b.dataset.hrBound = '1'; b.addEventListener('click', async () => { try {

            error = '';
        await action(b.dataset.hr, b.dataset.id);
    }
    catch (err) {
        if (err.message !== 'staleSession') {
            error = err.message;
            redraw();
        }
    } }); }); const evalMonth=document.querySelector('#hr-evaluation-month'),evalCompany=document.querySelector('#hr-evaluation-company');if(evalMonth)evalMonth.addEventListener('change',async()=>{evaluationMonth=evalMonth.value;await load();});if(evalCompany)evalCompany.addEventListener('change',async()=>{evaluationCompany=evalCompany.value;await load();});
        const runCompany=document.querySelector('#hr-run-company'),runMonth=document.querySelector('#hr-run-month');if(runCompany)runCompany.addEventListener('change',async()=>{co=runCompany.value;await load();});if(runMonth)runMonth.addEventListener('change',async()=>{payrollMonth=runMonth.value;await load();});
        const company = document.querySelector('#hr-admin-company'); if (company)
        company.addEventListener('change', async () => { co = company.value; await load(); }); const search=document.querySelector('#hr-search');if(search)search.addEventListener('input',()=>{const caret=search.selectionStart;filters.search=search.value;redraw();const next=document.querySelector('#hr-search');next.focus();next.setSelectionRange(caret,caret);});const companies=document.querySelector('#hr-companies');if(companies)companies.addEventListener('change',()=>{filters.companyIds=[...companies.selectedOptions].map(o=>o.value);redraw();});document.querySelectorAll('[data-hr-filter]').forEach(node=>node.addEventListener('change',()=>{filters[node.dataset.hrFilter]=node.value;redraw();}));
        document.querySelectorAll('[data-hr-column]').forEach(node=>node.addEventListener('change',()=>{const pref=tablePrefs[node.dataset.hrTable]||{filters:{},sort:'',dir:1};pref.filters[node.dataset.hrColumn]=[...node.selectedOptions].map(o=>o.value);tablePrefs[node.dataset.hrTable]=pref;redraw();}));
        const f = document.querySelector('#hr-form'); if (f && !f.dataset.bound) {
        f.dataset.bound = '1';
        f.addEventListener('input', () => { for (const x of f.elements)
            if(x.name&&x.type==='file'&&x.files?.[0])dialog.files[x.name]=x.files[0];else if (x.name && x.type !== 'file')
                draft[x.name]=x.multiple?[...x.selectedOptions].map(o=>o.value):x.type==='checkbox'?x.checked:x.value; });
        f.addEventListener('submit', async (event) => { event.preventDefault(); if (f.dataset.busy)
            return; f.dataset.busy = '1'; const data = new FormData(f), body = {};for(const [name,file]of Object.entries(dialog.files||{}))data.set(name,file); for (const def of dialog.defs)
            if (def.type !== 'file')
                body[def.name] = def.type==='multiselect'?data.getAll(def.name):def.type === 'checkbox' ? data.has(def.name) : data.get(def.name); try {
            const r = await dialog.save(body, data);
            if (r.preview) {
                dialog = null;
                redraw();
                showResult(r.preview);
            }
            else {
                dialog = null;
                draft = {};
                success = t('تم حفظ البيانات في قاعدة البيانات المركزية.', 'Saved to the central database.');
                await load();
            }
        }
        catch (err) {
            if (err.message !== 'staleSession')
                f.querySelector('#hr-form-error').textContent = t('تعذر الحفظ؛ لم تُفقد المدخلات. ', 'Save failed; input retained. ') + err.message;
        }
        finally {
            delete f.dataset.busy;
        } });
    } WorkspaceUI.enhance();}
    root.PersonnelUI = { openProfile: async id => { app.state.currentPage='personnel'; await load(); selected=await api('employees/'+id); panel='profile'; await loadPhoto(selected); redraw(); }, render: () => renderUI(), renderTasks: () => renderUI(true), canEnter: () => !!root.ABCentral?.enabled && !!ABCentral.actor, bind, reset, openNotification: async () => { app.state.currentPage = 'personnel'; await load(); redraw(); } };
})(globalThis);
