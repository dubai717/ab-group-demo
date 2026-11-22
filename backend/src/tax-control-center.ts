import {financeRight} from './finance.js';
import {registerArgs,registerResponse} from './register-query.js';
// Separate VAT/Corporate Tax planning files over the existing unified items/settings/audit.
// A reviewed planning version NEVER enables tax posting, document repricing or filing.
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireOk,sha} from './core.js';
import {L,need,company,event} from './ledger-domain.js';
const id=z.uuid(),money=z.string().regex(/^\d{1,15}(\.\d{1,3})?$/),signed=z.string().regex(/^-?\d{1,15}(\.\d{1,3})?$/),rate=z.number().int().min(0).max(10000),text=z.string().trim().max(2000),kind=z.enum(['vat','corporate']);
const period=z.object({from:z.iso.date(),to:z.iso.date()}).strict();
const common={itemId:id,selected:z.boolean(),status:z.enum(['pending_review','classified','not_subject']),ruleReference:text,notes:text};
const vatMapping=z.object({...common,supply:z.enum(['review','standard','zero','exempt','outside_scope','reverse_charge']),rateBasisPoints:rate.nullable(),inputRecovery:z.enum(['review','recoverable','blocked','partial']),recoveryBasisPoints:rate.nullable()}).strict();
const corporateMapping=z.object({...common,category:z.enum(['review','revenue','expense','capital_recovery','receivable','tax_adjustment']),treatment:z.enum(['review','taxable','non_taxable','deductible','non_deductible','add','deduct'])}).strict();
const shared={companyId:id,revision:z.number().int().min(0),effectiveFrom:z.iso.date(),effectiveUntil:z.iso.date().nullable(),periods:z.array(period).max(120),ruleReference:text,notes:text};
export const taxProfileSchema=z.discriminatedUnion('taxType',[
 z.object({...shared,taxType:z.literal('vat'),settings:z.object({registrationStatus:z.enum(['review','registered','not_registered']),registrationThreshold:money.nullable(),standardRateBasisPoints:rate.nullable(),thresholdBasis:z.literal('taxable_supplies_for_registration')}).strict(),mappings:z.array(vatMapping).max(500)}).strict(),
 z.object({...shared,taxType:z.literal('corporate'),settings:z.object({taxBase:z.literal('taxable_income'),reliefThreshold:money.nullable(),brackets:z.array(z.object({from:money,to:money.nullable(),rateBasisPoints:rate}).strict()).max(30)}).strict(),mappings:z.array(corporateMapping).max(500)}).strict()
]).superRefine((p,ctx)=>{
 const issue=(path:(string|number)[],message:string)=>ctx.addIssue({code:'custom',path,message});
 if(p.effectiveUntil&&p.effectiveUntil<p.effectiveFrom)issue(['effectiveUntil'],'invalidTaxPeriod');
 const periods=[...p.periods].sort((a,b)=>a.from.localeCompare(b.from));if(periods.some((v,i)=>v.to<v.from||i>0&&v.from<=periods[i-1].to))issue(['periods'],'overlappingTaxPeriods');
 if(new Set(p.mappings.map(m=>m.itemId)).size!==p.mappings.length)issue(['mappings'],'duplicateTaxMapping');
 p.mappings.forEach((m,i)=>{
  if(m.status!=='pending_review'&&!m.ruleReference)issue(['mappings',i,'ruleReference'],'taxRuleReferenceRequired');
  if(p.taxType==='vat'&&'supply'in m){
   if(m.status==='classified'&&(m.supply==='review'||m.supply==='standard'&&(!m.rateBasisPoints||m.rateBasisPoints<=0)))issue(['mappings',i,'supply'],'taxClassificationReviewRequired');
   if(['zero','exempt','outside_scope'].includes(m.supply)&&m.rateBasisPoints!==0)issue(['mappings',i,'rateBasisPoints'],'taxClassificationReviewRequired');
   if(m.supply==='review'&&m.rateBasisPoints!==null)issue(['mappings',i,'rateBasisPoints'],'taxClassificationReviewRequired');
   if(m.status==='not_subject'&&m.supply!=='outside_scope')issue(['mappings',i,'status'],'taxClassificationReviewRequired');
   if(m.inputRecovery==='partial'&&(m.recoveryBasisPoints===null||m.recoveryBasisPoints<=0||m.recoveryBasisPoints>=10000))issue(['mappings',i,'recoveryBasisPoints'],'taxRecoveryReviewRequired');
   if(m.inputRecovery!=='partial'&&m.recoveryBasisPoints!==null)issue(['mappings',i,'recoveryBasisPoints'],'taxRecoveryReviewRequired');
  }
  if(p.taxType==='corporate'&&'category'in m){
   const allowed:Record<string,string[]>={review:['review'],revenue:['review','taxable','non_taxable'],expense:['review','deductible','non_deductible'],capital_recovery:['review','non_taxable'],receivable:['review','non_taxable'],tax_adjustment:['review','add','deduct']};
   if(!allowed[m.category].includes(m.treatment)||m.status==='classified'&&(m.category==='review'||m.treatment==='review')||m.status==='not_subject'&&m.treatment!=='non_taxable')issue(['mappings',i,'treatment'],'taxClassificationReviewRequired');
  }
 });
 if(p.taxType==='corporate'){
  const b=p.settings.brackets;
  b.forEach((v,i)=>{if((i===0&&L.units(v.from)!==0n)||(v.to!==null&&L.units(v.to)<=L.units(v.from))||(i>0&&(b[i-1].to===null||L.units(v.from)!==L.units(b[i-1].to)))||(v.to===null&&i!==b.length-1))issue(['settings','brackets',i],'invalidTaxBrackets');});
  if(b.length&&b[b.length-1].to!==null)issue(['settings','brackets'],'openFinalTaxBracketRequired');
 }
});
export type TaxProfile=z.infer<typeof taxProfileSchema>;
const prefix='ledger:tax-control-profile-v1:',key=(co:string,type:string)=>prefix+co+':'+type,flags={financialEffect:false,automaticTaxPosting:false,filingReady:false,submissionEnabled:false,taxTreatmentLegallyApproved:false};
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date());
const context=z.object({companyId:id,taxType:kind}).strict();
const scenario=z.object({itemId:id.optional(),taxableBase:money.optional(),registrationTurnover:money.optional(),accountingProfit:signed.optional(),additions:money.optional(),deductions:money.optional()}).strict();
const normalize=(p:TaxProfile):TaxProfile=>({...p,periods:[...p.periods].sort((a,b)=>a.from.localeCompare(b.from)),mappings:[...p.mappings].sort((a,b)=>a.itemId.localeCompare(b.itemId))}) as TaxProfile;
const profileDigest=(p:TaxProfile)=>sha(JSON.stringify({...p,revision:0}));
async function get(c:any,cipher:any,k:string,tenant:string){const r=(await c.query('select value from ab.settings where tenant_id=$1 and key=$2',[tenant,k])).rows[0];if(!r)return null;const value=cipher.open(r.value.cipher);requireOk(value?.profile&&taxProfileSchema.safeParse(value.profile).success&&value.companyId!==null,409,'taxProfileSourceReviewRequired');const expected=key(value.profile.companyId,value.profile.taxType);requireOk((k===expected||k.startsWith(expected+':'))&&(!value.companyId||value.companyId===value.profile.companyId)&&(!value.taxType||value.taxType===value.profile.taxType),409,'taxProfileSourceReviewRequired');return value;}
async function put(c:any,cipher:any,s:any,k:string,v:any,head=false){await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)'+(head?' on conflict(tenant_id,key)do update set value=excluded.value':''),[s.tenant_id,k,{cipher:cipher.seal(v)}]);}
async function catalog(c:any,cipher:any,s:any,co:string){
 const rows=(await c.query('select id,name_ar,name_en,category,active,payload_cipher from ab.finance_items where tenant_id=$1 order by id limit 2001',[s.tenant_id])).rows;requireOk(rows.length<=2000,422,'taxCatalogReviewRequired');
 const result=rows.filter((r:any)=>{const p=cipher.open(r.payload_cipher);return !p.companyIds?.length||p.companyIds.includes(co);});requireOk(result.length<=500,422,'taxCatalogReviewRequired');
 return{rows:result.map((r:any)=>({id:r.id,nameAr:r.name_ar,nameEn:r.name_en,category:r.category,active:r.active})),digest:sha(JSON.stringify(result.map((r:any)=>[r.id,r.name_ar,r.name_en,r.category,r.active,cipher.digest(r.payload_cipher)])))};
}
function assertItems(profile:TaxProfile,source:any){const ids=new Set(source.rows.map((r:any)=>r.id));requireOk(profile.mappings.every(m=>ids.has(m.itemId)),422,'taxItemCompanyRequired');}
export async function taxControlProfile(c:any,cipher:any,co:string,type:'vat'|'corporate',tenant:string){const record=await get(c,cipher,key(co,type),tenant);return record?{...record.profile,revision:record.revision}:null;}
export function taxPlanningIllustration(p:TaxProfile,input:z.infer<typeof scenario>={}){
 const selected=p.mappings.filter(m=>m.selected),unresolved=selected.filter(m=>m.status==='pending_review').length;
 const output:any={...flags,basis:'manual_scenario_only_not_ledger_or_return',selectedItems:selected.length,pendingReview:unresolved,proposedTax:null,taxDue:null,rounding:'system_0.001_per_bracket_illustration_only'};
 if(p.taxType==='vat'){
  output.registration={status:p.settings.registrationStatus,threshold:p.settings.registrationThreshold,comparison:input.registrationTurnover!==undefined&&p.settings.registrationThreshold!==null?(L.units(input.registrationTurnover)<L.units(p.settings.registrationThreshold)?'below':'at_or_above'):null,calculationUsesThreshold:false,legalRegistrationDecision:false};
  const m=p.mappings.find(x=>x.itemId===input.itemId&&x.selected);
  if(p.settings.registrationStatus==='registered'&&input.taxableBase!==undefined&&m&&m.status!=='pending_review'&&m.ruleReference&&m.supply!=='review'&&m.supply!=='reverse_charge'&&m.rateBasisPoints!==null)output.proposedTax=L.money((L.units(input.taxableBase)*BigInt(m.rateBasisPoints)+5000n)/10000n);
 }else{
  output.accountingProfit=input.accountingProfit??null;output.proposedAdditions=input.additions??'0';output.proposedDeductions=input.deductions??'0';
  output.proposedTaxableIncome=input.accountingProfit===undefined?null:L.money(L.units(input.accountingProfit)+L.units(input.additions||'0')-L.units(input.deductions||'0'));
  if(output.proposedTaxableIncome!==null&&p.ruleReference&&p.settings.brackets.length&&!unresolved){let base=L.units(output.proposedTaxableIncome);if(base<0n)base=0n;let sum=0n;for(const b of p.settings.brackets){const low=L.units(b.from),high=b.to===null?base:L.units(b.to),amount=(base<high?base:high)-low;if(amount>0n)sum+=(amount*BigInt(b.rateBasisPoints)+5000n)/10000n;}output.proposedTax=L.money(sum);}
 }
 return output;
}
export function registerTaxControlCenter(app:any,route:any,cipher:any){
 const base='/api/ledger/package/tax-control';
 const auth=(m:any,co:string,write=false)=>{need(m,write?'configure':'view',co);requireOk(m.state.companies.some((v:any)=>v.id===co),403,'denied');if(write)company(m,co);};
 app.get(base,route(async(c:any,m:any,s:any,req:any)=>{const q=context.parse(req.query);auth(m,q.companyId);const k=key(q.companyId,q.taxType),head=await get(c,cipher,k,s.tenant_id),source=await catalog(c,cipher,s,q.companyId),fileKeys=(await c.query('select key from ab.settings where tenant_id=$1 and key=any($2::text[])',[s.tenant_id,[key(q.companyId,'vat'),key(q.companyId,'corporate')]])).rows.map((r:any)=>r.key);return{companyId:q.companyId,taxType:q.taxType,legacyFieldLocks:{vat:fileKeys.includes(key(q.companyId,'vat')),corporate:fileKeys.includes(key(q.companyId,'corporate'))},profile:head?.profile||null,revision:head?.revision||0,status:head?.status||'NotConfigured',versionId:head?.id||null,sourceChanged:head?head.sourceDigest!==source.digest:false,items:source.rows,history:(head?.history||[]).map((r:any)=>{const u=m.state.users.find((u:any)=>u.id===r.actorId);return{...r,actorNameAr:u?.nameAr||u?.fullName||'',actorNameEn:u?.nameEn||u?.fullName||''};}),canConfigure:financeRight(m,'ledger_configure',q.companyId)&&m.state.companies.some((v:any)=>v.id===q.companyId&&v.status==='Active'),...flags};}));
 app.post(base+'/draft',route(async(c:any,m:any,s:any,req:any)=>{
  const p=normalize(taxProfileSchema.parse(req.body));auth(m,p.companyId,true);const k=key(p.companyId,p.taxType);await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[k]);const old=await get(c,cipher,k,s.tenant_id),source=await catalog(c,cipher,s,p.companyId);assertItems(p,source);const digest=profileDigest(p);
  if(old?.profileDigest===digest&&old.sourceDigest===source.digest)return{id:old.id,revision:old.revision,status:old.status,existing:true,...flags};requireOk((old?.revision||0)===p.revision,409,'revisionConflict');requireOk((old?.history.length||0)<250,422,'taxProfileHistoryReviewRequired');
  const revision=p.revision+1,record={id:randomUUID(),revision,profile:p,itemSnapshot:source.rows.filter((r:any)=>p.mappings.some(m=>m.itemId===r.id)),profileDigest:digest,sourceDigest:source.digest,status:'DraftForReview',actorId:s.user_id,at:new Date().toISOString()},history=[...(old?.history||[]),{id:record.id,revision,status:record.status,actorId:s.user_id,at:record.at,effectiveFrom:p.effectiveFrom,effectiveUntil:p.effectiveUntil}];
  await put(c,cipher,s,k+':version:'+record.id,record);await put(c,cipher,s,k,{...record,history},true);await event(c,cipher,s,p.companyId,p.companyId,'tax_profile_draft_saved',old?.profile||null,{taxType:p.taxType,versionId:record.id,revision,profile:p,...flags});return{id:record.id,revision,status:record.status,...flags};
 }));
 app.post(base+'/preview',route(async(c:any,m:any,s:any,req:any)=>{
  const d=z.object({profile:taxProfileSchema,scenario:scenario.default({})}).strict().parse(req.body),p=normalize(d.profile);auth(m,p.companyId,true);const k=key(p.companyId,p.taxType),head=await get(c,cipher,k,s.tenant_id);requireOk((head?.revision||0)===p.revision,409,'revisionConflict');const source=await catalog(c,cipher,s,p.companyId);assertItems(p,source);
  const record={id:randomUUID(),companyId:p.companyId,taxType:p.taxType,actorId:s.user_id,profile:p,sourceDigest:source.digest,revision:p.revision,expiresAt:new Date(Date.now()+15*60000).toISOString()},digest=cipher.digest(JSON.stringify(record));await put(c,cipher,s,k+':preview:'+record.id,{...record,digest});return{previewId:record.id,digest,expiresAt:record.expiresAt,profile:p,previousProfile:head?.profile||null,illustration:taxPlanningIllustration(p,d.scenario),reviewEligible:!!p.ruleReference&&!p.mappings.some(x=>x.selected&&x.status==='pending_review')&&p.effectiveFrom>=today(),reviewMeaning:'planning_version_only_not_legal_tax_approval',...flags};
 }));
 app.post(base+'/review',route(async(c:any,m:any,s:any,req:any)=>{
  const d=context.extend({previewId:id,digest:z.string().length(64),confirm:z.literal(true)}).parse(req.body);auth(m,d.companyId,true);requireOk(m.actor.roleId==='owner',403,'ownerOnly');const k=key(d.companyId,d.taxType);await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[k]);const old=await get(c,cipher,k,s.tenant_id),preview=await get(c,cipher,k+':preview:'+d.previewId,s.tenant_id);
  requireOk(preview&&preview.actorId===s.user_id&&preview.companyId===d.companyId&&preview.taxType===d.taxType&&preview.digest===d.digest,409,'taxProfilePreviewRequired');const {digest:storedDigest,...previewBody}=preview;requireOk(storedDigest===cipher.digest(JSON.stringify(previewBody)),409,'taxProfilePreviewRequired');
  if(old?.reviewPreviewId===preview.id)return{id:old.id,revision:old.revision,status:old.status,existing:true,...flags};requireOk(new Date(preview.expiresAt).getTime()>Date.now(),409,'taxProfilePreviewExpired');requireOk((old?.revision||0)===preview.revision,409,'revisionConflict');
  const p=taxProfileSchema.parse(preview.profile),source=await catalog(c,cipher,s,d.companyId);assertItems(p,source);requireOk(source.digest===preview.sourceDigest,409,'taxProfileSourceChanged');requireOk(p.effectiveFrom>=today(),422,'prospectiveTaxProfileRequired');requireOk(p.ruleReference&&!p.mappings.some(x=>x.selected&&x.status==='pending_review'),422,'taxProfileReviewRequired');requireOk((old?.history.length||0)<250,422,'taxProfileHistoryReviewRequired');
  const record={id:randomUUID(),revision:preview.revision+1,profile:p,itemSnapshot:source.rows.filter((r:any)=>p.mappings.some(m=>m.itemId===r.id)),profileDigest:profileDigest(p),sourceDigest:source.digest,status:'ReviewedForPlanning',reviewPreviewId:preview.id,actorId:s.user_id,at:new Date().toISOString()},history=[...(old?.history||[]),{id:record.id,revision:record.revision,status:record.status,actorId:s.user_id,at:record.at,effectiveFrom:p.effectiveFrom,effectiveUntil:p.effectiveUntil}];
  await put(c,cipher,s,k+':version:'+record.id,record);await put(c,cipher,s,k,{...record,history},true);await event(c,cipher,s,p.companyId,p.companyId,'tax_profile_planning_reviewed',old?.profile||null,{taxType:p.taxType,versionId:record.id,revision:record.revision,profile:p,...flags});return{id:record.id,revision:record.revision,status:record.status,...flags};
 }));
 app.get(base+'/version',route(async(c:any,m:any,s:any,req:any)=>{const d=context.extend({versionId:id}).parse(req.query);auth(m,d.companyId);const record=await get(c,cipher,key(d.companyId,d.taxType)+':version:'+d.versionId,s.tenant_id);requireOk(record,404,'notFound');return{record,...flags};}));
 app.get(base+'/report',route(async(c:any,m:any,s:any,req:any)=>{
  const q=context.extend({locale:z.enum(['ar','en']).default('ar'),format:z.enum(['json','csv','excel','print']).default('json'),...registerArgs}).parse(req.query);auth(m,q.companyId);need(m,'report',q.companyId);if(q.format!=='json')need(m,'export',q.companyId);
  const head=await get(c,cipher,key(q.companyId,q.taxType),s.tenant_id),source=await catalog(c,cipher,s,q.companyId),ar=q.locale==='ar',t=(a:string,b:string)=>ar?a:b;
  const states:any={pending_review:t('بانتظار مراجعة','Pending review'),classified:t('مصنف','Classified'),not_subject:t('غير خاضع وفق مرجع قاعدة','Not subject under referenced rule')},classes:any={review:t('بانتظار مراجعة','Pending review'),standard:t('توريد بالنسبة المحددة','Standard-rated supply'),zero:t('توريد بنسبة صفر','Zero-rated supply'),exempt:t('توريد معفى','Exempt supply'),outside_scope:t('خارج نطاق VAT','Outside VAT scope'),reverse_charge:t('احتساب عكسي — مراجعة','Reverse charge — review'),revenue:t('إيرادات','Revenue'),expense:t('مصروفات','Expenses'),capital_recovery:t('استرداد رأس المال','Capital recovery'),receivable:t('ذمم','Receivables'),tax_adjustment:t('تعديلات ضريبية','Tax adjustments')};
  const treatment:any={review:t('بانتظار مراجعة','Pending review'),taxable:t('دخل خاضع مقترح','Proposed taxable income'),non_taxable:t('ليس دخلاً خاضعاً وفق المرجع','Non-taxable under referenced rule'),deductible:t('مصروف قابل للخصم وفق المرجع','Deductible under referenced rule'),non_deductible:t('غير قابل للخصم وفق المرجع','Non-deductible under referenced rule'),add:t('إضافة للدخل المقترح','Add to proposed income'),deduct:t('استبعاد من الدخل المقترح','Deduct from proposed income')};
  const co=m.state.companies.find((v:any)=>v.id===q.companyId);const rows=source.rows.map((r:any)=>{const v=head?.profile.mappings.find((x:any)=>x.itemId===r.id);return{company:ar?co.arabicName:co.englishName,taxFile:q.taxType==='vat'?'VAT':'Corporate Tax',item:(ar?r.nameAr:r.nameEn)+(r.active?'':' · '+t('غير نشط — محفوظ','Inactive — retained')),selected:v?.selected?t('محدد','Selected'):t('غير محدد — ليس حكماً ضريبياً','Not selected — no tax determination'),status:states[v?.status||'pending_review'],classification:classes[v?.supply||v?.category||'review']+(q.taxType==='corporate'?' · '+treatment[v?.treatment||'review']:''),rate:v?.rateBasisPoints==null?'':String(v.rateBasisPoints/100),ruleReference:v?.ruleReference||''};}),columns=['company','taxFile','item','selected','status','classification',...(q.taxType==='vat'?['rate']:[]),'ruleReference'],labels={company:t('الشركة','Company'),taxFile:t('الملف الضريبي','Tax file'),item:t('البند المالي الموحد','Unified financial item'),selected:t('الاختيار','Selection'),status:t('حالة المراجعة','Review state'),classification:t('التصنيف','Classification'),rate:t('النسبة %','Rate %'),ruleReference:t('مرجع القاعدة','Rule reference')};
  return{...registerResponse(rows,{...q,full:'true'},columns,'tax-profile-'+q.taxType,labels,{rate:'number'},['item','status','classification',...(q.taxType==='vat'?['rate']:[]),'ruleReference']),columns,columnLabels:labels,companyId:q.companyId,taxType:q.taxType,profileRevision:head?.revision||0,settings:head?.profile.settings||null,scope:'Planning configuration only; not assessed tax, legal approval, posted ledger or tax return',...flags};
 }));

}
