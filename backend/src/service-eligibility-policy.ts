import{serviceDubaiDay,serviceInstant}from'./service-activation-clock.js';
// Independent, side-effect-free policy over verified original accounting sources.
// This module does not query, duplicate or alter the ledger, or activate a hosted rule.
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {z} from 'zod';
const money=z.string().regex(/^\d{1,15}(?:\.\d{1,3})?$/),day=z.iso.date(),id=z.string().min(1).max(120);
const M=createRequire(import.meta.url)('../../ledger-policy.js');
const protectedActions=['collect','receipt','deposit','settle_debt','view_customer','view_balance','update_document','complaint'] as const;
export const serviceEligibilityInput=z.object({
 action:z.enum([...protectedActions,'new_request','approve_new_request','execute_new_request']),asOf:day,asOfAt:serviceInstant.optional(),
 customerId:id,policy:z.object({version:id,approved:z.boolean(),effectiveFrom:day,effectiveAt:serviceInstant.optional(),reference:z.literal('last_two_actual_due_months'),companyIds:z.array(id).min(1).max(100)}).strict(),
 completeScope:z.boolean(),sourceVersion:id,
 entitlements:z.array(z.object({id,companyId:id,vehicleId:id.nullable(),contractId:id,category:z.enum(['installment','registration_monthly','other']),dueOn:day,amountDue:money,outstanding:money,currency:z.string().length(3),recurrence:z.enum(['monthly','irregular']),confirmed:z.boolean(),disputed:z.boolean(),cancelled:z.boolean()}).strict()).max(20000),
 existingExecution:z.object({requestId:id,createdOn:day,approvedOn:day,startedOn:day,createdAt:serviceInstant.optional(),approvedAt:serviceInstant.optional(),startedAt:serviceInstant.optional(),sourceVerified:z.literal(true)}).strict().optional()
}).strict();
export type ServiceEligibilityInput=z.infer<typeof serviceEligibilityInput>;
export function evaluateServiceEligibility(raw:ServiceEligibilityInput){
 const d=serviceEligibilityInput.parse(raw),fingerprint=createHash('sha256').update(JSON.stringify(d)).digest('hex'),base={customerId:d.customerId,asOf:d.asOf,policyVersion:d.policy.version,sourceVersion:d.sourceVersion,fingerprint,financialEffect:false,activated:false};
 type Details={confirmedOverdue?:string;excludedDisputed?:string;currency?:'AED';referenceMonths?:string[];referenceCommitment?:string};
 const result=(status:'allowed'|'blocked'|'review',reason:string,extra:Details={}):typeof base&Details&{status:'allowed'|'blocked'|'review';reason:string}=>({...base,status,reason,...extra});
 // These are trusted server action identities, never inferred from free-text service titles.
 if((protectedActions as readonly string[]).includes(d.action))return result('allowed','protected_non_service_action');
 const precise=d.policy.effectiveAt!==undefined,activation=precise?Date.parse(d.policy.effectiveAt!):null,at=d.asOfAt?Date.parse(d.asOfAt):null;
 if(precise&&(at===null||serviceDubaiDay(activation!)!==d.policy.effectiveFrom||serviceDubaiDay(at)!==d.asOf))return result('review','precise_policy_clock_review_required');
 if(!d.policy.approved||(precise?at!<activation!:d.asOf<d.policy.effectiveFrom))return result('review','policy_not_effective');
 if(precise&&d.action==='execute_new_request'&&d.existingExecution){const e=d.existingExecution;if(!e.createdAt||!e.approvedAt||!e.startedAt)return result('review','precise_original_execution_time_required');const created=Date.parse(e.createdAt),approved=Date.parse(e.approvedAt),started=Date.parse(e.startedAt);if(serviceDubaiDay(created)!==e.createdOn||serviceDubaiDay(approved)!==e.approvedOn||serviceDubaiDay(started)!==e.startedOn||created>approved||approved>started||started>at!)return result('review','original_execution_time_inconsistent');if(started<activation!)return result('allowed','previously_started_service_not_retroactive');}
 if(!precise&&d.action==='execute_new_request'&&d.existingExecution&&d.existingExecution.startedOn<d.policy.effectiveFrom&&d.existingExecution.approvedOn<d.policy.effectiveFrom&&d.existingExecution.createdOn<=d.existingExecution.approvedOn&&d.existingExecution.approvedOn<=d.existingExecution.startedOn)return result('allowed','previously_started_service_not_retroactive');
 if(!d.completeScope)return result('review','incomplete_original_company_scope');
 const scope=new Set(d.policy.companyIds),seen=new Set<string>();
 if(d.entitlements.some(r=>seen.has(r.id)||!seen.add(r.id)||!scope.has(r.companyId)||M.units(r.outstanding)>M.units(r.amountDue)))return result('review','original_source_inconsistent');
 const relevant=d.entitlements.filter(r=>!r.cancelled&&['installment','registration_monthly'].includes(r.category)&&r.dueOn<=d.asOf);
 if(relevant.some(r=>r.currency!=='AED'||!r.confirmed))return result('review','unverified_due_source');
 const undisputed=relevant.filter(r=>!r.disputed),overdue=undisputed.filter(r=>r.dueOn<d.asOf),outstanding=overdue.reduce((n,r)=>n+M.units(r.outstanding),0n);
 const excludedDisputed= relevant.filter(r=>r.disputed&&r.dueOn<d.asOf).reduce((n,r)=>n+M.units(r.outstanding),0n),detail={confirmedOverdue:M.money(outstanding),excludedDisputed:M.money(excludedDisputed),currency:'AED' as const};
 if(outstanding===0n)return result('allowed','no_confirmed_periodic_arrears',detail);
 if(undisputed.some(r=>r.recurrence!=='monthly'&&M.units(r.outstanding)>0n))return result('review','nonperiodic_reference_requires_review',detail);
 const months=[...new Set(undisputed.filter(r=>r.recurrence==='monthly'&&M.units(r.amountDue)>0n).map(r=>r.dueOn.slice(0,7)))].sort().slice(-2);
 if(months.length!==2)return result('review','two_verified_due_months_required',detail);
 // Gaps are not silently treated as two consecutive monthly commitments.
 const ordinal=(m:string)=>Number(m.slice(0,4))*12+Number(m.slice(5,7));
 if(ordinal(months[1])-ordinal(months[0])!==1)return result('review','missing_reference_month',detail);
 const reference=undisputed.filter(r=>r.recurrence==='monthly'&&months.includes(r.dueOn.slice(0,7))).reduce((n,r)=>n+M.units(r.amountDue),0n);
 if(reference<=0n)return result('review','positive_reference_required',detail);
 return result(outstanding>=reference?'blocked':'allowed',outstanding>=reference?'two_due_months_reached':'below_two_due_months',{...detail,referenceMonths:months,referenceCommitment:M.money(reference)});
}
