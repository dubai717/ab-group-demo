import{reviewedPrivateJsonSourceReady}from'./reviewed-private-json-source.js';
// Review-only private source adapter. No route, service guard, actor substitution or live installer.
import{z}from'zod';import{requireOk,ApiError}from'./core.js';import{L}from'./ledger-domain.js';import{today,vehicleRight}from'./vehicle-domain.js';import{customerCan}from'./customers.js';import{decodeCommunicationCaseBook}from'./communication-cases.js';import{receivableAdjustmentFacts,unappliedReceiptCreditFacts}from'./receivable-amount-facts.js';import{serviceEligibilitySourceProjection}from'./service-eligibility-source.js';
const uuid=z.uuid(),money=z.string().regex(/^\d{1,18}(?:\.\d{1,3})?$/),ciphertext=z.string().min(1).max(8388608),date=z.iso.date(),nullableId=uuid.nullable();
const invoice=z.object({id:uuid,company_id:uuid,vehicle_id:nullableId,contract_id:nullableId,kind:z.string().max(50),source_key:z.string().max(1000),due_on:date,amount:money,currency:z.string().length(3),payload_cipher:ciphertext,category:z.string().max(100).nullable(),paid:money}).strict();
const packetSchema=z.object({format:z.literal('AB-SERVICE-ELIGIBILITY-SOURCE-1'),actorId:uuid,tenantId:uuid,customerId:uuid,asOf:date,purposeOnly:z.literal(true),sourceWrites:z.literal(false),companyCount:z.number().int().min(1).max(100),companies:z.array(uuid).min(1).max(100),invoices:z.array(invoice).max(20000),adjustments:z.array(z.object({invoice_id:uuid,kind:z.string().max(50),amount:money,document_type:z.string().max(100).nullable()}).strict()).max(20000),contracts:z.array(z.object({id:uuid,company_id:uuid,vehicle_id:uuid,payload_cipher:ciphertext}).strict()).max(20000),confirmations:z.array(z.object({tenant_id:uuid,company_id:uuid,vehicle_id:uuid,payload_cipher:ciphertext}).strict()).max(20000),credits:z.array(z.object({company_id:uuid,currency:z.string().length(3),amount:money,allocated:money}).strict()).max(20000),caseBooks:z.array(z.object({id:uuid,value:z.unknown()}).strict()).max(500)}).strict();
export function projectActualActorEligibilityPacket(raw:unknown,cipher:any,context:{actorId:string;tenantId:string;customerId:string;asOf:string}){
 const parsed=packetSchema.safeParse(raw);requireOk(parsed.success,503,'eligibilitySourceReviewRequired');const p=parsed.data!;
 requireOk(p.actorId===context.actorId&&p.tenantId===context.tenantId&&p.customerId===context.customerId&&p.asOf===context.asOf,503,'eligibilitySourceContextMismatch');
 const companies=new Set(p.companies),invoiceIds=new Set(p.invoices.map(r=>r.id));requireOk(companies.size===p.companyCount&&companies.size===p.companies.length&&invoiceIds.size===p.invoices.length,503,'eligibilitySourceIncomplete');
 requireOk(p.invoices.every(r=>companies.has(r.company_id)&&r.due_on<=p.asOf)&&p.credits.every(r=>companies.has(r.company_id))&&p.adjustments.every(r=>invoiceIds.has(r.invoice_id)),503,'eligibilitySourceIncomplete');
 requireOk(new Set(p.contracts.map(r=>r.id)).size===p.contracts.length&&new Set(p.caseBooks.map(r=>r.id)).size===p.caseBooks.length&&p.confirmations.every(e=>e.tenant_id===p.tenantId&&companies.has(e.company_id)&&p.contracts.some(r=>r.vehicle_id===e.vehicle_id&&r.company_id===e.company_id)),503,'eligibilitySourceContextMismatch');
 const contracts=p.contracts.map(r=>{requireOk(p.invoices.some(i=>i.contract_id===r.id&&i.company_id===r.company_id&&i.vehicle_id===r.vehicle_id),503,'eligibilitySourceIncomplete');const term=cipher.open(r.payload_cipher),confirmed=p.confirmations.some(e=>{requireOk(e.tenant_id===p.tenantId&&companies.has(e.company_id),503,'eligibilitySourceContextMismatch');const event=cipher.open(e.payload_cipher);return event.after?.contractId===r.id&&e.company_id===r.company_id&&e.vehicle_id===r.vehicle_id;});return{id:r.id,companyId:r.company_id,vehicleId:r.vehicle_id,startOn:term.startOn,months:term.months,confirmed:confirmed&&typeof term.legalBasis==='string'&&term.legalBasis.trim().length>0};});
 const rows=p.invoices.map(r=>{const {remaining,...facts}=receivableAdjustmentFacts(r.amount,r.paid,p.adjustments.filter(a=>a.invoice_id===r.id));return{id:r.id,companyId:r.company_id,vehicleId:r.vehicle_id,contractId:r.contract_id,kind:r.kind,sourceReference:r.source_key,dueOn:r.due_on,amount:r.amount,paid:r.paid,currency:r.currency,category:r.category,...facts};});
 const metadata=p.invoices.filter(r=>['finance','service'].includes(r.kind)).map(r=>{const v=cipher.open(r.payload_cipher);return{id:r.id,payload:{installment:v.installment,recurring:v.recurring,contractId:v.contractId}};});
 const credits=new Map<string,typeof p.credits>();for(const row of p.credits){requireOk(L.units(row.allocated)<=L.units(row.amount),503,'eligibilitySourceAmountReviewRequired');const key=row.company_id+':'+row.currency;credits.set(key,[...(credits.get(key)||[]),row]);}
 let disputeReview=false;for(const book of p.caseBooks){try{if(decodeCommunicationCaseBook(cipher,book.value,p.tenantId,book.id).cases.some((c:any)=>['financial_dispute','payment_claim'].includes(c.kind)))disputeReview=true;}catch(e){if(e instanceof ApiError&&e.status===409)disputeReview=true;else throw e;}}
 const projection=serviceEligibilitySourceProjection({customerId:p.customerId,asOf:p.asOf,companyIds:[...companies].sort(),rows,contracts,metadata,creditBalances:[...credits.values()].map(rows=>({creditBalance:unappliedReceiptCreditFacts(rows)})),disputeReview,completeScope:true});
 // No raw packet, names, bank details, invoice/vehicle/company IDs or contract payload reach clients.
 return{status:projection.simulation.status,reason:projection.simulation.reason,reference:'last_two_actual_due_months',confirmedOverdue:projection.simulation.confirmedOverdue,referenceCommitment:projection.simulation.referenceCommitment,referenceMonths:projection.simulation.referenceMonths,issues:projection.issues,sourceVersion:projection.sourceVersion,asOf:p.asOf,simulationOnly:true,controllerGuardInstalled:false,financialEffect:false};
}

// Explicit reviewed body pin. Changing a proposal requires review and a new test, never runtime repair.
export const eligibilitySourceBodyHash='9d1a4b97405c6e577481611923d17500bfecdeec6c32164eb9d885c7c20a2e88';
export const actualActorEligibilitySourceReady=(c:any)=>reviewedPrivateJsonSourceReady(c,'ab.service_eligibility_source_snapshot(uuid,date)',eligibilitySourceBodyHash);

async function actualActorEligibilityRead(c:any,m:any,s:any,cipher:any,input:{customerId:string;companyId:string;type:'vehicle'|'residence'|'general'},readOnlyReview:boolean,approvalPhase=false){
 const d=z.object({customerId:uuid,companyId:uuid,type:z.enum(['vehicle','residence','general'])}).strict().parse(input);
 requireOk(!s.viewAs&&(s.actor_type===undefined||s.actor_type==='user')&&m.actor.id===s.user_id&&m.actor.status==='Active'&&m.actor.roleId!=='investor',403,'denied');
 const context=(await c.query("select ab.tenant()tenant_id,current_setting('ab.actor')actor_id,current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only")).rows[0];
 requireOk(context.tenant_id===s.tenant_id&&context.actor_id===s.user_id,403,'denied');requireOk(readOnlyReview?context.isolation==='repeatable read'&&context.read_only==='on':['read committed','repeatable read','serializable'].includes(context.isolation)&&context.read_only==='off',409,'eligibilitySnapshotReviewRequired');
 const company=m.state.companies.find((r:any)=>r.id===d.companyId);requireOk(company&&(approvalPhase||company.status==='Active'),403,'denied');
 const customer=(await c.query('select id,company_id from ab.customers where id=$1',[d.customerId])).rows[0];requireOk(customer,404,'notFound');
 requireOk(customerCan(m,approvalPhase||d.type==='vehicle'?'view':'edit',customer.company_id),403,'denied');
 requireOk(approvalPhase?m.actor.roleId==='owner':d.type==='vehicle'?vehicleRight(m,'create',d.companyId):customerCan(m,'view',d.companyId)&&customerCan(m,'edit',d.companyId),403,'denied');
 requireOk(await actualActorEligibilitySourceReady(c),503,'eligibilitySourceReviewRequired');
 const raw=(await c.query('select ab.service_eligibility_source_snapshot($1,$2)packet',[d.customerId,today()])).rows[0]?.packet;
 return projectActualActorEligibilityPacket(raw,cipher,{actorId:s.user_id,tenantId:s.tenant_id,customerId:d.customerId,asOf:today()});
}

export const actualActorServiceEligibilityReview=(c:any,m:any,s:any,cipher:any,input:{customerId:string;companyId:string;type:'vehicle'|'residence'|'general'})=>actualActorEligibilityRead(c,m,s,cipher,input,true);
// Used only by the explicit isolated new-request prototype; never selected by a client input.
export const actualActorServiceEligibilityCreationCheck=(c:any,m:any,s:any,cipher:any,input:{customerId:string;companyId:string;type:'vehicle'|'residence'|'general'})=>actualActorEligibilityRead(c,m,s,cipher,input,false);

export const actualActorServiceEligibilityApprovalCheck=(c:any,m:any,s:any,cipher:any,input:{customerId:string;companyId:string;type:'vehicle'|'residence'|'general'})=>actualActorEligibilityRead(c,m,s,cipher,input,false,true);

export type VehicleExecutionInput={customerId:string;companyId:string;type:'vehicle';requestId:string;phase:'disburse'|'register'};
// Minimal execution authorization. Registration permission does not manufacture customer-profile/ledger-view rights.
export async function assertActualVehicleExecutionContext(c:any,m:any,s:any,input:VehicleExecutionInput){
 const d=z.object({customerId:uuid,companyId:uuid,type:z.literal('vehicle'),requestId:uuid,phase:z.enum(['disburse','register'])}).strict().parse(input);
 requireOk(!s.viewAs&&(s.actor_type===undefined||s.actor_type==='user')&&m.actor.id===s.user_id&&m.actor.status==='Active'&&m.actor.roleId!=='investor',403,'denied');const context=(await c.query("select ab.tenant()tenant_id,current_setting('ab.actor')actor_id,current_setting('transaction_read_only')read_only")).rows[0];requireOk(context.tenant_id===s.tenant_id&&context.actor_id===s.user_id&&context.read_only==='off',403,'denied');
 requireOk(m.state.companies.some((r:any)=>r.id===d.companyId)&&vehicleRight(m,d.phase==='register'?'create':'disburse',d.companyId),403,'denied');
 const original=(await c.query('select id,tenant_id,company_id,customer_id from ab.vehicle_requests where id=$1 for update',[d.requestId])).rows[0];requireOk(original&&original.tenant_id===s.tenant_id&&original.company_id===d.companyId&&original.customer_id===d.customerId,404,'notFound');
 requireOk(!!(await c.query("select to_regprocedure('ab.hr_actor_allowed()')ok")).rows[0]?.ok,503,'eligibilityWorkAccessUnavailable');requireOk((await c.query('select ab.hr_actor_allowed()ok')).rows[0]?.ok===true,403,'denied');return d;
}
export async function actualActorVehicleExecutionEligibility(c:any,m:any,s:any,cipher:any,input:VehicleExecutionInput){
 const d=await assertActualVehicleExecutionContext(c,m,s,input);requireOk(await actualActorEligibilitySourceReady(c),503,'eligibilitySourceReviewRequired');const raw=(await c.query('select ab.service_eligibility_source_snapshot($1,$2)packet',[d.customerId,today()])).rows[0]?.packet;return projectActualActorEligibilityPacket(raw,cipher,{actorId:s.user_id,tenantId:s.tenant_id,customerId:d.customerId,asOf:today()});
}
