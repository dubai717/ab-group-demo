/* Session-only ERP workflow. Production authorization must run on a trusted backend. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UserManagement = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const bankActions = ['view', 'create', 'edit', 'close', 'view_documents', 'manage_documents'];
  const financeActions=['view','create','approve','cheques','custody','receive_custody','reconcile','chart','notifications','print','export','sensitive'].map(a=>'finance_'+a);
  const actions = [...['view','create','edit','activate','deactivate','contracts'].map(a=>'contracting_'+a), 'hr_view', 'hr_create', 'hr_edit', 'hr_private', 'hr_documents', 'hr_document_update', 'hr_document_review', 'hr_leave_approve', 'hr_account_status', 'hr_task_manage', 'hr_task_delegate', 'hr_evaluation_models', 'hr_evaluation_weights', 'hr_evaluation_view', 'hr_evaluation_approve', 'hr_evaluation_visibility', 'hr_salary_view', 'hr_salary_edit', 'hr_payroll_prepare', 'hr_payroll_approve', 'hr_awards', 'hr_deductions', 'hr_coaching', 'hr_termination', 'hr_clearance', 'hr_eos_view', 'hr_reserve', 'hr_library_view', 'hr_library_download', 'hr_library_manage', 'hr_configure', 'hr_audit', 'hr_export'].concat(['create', 'edit', 'status', 'assign', 'grant', 'reset', 'attachments', 'redelegate', ...bankActions.map(a => 'bank_' + a), ...financeActions,...['view','invoice_create','invoice_correct','invoice_import','collect','collection_override','hand_over','receive','deposit','deposit_verify','fund_manage','petty_spend','voucher_create','voucher_approve','voucher_batch','voucher_cancel','cheques','settle','journal_create','journal_approve','account_manage','item_manage','statement_upload','reconcile','close','group_close','report','export','configure','cards','card_settle','intercompany','audit'].map(a=>'ledger_'+a),...['view','create','edit','funding_approve','disburse','receive_funds','settle_custody','invoices','collect','approve','reschedule','reschedule_extend','sale','sale_approve','print','export','insurance','gps','location','keys','circular_issue','circular_complete','circular_exception','recovery','recovery_approve','recovery_assign','recovery_close','settlement','writeoff_approve','configure','documents','notify','audit','import'].map(a=>'vehicle_'+a),...['view','create','edit','status','transfer','export','print','documents','relations','followup','review','audit','notify','configure','import','undertaking_issue','undertaking_edit','undertaking_cancel','undertaking_complete'].map(a=>'customer_'+a)]);
  const legacy = { create: 'create_user', edit: 'edit_user', status: 'deactivate_user' };
  const copy = value => JSON.parse(JSON.stringify(value));
  const clean = user => { const value = copy(user); delete value.password; return value; };
  // Shared creation validation. No permissions or credential values are returned.
  function fieldErrors(data,{passwordRequired=false,nameArRequired=true}={}){const errors={};for(const key of [...(nameArRequired?['nameAr']:[]),'nameEn'])if(typeof data[key]!=='string'||!data[key].trim())errors[key]='required';if(!/^[A-Za-z0-9_.-]{3,64}$/.test(data.username||''))errors.username=data.username?'invalidUsername':'required';if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||''))errors.email=data.email?'invalidEmail':'required';if(data.hireDate&&(!/^\d{4}-\d{2}-\d{2}$/.test(data.hireDate)||Number.isNaN(Date.parse(data.hireDate))))errors.hireDate='invalid';if(data.status&&!['Active','Pending','Disabled'].includes(data.status))errors.status='invalidReference';if(data.emiratesId&&!/^784-?\d{4}-?\d{7}-?\d$/.test(data.emiratesId))errors.emiratesId='invalidId';if(passwordRequired){const p=data.password;if(typeof p!=='string'||p.length<12||p.length>128||!/[A-Z]/.test(p)||!/[a-z]/.test(p)||!/[0-9]/.test(p)||! /[^a-zA-Z0-9\s]/.test(p)||/\s/.test(p))errors.password=p?'weak':'required';}return errors;}
  function createService(source, now = () => new Date().toISOString(), persistence = {}) {
    const records = new Map(source.users.map(user => [user.id, clean(user)]));
    const roles = copy(source.roles), companies = copy(source.companies), departments = copy(source.departments);
    const grants = new Map(), files = new Map(), audit = [...(persistence.initialAudit||[])];
    for(const row of persistence.initialGrants||[]) { const list=grants.get(row.userId)||[];list.push(copy(row.entry));grants.set(row.userId,list); }
    const grantSnapshot=()=>[...grants].flatMap(([userId,entries])=>entries.map(entry=>({userId,entry:copy(entry)})));
    let sequence = 0;
    const user = id => records.get(id);
    const isOwner = id => user(id)?.roleId === 'owner';
    const associations = (u, type) => u[`${type}Ids`] || (u[`${type}Id`] ? [u[`${type}Id`]] : []);
    function descendants(manager, target) {
      const visited = new Set(); let current = user(target);
      while (current?.managerId && !visited.has(current.id)) {
        visited.add(current.id);
        if (current.managerId === manager) return true;
        current = user(current.managerId);
      }
      return false;
    }
    function validScope(scope) {
      if (!scope || !['group', 'company', 'department', 'reports'].includes(scope.type)) return false;
      if (scope.type === 'group') return scope.id === '';
      const options = scope.type === 'company' ? companies : scope.type === 'department' ? departments : [...records.values()];
      return options.some(row => row.id === scope.id);
    }
    function inScope(scope, target) {
      if (!validScope(scope) || !target) return false;
      if (scope.type === 'group') return true;
      if (scope.type === 'company') return associations(target, 'company').includes(scope.id);
      if (scope.type === 'department') return associations(target, 'department').includes(scope.id);
      return descendants(scope.id, target.id) || target.managerId === scope.id;
    }
    function scopeContains(parent, child) {
      if (!validScope(parent) || !validScope(child)) return false;
      if (parent.type === 'group') return true;
      // Deliberately conservative: a limited grant may only be re-granted within the same explicit scope.
      return parent.type === child.type && parent.id === child.id;
    }
    function effective(id, action) {
      const actor = user(id);
      if (!actor || actor.status !== 'Active') return [];
      const result = (grants.get(id) || []).filter(g => g.action === action);
      const role = roles.find(r => r.id === actor.roleId);
      if (isOwner(id) || (legacy[action] && role?.permissions.includes(legacy[action]))) {
        result.push({ action, scope: { type: 'group', id: '' }, delegable: isOwner(id) });
      }
      if (action.startsWith('bank_')) {
        for (const entry of (Array.isArray(actor.companyBankPermissions) ? actor.companyBankPermissions : [])) {
          if (Array.isArray(entry.permissions) && entry.permissions.includes(action.slice(5)) && companies.some(c => c.id === entry.companyId)) result.push({action, scope:{type:'company',id:entry.companyId}, delegable:false});
        }
      }
      return result;
    }
    function can(id, action, target) {
      if (!actions.includes(action) || !target) return false;
      if (target.roleId === 'owner' && !isOwner(id)) return false;
      return effective(id, action).some(g => inScope(g.scope, target));
    }
    function requireAction(id, action, target) {
      if (!can(id, action, target)) throw new Error('denied');
    }
    function log(actorId, action, targetId, fields = []) {
      audit.push(Object.freeze({ id: ++sequence, at: now(), actorId, action, targetId, fields: [...fields] }));
    }
    function visible(id, target) {
      if (!target?.id) return false;
      const actor = user(id);
      const legacyViewer = actor?.status === 'Active' && (actor.roleId === 'general_manager' || roles.find(r => r.id === actor.roleId)?.permissions.includes('view_users'));
      return actor?.status === 'Active' && (id === target.id || legacyViewer || actions.filter(action => !action.startsWith('contracting_')&&!action.startsWith('bank_')&&!action.startsWith('finance_')&&!action.startsWith('customer_')&&!action.startsWith('vehicle_')&&!action.startsWith('ledger_')&&!action.startsWith('hr_')).some(action => can(id, action, target)));
    }
    function validate(data, targetId) {
      if (((!records.has(targetId) || user(targetId)?.nameAr) && !data.nameAr?.trim()) || !data.nameEn?.trim() || !/^[A-Za-z0-9_.-]{3,64}$/.test(data.username || '') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '')) throw new Error('invalid');
      if ([...records.values()].some(u => u.id !== targetId && (u.username.toLowerCase() === data.username.toLowerCase() || u.email?.toLowerCase() === data.email.toLowerCase()))) throw new Error('duplicate');
      if (data.emiratesId && !/^784-?\d{4}-?\d{7}-?\d$/.test(data.emiratesId)) throw new Error('invalidId');
      if (!['Active', 'Pending', 'Disabled'].includes(data.status)) throw new Error('invalid');
      if (data.hireDate && (!/^\d{4}-\d{2}-\d{2}$/.test(data.hireDate) || Number.isNaN(Date.parse(data.hireDate)))) throw new Error('invalid');
      for (const [key, options] of [['companyIds', companies], ['departmentIds', departments]]) {
        if (!Array.isArray(data[key]) || data[key].some(id => !options.some(item => item.id === id))) throw new Error('invalid');
      }
      if (data.managerId && (!user(data.managerId) || data.managerId === targetId || descendants(targetId, data.managerId))) throw new Error('cycle');
      if (data.departmentIds.some(id => !data.companyIds.includes(departments.find(d => d.id === id).companyId))) throw new Error('departmentCompany');
    }
    function attachmentCheck(list) {
      const slots = ['photo', 'idFront', 'idBack', 'passport', 'contract', 'driving'];
      if (list.some(({slot, file}) => !slots.includes(slot) || !file || file.size > 5 * 1024 * 1024 || !['image/png', 'image/jpeg', 'application/pdf'].includes(file.type) || (slot === 'photo' && !file.type.startsWith('image/')))) throw new Error('fileError');
    }
    const assignmentKeys = ['jobTitle', 'hireDate', 'managerId', 'companyIds', 'departmentIds'];
    const profileKeys = ['nameAr', 'nameEn', 'emiratesId', 'nationality', 'phone', 'email', 'username'];
    function update(actorId, targetId, data, attachments = [], options = {}) {
      const previous = user(targetId);
      if (targetId && !previous) throw new Error('denied');
      const isNew = !previous;
      const candidate = { ...(previous || {id: `demo-${crypto.randomUUID()}`, roleId: 'employee', status: 'Pending'}), ...Object.fromEntries([...profileKeys, ...assignmentKeys, 'status'].map(k => [k, data[k]])) };
      if (isNew && options.roleId && options.roleId !== 'employee') {
        if (!isOwner(actorId) || options.roleId === 'owner' || !roles.some(r => r.id === options.roleId)) throw new Error('denied');
        candidate.roleId = options.roleId;
      }
      if (!isNew && options.verifier) throw new Error('denied');
      validate(candidate, candidate.id);
      const baseline = { nameEn:previous?.fullName || '', nameAr:'', jobTitle:'', hireDate:'', managerId:'', companyIds:previous ? associations(previous, 'company') : [], departmentIds:previous ? associations(previous, 'department') : [], ...previous };
      const changed = keys => keys.filter(key => JSON.stringify(candidate[key]) !== JSON.stringify(baseline[key] ?? ''));
      if (previous && candidate.status !== previous.status && (previous.roleId === 'owner' || targetId === actorId)) throw new Error('ownerProtected');
      // Check both old and new memberships, so scoped operators cannot move records out of their remit.
      function check(action) {
        requireAction(actorId, action, candidate);
        if (previous) requireAction(actorId, action, previous);
      }
      if (isNew) check('create'); else if (changed(profileKeys).length) check('edit');
      if (changed(assignmentKeys).length) check('assign');
      if (candidate.status !== (previous?.status || 'Pending')) check('status');
      if (attachments.length) { check('attachments'); if (!isNew) check('edit'); attachmentCheck(attachments); }
      candidate.fullName = candidate.nameEn;
      candidate.companyId = candidate.companyIds[0] || '';
      candidate.departmentId = candidate.departmentIds[0] || '';
      const localLogin = persistence.save?.(copy(candidate), options.verifier) === true;
      records.set(candidate.id, copy(candidate));
      if (localLogin) log(actorId, 'demoLoginSaved', candidate.id, ['username', 'roleId', 'status']);
      if (attachments.length) {
        const stored = files.get(candidate.id) || new Map();
        attachments.forEach(({slot, file}) => stored.set(slot, file)); files.set(candidate.id, stored);
        log(actorId, 'attachmentsUpdated', candidate.id, attachments.map(item => item.slot));
      }
      log(actorId, isNew ? 'created' : 'updated', candidate.id, changed([...profileKeys, ...assignmentKeys, 'status']));
      if (changed(assignmentKeys).length) log(actorId, 'assigned', candidate.id, changed(assignmentKeys));
      if (candidate.status !== previous?.status) log(actorId, 'statusChanged', candidate.id, ['status', previous?.status || 'Pending', candidate.status]);
      return clean(candidate);
    }
    function setStatus(actorId, targetId, status) {
      const target = user(targetId); requireAction(actorId, 'status', target);
      if (targetId === actorId || target.roleId === 'owner') throw new Error('ownerProtected');
      if (!['Active', 'Disabled', 'Pending'].includes(status)) throw new Error('invalid');
      persistence.save?.({...copy(target), status});
      const before = target.status; target.status = status; log(actorId, 'statusChanged', targetId, ['status', before, status]);
    }
    function grant(actorId, targetId, entry) {
      const target = user(targetId); requireAction(actorId, 'grant', target);
      if ((String(entry.action).startsWith('bank_')||String(entry.action).startsWith('finance_')||String(entry.action).startsWith('customer_')||String(entry.action).startsWith('vehicle_')||String(entry.action).startsWith('ledger_')||String(entry.action).startsWith('hr_')) && !['group', 'company'].includes(entry.scope?.type)) throw new Error('denied');
      if (targetId === actorId || target.roleId === 'owner' || !actions.includes(entry.action) || !validScope(entry.scope)) throw new Error('denied');
      if (!effective(actorId, 'grant').some(g => scopeContains(g.scope, entry.scope))) throw new Error('denied');
      if (!isOwner(actorId) && !effective(actorId, 'redelegate').some(g => scopeContains(g.scope, entry.scope))) throw new Error('denied');
      const rights = effective(actorId, entry.action);
      if (!rights.some(g => scopeContains(g.scope, entry.scope))) throw new Error('denied');
      // Managing grants does not by itself authorize passing that management power on.
      if ((entry.delegable || entry.action === 'grant' || entry.action === 'redelegate') && !effective(actorId, 'redelegate').some(g => scopeContains(g.scope, entry.scope))) throw new Error('denied');
      if (!isOwner(actorId) && !rights.some(g => g.delegable && scopeContains(g.scope, entry.scope))) throw new Error('denied');
      const list = grants.get(targetId) || [];
      if (list.some(g => g.action === entry.action && JSON.stringify(g.scope) === JSON.stringify(entry.scope))) throw new Error('duplicate');
      const saved = { id: `grant-${++sequence}`, action:entry.action, scope:copy(entry.scope), delegable:entry.delegable === true, issuer:actorId };
      list.push(saved); grants.set(targetId, list); persistence.grantsChanged?.(grantSnapshot()); log(actorId, 'granted', targetId, [saved.action, saved.scope.type, saved.scope.id, saved.delegable ? 'redelegate' : 'nonDelegable']);
      return copy(saved);
    }
    function revoke(actorId, targetId, grantId) {
      const target = user(targetId); requireAction(actorId, 'grant', target);
      const list = grants.get(targetId) || [], entry = list.find(g => g.id === grantId);
      if (!entry || (!isOwner(actorId) && entry.issuer !== actorId)) throw new Error('denied');
      // Also remove downstream grants issued using this authority. Conservatively revoke all descendants.
      const visited = new Set();
      function cascade(issuer) {
        if (visited.has(issuer)) return; visited.add(issuer);
        for (const [id, entries] of grants) {
          const removed = entries.filter(g => g.issuer === issuer);
          if (removed.length) { grants.set(id, entries.filter(g => g.issuer !== issuer)); log(actorId, 'revoked', id, removed.map(g => g.action)); cascade(id); }
        }
      }
      grants.set(targetId, list.filter(g => g.id !== grantId)); log(actorId, 'revoked', targetId, [entry.action]); cascade(targetId); persistence.grantsChanged?.(grantSnapshot());
    }
    return {
      actions, companies, departments,
      summary() { const rows=[...records.values()];return {total:rows.length,active:rows.filter(u=>u.status==='Active').length,byRole:Object.fromEntries(roles.map(r=>[r.id,rows.filter(u=>u.roleId===r.id).length]))}; },
      bankPermissions(id, companyId) { return bankActions.filter(action => effective(id, 'bank_' + action).some(g => g.scope.type === 'group' || g.scope.type === 'company' && g.scope.id === companyId)); },
      syncDirectories(state) { companies.splice(0, companies.length, ...copy(state.companies)); departments.splice(0, departments.length, ...copy(state.departments)); },
      get: (actorId, id) => visible(actorId, user(id) || {}) ? clean(user(id)) : null,
      list: actorId => [...records.values()].filter(u => visible(actorId, u)).map(clean),
      actor: id => user(id) ? clean(user(id)) : null,
      can, has: (id, action) => effective(id, action).length > 0,
      update, setStatus, grant, revoke,
      grants: (actorId, targetId) => visible(actorId, user(targetId) || {}) ? copy(grants.get(targetId) || []) : [],
      reset(actorId, targetId) { requireAction(actorId, 'reset', user(targetId)); log(actorId, 'resetRequested', targetId); },
      files(actorId, targetId) { requireAction(actorId, 'attachments', user(targetId)); return [...(files.get(targetId) || new Map())].map(([slot, file]) => ({slot, name:file.name, type:file.type})); },
      file(actorId, targetId, slot) { requireAction(actorId, 'attachments', user(targetId)); const file=files.get(targetId)?.get(slot); if (!file) throw new Error('invalid'); log(actorId,'attachmentViewed',targetId,[slot]); return file; },
      audit: actorId => audit.filter(row => isOwner(actorId) || row.actorId === actorId).map(copy),
      enter(actorId, targetId) { if (!visible(actorId, user(targetId) || {})) throw new Error('denied'); }
    };
  }
  const messages = {
    ar: {
      contracting_view:'عرض الشركات المتعاقدة',contracting_create:'إضافة شركة متعاقدة',contracting_edit:'تعديل شركة متعاقدة',contracting_activate:'تفعيل شركة متعاقدة',contracting_deactivate:'تعطيل شركة متعاقدة',contracting_contracts:'إدارة عقود الشركات المتعاقدة',
      title:'إدارة المستخدمين والتعيينات', demo:'وضع تجريبي — استخدم بيانات وهمية فقط. بيانات هذه الشاشة والمرفقات والتفويضات وسجل التدقيق تبقى في ذاكرة الصفحة وتُفقد عند إعادة تحميلها. الحسابات الجديدة لا تسجّل الدخول قبل ربط Backend آمن.',
      search:'البحث بالاسم أو اسم المستخدم أو البريد', searchButton:'بحث / تصفية', displayName:'المستخدم', nonDelegable:'لا يجوز إعادة تفويضها', all:'الكل', add:'إضافة مستخدم', profile:'عرض / تعديل الملف', save:'حفظ', cancel:'إغلاق', identity:'البيانات الشخصية', assignment:'التعيين والارتباط الإداري',
      nameAr:'الاسم بالعربية', nameEn:'الاسم بالإنجليزية', emiratesId:'الهوية الإماراتية', nationality:'الجنسية', phone:'رقم الهاتف', email:'البريد الإلكتروني', jobTitle:'المسمى الوظيفي', hireDate:'تاريخ التعيين', username:'اسم المستخدم', status:'حالة الحساب', managerId:'المسؤول المباشر', companyIds:'الشركات المرتبطة', departmentIds:'الإدارات المرتبطة',
      Active:'نشط', Pending:'قيد الانتظار', Disabled:'موقوف', attachmentsTitle:'المرفقات الشخصية', photo:'الصورة الشخصية', idFront:'الهوية — الأمام', idBack:'الهوية — الخلف', passport:'جواز السفر', contract:'عقد العمل', driving:'رخصة القيادة (اختياري)', fileHint:'PNG أو JPEG أو PDF، حتى 5 MB لكل ملف. الصور الشخصية PNG أو JPEG فقط. اختيار ملف جديد يستبدل ملف الجلسة بعد الحفظ. لا تستخدم وثائق حقيقية. تحديث المرفقات يتطلب صلاحية التعديل والاطلاع معًا.', open:'عرض', none:'لا يوجد',
      permissions:'الصلاحيات والتفويضات', create:'إضافة مستخدم', edit:'تعديل بيانات مستخدم', statusAction:'تفعيل / إيقاف حساب', assign:'تعيين الوظيفة والمسؤول والارتباطات', grant:'منح وتعديل الصلاحيات', reset:'طلب إعادة تعيين الدخول', attachments:'الاطلاع على المرفقات الشخصية', redelegate:'السماح الصريح بإعادة التفويض',
      group:'المجموعة', company:'شركة', department:'إدارة', reports:'موظفون تابعون لمسؤول', scope:'النطاق', scopeId:'الشركة / الإدارة / المسؤول', action:'الصلاحية', delegable:'يمكن إعادة تفويض هذه الصلاحية (يتطلب تفويضًا صريحًا)', grantButton:'منح الصلاحية', revoke:'سحب', inherited:'صلاحيات الأدوار الحالية محفوظة ولا تُعدّل من هذه الشاشة.',
      resetButton:'محاكاة طلب إعادة تعيين الدخول', resetConfirm:'سيُسجل طلب تجريبي فقط، دون تغيير كلمة المرور أو إرسال رسالة. هل تريد المتابعة؟', resetDone:'سُجّل الطلب التجريبي. الإرسال والرابط الآمن وتغيير بيانات الدخول تتطلب Backend.',
      saved:'حُفظت التغييرات في الجلسة فقط.', granted:'مُنحت الصلاحية في الجلسة.', revoked:'سُحب التفويض والتفويضات التابعة له في الجلسة.', statusConfirm:'هل تريد تغيير حالة الحساب في هذه الجلسة؟', audit:'سجل التدقيق التجريبي', auditHint:'المالك يرى جميع عمليات الجلسة؛ الآخرون يرون عملياتهم فقط. لا يحتوي السجل على قيم الهوية أو محتوى الملفات.', at:'الوقت (دبي)', actor:'منفذ الإجراء', target:'المستخدم', event:'العملية', fields:'الحقول / النطاق', noResults:'لا توجد نتائج', readOnly:'عرض فقط حسب صلاحياتك الحالية.',
      denied:'الإجراء غير مسموح أو خارج نطاق تفويضك.', invalid:'تحقق من الأسماء والبريد واسم المستخدم والتاريخ والارتباطات.', duplicate:'اسم المستخدم أو البريد أو التفويض موجود بالفعل.', invalidId:'صيغة الهوية الإماراتية غير صحيحة (تبدأ بـ 784 وتتكون من 15 رقمًا).', cycle:'المسؤول المباشر غير صالح أو يؤدي إلى حلقة إدارية.', departmentCompany:'اختر الشركة التابعة للإدارة المحددة.', fileError:'نوع الملف أو حجمه غير مسموح.', ownerProtected:'لا يمكن إيقاف حساب المالك أو إيقاف حسابك بنفسك.', scopeTarget:'يجب أن يكون المستخدم ضمن النطاق الذي تمنحه.', created:'إنشاء مستخدم', updated:'تعديل ملف', assigned:'تعيين إداري', statusChanged:'تغيير حالة', attachmentsUpdated:'تحديث مرفقات', attachmentViewed:'عرض مرفق', resetRequested:'طلب إعادة تعيين تجريبي',
      activate:'تفعيل', disable:'إيقاف', filePreview:'معاينة المرفق', close:'إغلاق المعاينة', confirmRevoke:'سحب هذا التفويض والتفويضات التابعة له؟', total:'المستخدمون الظاهرون',
    },
    en: {
      contracting_view:'View contracting companies',contracting_create:'Create contracting company',contracting_edit:'Edit contracting company',contracting_activate:'Activate contracting company',contracting_deactivate:'Deactivate contracting company',contracting_contracts:'Manage contracting-company contracts',
      title:'Users & assignments', demo:'Demo — use fictional data only. Profiles, files, grants and audit entries on this screen stay in page memory and disappear on reload. New accounts cannot sign in until a secure backend is connected.',
      search:'Search name, username or email', searchButton:'Search / filter', displayName:'User', nonDelegable:'Cannot re-delegate', all:'All', add:'Add user', profile:'View / edit profile', save:'Save', cancel:'Close', identity:'Personal information', assignment:'Job & reporting assignments',
      nameAr:'Arabic name', nameEn:'English name', emiratesId:'Emirates ID', nationality:'Nationality', phone:'Phone', email:'Email', jobTitle:'Job title', hireDate:'Hire date', username:'Username', status:'Account status', managerId:'Direct manager', companyIds:'Linked companies', departmentIds:'Linked departments',
      Active:'Active', Pending:'Pending', Disabled:'Disabled', attachmentsTitle:'Personal attachments', photo:'Profile photo', idFront:'Emirates ID — front', idBack:'Emirates ID — back', passport:'Passport', contract:'Employment contract', driving:'Driving licence (optional)', fileHint:'PNG, JPEG or PDF, up to 5 MB each. Profile photos must be PNG or JPEG. A new selection replaces the session file after saving. Never use real documents. Updating files requires both edit and attachment access.', open:'View', none:'None',
      permissions:'Permissions & delegation', create:'Create user', edit:'Edit user profile', statusAction:'Activate / disable account', assign:'Assign job, manager and memberships', grant:'Manage permission grants', reset:'Request sign-in reset', attachments:'View personal attachments', redelegate:'Explicit permission to re-delegate',
      group:'Group', company:'Company', department:'Department', reports:'Employees reporting to a manager', scope:'Scope', scopeId:'Company / department / manager', action:'Permission', delegable:'May re-delegate this permission (requires explicit delegation authority)', grantButton:'Grant permission', revoke:'Revoke', inherited:'Existing role permissions are preserved and cannot be changed here.',
      resetButton:'Simulate sign-in reset request', resetConfirm:'This only records a demo request. It does not change a password or send a message. Continue?', resetDone:'Demo request recorded. Delivery, secure reset links and credential changes require a backend.',
      saved:'Changes saved for this page session only.', granted:'Permission granted for this session.', revoked:'Grant and downstream grants revoked for this session.', statusConfirm:'Change this account status for this session?', audit:'Demo audit log', auditHint:'The owner sees all session events; others see their own events only. No ID values or file contents are recorded.', at:'Time (Dubai)', actor:'Actor', target:'User', event:'Action', fields:'Fields / scope', noResults:'No results', readOnly:'Read-only under your current permissions.',
      denied:'Action denied or outside your delegated scope.', invalid:'Check names, email, username, date and memberships.', duplicate:'Username, email or permission grant already exists.', invalidId:'Invalid Emirates ID (15 digits starting with 784).', cycle:'Invalid manager or reporting cycle.', departmentCompany:'Select the company associated with each selected department.', fileError:'File type or size is not allowed.', ownerProtected:'You cannot disable the owner or your own account.', scopeTarget:'The recipient must belong to the scope being granted.', created:'User created', updated:'Profile updated', assigned:'Assignment updated', statusChanged:'Status changed', attachmentsUpdated:'Attachments updated', attachmentViewed:'Attachment viewed', resetRequested:'Demo reset requested',
      activate:'Activate', disable:'Disable', filePreview:'Attachment preview', close:'Close preview', confirmRevoke:'Revoke this grant and its downstream grants?', total:'Visible users',
    }
  };
  Object.assign(messages.ar, {
    demo:'وضع تجريبي — استخدم بيانات وهمية فقط. الملفات الشخصية الحساسة والمرفقات والتفويضات والتدقيق في ذاكرة الصفحة. خيار الدخول المحلي يحفظ بيانات الدليل الأساسية ومشتق كلمة المرور في هذا المتصفح فقط؛ ليس مصادقة آمنة أو حساباً مركزياً.',
    legacyLoginNote:'هذا حساب دخول تجريبي سابق. تعديل الملف واسم المستخدم هنا للجلسة فقط ولا يغيّر بيانات دخوله الأصلية المحفوظة. تغيير بيانات الدخول الفعلي يحتاج خدمة مصادقة آمنة.',
    demoLogin:'بيانات دخول تجريبية محلية (اختياري)', enableDemoLogin:'إنشاء دخول تجريبي محفوظ في هذا المتصفح',
    demoLoginNote:'استخدم كلمة مرور وهمية من 12 إلى 128 حرفاً تشمل حرفاً كبيراً وصغيراً ورقماً ورمزاً، دون مسافات. يُحفظ مشتق مملّح فقط مع الاسم وبيانات التواصل والارتباطات الأساسية؛ لا تُحفظ الهوية أو الجنسية أو المرفقات. الحساب النشط يمكنه الدخول هنا فقط. دون هذا الخيار يبقى الملف للجلسة. اختيار دور غير الموظف عند الإنشاء متاح للمالك فقط.',
    demoPassword:'كلمة مرور تجريبية', demoConfirm:'تأكيد كلمة المرور التجريبية', baseRole:'الدور الأساسي', savedLocalLogin:'حُفظ دليل الدخول التجريبي محلياً؛ البيانات الحساسة والمرفقات والتفويضات تبقى للجلسة فقط.',
    demoLoginSaved:'حفظ دليل الدخول التجريبي', mismatch:'كلمتا المرور غير متطابقتين.', weak:'كلمة المرور لا تستوفي المتطلبات المعروضة.', cryptoUnavailable:'تجهيز الدخول المحلي غير متاح؛ يلزم متصفح يدعم Web Crypto عبر HTTPS أو localhost.', credentialStorageInvalid:'تعذر قراءة دليل الدخول المحلي؛ لم يُستبدل أو يُحذف.', storageFailed:'فشل حفظ دليل الدخول والتحقق منه؛ لم يُعتمد التغيير.',
    bank_view:'البنوك: عرض الحسابات', bank_create:'البنوك: إنشاء حساب', bank_edit:'البنوك: تعديل حساب', bank_close:'البنوك: إغلاق حساب', bank_view_documents:'البنوك: عرض المستندات', bank_manage_documents:'البنوك: إضافة مستندات'
  });
  Object.assign(messages.en, {
    demo:'Demo — use fictional data only. Sensitive profiles, files, grants and audit stay in page memory. Optional local sign-in saves basic directory metadata and a password verifier in this browser only; it is not secure authentication or a central account.',
    legacyLoginNote:'This is a legacy demo sign-in account. Session profile/username edits do not change its existing saved sign-in credentials. Actual credential changes require secure authentication services.',
    demoLogin:'Local demo sign-in (optional)', enableDemoLogin:'Create sign-in saved in this browser',
    demoLoginNote:'Use a fictional 12–128 character password with uppercase, lowercase, digit and symbol, without spaces. Only a salted verifier plus names, contact and basic membership metadata are saved; never ID, nationality or files. Active accounts can sign in here only. Without this option the profile is session-only. Only the owner can choose a non-employee role at creation.',
    demoPassword:'Demo password', demoConfirm:'Confirm demo password', baseRole:'Base role', savedLocalLogin:'Demo sign-in directory saved locally; sensitive data, files and grants remain session-only.',
    demoLoginSaved:'Demo sign-in directory saved', mismatch:'Passwords do not match.', weak:'Password does not meet the displayed requirements.', cryptoUnavailable:'Local sign-in setup unavailable; use a Web Crypto browser over HTTPS or localhost.', credentialStorageInvalid:'Local sign-in directory could not be read; it was not overwritten or deleted.', storageFailed:'Sign-in directory saving/verification failed; changes were not committed.',
    bank_view:'Bank accounts: view', bank_create:'Bank accounts: create', bank_edit:'Bank accounts: edit', bank_close:'Bank accounts: close', bank_view_documents:'Bank documents: view', bank_manage_documents:'Bank documents: add'
  });
  let service, selected = null, notice = '', query = '', previewUrl;
  for(const [k,ar] of Object.entries({"view": "عرض ملفات الموظفين", "create": "إنشاء موظف", "edit": "تعديل موظف", "private": "الهوية والعقد والبيانات الخاصة", "documents": "عرض وثائق الموظفين", "document_update": "إضافة إصدارات وثائق", "document_review": "مراجعة وثائق الموظفين", "leave_approve": "اعتماد الإجازات", "account_status": "إيقاف الدخول وإعادة تفعيله", "task_manage": "إدارة المهام التشغيلية", "task_delegate": "تفويض المهام دون صلاحية مالية", "evaluation_models": "نماذج تقييم الموظفين", "evaluation_weights": "أوزان التقييم", "evaluation_view": "عرض التقييم التفصيلي", "evaluation_approve": "اعتماد تقييم شهري", "evaluation_visibility": "ضبط ظهور التقييم", "salary_view": "عرض الرواتب", "salary_edit": "تعديل الراتب والتوزيع", "payroll_prepare": "إعداد مسير الرواتب", "payroll_approve": "اعتماد مسير الرواتب", "awards": "المكافآت والحوافز", "deductions": "الخصومات القانونية", "coaching": "خطط التأهيل", "termination": "طلبات إنهاء الخدمة", "clearance": "إخلاء الطرف والعهد", "eos_view": "تقدير نهاية الخدمة", "reserve": "المخصصات والاحتياطي", "library_view": "عرض المكتبة المركزية", "library_download": "تنزيل وثائق المكتبة", "library_manage": "إدارة إصدارات المكتبة", "configure": "إعدادات شؤون الموظفين", "audit": "تدقيق شؤون الموظفين", "export": "تصدير الموظفين"})){messages.ar['hr_'+k]='شؤون الموظفين: '+ar;messages.en['hr_'+k]='Personnel: '+k.replaceAll('_',' ');}
  const financeLabels={view:['عرض العمليات المالية','View finance'],create:['إنشاء عملية مالية','Create finance operation'],approve:['اعتماد مالي','Approve finance'],cheques:['إدارة الشيكات','Manage cheques'],custody:['تسجيل العهد والتسليم','Record custody/handover'],receive_custody:['تأكيد استلام العهدة','Confirm custody receipt'],reconcile:['المطابقة البنكية','Reconcile banks'],chart:['تهيئة دليل الحسابات','Configure chart'],notifications:['تحديد مستلمي الإشعار','Configure notification recipients'],print:['طباعة تقارير مالية','Print finance reports'],export:['تصدير تقارير مالية','Export finance reports'],sensitive:['البيانات المالية الحساسة','Sensitive finance data']};
  for(const [k,v] of Object.entries(financeLabels)){messages.ar['finance_'+k]=v[0];messages.en['finance_'+k]=v[1];}
  for(const [k,ar] of Object.entries({view:'عرض العملاء',create:'إنشاء عميل',edit:'تعديل عميل',status:'إيقاف وتفعيل العميل',transfer:'نقل العميل',export:'تصدير العملاء',print:'طباعة العملاء',documents:'وثائق العملاء',relations:'علاقات العملاء',followup:'المتابعة والاتصالات',review:'مراجعة التكرار والاستثناءات',audit:'سجل تدقيق العملاء',notify:'استلام إشعارات العملاء',configure:'إعدادات متابعة العملاء',import:'استيراد العملاء',undertaking_issue:'إصدار تعهد',undertaking_edit:'تعديل التعهد',undertaking_cancel:'إلغاء التعهد',undertaking_complete:'استكمال التعهد'})){messages.ar['customer_'+k]=ar;messages.en['customer_'+k]='Customers: '+k.replaceAll('_',' ');}
  for(const [k,ar] of Object.entries({view:'عرض المركبات',create:'إنشاء طلب ومركبة',edit:'تعديل المركبة',funding_approve:'اعتماد التمويل',disburse:'صرف التمويل والموردين',receive_funds:'استلام عهدة التمويل',settle_custody:'تسوية عهدة التمويل',invoices:'إصدار فواتير المركبة',collect:'تخصيص التحصيل',approve:'اعتماد المعالجات والإنهاء',reschedule:'إعادة جدولة التمويل',reschedule_extend:'اعتماد تمديد الجدولة',sale:'إنشاء طلب بيع',sale_approve:'اعتماد البيع',print:'طباعة مستندات المركبة',export:'تصدير تقارير المركبات',insurance:'إدارة التأمين',gps:'إدارة GPS دون تفعيل الربط',location:'الاطلاع على بيانات الموقع',keys:'إدارة المفاتيح',circular_issue:'إصدار تعميم مركبات',circular_complete:'استكمال متطلب تعميم',circular_exception:'اعتماد استثناء تعميم',recovery:'متابعة الاسترداد',recovery_approve:'اعتماد إدراج للاسترداد',recovery_assign:'إسناد مندوب الاسترداد',recovery_close:'إغلاق مهمة الاسترداد',settlement:'إدارة تسوية المركبة',writeoff_approve:'اعتماد الشطب المحاسبي',configure:'إعدادات المركبات والقوالب',documents:'وثائق المركبات',notify:'تلقي إشعارات المركبات',audit:'سجل تدقيق المركبات',import:'استيراد المركبات'})){messages.ar['vehicle_'+k]=ar;messages.en['vehicle_'+k]='Vehicles: '+k.replaceAll('_',' ');}
  function t(key) { return messages[getLocale() === 'ar' ? 'ar' : 'en'][key] || key; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getService() { if (!service) service = createService({...app.state, users:[...app.state.users, ...DemoCredentials.directory()]}, undefined, {initialGrants:globalThis.ABCentral?.enabled?globalThis.ABCentral.grants:[],initialAudit:globalThis.ABCentral?.enabled?globalThis.ABCentral.audit:[],save:(candidate, verifier)=>DemoCredentials.saveProfile(candidate, verifier)}); else service.syncDirectories(app.state); return service; }
  function actorId() { return app.state.currentUser?.id; }
  function name(user) { return (getLocale() === 'ar' ? user.nameAr : user.nameEn) || user.fullName || user.username; }
  function hydrated(u) {
    return {nameAr:'', nameEn:u?.fullName || '', emiratesId:'', nationality:'', phone:'', email:'', jobTitle:'', hireDate:'', managerId:'', companyIds:u?.companyId ? [u.companyId] : [], departmentIds:u?.departmentId ? [u.departmentId] : [], ...u};
  }
  function option(value, label, chosen) { return `<option value="${esc(value)}" ${chosen ? 'selected' : ''}>${esc(label)}</option>`; }
  function field(key, value, disabled, type = 'text', required = false) {
    return `<div class="form-group"><label for="um-${key}">${(globalThis.ABCentral?.enabled&&key==='demoPassword'?(getLocale()==='ar'?'كلمة المرور':'Password'):globalThis.ABCentral?.enabled&&key==='demoConfirm'?(getLocale()==='ar'?'تأكيد كلمة المرور':'Confirm password'):t(key))}</label><input id="um-${key}" class="input" name="${key}" type="${type}" value="${esc(value)}" ${disabled ? 'disabled' : ''} ${required ? 'required' : ''} maxlength="${type === 'password' ? '128' : key === 'emiratesId' ? '18' : '160'}" ${type==='password'?'autocomplete="new-password"':''} /></div>`;
  }
  function selectField(key, options, values, disabled, multiple = false) {
    return `<div class="form-group"><label for="um-${key}">${t(key)}</label><select id="um-${key}" class="input" name="${key}" ${disabled ? 'disabled' : ''} ${multiple ? 'multiple size="4"' : ''}>${multiple ? '' : option('',t('none'),!values[0])}${options.map(o=>option(o.id,o.label,values.includes(o.id))).join('')}</select></div>`;
  }
  function renderEditor() {
    if (selected === null) return '';
    const s=getService(), actor=actorId(), existing=selected ? s.get(actor,selected) : null;
    if (selected && !existing) { selected=null;return ''; }
    const u=hydrated(existing), isNew=!existing;
    const has=(action)=>isNew?s.has(actor,action):s.can(actor,action,existing);
    const owner=existing?.roleId==='owner';
    const basic=isNew?s.has(actor,'create'):has('edit'), assign=has('assign'), status=has('status')&&!owner&&selected!==actor;
    const companyOptions=s.companies.map(c=>({id:c.id,label:c.englishName||c.name||c.id}));
    const departmentOptions=s.departments.map(d=>({id:d.id,label:d.name}));
    const managerOptions=s.list(actor).filter(v=>v.id!==selected).map(v=>({id:v.id,label:name(v)}));
    const attachmentAllowed=has('attachments'), attachmentWritable=attachmentAllowed&&basic;
    const attachmentList=!isNew&&attachmentAllowed?s.files(actor,selected):[];
    return `<section class="content-panel um-editor" id="um-editor"><div class="section-head"><h2>${isNew?t('add'):esc(name(existing))}</h2><button class="ghost-btn" type="button" data-um="close">${t('cancel')}</button></div>
      <p class="muted">${t('inherited')}</p>${existing&&app.state.users.some(v=>v.id===existing.id)?`<p class="muted">${t('legacyLoginNote')}</p>`:''}<p class="muted">${localeText('role')}: ${esc(getRoleName(existing?.roleId || 'employee'))}</p>
      <form id="um-profile" data-user-id="${esc(existing?.id||'')}" data-user-revision="${existing?.revision||''}"><h3>${t('identity')}</h3><div class="form-grid">
      ${['nameAr','nameEn','emiratesId','nationality','phone','email','username'].map(k=>field(k,u[k],!basic,k==='email'?'email':k==='phone'?'tel':'text',['nameAr','nameEn','email','username'].includes(k))).join('')}
      <div class="form-group"><label for="um-status">${t('status')}</label><select id="um-status" name="status" class="input" ${status?'':'disabled'}>${['Pending','Active','Disabled'].map(v=>option(v,t(v),v===(u.status||'Pending'))).join('')}</select></div>
      </div>${isNew&&globalThis.ABCentral?.enabled?`<fieldset class="um-login-setup" data-central-credentials="true"><legend>${getLocale()==='ar'?'بيانات الدخول المركزية':'Central sign-in credentials'}</legend><p class="muted">${getLocale()==='ar'?'كلمة مرور من 12 إلى 128 خانة، تشمل حرفاً كبيراً وصغيراً ورقماً ورمزاً دون مسافات. تُنشأ لدى خدمة المصادقة ولا تُحفظ في المتصفح.':'Use 12–128 characters including uppercase, lowercase, a number and a symbol, without spaces. Credentials are enrolled through the authentication service, not browser storage.'}</p><div class="form-grid">${field('demoPassword','',false,'password',true)}${field('demoConfirm','',false,'password',true)}<div><label for="um-base-role">${t('baseRole')}</label><select class="input" id="um-base-role" name="baseRole" ${s.actor(actor)?.roleId==='owner'?'':'disabled'}>${app.state.roles.filter(r=>r.id!=='owner').map(r=>option(r.id,r.name,r.id==='employee')).join('')}</select></div></div></fieldset>`:''}${isNew&&!globalThis.ABCentral?.enabled?`<fieldset class="um-login-setup"><legend>${t('demoLogin')}</legend><p class="muted">${t('demoLoginNote')}</p><label class="um-checkbox"><input type="checkbox" id="um-local-login" name="localLogin" />${t('enableDemoLogin')}</label><div class="form-grid">${field('demoPassword','',true,'password')}${field('demoConfirm','',true,'password')}<div><label for="um-base-role">${t('baseRole')}</label><select class="input" id="um-base-role" name="baseRole" ${s.actor(actor)?.roleId==='owner'?'':'disabled'}>${app.state.roles.filter(r=>r.id!=='owner').map(r=>option(r.id,r.name,r.id==='employee')).join('')}</select></div></div></fieldset>`:''}<h3>${t('assignment')}</h3><div class="form-grid">
      ${field('jobTitle',u.jobTitle,!assign)}${field('hireDate',u.hireDate,!assign,'date')}
      ${selectField('managerId',managerOptions,[u.managerId],!assign)}
      ${selectField('companyIds',companyOptions,u.companyIds,!assign,true)}
      ${selectField('departmentIds',departmentOptions,u.departmentIds,!assign,true)}
      </div>
      ${attachmentAllowed?`<h3>${t('attachmentsTitle')}</h3><p class="muted">${t('fileHint')}</p><div class="form-grid">${['photo','idFront','idBack','passport','contract','driving'].map(slot=>`<div class="form-group"><label for="um-file-${slot}">${t(slot)}</label>${attachmentWritable?`<input id="um-file-${slot}" name="file-${slot}" type="file" accept="${slot==='photo'?'image/png,image/jpeg':'image/png,image/jpeg,application/pdf'}" />`:``}${attachmentList.some(f=>f.slot===slot)?`<button type="button" class="ghost-btn" data-um="file" data-slot="${slot}">${t('open')}: ${esc(attachmentList.find(f=>f.slot===slot).name)}</button>`:''}</div>`).join('')}</div>`:''}
      <p role="status" aria-live="polite" data-user-save-status></p>${basic||assign||status||attachmentWritable?`<button type="submit" class="primary-btn">${t('save')}</button>`:`<p>${t('readOnly')}</p>`}</form>
      ${!isNew&&!owner&&globalThis.ABCentral?.enabled&&s.actor(actor)?.roleId==='owner'?`<form id="um-company-rights" class="form-grid" data-user="${esc(selected)}" data-revision="${u.revision||1}"><h3 class="full">${getLocale()==='ar'?'صلاحيات الشركات المستقلة':'Independent company permissions'}</h3><p class="full">${getLocale()==='ar'?'التوريث يحافظ على المنح الحالية. لا يُطبّق تغيير قبل حفظ المالك. لا تتغير صلاحية العرض.':'Inherit preserves existing grants. Changes apply only when the owner saves. View access is unchanged.'}</p>${['edit','activate','deactivate'].map(action=>`<label>${getLocale()==='ar'?({edit:'تعديل بيانات الشركة',activate:'تفعيل الشركة',deactivate:'تعطيل الشركة'})[action]:({edit:'Edit company',activate:'Activate company',deactivate:'Deactivate company'})[action]}<select class="input" name="${action}">${['inherit','allow','deny'].map(effect=>`<option value="${effect}" ${(u.companyPermissions?.[action]||'inherit')===effect?'selected':''}>${getLocale()==='ar'?({inherit:'توريث الصلاحيات الحالية',allow:'سماح',deny:'منع'})[effect]:effect}</option>`).join('')}</select></label>`).join('')}<button type="submit" class="secondary-btn">${getLocale()==='ar'?'حفظ صلاحيات الشركات':'Save company permissions'}</button></form>`:''}
      ${!isNew?`<h3>${t('permissions')}</h3><div class="um-grants">${s.grants(actor,selected).map(g=>`<div class="um-grant"><span>${t(g.action==='status'?'statusAction':g.action)} · ${t(g.scope.type)} ${esc(g.scope.type==='company'?(s.companies.find(c=>c.id===g.scope.id)?.englishName||g.scope.id):g.scope.type==='department'?(s.departments.find(d=>d.id===g.scope.id)?.name||g.scope.id):g.scope.type==='reports'?name(s.actor(g.scope.id)||{}):'')} ${g.delegable?'· '+t('redelegate'):''}</span>${has('grant')?`<button class="ghost-btn" data-um="revoke" data-grant="${esc(g.id)}">${t('revoke')}</button>`:''}</div>`).join('')||`<p class="muted">${t('none')}</p>`}</div>
      ${has('grant')&&!owner&&selected!==actor?`<form id="um-grant" class="form-grid"><div><label for="um-action">${t('action')}</label><select id="um-action" name="action" class="input">${actions.filter(action=>s.has(actor,action)).map(action=>option(action,t(action==='status'?'statusAction':action),false)).join('')}</select></div><div><label for="um-scope">${t('scope')}</label><select class="input" id="um-scope" name="scope">${['group','company','department','reports'].map(v=>option(v,t(v),false)).join('')}</select></div><div id="um-scope-options"></div><label class="um-checkbox"><input type="checkbox" name="delegable" ${s.has(actor,'redelegate')?'':'disabled'} />${t('delegable')}</label><button type="submit" class="secondary-btn">${t('grantButton')}</button></form>`:''}
      ${has('reset')?`<button class="secondary-btn" data-um="reset">${t('resetButton')}</button>`:''}`:''}
    </section>`;
  }
  function renderPage() {
    const s=getService(),actor=actorId();
    if (!actor || s.actor(actor)?.status!=='Active') return `<section class="content-panel">${t('denied')}</section>`;
    const visible=s.list(actor).map(u=>({...u,displayName:name(u),companyNames:hydrated(u).companyIds.map(id=>s.companies.find(c=>c.id===id)?.englishName||id).join(' · '),departmentNames:hydrated(u).departmentIds.map(id=>s.departments.find(d=>d.id===id)?.name||id).join(' · ')}));
    const keys=['displayName','username','jobTitle','status','companyNames','departmentNames'];const register=RegisterView.select('users',visible,keys,{query,search:u=>[u.nameAr,u.nameEn,u.fullName,u.username,u.email,u.phone,u.jobTitle,u.companyNames,u.departmentNames]});const rows=register.rows;
    return `<div class="um-page"><div class="company-desc" role="note">${t('demo')}</div><div id="um-notice" role="status" aria-live="polite">${notice?esc(t(notice)):''}</div><section class="content-panel"><div class="section-head"><h2>${t('title')}</h2>${s.has(actor,'create')?`<button class="secondary-btn" data-um="new">${t('add')}</button>`:''}</div>
      <form id="um-filters" class="register-search"><div><label for="um-search">${t('search')}</label><input class="input" type="search" id="um-search" name="query" value="${esc(query)}" /></div><button class="ghost-btn" type="submit">${t('searchButton')}</button></form>
      <p>${t('total')}: ${rows.length}</p><div class="table-wrap" data-register-view="users"><table><thead><tr>${keys.map(k=>`<th>${RegisterTools.head(k,t(({companyNames:'companyIds',departmentNames:'departmentIds'})[k]||k),register.facets[k]||[],register.state,k==='status'?t:undefined)}</th>`).join('')}<th>${t('action')}</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${esc(name(u))}</td><td>${esc(u.username)}</td><td>${esc(u.jobTitle||'—')}</td><td><span class="badge ${u.status==='Active'?'active':u.status==='Pending'?'pending':'disabled'}">${t(u.status)}</span></td><td>${esc(u.companyNames)}</td><td>${esc(u.departmentNames)}</td><td><div class="row-actions"><button class="ghost-btn" data-um="profile" data-id="${esc(u.id)}">${t('profile')}</button>${s.can(actor,'status',u)&&u.roleId!=='owner'&&u.id!==actor?`<button class="ghost-btn" data-um="status" data-id="${esc(u.id)}">${t(u.status==='Active'?'disable':'activate')}</button>`:''}</div></td></tr>`).join('')||`<tr><td colspan="5">${t('noResults')}</td></tr>`}</tbody></table></div></section>${renderEditor()}
      <dialog id="um-preview"><button class="ghost-btn" data-um="close-preview">${t('close')}</button><h3>${t('filePreview')}</h3><div id="um-preview-body"></div></dialog></div>`;
  }
  function refresh(text = '') { notice=text;render(); }
  function scopeOptions() {
    const type=document.getElementById('um-scope')?.value,container=document.getElementById('um-scope-options');if(!container)return;
    const s=getService(),options=type==='company'?s.companies.map(c=>({id:c.id,label:c.englishName||c.name})):type==='department'?s.departments.map(d=>({id:d.id,label:d.name})):s.list(actorId()).map(u=>({id:u.id,label:name(u)}));
    container.innerHTML=type==='group'?'':`<label for="um-scope-id">${t('scopeId')}</label><select class="input" id="um-scope-id" name="scopeId" required>${options.map(o=>option(o.id,o.label,false)).join('')}</select>`;
  }
  function bind() {
    if(app.state.currentPage!=='users')return;
    const s=getService();
    const run=fn=>{try{fn();}catch(error){const n=document.getElementById('um-notice');if(n){notice=error.message;n.textContent=t(error.message);n.scrollIntoView({block:'nearest'});}}};
    document.querySelectorAll('[data-um]').forEach(button=>button.addEventListener('click',()=>run(()=>{
      const actor=actorId(),id=button.dataset.id,action=button.dataset.um;
      if(action==='new'){if(!s.has(actor,'create'))throw new Error('denied');selected='';refresh();}
      if(action==='profile'){s.enter(actor,id);selected=id;refresh();}
      if(action==='close'){selected=null;refresh();}
      if(action==='status'&&confirm(t('statusConfirm'))){const u=s.get(actor,id);s.setStatus(actor,id,u.status==='Active'?'Disabled':'Active');refresh('saved');}
      if(action==='reset'&&confirm(t('resetConfirm'))){s.reset(actor,selected);refresh('resetDone');}
      if(action==='revoke'&&confirm(t('confirmRevoke'))){s.revoke(actor,selected,button.dataset.grant);refresh('revoked');}
      if(action==='file'){
        const file=s.file(actor,selected,button.dataset.slot);AttachmentViewer.show([{name:file.name,load:async()=>file}]);
      }
      if(action==='close-preview'){document.getElementById('um-preview').close();if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;refresh();}
    })));
    RegisterView.bind(document.querySelector('.um-page'),()=>refresh());
    document.getElementById('um-filters')?.addEventListener('submit',event=>{event.preventDefault();const fd=new FormData(event.target);query=String(fd.get('query')||'');refresh();});
    document.getElementById('um-local-login')?.addEventListener('change',event=>{for(const key of ['demoPassword','demoConfirm']){const input=document.getElementById('um-'+key);input.disabled=!event.target.checked;input.required=event.target.checked;}});
    document.getElementById('um-profile')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.target,submittedActor=actorId(),submittedTarget=selected,button=form.querySelector('button[type=submit]');if(button.disabled)return;button.disabled=true;try {
      const previous=selected?s.get(actorId(),selected):null,u=hydrated(previous),fd=new FormData(event.target),data={};
      for(const key of ['nameAr','nameEn','emiratesId','nationality','phone','email','username','jobTitle','hireDate','managerId','status'])data[key]=fd.has(key)?String(fd.get(key)).trim():(u[key]??(key==='status'?'Pending':''));
      for(const key of ['companyIds','departmentIds'])data[key]=event.target.elements[key].disabled?u[key]:fd.getAll(key);
      const attachments=['photo','idFront','idBack','passport','contract','driving'].map(slot=>({slot,file:fd.get(`file-${slot}`)})).filter(f=>f.file&&f.file.name);
      const localLogin=fd.get('localLogin')==='on';
      const verifier=localLogin?await DemoCredentials.prepare(String(fd.get('demoPassword')||''),String(fd.get('demoConfirm')||'')):undefined;
      if(actorId()!==submittedActor||selected!==submittedTarget||!form.isConnected)throw new Error('denied');
      const saved=s.update(submittedActor,submittedTarget||null,data,attachments,{roleId:previous?undefined:String(fd.get('baseRole')||'employee'),verifier});selected=saved.id;refresh(localLogin||DemoCredentials.directory().some(u=>u.id===saved.id)?'savedLocalLogin':'saved');
    } catch(error) { const node=document.getElementById('um-notice');if(node)node.textContent=t(error.message); } finally { if(button.isConnected)button.disabled=false; } });
    function grantScopeChoices(){const action=document.getElementById('um-action')?.value,scope=document.getElementById('um-scope');if(!scope)return;for(const option of scope.options)option.disabled=(action?.startsWith('bank_')||action?.startsWith('finance_')||action?.startsWith('customer_')||action?.startsWith('vehicle_')||action?.startsWith('ledger_'))&&!['group','company'].includes(option.value);if(scope.selectedOptions[0]?.disabled)scope.value='company';scopeOptions();}
    document.getElementById('um-action')?.addEventListener('change',grantScopeChoices);document.getElementById('um-scope')?.addEventListener('change',scopeOptions);grantScopeChoices();
    document.getElementById('um-grant')?.addEventListener('submit',event=>{event.preventDefault();run(()=>{const fd=new FormData(event.target);s.grant(actorId(),selected,{action:String(fd.get('action')),scope:{type:String(fd.get('scope')),id:String(fd.get('scopeId')||'')},delegable:fd.get('delegable')==='on'});refresh('granted');});});
  }
  return { permissionLabel:t,fieldErrors, centralSelect(id) {selected=id;service=undefined;}, reveal(id){query='';RegisterView.reset('users');selected=null;refresh();document.querySelector('[data-um="profile"][data-id="'+CSS.escape(id)+'"]')?.scrollIntoView({block:'center'});}, visible(id){return !!document.querySelector('[data-um="profile"][data-id="'+CSS.escape(id)+'"]');}, createService, render:renderPage, bind, escape:esc,
    effectiveUser(user) { return user ? getService().actor(user.id) : null; },
    visibleUsers() { return getService().list(actorId()); },
    summary() { return globalThis.ABCentral?.enabled?globalThis.ABCentral.summary:getService().summary(); },
    actorForModules(user) { const s=getService(),u=user&&s.actor(user.id);return u?{...u,permissions:app.state.roles.find(r=>r.id===u.roleId)?.permissions||[],companyBankPermissions:s.companies.map(c=>({companyId:c.id,permissions:s.bankPermissions(u.id,c.id)}))}:null; },
    cleanup() { if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null; },
    logout() { selected=null;notice='';query='';globalThis.RegisterView?.clear();if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null; }
  };
});
/* Explicit owner permission plans; no grant changes occur on opening this view. */
(function(root){if(typeof window==='undefined')return;'use strict';const t=(a,b)=>getLocale()==='ar'?a:b,e=v=>WorkspaceUI.esc(v),label=a=>{const v=UserManagement.permissionLabel(a);return v===a?a.replaceAll('_',' '):v;};let who='',selected='',query='',data=null,error='',loading=false,busy=false,planResult=null,draft=null,committed=false,saveKey='';
 function sync(){if(who!==ABCentral.actor?.id){who=ABCentral.actor?.id;selected='';query='';data=null;error='';loading=false;busy=false;planResult=null;draft=null;committed=false;saveKey='';}}
 async function load(){if(loading||!selected)return;loading=true;const id=selected,actor=who;try{const result=await ABCentral.api('users/'+id+'/permission-summary');if(actor===ABCentral.actor?.id&&id===selected){data=result;error='';}}catch(err){if(actor===ABCentral.actor?.id)error=err.message;}finally{loading=false;if(app.state.currentPage==='roles')render();}}
 function renderUI(){sync();if(ABCentral.actor?.roleId!=='owner')return '';if(selected&&!data&&!loading&&!error)queueMicrotask(load);const users=app.state.users.filter(u=>RegisterTools.search([u.nameAr,u.nameEn,u.fullName,u.username],query));return `<section class="content-panel" id="permission-admin"><h2>${t('الأدوار والصلاحيات','Roles & permissions')}</h2><p>${t('لن تتغير أي صلاحية قبل مراجعة الخطة وتأكيد المالك. صلاحيات الدور الموروثة معروضة كما هي.','Permissions change only after the owner reviews and confirms the plan. Inherited role rights are shown as they are.')}</p><label>${t('بحث عن مستخدم','Find user')}<input class="input" id="permission-search" value="${e(query)}"></label><label>${t('المستخدم','User')}<select class="input" id="permission-user"><option value="">—</option>${users.map(u=>`<option value="${e(u.id)}" ${selected===u.id?'selected':''}>${e((getLocale()==='ar'?u.nameAr:u.nameEn)||u.fullName||u.username)} · ${e(u.username)}</option>`).join('')}</select></label><p role="alert">${e(error)}</p>${loading?`<p role="status">${t('جارٍ تحميل الصلاحيات…','Loading permissions…')}</p>`:''}${data?details():''}</section>`;}
 function details(){const d=data,role=d.roles.find(r=>r.id===d.user.roleId);return `<div class="record-action-row"><button type="button" class="secondary-btn" data-permission-profile>${t('فتح ملف المستخدم وتعديل القسم','Open user profile / department')}</button><button type="button" class="secondary-btn" data-permission-preview ${d.user.roleId==='owner'?'disabled':''}>${t('معاينة شاشة الموظف','Preview employee screen')}</button></div><h3>${t('ملخص الصلاحيات الحالية','Current permission summary')}</h3><p>${t('الدور','Role')}: ${e(role?.name||d.user.roleId)} · ${t('الأقسام','Departments')}: ${e(d.departments.filter(v=>d.user.departmentIds.includes(v.id)).map(v=>v.name).join('، ')||'—')}</p><p>${t('الموروث من الدور','Inherited from role')}: ${d.rolePermissions.map(v=>e(label(v))).join('، ')||'—'}</p>${CenterForms.table('permission-summary:'+selected,d.directGrants.map(g=>({...g,permission:label(g.action),scopeLabel:g.scope.type==='company'?(d.companies.find(c=>c.id===g.scope.id)?.name||g.scope.id):g.scope.type==='department'?(d.departments.find(c=>c.id===g.scope.id)?.name||g.scope.id):g.scope.type})),[['permission',t('الصلاحية','Permission')],['scopeLabel',t('النطاق','Scope')]],'',()=> '')}<p>${t('استثناءات صلاحيات الشركات الحالية','Current company permission overrides')}: ${['edit','activate','deactivate'].map(a=>e(label(a))+': '+e(d.companyOverrides?.[a]||'inherit')).join(' · ')}</p>${CenterForms.table('permission-bank-summary:'+selected,(d.bankAccess||[]).map(b=>({name:b.name,rights:b.permissions.map(a=>label('bank_'+a)).join('، ')})),[['name',t('الشركة / الرخصة','Company / licence')],['rights',t('الوصول البنكي الفعلي','Effective bank access')]])}<fieldset class="record-section"><legend>${t('الدور وحدود الوصول المتقدمة','Role and advanced access bounds')}</legend><p>${t('تغيير دور مستخدم قائم وتقييد الوصول بإمارة مقر الشركة يحتاجان إجراء قاعدة بيانات مُراجعاً. لم يتم تفعيلهما أو تعديل المستخدمين الحاليين.','Changing an existing role and bounding access by company emirate require a reviewed database procedure. They are not activated and existing users are unchanged.')}</p><label>${t('الدور الحالي','Current role')}<select class="input" disabled>${d.roles.map(r=>`<option ${r.id===d.user.roleId?'selected':''}>${e(r.name)}</option>`).join('')}</select></label></fieldset>${d.canEdit?editor():`<p>${t('لا يسمح بتعديل صلاحيات حساب المالك أو منح الذات صلاحيات.','Owner account permissions and self-escalation cannot be changed here.')}</p>`}`;}
 function editor(){const d=data;return `<form id="permission-plan"><h3>${t('إعداد تغيير صريح','Prepare explicit changes')}</h3><label>${t('نطاق المنح الجديدة','New grant scope')}<select class="input" name="scope"><option value="group">${t('المجموعة','Group')}</option>${d.companies.map(c=>`<option value="company:${e(c.id)}">${e(c.name)} — ${e(c.licenseNumber||t('الرخصة الحالية','Current licence'))}</option>`).join('')}${d.departments.map(v=>`<option value="department:${e(v.id)}">${e(v.name)}</option>`).join('')}</select></label><p>${t('الشركة والرخصة الحالية تحددان النطاق نفسه في الصلاحيات القائمة. لا ينشئ اختيار النطاق أي منحة.','Company and current licence identify the same existing grant scope. Selecting a scope creates no grant.')}</p><details><summary>${t('صلاحيات لإضافتها','Permissions to add')}</summary><div class="permission-action-grid">${d.catalog.map(a=>`<label><input type="checkbox" name="add" value="${e(a)}">${e(label(a))}</label>`).join('')}</div></details><details><summary>${t('منح مباشرة لسحبها','Direct grants to revoke')}</summary>${d.directGrants.map(g=>`<label><input type="checkbox" name="revoke" value="${e(g.id)}">${e(label(g.action))} · ${e(g.scope.type)} ${e(g.scope.id?d.companies.find(c=>c.id===g.scope.id)?.name||d.departments.find(v=>v.id===g.scope.id)?.name||'':'')}</label>`).join('')}</details><div class="record-action-row"><button class="primary-btn" type="submit" ${busy?'disabled':''}>${t('مراجعة التغييرات قبل الحفظ','Review changes before saving')}</button></div></form><div id="permission-confirmation" aria-live="polite"></div>`;}
 function capture(form){const f=new FormData(form),raw=f.get('scope'),[type,id='']=raw==='group'?['group','']:String(raw).split(':');return {revision:data.user.revision,grantVersion:data.grantVersion,adds:f.getAll('add').map(action=>({action,scope:{type,id},delegable:false})),revokeIds:f.getAll('revoke')};}
 function bind(){const host=document.getElementById('permission-admin');if(!host)return;host.querySelector('#permission-search').oninput=ev=>{query=ev.target.value;const caret=ev.target.selectionStart;render();const n=document.getElementById('permission-search');n.focus();n.setSelectionRange(caret,caret);};host.querySelector('#permission-user').onchange=ev=>{if(busy)return;selected=ev.target.value;data=null;error='';planResult=draft=null;committed=false;saveKey='';render();};host.querySelector('[data-permission-profile]')?.addEventListener('click',()=>ABCentral.openUser(selected));host.querySelector('[data-permission-preview]')?.addEventListener('click',()=>ViewAsUI.start(selected));if(data?.capabilities.changeRole&&data.canEdit)ReviewedAccessUI.mount(host,data);const form=host.querySelector('#permission-plan');if(!form)return;
 form.onsubmit=async ev=>{ev.preventDefault();if(busy||committed)return;busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;error='';try{draft=capture(form);planResult=await ABCentral.api('users/'+selected+'/permission-plan','POST',draft,crypto.randomUUID());saveKey=crypto.randomUUID();const node=host.querySelector('#permission-confirmation');node.innerHTML=`<h3>${t('تأكيد المالك','Owner confirmation')}</h3><p>${t('إضافات','Additions')}: ${planResult.added.map(v=>e(label(v.action))).join('، ')||'0'}</p><p>${t('منح ستُسحب، بما فيها المنح التابعة','Grants to revoke, including downstream grants')}: ${planResult.revoked.length}</p><div class="record-action-row"><button type="button" class="primary-btn" data-permission-confirm>${t('تأكيد وحفظ الصلاحيات','Confirm and save permissions')}</button><button type="button" class="secondary-btn" data-permission-cancel>${t('إلغاء','Cancel')}</button></div><p role="alert" data-permission-error></p>`;
 node.querySelector('[data-permission-cancel]').onclick=()=>{if(committed){node.querySelector('[data-permission-error]').textContent=t('تم الحفظ؛ أعد التحقق من النتيجة أولاً.','Saved; verify the existing result first.');return;}node.replaceChildren();planResult=null;};node.querySelector('[data-permission-confirm]').onclick=async event=>{if(busy)return;busy=true;event.target.disabled=true;form.inert=true;try{if(!committed){await ABCentral.api('users/'+selected+'/permission-apply','POST',{...draft,confirm:true,planHash:planResult.planHash},saveKey);committed=true;}data=await ABCentral.api('users/'+selected+'/permission-summary');await ABCentral.reload();error='';planResult=draft=null;committed=false;render();}catch(err){node.querySelector('[data-permission-error]').textContent=(committed?t('تم الحفظ؛ تعذر التحقق. أعد المحاولة لاسترجاع النتيجة دون تكرار التغيير. ','Saved; readback failed. Retry to retrieve the result without repeating changes. '):t('تعذر الحفظ: ','Save failed: '))+err.message;event.target.disabled=false;}finally{busy=false;form.inert=false;}};
 }catch(err){host.querySelector('[role=alert]').textContent=err.message;}finally{busy=false;button.disabled=false;}};
 }
 root.PermissionUI={render:renderUI,bind,invalidate(){data=null;error='';}};
})(globalThis);
/* REVIEW-ONLY opt-in UI; hidden until the reviewed database procedure exists. */
(function(root){if(typeof window==='undefined')return;'use strict';const t=(a,b)=>getLocale()==='ar'?a:b;root.ReviewedAccessUI={async mount(host,summary){const id=summary.user.id,section=host.querySelector('fieldset.record-section');if(!section||section.dataset.accessLoaded)return;section.dataset.accessLoaded='1';try{const cfg=await ABCentral.api('users/'+id+'/reviewed-access');if(!section.isConnected||ABCentral.actor?.roleId!=='owner')return;section.replaceChildren();const button=document.createElement('button');button.type='button';button.className='secondary-btn';button.textContent=t('إعداد الدور وحدود الشركات والرخص وإمارات مقر الشركات','Prepare role, company, licence and company-emirate bounds');section.append(button);button.onclick=()=>{const bounds=cfg.bounds;let committed=false,request=null;const fields=[{name:'roleId',ar:'الدور المطلوب',en:'Requested role',value:cfg.user.roleId,options:cfg.roles.map(r=>({id:r.id,name:getRoleName(r.id)}))}];for(const [key,ar,en,options,column]of [['companies','الشركات','Companies',cfg.companies,'company_ids'],['licenses','الرخص','Licences',cfg.licenses.map(v=>({id:v.id,name:v.number})),'license_ids'],['emirates','إمارات مقر الشركات (ليست مواقع المركبات)','Company registration emirates (not vehicle locations)',cfg.emirates,'emirate_ids']]){fields.push({name:'limit_'+key,ar:'تقييد '+ar,en:'Restrict '+en,type:'checkbox',value:bounds?.[column]!==null&&bounds?.[column]!==undefined});for(const o of options)fields.push({name:key+':'+o.id,ar:o.name,en:o.name,type:'checkbox',value:bounds?.[column]?.includes(o.id)||false});}
const dialog=CenterForms.form(t('مراجعة الدور وحدود الوصول','Review role and access bounds'),fields,async(d,key)=>{if(!committed){const ids=type=>Object.keys(d).filter(k=>k.startsWith(type+':')&&d[k]===true).map(k=>k.slice(type.length+1));request={revision:cfg.user.revision,roleId:d.roleId,companyIds:d.limit_companies?ids('companies'):null,licenseIds:d.limit_licenses?ids('licenses'):null,emirateIds:d.limit_emirates?ids('emirates'):null};const plan=await ABCentral.api('users/'+id+'/reviewed-access/plan','POST',request,crypto.randomUUID());if(!confirm(t('تأكيد تغيير الدور وحدود الوصول؟ تبقى المنح المباشرة الحالية كما هي.\n','Confirm role/access change? Existing direct grants remain.\n')+getRoleName(plan.fromRole)+' → '+getRoleName(plan.toRole)+'\n'+plan.companies.join(', ')+'\n'+plan.rolePermissions.join(', ')))throw Error(t('أُلغي التأكيد؛ لم يتغير أي مستخدم.','Confirmation cancelled; no user changed.'));await ABCentral.api('users/'+id+'/reviewed-access/apply','POST',{...request,confirm:true,planHash:plan.planHash},key);committed=true;for(const control of dialog.querySelectorAll('input,select'))control.disabled=true;}
try{const verified=await ABCentral.api('users/'+id+'/reviewed-access');if(verified.user.roleId!==request.roleId)throw Error('readbackMismatch');for(const [field,col]of [['companyIds','company_ids'],['licenseIds','license_ids'],['emirateIds','emirate_ids']])if(JSON.stringify(verified.bounds?.[col]??null)!==JSON.stringify(request[field]))throw Error('scopeReadbackMismatch');PermissionUI.invalidate();await ABCentral.reload();}catch(err){throw Error(t('حُفظ التغيير؛ أعد المحاولة للتحقق دون إعادة تطبيقه: ','Change saved; retry verification without reapplying: ')+err.message);}});};}catch(err){section.append(document.createTextNode(err.message));}}};})(globalThis);
