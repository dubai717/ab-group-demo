# موضوعات المتابعة داخل المحادثة الأصلية

الموضوع سجل متابعة إداري مرتبط بالمحادثة المصرح بها، وليس مطالبة مالية أو مهمة موازية. الأنواع الحالية: ادعاء سداد، خلاف مالي، شكوى. تبقى الاستفسارات والردود العادية في المحادثة ولا تنشئ موضوعاً أو مهمة تلقائياً.

يمكن لأي مشارك مخول بإدارة المراسلات تولي الموضوع أو متابعة عمل زميله؛ التولي لا يمنع الآخرين. الحالات: مفتوح، قيد المراجعة، بانتظار العميل، محلول إدارياً. السبب إلزامي للانتظار والحل وإعادة الفتح. الرد والاطلاع ليسا حلاً. يُنسب الحل الحالي مرة واحدة لمن نفذه، وتبقى مساهمات الآخرين والحلول السابقة في السجل الأصلي عند إعادة الفتح. هذه الإحصائية منفصلة عن المهام المكتملة والتحصيل المالي.

## المصدر والحماية

يستخدم المكون رسائل `ab.communication_messages` الأصلية للأحداث، وبيانات وصفية مشفرة ذات إصدارات داخل `ab.settings`. فهرس إلحاقي بلا محتوى يربط رقم الحدث برسالته الأصلية. السجل50 حدثاً للصفحة مع مؤشر لاستكماله؛ لا نسخ لأجسام الرسائل ولا دفتر مالي جديد. القراءة لا تنشئ فاتورة أو مهمة أو قيداً.

صلاحية المصدر والمشاركة وحالة الحساب تتحقق على الخادم. استرجاع إيصال طلب سابق يعيد التحقق من الوصول الحالي للمحادثة؛ فقد الصلاحية لا يسمح باسترجاع استجابة خاصة مخزنة. المالك محمي، ولا تعديل لأدواره أو منح جديدة. View As للقراءة فقط. إشعار المالك الداخلي إلزامي بأرقام الأحداث الأصلية لمنع التكرار، ولا ينشئ مهمة عليه. لا إرسال WhatsApp أو خدمة خارجية.

المراجعة والحفظ ومنع التكرار ذرية. UUID موحد، مع استرجاع مفاتيح المهام السابقة عند اختلاف كتابة UUID دون إعادة كتابتها. الإصدار السابق أو العنوان المكرر يرفضان الحفظ مع بقاء المدخلات. عند فشل الاستجابة تُستخدم العملية نفسها؛ لا تُستبدل المدخلات المعدلة بصمت بطلب سابق. إذا نجح الحفظ وفشل الاسترجاع تُقفل الحقول وتصبح المحاولة التالية قراءة فقط، دون POST آخر.

مهمة المتابعة تُنشأ صراحة من الموضوع باستخدام `ab.tasks` والساعة الأصلية، مع معرف الموضوع والمحادثة والموظف. الموضوعان المختلفان لهما مهام مستقلة؛ تكرار الطلب لا يكررها. حل الموضوع لا يكمل المهمة ولا يخفض الدين، ولا يُسمح بإنشاء متابعة جديدة لموضوع محلول دون مراجعته وإعادة فتحه.

## الواجهة والتحقق

داخل المحادثة نفسها: بحث محلي، فتح تفاصيل الصف، المتولي والمساهمون والسجل والإجراءات. البحث لا يعيد الاستعلام عن الرسائل. الرد المتأخر لسجل موضوع آخر لا يستبدل الموضوع المختار. العربية والإنجليزية وثلاثة مقاسات، مع بقاء الأعمدة والأزرار الأساسية ظاهرة على الهاتف والهوية البنية الحالية.

نجحت21 حالة خادم مركزة، و16 رحلة واجهة، و182 حالة ثابتة، وبناء graph التشغيل دون مزود. تشمل الأدلة59 حدثاً في صفحتين50 و9 دون تكرار، وتنافس الطلبات، وفقد الرد، وفشل القراءة بعد نجاح الحفظ، وتغير الإصدار، ومنع استرجاع البيانات بعد فقد الصلاحية، وView As. قارنت الاختبارات الفواتير والقيود والمنح وحالات المهام كاملة. بيانات الاختبار اصطناعية فقط.

## غير مكتمل

مهلة الأيام الثلاثة وفق تقويم معتمد، وإثبات المتابعة الأخيرة وإجراء عدم الاستجابة، والربط التلقائي بالرسائل الواردة والتذكيرات والمزود الرسمي والتقارير الشاملة متبقية. إغلاق عدم الاستجابة غير متاح حالياً، والموعد غير المتحقق يظهر بحاجة لمراجعة. لا تُعد هذه النواقص مكتملة ولا تُحوّل إلى موافقة مالك افتراضية. الحزمة غير جاهزة للنشر.

## Source-eligible assignees and leave coverage (2026-11-23)

A topic follow-up assignee must have an active linked account, original conversation
membership and current source read authority. The picker offers active participants
only; the server independently checks the source again and refuses without a partial
task or any new grant. Generic conversation-task entry remains compatible.

Approved-leave delegation now supports these original case-linked tasks, alongside
manual and employee-document sources. Both creation and activation verify the
substitute's existing source rights; general circulars, unlinked communication tasks
and financial authority are excluded from the new adapter. A resolved administrative
case still has an independent open task: closing a case never supplies task completion.

A native acceptance test exposed the existing follow-up worker treating the positive
communication source check as completed work. The worker now excludes communication
and manual tasks from automatic source completion. The existing submit/review workflow
still permits actual completion; its source predicate was not weakened or repurposed.

Return checks use a read-only MVCC case reference after task locks, avoiding an inverted
case-book/task lock order. Open original tasks return only to an active source-authorized
original employee through verified return, or at expiry with pending-return review. Expired coverage with a
Pending original account remains visible for management review; it never activates
that account. Explicit linked-delegation return also checks source eligibility.
Completed tasks and substitute credit remain unchanged. No account, grant, debt,
financial journal or external message is created by this adapter.

Remaining: full source adapters, cross-company coverage, clock adoption, unlinked
message/attachment attribution, three-working-day SLA and final follow-up/no-response
closure, official inbound routing/provider and reminders. The whole release is partial.
