# تدفقات النسخة التشغيلية — نطاق المراجعة

الرسوم تشرح مصدر الحالة، وليست إثباتاً على نشر أو اكتمال البنود الموضحة «متبقي».

```mermaid
flowchart RL
  A[ملف العميل الكامل] --> B[عميل محتمل أو فعلي في السجل نفسه]
  B --> C[طلب خدمة جديد]
  C -. ربط محاسبي متبقٍ .-> D[أهلية الخدمة: مجموع الالتزامات الفعلية للشهرين الأخيرين]
  D --> E[مسار المالك والخدمة القائم]
  A --> F[التحصيل والسداد والاستعلام: مستثناة من الحظر]
  G[الحزمة المالية PR115 غير مستقرة وغير مدمجة] -. تبعية دون تعديل .-> D
```

```mermaid
flowchart RL
  A[تعليق عمل بسبب إجازة فعلية] --> B[جلسة خدمة ذاتية محدودة]
  B --> C[إشعار عودة واحد مرتبط بالإجازة]
  C --> D[مراجعة المسؤول من المصدر نفسه في مهامي]
  D --> E{الدليل الأمني المستقبلي مطابق ولا حظر آخر؟}
  E -->|نعم| F[استعادة الوصول دون منح صلاحيات جديدة]
  E -->|لا| G[تأكيد العودة مع إبقاء مراجعة الوصول]
  D -. متبقٍ .-> H[عودة التفويض وملخص مساهمات البدلاء]
```

```mermaid
flowchart RL
  A[موعد دقيق يراجعه مسؤول مخول] --> B[المهمة الأصلية وجدول الموظف المؤرخ]
  C[الانتظار والإجازة الفعلية المعتمدان] --> B
  B --> D[متابعة HR القائمة]
  D --> E{المصدر والتسلسل مكتملان؟}
  E -->|لا| F[تحتاج مراجعة؛ لا توقيت مفترض]
  E -->|نعم| G[30 ثم60 دقيقة عمل: إشعار للمستوى الحقيقي]
  G --> H[منع التكرار؛ لا مهمة جديدة أو عقوبة مالية]
```

## Existing leave-linked delegation

```mermaid
flowchart TD
 A[Approved HR leave] --> B[Existing optional linked delegation]
 B --> C[Recheck source, scope, dates and active substitute]
 C --> D[Assign same original task once]
 D --> E{Source outcome}
 E -->|Completed| F[Preserve actual substitute and completion]
 E -->|Expiry or confirmed return| G[Verify latest open-task assignment]
 G -->|Uncertain| H[Undo attempted source return; review notice]
 G -->|Verified| I[Return open work to original]
 I --> J{Actual return and account available?}
 J -->|No| K[Preserve security hold; management followup]
 J -->|Yes| L[Existing authorized task access]
```

## Original conversation topics and tasks

```mermaid
flowchart LR
 C[Authorized original conversation] --> O[Open topic]
 O --> H[Qualified participant handles]
 H --> W[Await customer: deadline review]
 H --> R[Administrative resolution by actual actor]
 W --> R
 R --> E[Reopen same topic with reason]
 E --> H
 O --> T[Explicit original task plus optional clock]
 T --> S[Existing submit and review workflow]
 R -.does not complete.-> T
 R -.does not settle.-> L[Original approved receivables]
 H --> M[Original immutable message history]
 H --> N[Owner notification: no personal task]
 W --> P[No-response action remains unavailable]
```

## Explicit employee standard reset

```mermaid
flowchart LR
 A["Owner selects existing account"] --> B["Read current assigned standard and exceptions"]
 B --> C["Reason and before/after review"]
 C --> D["Original locked idempotent transaction"]
 D --> E["Revoke direct additions; clear denials and individual overrides"]
 E --> F["Verify source readback and refresh"]
 D --> G["Unknown response: same body and key"]
 G --> D
 E --> H["Acknowledged save, failed readback: GET only"]
 H --> F
```

Assigned role, company/unit scope, standard definitions, other users and financial records stay unchanged. Unknown legacy overrides/downstream grants require review before any reset.

### Reassigned task with a recorded clock

```mermaid
flowchart LR
  A[Original task reassigned] --> B{Clock employee matches?}
  B -->|No| C[Retain old deadline and clock history]
  C --> D[One current-supervisor review notice]
  D --> E[Explicit review with actual employee schedule]
  E --> F[Original versioned clock approval]
  F --> G[Existing working-hours escalation]
  B -->|Yes| G
```

This review does not automatically extend a deadline or assign historic delay to a substitute. Terminal tasks do not generate review notices.

## Read-only Owner backup status (default disabled)

```mermaid
flowchart LR
 A[Owner opens dashboard] --> B[Explicit status check]
 B --> C{Configured public key and private source?}
 C -- no --> D[Unconfigured; no absence claim]
 C -- yes --> E[Bounded four-folder technical scan]
 E --> F{Signature + source + organization match?}
 F -- no --> G[Needs review; no foreign metadata]
 F -- yes --> H[HEAD archive and encrypted metadata]
 H --> I[Recorded capture/test facts + current presence and size]
 I --> J[Current full integrity and service restoration still need evidence]
```

The display cannot start capture, download archives, change a schedule or run restore. The protected original backup job may publish an optional signed technical companion only after its original checks. Its private signing key remains outside application runtime. Independent storage and real restore acceptance remain release prerequisites.

## Existing customer/vehicle CSV workbench (unpublished)

```mermaid
flowchart LR
 A[Original scoped field template] --> B[Choose company and UTF-8 CSV]
 B --> C[Bounded decoding and original strict parser]
 C --> D[Original mapping + independent source company check]
 D --> E[Preview duplicates, documents and errors]
 E --> F{Explicit original confirmation and current token}
 F -- no --> G[No target customer or vehicle created]
 F -- yes --> H[Original save, audit and cursor in isolated acceptance]
 B --> I[Lost response: retain file and retry original source hash]
 I --> E
```

No finance or historical balances are imported. Real operating-data import remains prohibited pending final approval and backup. This diagram does not claim missing entity adapters are implemented.

### Explicit original conversation-task successor (unpublished)

```mermaid
flowchart LR
  A[Original completed case task] --> B[Explicit completed-parent selection]
  B --> C[Original source and task authority]
  C --> D[Atomic original task / optional UAE clock / encrypted link / audit]
  D --> E[One future successor, safe same-request retry]
  E --> F[Original task execution and independent review]
  A --> G[Completed history and actual performer retained]
  D --> H[No financial settlement or case closure]
```

### Dated operating-centre administration (unpublished)

```mermaid
flowchart LR
  A[Owner in original employee permission page] --> B[Explicit recorded centre source read]
  B --> C[Latest recorded and immutable dated history]
  C --> D[Draft actual location and company links]
  D --> E[Fresh original before/after and retained future snapshots]
  E --> F[Explicit confirmation with original request receipt]
  F --> G[One immutable snapshot and encrypted audit]
  F --> H[Uncertain reply: same body and key]
  H --> G
  G --> I[GET-only verification and dated history]
  I --> J[Separate future employee scope review]
```

A centre-directory change does not update employee memberships, grant rights or move financial balances. Primary work location is separate from authorized scope. Stable referential identity and effective geographic scope enforcement remain unfinished; no hosted candidate installation is authorized during this build.

### Original work-account primary location (unpublished)

```mermaid
flowchart LR
 A[Original employee permission page] --> B[Explicit account-location source]
 B --> C[Actual dated physical-centre options]
 C --> D[Fresh before/after and retained future transfers]
 D --> E[Explicit Owner confirmation and original receipt]
 E --> F[Immutable location and encrypted audit]
 F --> G[Verified read-only result]
 F --> H[Original company memberships and permissions unchanged]
```

Null location is explicitly unassigned. Geographic access is a separate unfinished review/enforcement path. No HR employee or work account is manufactured from this source.
