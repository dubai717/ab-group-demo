import {registerTaxRegistrationReview} from './tax-registration-review.js';
import {registerTaxSourceReview} from './tax-source-review.js';
import {corporateAccounting,registerCorporateTaxSources} from './corporate-tax-workpaper.js';
import {vatControlsSchema,validateVatControls,registerVatWorkpaper} from './vat-workpaper.js';
import {z} from 'zod';
import {requireOk} from './core.js';
import {L,need,company,item,event,evidence} from './ledger-domain.js';
const period=z.object({from:z.iso.date(),to:z.iso.date()}).strict().refine(p=>p.to>=p.from,{message:'invalidTaxPeriod'});
export const companyTaxSchema=z.object({
 companyId:z.uuid(),revision:z.number().int().min(0),trn:z.string().regex(/^\d{15}$/),
 vatPeriods:z.array(period).max(120),corporatePeriods:z.array(period).max(30),
 mappings:z.array(z.object({itemId:z.uuid(),category:z.enum(['standard','zero','exempt','outside_scope','reverse_charge','review']),
  rateBasisPoints:z.number().int().min(0).max(10000).nullable(),inputRecovery:z.enum(['review','recoverable','blocked','partial']),
  reason:z.string().trim().min(1).max(2000)}).strict()).max(500),
 adjustments:z.array(z.object({id:z.uuid(),from:z.iso.date(),to:z.iso.date(),direction:z.enum(['add','deduct']),
  amount:z.string().regex(/^\d{1,15}(\.\d{1,3})?$/),reason:z.string().trim().min(1).max(2000),
  evidenceVersionId:z.uuid().nullable()}).strict()).max(500),
 notes:z.string().max(4000),vatControls:vatControlsSchema.optional(),confirm:z.literal(true)
}).strict().superRefine((d,ctx)=>{
 for(const key of ['vatPeriods','corporatePeriods'] as const){const sorted=[...d[key]].sort((a,b)=>a.from.localeCompare(b.from));
  if(sorted.some((p,i)=>i>0&&p.from<=sorted[i-1].to))ctx.addIssue({code:'custom',path:[key],message:'overlappingTaxPeriods'});}
 if(new Set(d.mappings.map(x=>x.itemId)).size!==d.mappings.length)ctx.addIssue({code:'custom',path:['mappings'],message:'duplicateTaxMapping'});
 if(new Set(d.adjustments.map(x=>x.id)).size!==d.adjustments.length)ctx.addIssue({code:'custom',path:['adjustments'],message:'duplicateTaxAdjustment'});
 for(const [i,m] of d.mappings.entries())if((['zero','exempt','outside_scope'].includes(m.category)&&m.rateBasisPoints!==0)||
  (m.category==='standard'&&(!m.rateBasisPoints||m.rateBasisPoints<=0))||
  (m.category==='review'&&m.rateBasisPoints!==null))ctx.addIssue({code:'custom',path:['mappings',i],message:'taxClassificationReviewRequired'});
 for(const [i,a] of d.adjustments.entries())if(a.to<a.from||L.units(a.amount)<=0n)ctx.addIssue({code:'custom',path:['adjustments',i],message:'invalidTaxAdjustment'});
});
const key=(co:string)=>'tax-preparation-v1:'+co;
export async function companyTaxDraft(c:any,cipher:any,co:string){
 const r=(await c.query('select value from ab.settings where key=$1',[key(co)])).rows[0];
 return r?cipher.open(r.value.cipher):null;
}
export function taxBridge(profit:string,adjustments:any[],from:string,to:string){
 const rows=adjustments.filter(a=>a.from===from&&a.to===to),adds=rows.filter(a=>a.direction==='add').reduce<bigint>((n,a)=>n+L.units(a.amount),0n),
  deductions=rows.filter(a=>a.direction==='deduct').reduce<bigint>((n,a)=>n+L.units(a.amount),0n);
 return{currency:'AED',accountingProfit:profit,proposedAdditions:L.money(adds),proposedDeductions:L.money(deductions),
  proposedTaxableIncome:L.money(L.units(profit)+adds-deductions),taxableIncome:null,taxDue:null,
  adjustments:rows,filingReady:false,status:'DraftForTaxReview',source:'posted income/expense journals and approved bank operations; exact selected period only'};
}
export function registerCompanyTaxPreparation(app:any,route:any,cipher:any){
 registerTaxRegistrationReview(app,route,cipher,companyTaxDraft);
 registerVatWorkpaper(app,route,cipher,companyTaxDraft);
 registerTaxSourceReview(app,route,cipher,companyTaxDraft);
 registerCorporateTaxSources(app,route);
 app.post('/api/ledger/package/tax-config',route(async(c:any,m:any,s:any,req:any)=>{
  const d=companyTaxSchema.parse(req.body);need(m,'configure',d.companyId);company(m,d.companyId);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[key(d.companyId)]);
  const old=await companyTaxDraft(c,cipher,d.companyId);requireOk((old?.revision||0)===d.revision,409,'revisionConflict');
  if(d.vatControls){await validateVatControls(c,cipher,m,d.companyId,d.vatControls);if(d.vatControls.evidenceVersionId)await evidence(c,m,d.companyId,d.vatControls.evidenceVersionId);}
  for(const mapping of d.mappings)await item(c,cipher,m,mapping.itemId,d.companyId,true);
  for(const adjustment of d.adjustments)if(adjustment.evidenceVersionId)await evidence(c,m,d.companyId,adjustment.evidenceVersionId);
  // Configuration drafts have no posting, invoice, rate-change or filing authority.
  const value={...d,...(!d.vatControls&&old?.vatControls?{vatControls:old.vatControls}:{}),revision:d.revision+1,status:'DraftForTaxReview',updatedBy:s.user_id,updatedAt:new Date().toISOString()};
  await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',
   [s.tenant_id,key(d.companyId),{cipher:cipher.seal(value)}]);
  await event(c,cipher,s,d.companyId,d.companyId,'tax_preparation_draft_saved',old,value);
  return{saved:true,revision:value.revision,status:value.status,financialEffect:false,filingReady:false};
 }));
 app.get('/api/ledger/package/tax-config',route(async(c:any,m:any,s:any,req:any)=>{
  const co=z.uuid().parse(req.query.companyId);need(m,'view',co);company(m,co);
  return{configuration:await companyTaxDraft(c,cipher,co),filingReady:false,automaticTaxPosting:false,
   electronicInvoice:{status:'NotConnected',standard:'PINT-AE',submissionEnabled:false}};
 }));
 app.get('/api/ledger/package/tax-bridge',route(async(c:any,m:any,s:any,req:any)=>{
  const q=z.object({companyId:z.uuid(),from:z.iso.date(),to:z.iso.date()}).strict().parse(req.query);
  requireOk(q.to>=q.from,422,'invalidTaxPeriod');need(m,'report',q.companyId);company(m,q.companyId);
  const accounting=await corporateAccounting(c,q.companyId,q.from,q.to),cfg=await companyTaxDraft(c,cipher,q.companyId);
  const registeredPeriod=cfg?.corporatePeriods.some((p:any)=>p.from===q.from&&p.to===q.to)||false;
  const co=m.state.companies.find((r:any)=>r.id===q.companyId);return{companyId:q.companyId,companyNameAr:co.arabicName,companyNameEn:co.englishName,from:q.from,to:q.to,registeredPeriod,...taxBridge(accounting.accountingProfit,cfg?.adjustments||[],q.from,q.to),...accounting};
 }));
}
