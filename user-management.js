/* Session-only ERP workflow. Production authorization must run on a trusted backend. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UserManagement = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const bankActions = ['view', 'create', 'edit', 'close', 'view_documents', 'manage_documents'];
  const actions = ['create', 'edit', 'status', 'assign', 'grant', 'reset', 'attachments', 'redelegate', ...bankActions.map(a => 'bank_' + a)];
  const legacy = { create: 'create_user', edit: 'edit_user', status: 'deactivate_user' };
  const copy = value => JSON.parse(JSON.stringify(value));
  const clean = user => { const value = copy(user); delete value.password; return value; };
  function createService(source, now = () => new Date().toISOString(), persistence = {}) {
    const records = new Map(source.users.map(user => [user.id, clean(user)]));
    const roles = copy(source.roles), companies = copy(source.companies), departments = copy(source.departments);
    const grants = new Map(), files = new Map(), audit = [];
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
      return actor?.status === 'Active' && (id === target.id || legacyViewer || actions.filter(action => !action.startsWith('bank_')).some(action => can(id, action, target)));
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
      if (String(entry.action).startsWith('bank_') && !['group', 'company'].includes(entry.scope?.type)) throw new Error('denied');
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
      list.push(saved); grants.set(targetId, list); log(actorId, 'granted', targetId, [saved.action, saved.scope.type, saved.scope.id, saved.delegable ? 'redelegate' : 'nonDelegable']);
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
      grants.set(targetId, list.filter(g => g.id !== grantId)); log(actorId, 'revoked', targetId, [entry.action]); cascade(targetId);
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
  let service, selected = null, notice = '', query = '', filterStatus = '', filterCompany = '', filterDept = '', previewUrl;
  function t(key) { return messages[getLocale() === 'ar' ? 'ar' : 'en'][key] || key; }
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getService() { if (!service) service = createService({...app.state, users:[...app.state.users, ...DemoCredentials.directory()]}, undefined, {save:(candidate, verifier)=>DemoCredentials.saveProfile(candidate, verifier)}); else service.syncDirectories(app.state); return service; }
  function actorId() { return app.state.currentUser?.id; }
  function name(user) { return (getLocale() === 'ar' ? user.nameAr : user.nameEn) || user.fullName || user.username; }
  function hydrated(u) {
    return {nameAr:'', nameEn:u?.fullName || '', emiratesId:'', nationality:'', phone:'', email:'', jobTitle:'', hireDate:'', managerId:'', companyIds:u?.companyId ? [u.companyId] : [], departmentIds:u?.departmentId ? [u.departmentId] : [], ...u};
  }
  function option(value, label, chosen) { return `<option value="${esc(value)}" ${chosen ? 'selected' : ''}>${esc(label)}</option>`; }
  function field(key, value, disabled, type = 'text', required = false) {
    return `<div class="form-group"><label for="um-${key}">${t(key)}</label><input id="um-${key}" class="input" name="${key}" type="${type}" value="${esc(value)}" ${disabled ? 'disabled' : ''} ${required ? 'required' : ''} maxlength="${type === 'password' ? '128' : key === 'emiratesId' ? '18' : '160'}" ${type==='password'?'autocomplete="new-password"':''} /></div>`;
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
      <form id="um-profile"><h3>${t('identity')}</h3><div class="form-grid">
      ${['nameAr','nameEn','emiratesId','nationality','phone','email','username'].map(k=>field(k,u[k],!basic,k==='email'?'email':k==='phone'?'tel':'text',['nameAr','nameEn','email','username'].includes(k))).join('')}
      <div class="form-group"><label for="um-status">${t('status')}</label><select id="um-status" name="status" class="input" ${status?'':'disabled'}>${['Pending','Active','Disabled'].map(v=>option(v,t(v),v===(u.status||'Pending'))).join('')}</select></div>
      </div>${isNew?`<fieldset class="um-login-setup"><legend>${t('demoLogin')}</legend><p class="muted">${t('demoLoginNote')}</p><label class="um-checkbox"><input type="checkbox" id="um-local-login" name="localLogin" />${t('enableDemoLogin')}</label><div class="form-grid">${field('demoPassword','',true,'password')}${field('demoConfirm','',true,'password')}<div><label for="um-base-role">${t('baseRole')}</label><select class="input" id="um-base-role" name="baseRole" ${s.actor(actor)?.roleId==='owner'?'':'disabled'}>${app.state.roles.filter(r=>r.id!=='owner').map(r=>option(r.id,r.name,r.id==='employee')).join('')}</select></div></div></fieldset>`:''}<h3>${t('assignment')}</h3><div class="form-grid">
      ${field('jobTitle',u.jobTitle,!assign)}${field('hireDate',u.hireDate,!assign,'date')}
      ${selectField('managerId',managerOptions,[u.managerId],!assign)}
      ${selectField('companyIds',companyOptions,u.companyIds,!assign,true)}
      ${selectField('departmentIds',departmentOptions,u.departmentIds,!assign,true)}
      </div>
      ${attachmentAllowed?`<h3>${t('attachmentsTitle')}</h3><p class="muted">${t('fileHint')}</p><div class="form-grid">${['photo','idFront','idBack','passport','contract','driving'].map(slot=>`<div class="form-group"><label for="um-file-${slot}">${t(slot)}</label>${attachmentWritable?`<input id="um-file-${slot}" name="file-${slot}" type="file" accept="${slot==='photo'?'image/png,image/jpeg':'image/png,image/jpeg,application/pdf'}" />`:``}${attachmentList.some(f=>f.slot===slot)?`<button type="button" class="ghost-btn" data-um="file" data-slot="${slot}">${t('open')}: ${esc(attachmentList.find(f=>f.slot===slot).name)}</button>`:''}</div>`).join('')}</div>`:''}
      ${basic||assign||status||attachmentWritable?`<button type="submit" class="primary-btn">${t('save')}</button>`:`<p>${t('readOnly')}</p>`}</form>
      ${!isNew?`<h3>${t('permissions')}</h3><div class="um-grants">${s.grants(actor,selected).map(g=>`<div class="um-grant"><span>${t(g.action==='status'?'statusAction':g.action)} · ${t(g.scope.type)} ${esc(g.scope.type==='company'?(s.companies.find(c=>c.id===g.scope.id)?.englishName||g.scope.id):g.scope.type==='department'?(s.departments.find(d=>d.id===g.scope.id)?.name||g.scope.id):g.scope.type==='reports'?name(s.actor(g.scope.id)||{}):'')} ${g.delegable?'· '+t('redelegate'):''}</span>${has('grant')?`<button class="ghost-btn" data-um="revoke" data-grant="${esc(g.id)}">${t('revoke')}</button>`:''}</div>`).join('')||`<p class="muted">${t('none')}</p>`}</div>
      ${has('grant')&&!owner&&selected!==actor?`<form id="um-grant" class="form-grid"><div><label for="um-action">${t('action')}</label><select id="um-action" name="action" class="input">${actions.filter(action=>s.has(actor,action)).map(action=>option(action,t(action==='status'?'statusAction':action),false)).join('')}</select></div><div><label for="um-scope">${t('scope')}</label><select class="input" id="um-scope" name="scope">${['group','company','department','reports'].map(v=>option(v,t(v),false)).join('')}</select></div><div id="um-scope-options"></div><label class="um-checkbox"><input type="checkbox" name="delegable" ${s.has(actor,'redelegate')?'':'disabled'} />${t('delegable')}</label><button type="submit" class="secondary-btn">${t('grantButton')}</button></form>`:''}
      ${has('reset')?`<button class="secondary-btn" data-um="reset">${t('resetButton')}</button>`:''}`:''}
    </section>`;
  }
  function renderPage() {
    const s=getService(),actor=actorId();
    if (!actor || s.actor(actor)?.status!=='Active') return `<section class="content-panel">${t('denied')}</section>`;
    const visible=s.list(actor),needle=query.toLocaleLowerCase();
    const rows=visible.filter(u=>[u.nameAr,u.nameEn,u.fullName,u.username,u.email].join(' ').toLocaleLowerCase().includes(needle)&&(!filterStatus||u.status===filterStatus)&&(!filterCompany||hydrated(u).companyIds.includes(filterCompany))&&(!filterDept||hydrated(u).departmentIds.includes(filterDept)));
    return `<div class="um-page"><div class="company-desc" role="note">${t('demo')}</div><div id="um-notice" role="status" aria-live="polite">${notice?esc(t(notice)):''}</div><section class="content-panel"><div class="section-head"><h2>${t('title')}</h2>${s.has(actor,'create')?`<button class="secondary-btn" data-um="new">${t('add')}</button>`:''}</div>
      <form id="um-filters" class="um-filters"><div><label for="um-search">${t('search')}</label><input class="input" id="um-search" name="query" value="${esc(query)}" /></div><div><label for="um-filter-status">${t('status')}</label><select class="input" id="um-filter-status" name="status">${option('',t('all'),!filterStatus)}${['Active','Pending','Disabled'].map(v=>option(v,t(v),v===filterStatus)).join('')}</select></div><div><label for="um-filter-company">${t('companyIds')}</label><select class="input" id="um-filter-company" name="company">${option('',t('all'),!filterCompany)}${s.companies.map(c=>option(c.id,c.englishName||c.name,c.id===filterCompany)).join('')}</select></div><div><label for="um-filter-dept">${t('departmentIds')}</label><select class="input" id="um-filter-dept" name="department">${option('',t('all'),!filterDept)}${s.departments.map(d=>option(d.id,d.name,d.id===filterDept)).join('')}</select></div><button class="ghost-btn" type="submit">${t('searchButton')}</button></form>
      <p>${t('total')}: ${rows.length}</p><div class="table-wrap"><table><thead><tr><th>${t('displayName')}</th><th>${t('username')}</th><th>${t('jobTitle')}</th><th>${t('status')}</th><th>${t('action')}</th></tr></thead><tbody>${rows.map(u=>`<tr><td>${esc(name(u))}</td><td>${esc(u.username)}</td><td>${esc(u.jobTitle||'—')}</td><td><span class="badge ${u.status==='Active'?'active':u.status==='Pending'?'pending':'disabled'}">${t(u.status)}</span></td><td><div class="row-actions"><button class="ghost-btn" data-um="profile" data-id="${esc(u.id)}">${t('profile')}</button>${s.can(actor,'status',u)&&u.roleId!=='owner'&&u.id!==actor?`<button class="ghost-btn" data-um="status" data-id="${esc(u.id)}">${t(u.status==='Active'?'disable':'activate')}</button>`:''}</div></td></tr>`).join('')||`<tr><td colspan="5">${t('noResults')}</td></tr>`}</tbody></table></div></section>${renderEditor()}
      <section class="content-panel"><h2>${t('audit')}</h2><p class="muted">${t('auditHint')}</p><div class="table-wrap"><table><thead><tr>${['at','actor','event','target','fields'].map(k=>`<th>${t(k)}</th>`).join('')}</tr></thead><tbody>${s.audit(actor).slice().reverse().map(e=>`<tr><td>${esc(new Intl.DateTimeFormat(getLocale()==='ar'?'ar-AE':'en-AE',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Dubai'}).format(new Date(e.at)))}</td><td>${esc(s.actor(e.actorId)?.username||e.actorId)}</td><td>${t(e.action)}</td><td>${esc(s.actor(e.targetId)?.username||e.targetId)}</td><td>${esc(e.fields.map(f=>t(f)).join(', '))}</td></tr>`).join('')||`<tr><td colspan="5">${t('none')}</td></tr>`}</tbody></table></div></section><dialog id="um-preview"><button class="ghost-btn" data-um="close-preview">${t('close')}</button><h3>${t('filePreview')}</h3><div id="um-preview-body"></div></dialog></div>`;
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
        const file=s.file(actor,selected,button.dataset.slot),body=document.getElementById('um-preview-body');
        if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(file);
        const el=document.createElement(file.type==='application/pdf'?'iframe':'img');el.src=previewUrl;if(el.tagName==='IFRAME'){el.title=t('filePreview');el.setAttribute('sandbox','');}else el.alt=t(button.dataset.slot);body.replaceChildren(el);document.getElementById('um-preview').showModal();
      }
      if(action==='close-preview'){document.getElementById('um-preview').close();if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null;refresh();}
    })));
    document.getElementById('um-filters')?.addEventListener('submit',event=>{event.preventDefault();const fd=new FormData(event.target);query=String(fd.get('query'));filterStatus=String(fd.get('status'));filterCompany=String(fd.get('company'));filterDept=String(fd.get('department'));refresh();});
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
    function grantScopeChoices(){const action=document.getElementById('um-action')?.value,scope=document.getElementById('um-scope');if(!scope)return;for(const option of scope.options)option.disabled=action?.startsWith('bank_')&&!['group','company'].includes(option.value);if(scope.selectedOptions[0]?.disabled)scope.value='company';scopeOptions();}
    document.getElementById('um-action')?.addEventListener('change',grantScopeChoices);document.getElementById('um-scope')?.addEventListener('change',scopeOptions);grantScopeChoices();
    document.getElementById('um-grant')?.addEventListener('submit',event=>{event.preventDefault();run(()=>{const fd=new FormData(event.target);s.grant(actorId(),selected,{action:String(fd.get('action')),scope:{type:String(fd.get('scope')),id:String(fd.get('scopeId')||'')},delegable:fd.get('delegable')==='on'});refresh('granted');});});
  }
  return { createService, render:renderPage, bind, escape:esc,
    effectiveUser(user) { return user ? getService().actor(user.id) : null; },
    visibleUsers() { return getService().list(actorId()); },
    summary() { return getService().summary(); },
    actorForModules(user) { const s=getService(),u=user&&s.actor(user.id);return u?{...u,permissions:app.state.roles.find(r=>r.id===u.roleId)?.permissions||[],companyBankPermissions:s.companies.map(c=>({companyId:c.id,permissions:s.bankPermissions(u.id,c.id)}))}:null; },
    cleanup() { if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null; },
    logout() { selected=null;notice='';if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=null; }
  };
});
