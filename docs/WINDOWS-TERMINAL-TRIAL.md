# Windows 11: تشغيل عبر Terminal دون CMD أو تجاوز Smart App Control

هذا هو المسار البديل المفضل إذا حُظر Start-ABGroup.cmd. لا تشغّل CMD أو Start-ABGroup.ps1، ولا تغيّر ExecutionPolicy أو تستخدم Unblock-File أو Invoke-Expression أو تعطل Smart App Control. أُزيل ExecutionPolicy Bypass أيضاً من المشغّل القديم. لا يتطلب المسار الجديد صلاحيات Administrator أو تغيير صلاحيات النظام.

ثبّت Node.js 24 LTS الرسمي من https://nodejs.org/en/download إذا لم يكن موجوداً. حمّل ZIP النسخة المحددة في الرد وافتح Terminal/PowerShell عادياً داخل المجلد المفكوك. افتح Terminal من قائمة Start ثم انتقل للمجلد، ولا تشغّل ملفاً محظوراً. لا تحذف Zone.Identifier أو تغيّر اسم الملف المحظور بقصد تشغيله.

نفّذ الأسطر التالية بالترتيب. تستخدم npm وTypeScript مباشرة عبر Node، وليس npm.cmd أو npm.ps1 أو npx أو tsx/esbuild:

```powershell
$node = Get-Command node.exe -CommandType Application | Select-Object -First 1 -ExpandProperty Source
if ((Get-AuthenticodeSignature $node).Status -ne 'Valid') { throw 'Stop: install the official signed Node.js build.' }
& $node .\backend\windows\verify-source.mjs
if ($LASTEXITCODE -ne 0) { throw 'Stop: source integrity check failed.' }
$npm = Join-Path (Split-Path $node) 'node_modules\npm\bin\npm-cli.js'
& $node $npm ci --ignore-scripts --omit=optional --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Stop: dependency install failed.' }
& $node .\node_modules\typescript-portable\bin\tsc -p .\backend\tsconfig.json --noEmit false --outDir backend-build
if ($LASTEXITCODE -ne 0) { throw 'Stop: TypeScript build failed.' }
Copy-Item .\backend\package.json .\backend-build\package.json
& $node .\backend-build\windows\terminal-trial.js
```

تتحقق بصمات SHA-256 من ملفات الحزمة مقابل manifest المرفق؛ هذه سلامة محتوى وليست توقيع Authenticode للتطبيق. npm ci يتحقق من integrity لكل dependency مقابل lockfile؛ install scripts والاعتماديات الاختيارية متوقفة. البناء يستخدم typescript-portable، وهو alias مثبت للنسخة الرسمية typescript@6.0.3 العاملة بـJavaScript؛ TypeScript 7 الأصلي بقي دون تغيير. بناء TypeScript هنا JavaScript خالص ولا يستدعي esbuild.exe. لا تغيّر الحزمة أو تخلطها مع ملفات النسخة القديمة قبل فحص البصمات. Get-AuthenticodeSignature يتحقق من توقيع Node الموجود على جهازك؛ لا تدّعي نتيجة فحصه قبل تنفيذ الأمر محلياً.

بعد بدء البرنامج، أدخل القيم الخمس الأصلية عند الطلب **بإدخال مخفي داخل Terminal فقط**: SUPABASE_URL وSUPABASE_PUBLISHABLE_KEY وSUPABASE_SECRET_KEY وDATABASE_URL وDATA_ENCRYPTION_KEY. الأسرار تبقى في ذاكرة عمليات محلية فقط، ولا تُحفظ في ملف أو سجل أو command line أو متغيرات نظام دائمة. هذا المسار لا يقرأ أو يمسح خزنة DPAPI السابقة، ويطلب القيم مجدداً بعد إغلاق البرنامج. لا تغير قيمة مفتاح التشفير. GitHub لا يتيح استرجاع قيم Secrets؛ استخدم نسخك الأصلية المحمية.

إذا سبق إنشاء حساب trial فادخل اسم المستخدم عند السؤال، ثم سجّل الدخول من المتصفح بكلمة مروره الموجودة؛ لا يطلب هذا المسار اتصال إدارة. إذا لم يُنشأ حساب من قبل، اترك الاسم فارغاً: يظهر اسم جديد، ويُطلب MIGRATION_DATABASE_URL الحالي مؤقتاً وكلمة مرور تختارها لحساب الدخول وتأكيدها. يُنشأ مالك وهمي ومجموعة منفصلان فقط، دون تعديل أي حساب قديم أو صلاحياته؛ لا يُعاد تعيين كلمة مرور موجودة ولا تُطبّق ترحيلات. كلمة مرور حساب الدخول لا تُحفظ تلقائياً؛ احتفظ بها في مدير كلمات مرورك.

عند نجاح الجاهزية افتح **http://127.0.0.1:3100** وسجّل الدخول بالاسم الظاهر وكلمة مرور حساب trial، ثم أنشئ شركة وهمية وحساباً بنكياً واحفظهما وأعد فتحهما للتحقق من الاسترجاع. اترك Terminal مفتوحاً، واضغط Enter فيه لإيقاف Backend المحلي دون حذف بيانات Supabase. لا يوجد نشر أو منفذ عام أو تعديل Firewall.

إذا منع Smart App Control ملف Node أو مكوناً آخر أيضاً، **توقف عند رسالة الحظر** وأبلغ باسم الملف المحظور فقط. لا نضمن سماح سياسة جهازك؛ لم يجر تشغيل هذا الاختبار مع SAC مفعلاً على جهازك. معالجة ذلك تتطلب توزيعاً موثوقاً/موقعاً مقبولاً لدى Windows، وليست تجاوزاً للحماية. لا ترسل أسراراً أو screenshots لها.

## فحص التجهيز

- git fsck نجح. جميع dependency entries الـ121 في lockfile لها registry.npmjs.org URL وintegrity.
- npm audit الكامل بتاريخ 2026-11-02 أظهر صفر تنبيهات معروفة؛ لا يعني ذلك ضمان خلو كل مكتبة من العيوب أو ضمان قبول SAC.
- نجح بناء JavaScript مباشرة عبر Node وTypeScript دون tsx/esbuild.
- اختباران جديدان نجحا لعزل الأسرار وعدم وجود تشغيل CMD/PS1 أو تغيير سياسة في المسار البديل.
