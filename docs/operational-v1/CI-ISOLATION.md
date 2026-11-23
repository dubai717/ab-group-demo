# تشخيص CI — اختبار المرفق وحد الطلبات

فحص45093055481 على7617428 نجح. فحص45101351627 على188c1c4 اجتاز716 حالة خادم ورحلات التشغيل الست، ثم فشل في attachment-cancellation أثناء انتظار نموذج الدخول. فحص45103237345 على985d2a4 اجتاز720 حالة خادم والرحلات السبع، وكرر الفشل نفسه. لا يُصنف أي منهما نجاحاً شاملاً.

أعيدت المشكلة محلياً باستخدام خادم اصطناعي وحد300 طلب/دقيقة الأصلي. بعد رحلة المركبات أعاد تحميل bank-accounts.js وdemo-credentials.js وpermission-matrix-ui.js وuser-management.js وauth-flows.js و/api/bootstrap حالة429، فلم يظهر نموذج الدخول قبل بدء اختبار المرفق. السجل `/tmp/ab-v1-vehicle-rate-diagnostic-retry.log` يثبت ذلك؛ المشكلة ليست فشل فك PDF أو قرار صرف.

نُقل اختبار عارض المرفق إلى مرحلة renderer مستقلة في review-extra-suites، بقاعدة وAuth وحد طلبات جديدين. بقيت assertions نفسها وبقي الحد300 دون تخفيف أو تعطيل أو زيادة مهلة أو تجاوز حماية. نجحت محلياً الرحلات الأربع: المركبات، إلغاء العارض، مراجعة التمويل، ودورة الخدمات. تتجه الصور المحلية إلى RAM اختيارياً مع بقاء work الافتراضي في CI. لا تحذف بيانات أو أدلة مالية.

إعادة الإنتاج: تهيئة PostgreSQL الاصطناعي المعتاد ثم `node backend/tests/vehicle-regression-suite.browser.cjs`؛ يستخدم3408 افتراضياً ويتحقق من نطاق منفذ loopback. يحتفظ runner القائم للمراجعة بفصل كل رحلة، ويتخلص فقط من قاعدة هذه التجربة. أضيف تنظيف آمن عند تعذر بدء مستمع fixture لمنع تسرب قواعد اختبار جديدة. لم تُقتل خدمة3400 القائمة ولم يُحذف أي مصدر قديم.

نجاح الإصلاح المحلي لا يثبت نتيجة CI للرفع التالي، ولا يعد دليلاً على نشر أو تعديل الخدمة المستضافة. يحتفظ هذا الملف بالفشل كدليل تشخيص، لا كقبول نهائي.

## Second shared-fixture exhaustion (run 45106349520)
The renderer split passed in this run. The original financial handover journey then
called its own-fund privacy scenario in the same fixture after user, permission,
cash, history, limit and bilingual UI activity. A local reproduction captured the
original server's `ledger_action_failed` with status 429 (`req-8h`) on the reader's
workbench GET. This was request-budget exhaustion, not a failed accounting guard.
The privacy scenario now has its own fresh synthetic fixture in CI and the local
handover suite. Its original source/privacy/export/assertions remain, and the
opening equity selector explicitly matches the fund's legal company. Production
limits, permissions, accounting routes and financial worktree PR115 are unchanged.
The failed run remains failed; later skipped steps were not validated by that run.
