/* Presentation-only password flows. No credentials, identifiers or tokens are persisted. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AuthFlows = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const messages = {
    ar: {
      forgot:'نسيت كلمة المرور؟', recovery:'استعادة الحساب', identifier:'اسم المستخدم أو البريد الإلكتروني أو رقم الهاتف', channel:'وسيلة الاستعادة المطلوبة', sms:'رسالة نصية SMS', email:'البريد الإلكتروني', whatsapp:'واتساب WhatsApp', request:'طلب الاستعادة', back:'العودة لتسجيل الدخول',
      boundary:'واجهة تجريبية: خدمة الاستعادة الآمنة غير مرتبطة. لن يُرسل رمز أو رابط، ولن تتغيّر كلمة المرور. استخدم بيانات اختبار فقط.', channelsNote:'هذه وسائل الربط المخطط لها؛ توافرها وتوثيقها في حسابك لا يُحددان إلا على الخادم بعد ربطه. لا تعرض هذه الواجهة بيانات اتصال أو تؤكد وجود حساب.',
      unavailable:'خدمة الاستعادة الآمنة غير متاحة في هذه النسخة. لم يُرسل رمز أو رابط ولم تتغيّر بيانات الدخول، بصرف النظر عن البيانات المدخلة.', identifierError:'أدخل اسم مستخدم أو بريدًا أو رقم هاتف، بحد أقصى 254 حرفًا.',
      preview:'مراحل التحقق وتعيين كلمة المرور — غير متاحة قبل ربط الخادم', otp:'رمز التحقق', verify:'التحقق من الرمز', expiry:'يجب أن يفرض الخادم انتهاء صلاحية الرمز وحدود المحاولات. لا يُنشأ رمز ولا يُقبل تحقق محلي في هذه النسخة.', verifiedOnly:'لا يمكن تعيين كلمة مرور جديدة إلا بعد تحقق فعلي من الخادم وبرمز استعادة أحادي الاستخدام.',
      admin:'فقدت الوصول إلى جميع وسائل الاتصال', adminNotice:'الاستعادة عبر مسؤول مخوّل تتطلب تحققًا موثوقًا من الهوية وتفويضًا صريحًا وسجل تدقيق على الخادم. لم يُرسل طلب إداري في هذه النسخة. لا تشارك كلمة المرور مع المسؤول.',
      accountSettings:'إعدادات الحساب', changePassword:'تغيير كلمة المرور', settingsNote:'متاح لجميع المستخدمين لحسابهم الشخصي فقط، دون موافقة إدارية.', current:'كلمة المرور الحالية', newPassword:'كلمة المرور الجديدة', confirm:'تأكيد كلمة المرور الجديدة', save:'حفظ كلمة المرور', returnApp:'العودة للبرنامج',
      changeBoundary:'واجهة تجريبية: التحقق من كلمة المرور الحالية والحفظ الآمن والإشعارات تتطلب خادمًا. لن تُغيّر هذه الشاشة بيانات دخولك الحالية.', policy:'استخدم 12 إلى 128 حرفًا، مع حرف كبير وصغير ورقم ورمز، ودون مسافات. يجب أن تختلف عن كلمة المرور الحالية. هذه قواعد واجهة مبدئية؛ سياسة الخادم وقائمة الكلمات المسرّبة مطلوبة قبل الإنتاج.',
      required:'أكمل حقول كلمة المرور.', mismatch:'كلمة المرور الجديدة وتأكيدها غير متطابقين.', weak:'كلمة المرور الجديدة لا تستوفي المتطلبات المعروضة.', same:'اختر كلمة مرور تختلف عن الحالية.', changeUnavailable:'اجتازت البيانات فحص الصيغة فقط. لم يُتحقق من كلمة المرور الحالية ولم تُحفظ كلمة مرور جديدة؛ خدمة المصادقة الآمنة غير مرتبطة.', denied:'يلزم تسجيل الدخول لفتح إعدادات الحساب.',
      audit:'سجل أحداث الواجهة التجريبية', auditNote:'سجل مؤقت لهذه الصفحة فقط، وليس سجل تدقيق إنتاجيًا. لا يحتوي على كلمات مرور أو رموز أو وسائل اتصال أو قيم مدخلة. تُحذف أحداث الحساب من العرض عند الخروج.', time:'الوقت (دبي)', event:'الحدث', empty:'لا توجد أحداث بعد.',
      login_failed:'محاولة دخول غير ناجحة', login_succeeded:'دخول تجريبي ناجح', recovery_blocked:'طلب استعادة محجوب لغياب الخادم', recovery_invalid:'بيانات طلب استعادة غير مكتملة', admin_recovery_blocked:'استعادة إدارية غير متاحة', change_invalid:'فشل فحص صيغة تغيير كلمة المرور', change_blocked:'تغيير كلمة المرور محجوب لغياب الخادم',
    },
    en: {
      forgot:'Forgot password?', recovery:'Account recovery', identifier:'Username, email or phone number', channel:'Requested recovery channel', sms:'SMS', email:'Email', whatsapp:'WhatsApp', request:'Request recovery', back:'Back to sign in',
      boundary:'Demo interface: secure recovery is not connected. No code or link will be sent and no password will change. Use test data only.', channelsNote:'These are planned integrations. Only the server can determine which channels are available and verified for your account. This interface does not disclose contact details or confirm that an account exists.',
      unavailable:'Secure recovery is unavailable in this version. No code or link was sent and no sign-in details changed, regardless of the information entered.', identifierError:'Enter a username, email or phone number, up to 254 characters.',
      preview:'Verification and password reset steps — unavailable until the backend is connected', otp:'Verification code', verify:'Verify code', expiry:'The server must enforce expiry and attempt limits. This version never generates codes or accepts local verification.', verifiedOnly:'A new password may be set only after actual server verification and with a single-use reset authorization.',
      admin:'I lost access to all contact channels', adminNotice:'Administrator-assisted recovery requires trusted identity verification, explicit authorization and a server audit trail. No administrative request was sent in this version. Never share your password with an administrator.',
      accountSettings:'Account settings', changePassword:'Change password', settingsNote:'Available to every user for their own account, without administrative approval.', current:'Current password', newPassword:'New password', confirm:'Confirm new password', save:'Save password', returnApp:'Back to application',
      changeBoundary:'Demo interface: verifying the current password, secure storage and notifications require a backend. This screen will not change your current sign-in credentials.', policy:'Use 12–128 characters with an uppercase letter, lowercase letter, digit and symbol, without whitespace. Choose a different password from the current one. These are initial UI checks; server policy and a breached-password blocklist are required before production.',
      required:'Complete all password fields.', mismatch:'The new password and confirmation do not match.', weak:'The new password does not meet the displayed requirements.', same:'Choose a password different from your current one.', changeUnavailable:'Only the format checks passed. The current password was not verified and no new password was saved; secure authentication is not connected.', denied:'Sign in to open account settings.',
      audit:'Demo interface event log', auditNote:'Temporary page events, not a production audit log. No passwords, codes, contact details or entered values are recorded. Account events are removed from view on logout.', time:'Time (Dubai)', event:'Event', empty:'No events yet.',
      login_failed:'Unsuccessful sign-in attempt', login_succeeded:'Successful demo sign-in', recovery_blocked:'Recovery blocked: backend unavailable', recovery_invalid:'Incomplete recovery request', admin_recovery_blocked:'Administrator recovery unavailable', change_invalid:'Password format check failed', change_blocked:'Password change blocked: backend unavailable',
    }
  };
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode = 'login', notice = '', selectedChannel = 'email';
  const events = [];
  const eventTypes = new Set(['login_failed','login_succeeded','recovery_blocked','recovery_invalid','admin_recovery_blocked','change_invalid','change_blocked']);
  function text(key) { if(globalThis.ABCentral?.enabled&&['boundary','changeBoundary','changeUnavailable','unavailable','expiry'].includes(key))return typeof getLocale==='function'&&getLocale()==='ar'?'خدمة استعادة أو تغيير كلمة المرور غير مفعلة في هذه المرحلة. لم يُرسل رمز ولم تُتحقق كلمة المرور الحالية ولم تُحفظ كلمة مرور جديدة.':'Recovery and password changes are not enabled in this phase. No code was sent, the current password was not verified and no new password was saved.';return messages[typeof getLocale === 'function' && getLocale() === 'ar' ? 'ar' : 'en'][key] || key; }
  function record(type, actorId = null, channel = null) {
    if (!eventTypes.has(type)) return;
    // Only public event names, canonical authenticated IDs and allowlisted channel names.
    events.push(Object.freeze({ at:new Date().toISOString(), type, actorId, channel:['sms','email','whatsapp'].includes(channel)?channel:null }));
    if(events.length>100)events.shift();
  }
  function validateChange(current, password, confirmation) {
    if(!current || !password || !confirmation)return 'required';
    if(password!==confirmation)return 'mismatch';
    if(password===current)return 'same';
    if(password.length<12 || password.length>128 || /\s/.test(password) || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password))return 'weak';
    return null;
  }
  function attemptChange(actorId, current, password, confirmation) {
    if(!actorId)return {ok:false,code:'denied'};
    const error=validateChange(current,password,confirmation);
    record(error?'change_invalid':'change_blocked',actorId);
    // Fail closed even for valid-looking fields: never compare legacy plaintext or accept a reset locally.
    return {ok:false,code:error||'changeUnavailable'};
  }
  function attemptRecovery(identifier, channel) {
    const invalid=typeof identifier!=='string'||!identifier.trim()||identifier.length>254||!['sms','email','whatsapp'].includes(channel);
    record(invalid?'recovery_invalid':'recovery_blocked',null,channel);
    return {ok:false,code:invalid?'identifierError':'unavailable'};
  }
  function audit(actorId) { return events.filter(e=>e.actorId===actorId).map(e=>({...e})); }
  function auditHTML(actorId) {
    const rows=audit(actorId);
    return `<details class="auth-audit"><summary>${text('audit')}</summary><p class="muted">${text('auditNote')}</p><div class="table-wrap"><table><thead><tr><th>${text('time')}</th><th>${text('event')}</th></tr></thead><tbody>${rows.map(e=>`<tr><td>${escape(new Intl.DateTimeFormat(typeof getLocale==='function'&&getLocale()==='ar'?'ar-AE':'en-AE',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Dubai'}).format(new Date(e.at)))}</td><td>${text(e.type)}</td></tr>`).join('')||`<tr><td colspan="2">${text('empty')}</td></tr>`}</tbody></table></div></details>`;
  }
  function passwordField(id, label, autocomplete, disabled=false) {
    return `<div class="form-group"><label for="${id}">${text(label)}</label><input class="input" id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" maxlength="${id==='auth-current'?'1024':'128'}" required ${disabled?'disabled':''} /></div>`;
  }
  function recoveryHTML() {
    return `<div class="login-head"><h2>${text('recovery')}</h2><button class="lang-badge" data-action="toggle-language">${getLocale()==='ar'?'English':'العربية'}</button></div>
      <p class="company-desc" role="note">${text('boundary')}</p>
      <form id="auth-recovery"><div class="form-group"><label for="auth-identifier">${text('identifier')}</label><input class="input" id="auth-identifier" autocomplete="username" maxlength="254" required /></div>
      <fieldset class="auth-channels"><legend>${text('channel')}</legend>${['sms','email','whatsapp'].map(channel=>`<label><input name="auth-channel" type="radio" value="${channel}" ${channel===selectedChannel?'checked':''} />${text(channel)}</label>`).join('')}</fieldset>
      <p class="muted">${text('channelsNote')}</p><button class="primary-btn" type="submit">${text('request')}</button></form>
      <p id="auth-message" role="status" aria-live="polite">${notice?text(notice):''}</p>
      <details class="auth-preview"><summary>${text('preview')}</summary><p>${text('expiry')}</p><fieldset disabled><div class="form-group"><label for="auth-otp">${text('otp')}</label><input id="auth-otp" class="input" inputmode="numeric" autocomplete="one-time-code" disabled /></div><button class="secondary-btn" type="button" disabled>${text('verify')}</button><p>${text('verifiedOnly')}</p>${passwordField('auth-reset-new','newPassword','new-password',true)}${passwordField('auth-reset-confirm','confirm','new-password',true)}<button class="primary-btn" type="button" disabled>${text('save')}</button></fieldset></details>
      <button class="auth-link" type="button" data-auth="admin">${text('admin')}</button><button class="ghost-btn" type="button" data-auth="back">${text('back')}</button>${auditHTML(null)}`;
  }
  function showMessage(code) {
    notice=code; const node=document.getElementById('auth-message');
    if(node){node.textContent=text(code);node.focus();}
  }
  function mountLogin() {
    const container=document.querySelector('.login-form-wrap');
    if(mode==='recovery')container.innerHTML=recoveryHTML();
    document.querySelector('[data-auth="forgot"]')?.addEventListener('click',()=>{mode='recovery';notice='';render();});
    document.querySelector('[data-auth="back"]')?.addEventListener('click',()=>{leave();render();});
    document.querySelector('[data-auth="admin"]')?.addEventListener('click',()=>{record('admin_recovery_blocked');notice='adminNotice';render();});
    document.getElementById('auth-recovery')?.addEventListener('submit',event=>{
      event.preventDefault();const field=document.getElementById('auth-identifier');selectedChannel=document.querySelector('[name="auth-channel"]:checked')?.value;
      const result=attemptRecovery(field.value,selectedChannel);field.value='';notice=result.code;render();
    });
  }
  function renderSettings() {
    const user=getCurrentUser();if(!user)return `<section class="content-panel">${text('denied')}</section>`;
    return `<section class="content-panel auth-settings"><div class="section-head"><h2>${text('changePassword')}</h2><button class="ghost-btn" data-auth="return">${text('returnApp')}</button></div><p>${text('settingsNote')}</p><p class="company-desc" role="note">${text('changeBoundary')}</p><p class="muted" id="auth-policy">${text('policy')}</p><form id="auth-change" aria-describedby="auth-policy">
      ${passwordField('auth-current','current','current-password')}${passwordField('auth-new','newPassword','new-password')}${passwordField('auth-confirm','confirm','new-password')}<button class="primary-btn" type="submit">${text('save')}</button></form><p id="auth-message" tabindex="-1" role="status" aria-live="polite">${notice?text(notice):''}</p>${auditHTML(user.id)}</section>`;
  }
  function bindApp() {
    document.querySelector('[data-auth="settings"]')?.addEventListener('click',()=>{if(!getCurrentUser())return;BankAccounts.cleanup();CompanyDocuments.cleanupPreview();UserManagement.cleanup();mode='settings';notice='';render();});
    document.querySelector('[data-auth="return"]')?.addEventListener('click',()=>{leave();render();});
    document.getElementById('auth-change')?.addEventListener('submit',event=>{
      event.preventDefault();const user=getCurrentUser();const current=document.getElementById('auth-current'),password=document.getElementById('auth-new'),confirmation=document.getElementById('auth-confirm');
      const result=attemptChange(user?.id,current.value,password.value,confirmation.value);
      event.target.reset();showMessage(result.code);
      // Re-render the audit without keeping any credential values in application state.
      notice=result.code;render();
    });
  }
  function leave() { mode='login';notice=''; }
  function logout() { leave();for(let i=events.length-1;i>=0;i--)if(events[i].actorId!==null)events.splice(i,1); }
  return {text,escape,record,audit,validateChange,attemptChange,attemptRecovery,mountLogin,renderSettings,bindApp,leave,logout,isSettings:()=>mode==='settings'};
});
