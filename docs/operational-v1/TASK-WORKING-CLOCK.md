# مواعيد المهام والتصعيد بحسب العمل — بناء غير منشور

يستخدم `backend/src/task-working-clock.ts` المهمة الأصلية وموظفها وجدولها المؤرخ وإشعارات النظام وسجل إجراءات المهمة. لا ينشئ مهمة أو دفتر حسابات جديداً. تعرض `task-working-clock-ui.js` الموعد والانتظار من زر المهمة الأصلي، بالعربية والإنجليزية وتوقيت الإمارات، وتخزن اللحظات بصيغة UTC.

تسجيل الموعد والانتظار يتطلب مسؤولاً مخولاً وفق مراجعة المهام القائمة، ولا يسمح باعتماد تمديد المهمة للنفس إلا المالك المخول. تحفظ هوية المعتمد والسبب ونسخ قبل/بعد. يربط الحفظ بإصدار التوقيت وإصدار المهمة حتى لا يطبق نموذج قديم على تكليف تغير. تحافظ إعادة المحاولة على نسخة واحدة، وتبقى المدخلات بعد رفض أو فقد استجابة محفوظة.

أضيف الربط إلى متابعة HR القائمة بعد التحقق من إكمال مصادر المهام، ودون تفعيل automaticFollowup أو إنشاء cron جديد. تقرأ التوقيتات والجداول والإجازات المؤكدة والإشعارات على دفعات مقيدة بالشركة. الساعة الدقيقة لا تُخمن من تاريخ مهمة قديمة. يبقى التحذير القديم للمهام التي لم يعتمد لها توقيت دقيق؛ إعداد توقيت دقيق يوقف ازدواج التحذير القديم لهذه المهمة.

يحسب التصعيد دقائق الدوام الفعلية والعطلات والنصف يوم، ويخصم الانتظار المعتمد والإجازات الفعلية المعتمدة من hr_leaves؛ الخطة السنوية المبدئية لا توقف الوقت. تتبع المستويات التسلسل الإداري الحقيقي حتى المالك، وتظهر حاجة للمراجعة عند غيابه أو دورانه أو تعذر قراءة جدول موثوق أو تغير المكلف دون مراجعة التوقيت. لا ترسل تنبيهات تأخير للموظف غير المتاح في إجازة معتمدة. لا تقفز إلى مدير مفترض.

يرسل أول مستوى بعد30 دقيقة عمل والثاني بعد60 وهكذا حتى نهاية التسلسل. مفتاح الإشعار مرتبط بالمهمة وإصدار الموعد والمستوى؛ INSERT ON CONFLICT يسبق سجل التصعيد، فلا يتكرر الإشعار أو السجل حتى عند تشغيلين متزامنين. المهمة المنجزة أو المغلقة لا تصعد، ولا يعد الإشعار إنجاز مهمة جديدة أو تحصيلاً.

تغيير الموعد يحدث تاريخ المهمة التشغيلي فقط. تحقق الاختبار من بقاء فاتورة مطالبة أصلية بكامل حقولها وتاريخ استحقاقها وقيودها دون تغيير، مع استمرار المهمة الأصلية مرة واحدة ضمن MyWork. لا يفرض التصعيد عقوبة أو خصماً أو قيداً مالياً.

نجح اختبارا PostgreSQL شاملان للتوقيت الحقيقي،29/30/60 دقيقة، التشغيل المتزامن، الانتظار، الإجازة الفعلية، نقص الجدول، تغير الموظف، مصدر المطالبة، مركز المهام، والمنع في View As رغم صلاحية المسؤول الفعلية. نجح المتصفح من إجراء المهمة مع أخطاء المدخلات وفقد الاستجابة وإعادة القراءة، AR/EN على1440 و768 و390؛ الصور الاصطناعية راجعت بصرياً. شملت مجموعة الانحدار المحددة73 حالة مع HR والعودة والجدول وMyWork، مع نجاح182 حالة ثابتة وTypeScript.

المتبقي: استدعاء المواعيد الدقيقة المعتمدة تلقائياً من جميع مصادر المهام القائمة، وربط تبني توقيت التكليف عند التفويض والعودة، والقبول الشامل لعامل الخدمة وسلسلة مديرين طويلة وتقارير معدل التأخير. إعداد موعد يدوياً ليس دليلاً على اكتمال كل مصادر المهام. لا نشر أو تفعيل على التشغيل.

## Original manual creation adopts the same clock
The existing task creation form accepts an optional explicit UAE deadline. The
server validates its date against dueOn, then records task and initial clock in
one transaction using the same independent-approval function as later changes.
No initial time means no clock and no guessed midnight. A wrong date or an
unapproved self deadline rolls the complete creation back. Original idempotency
keys recover a lost response without a second task. Task validation returns field
errors and a safe trace reference; the AR/EN form retains input.

Four-level source acceptance additionally proves 30/60/90/120 working-minute
notifications reach the real managers then Owner once. Missing/inactive chains
require review; the original PostgreSQL reporting-cycle guard remains enabled.
Actual start/submit/independent completion stops later notifications and MyWork
retains one original completed task. Financial journals remain unchanged.

Latest acceptance: 59 combined original HR/clock tests, plus original clock and
manual-create browser journeys in independent synthetic fixtures. Other automated
task sources, delegation/return and complete delay reporting remain incomplete.
