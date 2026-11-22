// Personal issuer payment is the original independently verified bank proof, never a company reimbursement.
import {z} from 'zod';
import {requireOk,sha} from './core.js';
import {L,need,evidence} from './ledger-domain.js';
import {personalCardOwnership,assertPersonalCardOperator} from './personal-owner-card.js';
import {today} from './vehicle-domain.js';
export const issuerPaymentReference=z.string().trim().min(1).max(2000);
const sourcePrefix='owner-card-bank-payment-v1:';
export async function issuerPaymentReady(c:any){
 const f=(await c.query("select to_regprocedure('ab.card_issuer_payment_schema_version()')::text name")).rows[0]?.name;
 return !!f&&(await c.query('select ab.card_issuer_payment_schema_version() version')).rows[0]?.version==='CARD-ISSUER-PAYMENT-MATCH-REVIEW-1';
}
export async function assertIssuerPaymentNotMatched(c:any,key:string){
 requireOk(!(await c.query("select 1 from ab.finance_card_matches x where to_jsonb(x)->>'issuer_payment_source_key'=$1 limit 1",[key])).rowCount,409,'issuerPaymentAlreadyReconciled');
}
export async function verifiedIssuerPayment(c:any,cipher:any,m:any,st:any,referenceOrKey:string,byKey=false){
 requireOk(await issuerPaymentReady(c),409,'issuerPaymentSchemaReviewRequired');
 await assertPersonalCardOperator(c,cipher,m,st.card_id);const owner=await personalCardOwnership(c,cipher,st.card_id);requireOk(owner&&owner.ownerId===m.actor.id,403,'personalCardOwnerReviewRequired');
 need(m,'reconcile',st.company_id);
 const key=byKey?referenceOrKey:sourcePrefix+owner.ownerId+':'+sha(issuerPaymentReference.parse(referenceOrKey).toUpperCase());
 requireOk(key.startsWith(sourcePrefix+owner.ownerId+':')&&/:[a-f0-9]{64}$/.test(key),422,'invalidReference');
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[key]);
 const row=(await c.query('select value from ab.settings where key=$1',[key])).rows[0],p=row?cipher.open(row.value.cipher):null;
 requireOk(p&&p.cardId===st.card_id&&p.ownerId===owner.ownerId&&p.paidOn<=today()&&L.units(p.paymentAmount)>0n&&key===sourcePrefix+owner.ownerId+':'+sha(p.reference.trim().toUpperCase()),409,'ownerCardPaymentProofRequired');
 requireOk(Array.isArray(p.allocations)&&p.allocations.length>0&&p.allocations.length<=100,409,'ownerCardPaymentProofRequired');
 // Bounded exact source reads, including retained released allocations: releasing a reimbursement does not undo a real bank payment.
 const keys=[...new Set(p.allocations.map((a:any)=>'owner-card-settlement-v1:records:'+a.companyId+':'+a.settlementId))];
 const records=(await c.query('select value from ab.settings where key=any($1::text[])',[keys])).rows.map((r:any)=>cipher.open(r.value.cipher));
 let verified=false;
 for(const r of records){const proof=r.cardRepayment;if(!proof?.verified||!proof.bankPaymentVerified||proof.sourceKey!==key||r.cardId!==p.cardId||r.ownerId!==p.ownerId||proof.paidOn!==p.paidOn||L.units(proof.paymentAmount)!==L.units(p.paymentAmount)||proof.verifiedBy===p.ownerId||proof.verifiedBy===proof.submittedBy)continue;
  need(m,'reconcile',r.companyId);await evidence(c,m,r.companyId,proof.documentVersionId);await evidence(c,m,r.companyId,proof.verificationDocumentVersionId);
  const doc=(await c.query('select sha256 from ab.document_versions where id=$1',[proof.documentVersionId])).rows[0];
  requireOk(doc?.sha256===p.proofHash,409,'ownerCardPaymentSourceConflict');verified=true;break;
 }
 requireOk(verified,409,'ownerCardPaymentProofRequired');
 return{sourceKey:key,cardId:p.cardId,ownerId:p.ownerId,reference:p.reference,paidOn:p.paidOn,amount:L.money(-L.units(p.paymentAmount)),paymentAmount:L.money(L.units(p.paymentAmount)),proofHash:p.proofHash,financialEffect:false};
}
export function registerIssuerPaymentReview(app:any,route:any,cipher:any){
 app.get('/api/ledger/card-statements/:id/issuer-payment-review',route(async(c:any,m:any,s:any,req:any)=>{
  const q=z.object({reference:issuerPaymentReference}).strict().parse(req.query),st=(await c.query('select * from ab.finance_statements where id=$1',[z.uuid().parse(req.params.id)])).rows[0];requireOk(st?.card_id&&st.status==='Review',409,'invalidTransition');
  const source=await verifiedIssuerPayment(c,cipher,m,st,q.reference),matched=(await c.query("select line_id,statement_id from ab.finance_card_matches x where to_jsonb(x)->>'issuer_payment_source_key'=$1",[source.sourceKey])).rows[0];
  return{reference:source.reference,paidOn:source.paidOn,amount:source.amount,alreadyMatched:!!matched,sameStatement:matched?.statement_id===st.id,financialEffect:false};
 }));
}
