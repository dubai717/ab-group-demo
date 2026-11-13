# Review-only owner role and access bounds

Status: PREPARED, NOT APPROVED FOR HOSTED APPLICATION. This branch is a draft.
It is not merged into staging. Its SQL is deliberately outside `supabase/` and
is not present in any approved migration/release catalog, controller pin or
provisioning command. No deployed application reads or executes this SQL file.

The current database blocks runtime changes to an existing `role_id`. This
proposal keeps that trigger intact and adds one narrowly checked SECURITY
DEFINER procedure requiring a real active owner context, a non-owner/non-self
target, explicit confirmation, a known non-owner role and the current revision.
New bounds/history tables initially contain zero rows. Installing the reviewed
structure does not change any current user, role, membership or grant.

The optional bounds are intersections of company IDs, licence IDs and the
company's registered emirate. NULL preserves an unrestricted existing dimension;
an empty selected list grants access to no companies. These are company/legal
entity bounds, **not vehicle registration emirates, locations, or GPS access**.
A restrictive PostgreSQL policy covers companies and each existing UUID
`company_id` table; licence-bearing rows also check their actual licence ID.
Permission-grant metadata is excluded from the sweep so global grant authority
is still interpreted by the original policy within the bounded records. Bounds
never grant an action that the user's chosen role/direct grants do not allow.

A signed preview uses current role definitions, target revision, existing bounds,
company/licence metadata and active grants. The UI shows the proposed role's
rights and permitted companies before native owner confirmation. Direct grants
are preserved; choosing a role does not silently revoke historical grants or
assign new explicit grants. The database procedure records immutable before/after
access history and the ordinary owner audit event. Owner records/self-escalation
and non-owner calls remain prohibited. Existing-user role and scope controls are
not displayed until the exact reviewed procedure is present.

Validation runs ONLY on randomly named local synthetic databases. Tests verify
unchanged existing users/role grants on SQL preparation, owner/confirmation/
revision checks, invalid role/scope rejection, direct SQL RLS reads and writes,
company/licence/emirate intersections and empty-deny, immutable history, failed
runtime role UPDATE, stale grant plans, preserved direct grants and source API
scope. The isolated browser proves cancelled confirmation, actual confirmed
role/bounds save and committed-readback retry without applying twice.

Activation requires a separate explicit owner review of the SQL/security change,
registration of an immutable checksum-reviewed migration in the trusted catalog,
retained encrypted backup plus isolated restore/rehearsal, preservation checks,
and the existing native protected-environment approval. Do not run this SQL
through Render Shell, edit provider secrets/rulesets or bypass the controller.
After approved activation, each existing user still changes only through a
separate explicit owner preview/confirmation. No bulk role or permission update
is included or authorized by this draft.

## استكمال المراجعة — 12 نوفمبر 2026

يضم المقترح الآن قوالب منح إضافية للدور والوحدة الإدارية، دون إنشاء محرك صلاحيات موازٍ. الملف الوحيد هو `owner-role-bounds.review-only.sql`؛ جُمعت تعريفات القوالب فيه، ولا توجد نسخة ترحيل أخرى أو مدخل كتالوج أو رقم ترحيل منشور لها. لم يُطبق على البيئة المستخدمة، ولم يُدمج PR #61.

- أربعة جداول قالب جديدة: إصدارات ثابتة، تطبيقات مؤكدة على المستخدم، روابط للمنح الأصلية، واستثناءات موثقة. مع جدولي حدود الوصول السابقين تصبح ستة جداول فارغة عند التثبيت. صلاحيات الأدوار الأساسية القديمة لا يعاد كتابتها.
- حفظ الإصدار لا يغيّر أي مستخدم. تطبيقه يتم على موظف نشط مطابق للدور/الوحدة فقط، بعد ملخص يحدد الإضافات والسحوبات وتأكيد المالك. تستعمل الإضافة والسحب محرك permission-plan الأصلي وpermission_grants وRLS والتدقيق، لا قائمة صلاحيات بديلة.
- لا تمنح الذات أو حساب المالك صلاحيات عبر القالب. لا تمنح تفويضاً قابلاً لإعادة التفويض. نطاق قالب الوحدة لا يتجاوز شركتها، ونطاق الشركة يظل مرتبطاً بالرخص وحدود المستخدم الحالية عند تفعيل حدود الوصول المعتمدة.
- المنح الموروثة مقفلة في المستطيل وفي API، وحارس PostgreSQL يمنع سحبها المباشر حتى للمالك؛ يلزم تطبيق إصدار جديد على الموظف أو استثناء بسبب محفوظ ومؤكد. تبقى الإصدارات والتطبيقات القديمة ثابتة.
- إذا ورث الموظف المنحة نفسها من قالبين، لا يسحب فصل أحدهما المنحة الموروثة من الآخر. المنح المباشرة السابقة لا تحذف عند فصل القالب. تغيير الدور أو إزالة عضوية الوحدة يتوقف إذا كان سيترك منح قالب قديمة؛ يفصل القالب بإجراء موثق أولاً. الحارس المؤجل يسمح بحفظ العضوية الحالية دون توسيع النطاق أو كسر إعادة الحفظ.
- الواجهة تبقى بمستطيلين، مع البحث والتصنيف والاختيار المتعدد، وقائمة الشركة/الرخصة، وإدارة الإصدار والتطبيق والفصل والاستثناء. تمت ترجمة أسماء صلاحيات الأدوار الأساسية بدلاً من عرض معرفاتها التقنية.

### نتائج الاختبارات المعزولة

نجحت خمسة اختبارات تكامل للمقترح: عدم تفعيل أي حد أو منحة عند DDL، تطبيق صريح، إصدار ثان دون تعديل مستخدم تلقائياً، حفظ المنح المباشرة، مشاركة مصدرين للوراثة، رفض الشركة الأخرى والسحب المباشر ومنح الذات، استثناء موثق، وحماية تغيير الدور/الوحدة. تمت مقارنة جميع صفوف الجداول السابقة ودوالها وامتيازاتها على بيانات تضم فواتير وتحصيلات واتفاقيتي 50/100 وملفات خاصة؛ لم تختلف. نجحت استعادة أرشيف مشفر فعلياً إلى قاعدة منفصلة قبل المقترح وبعده، ونجح rollback التجريبي.

نجح متصفح فعلي في البحث والنقل وإلغاء حفظ القالب، وحفظ إصدار بلا منح، والتطبيق المؤكد، وإقفال الموروث، ومعاينة المستخدم بصلاحياته الحقيقية، والاستثناء، والعربية/الإنجليزية على الكمبيوتر والتابلت والهاتف. نتائج المجموعة الشاملة تضاف لطلب المراجعة قبل أي طلب تفعيل.

### حدود صريحة

هذا قالب إضافات بالنظام القائم؛ لا يغيّر قائمة صلاحيات الدور الأساسية لكل موظفيه دفعة واحدة. تعديل دور مستخدم قائم يستعمل إجراء المالك المراجع أعلاه. الإجراء الذي يجمع الاعتماد والرفض في تفويض واحد بالنظام الحالي يبقى كذلك؛ لم نضف أسماء صلاحيات شكلية لا ينفذها الخادم. فصل هذين الحقين بصورة مستقلة لكل مسار يحتاج تغييراً حساساً مراجعاً لقواعد القرار وRLS، ولا يُفترض مفعلاً بهذا المقترح. الأقسام لا تنسب تلقائياً إلى بيانات مركبات أو قيود مالية لا تحمل علاقة قسم موثقة.

### التفعيل والاستعادة

يتطلب موافقة صريحة منفصلة على هذا الملف واختباره على استعادة حديثة من البيانات المستخدمة، ثم إضافته مرة واحدة فقط إلى الكتالوج المحمي بعد تثبيت تسلسل 028. أي تغير غير مفسر للبيانات/الأرصدة/الصلاحيات يوقف النشر. يطبق داخل معاملة واحدة؛ فشل DDL يعيد المعاملة. بعد استخدام القوالب لا يعود التطبيق إلى إصدار يفتقد حراس الوراثة؛ يلزم إصلاح متوافق أو إجراء استعادة منفصل مصرح به يحفظ الحركات اللاحقة، دون حذف جداول أو استبدال أرصدة أحدث.
