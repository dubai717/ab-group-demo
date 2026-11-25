import{workLocationSourceReady}from'./employee-work-location-readiness.js';
// Minimal original-receivable read candidate. No server registration, Owner model,
// profile/ledger grant, allocation, receipt, custody move or financial write.
import{z}from'zod';import{requireOk}from'./core.js';import{financeRight}from'./finance.js';import{receivableAdjustmentFacts}from'./receivable-amount-facts.js';import{reviewedPrivateJsonSourceReady}from'./reviewed-private-json-source.js';
const uuid=z.uuid(),money=z.string().regex(/^\d{1,15}(?:\.\d{1,3})?$/),header={format:z.literal('AB-CROSS-BRANCH-COLLECTION-SOURCE-1'),actorId:uuid,tenantId:uuid,customerId:uuid,companyId:uuid,purposeOnly:z.literal(true),sourceWrites:z.literal(false)},review=z.object({...header,reviewRequired:z.string().min(1).max(100)}).strict();
const packet=z.object({...header,customer:z.object({id:uuid,number:z.string().regex(/^\d+$/).max(30),payload:z.string().max(65536)}).strict(),invoices:z.array(z.object({id:uuid,company_id:uuid,customer_id:uuid,vehicle_id:uuid.nullable(),invoice_number:z.string().regex(/^\d+$/).max(30),kind:z.string().max(100),currency:z.string().max(3),amount:money,due_on:z.iso.date(),paid:money,item_id:uuid.nullable(),name_ar:z.string().max(640).nullable(),name_en:z.string().max(640).nullable()}).strict()).max(100),adjustments:z.array(z.object({id:uuid,invoice_id:uuid,kind:z.enum(['waiver','writeoff','reschedule','termination']),amount:money,document_type:z.string().max(100).nullable()}).strict()).max(1000)}).strict();
export const crossBranchCollectionBodyHash='84e1343b299d41e3efc0b8eae7fbc1403cc4968ddf62dfea8ebf782534134016';
export function projectCrossBranchCollectionSource(raw:unknown,cipher:any,context:{actorId:string;tenantId:string;customerId:string;companyId:string}){
 const h=z.object(header).passthrough().parse(raw);requireOk(h.actorId===context.actorId&&h.tenantId===context.tenantId&&h.customerId===context.customerId&&h.companyId===context.companyId,409,'crossBranchCollectionSourceReviewRequired');
 const r=review.safeParse(raw);if(r.success)return{state:'review' as const,reason:r.data.reviewRequired,rows:[],canCollect:false,financialEffect:false};
 const p=packet.parse(raw),ids=new Set(p.invoices.map(i=>i.id)),adjustmentIds=new Set(p.adjustments.map(a=>a.id));requireOk(p.customer.id===p.customerId&&ids.size===p.invoices.length&&adjustmentIds.size===p.adjustments.length&&p.invoices.every(i=>i.company_id===p.companyId&&i.customer_id===p.customerId)&&p.adjustments.every(a=>ids.has(a.invoice_id)),409,'crossBranchCollectionSourceReviewRequired');
 const identity=cipher.open(p.customer.payload),name=[identity.fullName,identity.nameAr,identity.nameEn].find(n=>typeof n==='string'&&n.trim());requireOk(typeof name==='string'&&name.length<=240,409,'crossBranchCollectionSourceReviewRequired');
 const rows=p.invoices.map(i=>{const facts=receivableAdjustmentFacts(i.amount,i.paid,p.adjustments.filter(a=>a.invoice_id===i.id));requireOk(facts.remaining>=0n,409,'crossBranchCollectionSourceReviewRequired');return{id:i.id,companyId:i.company_id,customerId:i.customer_id,vehicleId:i.vehicle_id,invoiceNumber:i.invoice_number,dueOn:i.due_on,itemNameAr:i.name_ar,itemNameEn:i.name_en,currency:i.currency,outstanding:facts.outstanding,collectible:i.currency==='AED'&&!!i.item_id&&!facts.cancelled&&facts.remaining>0n&&facts.writtenOff==='0.000'};});
 const excludedOpenCount=rows.filter(i=>!i.collectible&&i.outstanding!=='0.000').length;
 return{state:'reviewed_source' as const,customer:{id:p.customer.id,number:p.customer.number,name},companyId:p.companyId,rows:rows.filter(i=>i.collectible),excludedOpenCount,additionalSourceReviewRequired:excludedOpenCount>0,canCollect:false,purposeOnly:true,financialEffect:false,profileAccessGranted:false,ledgerAccessGranted:false,sourceVersion:cipher.digest(JSON.stringify(p))};
}
export async function readCrossBranchCollectionSource(c:any,m:any,s:any,cipher:any,input:unknown){
 const d=z.object({customerId:uuid,companyId:uuid}).strict().parse(input);requireOk(!s.viewAs&&(s.actor_type===undefined||s.actor_type==='user')&&m.actor.id===s.user_id&&m.actor.status==='Active'&&m.actor.roleId!=='investor'&&financeRight(m,'ledger_cross_branch_collect',d.companyId),403,'denied');
 const t=(await c.query("select ab.tenant()tenant_id,current_setting('ab.actor')actor_id,current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only")).rows[0];requireOk(t.tenant_id===s.tenant_id&&t.actor_id===s.user_id&&t.isolation==='repeatable read'&&t.read_only==='on',409,'crossBranchCollectionSnapshotRequired');
 requireOk(await reviewedPrivateJsonSourceReady(c,'ab.cross_branch_collection_source(uuid,uuid)',crossBranchCollectionBodyHash),503,'crossBranchCollectionSourceReviewRequired');const raw=(await c.query('select ab.cross_branch_collection_source($1,$2)packet',[d.customerId,d.companyId])).rows[0]?.packet;
 const source=projectCrossBranchCollectionSource(raw,cipher,{actorId:s.user_id,tenantId:s.tenant_id,...d});
 if(source.state!=='reviewed_source')return source;
 const receivingSiteAvailable=(await c.query("select to_regprocedure('ab.cross_branch_receiving_site(uuid)') is not null ok")).rows[0]?.ok;
 if(!receivingSiteAvailable)return source;
 return {...source,receivingSite:await readCrossBranchReceivingSite(c,m,s,d.companyId)};
}

const receivingSiteSourceHash='3701724a043d87818626dacac27e427e9970bf5c12a26e31f630e86f013b0291';
const receivingSiteHeader={actorId:uuid,tenantId:uuid,companyId:uuid,asOf:z.iso.date()};
const receivingSiteReview=z.object({...receivingSiteHeader,reviewRequired:z.enum([
 'individual_denial_source_review','receiving_site_unassigned','receiving_site_source_mismatch','receiving_site_unavailable',
])}).strict();
const receivingSiteFacts=z.object({...receivingSiteHeader,centreId:uuid,centreSourceId:uuid,locationSourceId:uuid}).strict();

async function crossBranchReceivingSite(c:any,m:any,s:any,companyId:string,writing:boolean){
 companyId=uuid.parse(companyId);
 requireOk(!s.viewAs&&(s.actor_type===undefined||s.actor_type==='user')&&m.actor.id===s.user_id&&
  m.actor.status==='Active'&&m.actor.roleId!=='investor'&&financeRight(m,'ledger_cross_branch_collect',companyId),403,'denied');
 const context=(await c.query("select ab.tenant()tenant_id,current_setting('ab.actor')actor_id,current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only,current_database() database")).rows[0];
 requireOk(context.tenant_id===s.tenant_id&&context.actor_id===s.user_id&&
  (writing?context.read_only==='off':context.isolation==='repeatable read'&&context.read_only==='on'),409,'crossBranchCollectionSnapshotRequired');
 if(writing)requireOk(/^ab_backup_[a-f0-9]{32}$/.test(context.database),503,'crossBranchCollectionNotEnabled');
 requireOk(await reviewedPrivateJsonSourceReady(c,'ab.cross_branch_receiving_site(uuid)',receivingSiteSourceHash)&&
  await workLocationSourceReady(c),503,'crossBranchReceivingSiteReviewRequired');
 const raw=(await c.query('select ab.cross_branch_receiving_site($1)packet',[companyId])).rows[0]?.packet;
 const source=receivingSiteReview.or(receivingSiteFacts).safeParse(raw);
 requireOk(source.success&&source.data.actorId===s.user_id&&source.data.tenantId===s.tenant_id&&
  source.data.companyId===companyId,409,'crossBranchReceivingSiteReviewRequired');
 const {actorId,tenantId,...site}=source.data;
 return {...site,canCollect:false,financialEffect:false};
}


export const crossBranchReceivingSiteSelection=z.object({
 centreId:uuid,centreSourceId:uuid,locationSourceId:uuid,
}).strict();

export const readCrossBranchReceivingSite=(c:any,m:any,s:any,companyId:string)=>
 crossBranchReceivingSite(c,m,s,companyId,false);

export async function verifyCrossBranchReceivingSite(c:any,m:any,s:any,companyId:string,receivedOn:string,selection:unknown){
 const expected=crossBranchReceivingSiteSelection.parse(selection);
 const site=await crossBranchReceivingSite(c,m,s,companyId,true);
 requireOk(!('reviewRequired' in site)&&site.asOf===receivedOn&&site.centreId===expected.centreId&&
   site.centreSourceId===expected.centreSourceId&&site.locationSourceId===expected.locationSourceId,
   409,'crossBranchReceivingSiteChanged');
 return {centreId:site.centreId,centreSourceId:site.centreSourceId,locationSourceId:site.locationSourceId,receivedOn:site.asOf};
}
