import {receiptImageText} from './receipt-ocr.js';
// Extract only explicitly labelled facts. Uncertain/image-only evidence is sent to manual review.
import {requireOk,sha} from './core.js';
import {documentRight} from './document-access.js';
import {extractDocumentText} from './document-text.js';
import {evidence,L} from './ledger-domain.js';
export function depositTextFacts(text:string){
 const normalize=(s:string)=>s.normalize('NFKC').replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/\u066b/g,'.').replace(/\u066c/g,',');
 const s=normalize(text),unique=(a:string[])=>[...new Set(a)];
 const amounts=unique([...s.matchAll(/(?:AED|Amount|المبلغ)\s*[:：]?\s*([\d][\d,. ]*)/gi)].map(x=>x[1].trim()).filter(x=>/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/.test(x)).map(x=>x.replaceAll(',','')).filter(x=>/^\d{1,15}(\.\d{1,3})?$/.test(x))),accounts=unique(s.toUpperCase().match(/AE\d{21}\b/g)||[]),dates=unique(s.match(/\b20\d{2}-\d{2}-\d{2}\b/g)||[]),references=unique([...s.matchAll(/(?:Reference|Transaction(?:\s*(?:No|Number|ID))?|رقم العملية|المرجع)\s*[:：#]?\s*([A-Z0-9][A-Z0-9/-]{2,100})/gi)].map(x=>x[1]));
 const banks=unique([...s.matchAll(/(?:Bank|البنك)\s*[:：]\s*([^\n\r]{2,100}?)(?=\s+(?:Account|IBAN|Amount|Date|Reference|الحساب|المبلغ|التاريخ)|$)/gi)].map(x=>x[1].trim()));
 return{bank:banks.length===1?banks[0]:null,amount:amounts.length===1?amounts[0]:null,account:accounts.length===1?accounts[0]:null,date:dates.length===1?dates[0]:null,reference:references.length===1?references[0]:null,ambiguous:amounts.length>1||accounts.length>1||dates.length>1||references.length>1};
}
export async function reviewDepositReceipt(c:any,m:any,cipher:any,objects:any,d:any){
 const b=m.bank.list().find((x:any)=>x.id===d.bankAccountId&&x.companyId===d.companyId);requireOk(b,403,'denied');await evidence(c,m,d.companyId,d.documentVersionId);
 const r=(await c.query('select d.*,v.storage_key,v.sha256,v.mime from ab.document_versions v join ab.documents d on d.id=v.document_id where v.id=$1',[d.documentVersionId])).rows[0];documentRight(m,r,false);
 requireOk(!r.bank_account_id||r.bank_account_id===d.bankAccountId,422,'receiptAccountMismatch');
 if(!objects||!['application/pdf','image/png','image/jpeg'].includes(r.mime))return{status:'manualRequired',imageOcrAvailable:true,facts:null,differences:[],missing:['bank','amount','account','date','reference'],bankVerified:false};
 const encrypted=await objects.get(r.storage_key),bytes=Buffer.from(cipher.open(encrypted.toString()).bytes,'base64');requireOk(sha(bytes)===r.sha256,502,'integrityFailed');
 const extracted=r.mime==='application/pdf'?await extractDocumentText(bytes,r.mime):await receiptImageText(bytes,r.mime);if(r.mime!=='application/pdf'&&extracted.status!=='indexed')return{status:extracted.status,imageOcrAvailable:true,confidence:extracted.confidence??null,facts:null,differences:[],missing:['bank','amount','account','date','reference'],bankVerified:false};if(extracted.status!=='indexed'&&extracted.status!=='ready'&&!extracted.text)return{status:'manualRequired',imageOcrAvailable:true,facts:null,differences:[],missing:['bank','amount','account','date','reference'],bankVerified:false};
 const facts=depositTextFacts(extracted.text),differences=[];if(facts.amount&&L.units(facts.amount)!==L.units(d.amount))differences.push('amount');const canonicalBank=m.state.bankAccounts.find((x:any)=>x.id===b.id)||b;if(facts.account&&facts.account!==String(canonicalBank.iban||'').replace(/\s/g,'').toUpperCase())differences.push('account');if(facts.date&&facts.date!==d.effectiveOn)differences.push('date');if(facts.reference&&facts.reference.toUpperCase()!==d.reference.toUpperCase())differences.push('reference');
 return{extraction:r.mime==='application/pdf'?'pdfText':'localImageOcr',confidence:'confidence'in extracted?extracted.confidence:null,status:differences.length?'differences':facts.ambiguous?'ambiguous':'reviewRequired',imageOcrAvailable:true,facts:{...facts,account:facts.account?'…'+facts.account.slice(-4):null},differences,missing:Object.entries(facts).filter(([k,v])=>k!=='ambiguous'&&v===null).map(([k])=>k),bankVerified:false};
}
