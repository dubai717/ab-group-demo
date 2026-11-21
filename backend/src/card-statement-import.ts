// Bounded, exact statement import over original card statements. Import never posts money.
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {z} from 'zod';
import {requireOk,sha,ApiError} from './core.js';
import {L,need,evidence,event} from './ledger-domain.js';
import {assertPersonalCardOperator} from './personal-owner-card.js';
import {customerSpreadsheet} from './customer-spreadsheet.js';
import {importWorkbook} from './import-files.js';
const Csv=createRequire(import.meta.url)('../../customer-policy.js'),id=z.uuid(),col=z.string().min(1).max(200),prefix='card-statement-import-v1:';
export const statementMoney=z.string().regex(/^-?\d{1,15}(\.\d{1,3})?$/);
export const cardStatementSchema=z.object({periodFrom:z.iso.date(),periodTo:z.iso.date(),openingBalance:statementMoney,closingBalance:statementMoney,documentVersionId:id,lines:z.array(z.object({date:z.iso.date(),amount:statementMoney.refine(v=>L.units(v)!==0n),reference:z.string().max(200)}).strict()).min(1).max(1000)}).strict();
export const statementMapping=z.object({date:col,reference:col,amount:col.optional(),debit:col.optional(),credit:col.optional(),currency:col.optional(),mode:z.enum(['signed','debit_credit']),dateFormat:z.enum(['ISO','DMY','MDY']),numberFormat:z.enum(['dot_decimal','comma_decimal'])}).strict().superRefine((v,ctx)=>{
 if(v.mode==='signed'?!v.amount||!!v.debit||!!v.credit:!!v.amount||!v.debit||!v.credit)ctx.addIssue({code:'custom',message:'statementMappingRequired'});
 const columns=[v.date,v.reference,v.amount,v.debit,v.credit,v.currency].filter(Boolean);if(new Set(columns).size!==columns.length)ctx.addIssue({code:'custom',message:'duplicateStatementMapping'});
});
const digits=(s:string)=>s.normalize('NFKC').replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776));
export function statementDecimal(raw:string,format:string,signed=true){
 let s=digits(raw).trim().replace(/^AED\s+/i,'').replace(/\s+AED$/i,'');
 if(!s)return 0n;
 let negative=false;if(signed&&/^\(.*\)$/.test(s)){negative=true;s=s.slice(1,-1);}else if(signed&&/^[+-]/.test(s)){negative=s[0]==='-';s=s.slice(1);}
 const pattern=format==='dot_decimal'?/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,3})?$/:/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,3})?$/;
 requireOk(pattern.test(s),422,'invalidStatementAmount');
 const n=format==='dot_decimal'?s.replaceAll(',',''):s.replaceAll('.','').replace(',','.');requireOk(/^\d{1,15}(\.\d{1,3})?$/.test(n),422,'invalidStatementAmount');
 return L.units(n)*(negative?-1n:1n);
}
export function statementDate(raw:string,format:string){
 let s=digits(raw).trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(s)){
  requireOk(format!=='ISO',422,'invalidStatementDate');const v=s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);requireOk(v,422,'invalidStatementDate');
  const d=format==='DMY'?v![1]:v![2],m=format==='DMY'?v![2]:v![1];s=v![3]+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
 }
 requireOk(z.iso.date().safeParse(s).success,422,'invalidStatementDate');return s;
}
export async function statementFileRows(bytes:Buffer,format:string){
 requireOk(bytes.length>0&&bytes.length<=5e6,422,'invalidFile');let rows:any[];
 try{rows=format==='csv'?Csv.csv(new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,''),null,true):await customerSpreadsheet(bytes,null);}catch(e){throw new ApiError(422,'invalidStatementFile');}
 requireOk(rows.length>0&&rows.length<=1000,422,'statementImportLimit');const headers=Object.keys(rows[0]);requireOk(headers.length<=100&&headers.every(h=>h.trim()&&h.length<=200),422,'invalidStatementFile');return{rows,headers};
}
export function canonicalCardStatement(cardId:string,currency:string,d:any){
 const lines=d.lines.map((r:any)=>({date:r.date,amount:L.money(L.units(r.amount)),reference:String(r.reference??'').replace(/^ +| +$/g,'')})).sort((a:any,b:any)=>a.date.localeCompare(b.date)||a.reference.localeCompare(b.reference)||a.amount.localeCompare(b.amount));
 return sha(JSON.stringify({version:1,cardId,currency,periodFrom:d.periodFrom,periodTo:d.periodTo,openingBalance:L.money(L.units(d.openingBalance)),closingBalance:L.money(L.units(d.closingBalance)),lines}));
}
export async function existingCardStatement(c:any,card:any,d:any){
 const candidates=(await c.query('select id,status from ab.finance_statements where card_id=$1 and company_id=$2 and period_from=$3 and period_to=$4 and opening_balance=$5 and closing_balance=$6 order by created_at limit 101',[card.id,card.company_id,d.periodFrom,d.periodTo,d.openingBalance,d.closingBalance])).rows;
 requireOk(candidates.length<=100,422,'statementHistoryReviewRequired');if(!candidates.length)return null;
 // Compare exact multisets inside PostgreSQL; do not download a card's historical line archive.
 const incoming=JSON.stringify(d.lines.map((r:any)=>({date:r.date,amount:L.money(L.units(r.amount)),reference:r.reference})));
 const query=`with incoming as(
  select (v->>'date')::date effective_on,(v->>'amount')::numeric amount,btrim(coalesce(v->>'reference','')) reference,count(*) n
  from jsonb_array_elements($2::jsonb) v group by 1,2,3
 )select s.id,s.status from ab.finance_statements s where s.id=any($1::uuid[]) and
 not exists((select l.effective_on,l.amount,btrim(coalesce(l.reference,'')),count(*) from ab.finance_statement_lines l where l.statement_id=s.id group by 1,2,3)except(select * from incoming)) and
 not exists((select * from incoming)except(select l.effective_on,l.amount,btrim(coalesce(l.reference,'')),count(*) from ab.finance_statement_lines l where l.statement_id=s.id group by 1,2,3))
 order by s.created_at limit 1`;
 return(await c.query(query,[candidates.map((r:any)=>r.id),incoming])).rows[0]||null;
}
export function cardStatementTemplate(format:'csv'|'xlsx'){
 const fields=[{key:'date',ar:'تاريخ العملية YYYY-MM-DD',en:'Transaction date YYYY-MM-DD',type:'date',required:true},{key:'reference',ar:'المرجع الأصلي',en:'Original reference',type:'text',required:true},{key:'debit',ar:'مدفوعات البطاقة',en:'Card charges',type:'decimal',required:false},{key:'credit',ar:'دفعات أو مبالغ دائنة — تحتاج مطابقة مستقلة',en:'Payments or credits — independent matching required',type:'decimal',required:false},{key:'currency',ar:'العملة AED',en:'Currency AED',type:'text',required:true}];
 const bytes=format==='xlsx'?importWorkbook(fields):Buffer.from('\uFEFF'+fields.map(r=>r.key).join(',')+'\r\n');return{filename:'card-statement-template.'+format,mime:format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8',base64:bytes.toString('base64'),fields,financialEffect:false};
}
export function previewStatementRows(raw:any[],mapping:any,header:any){
 const seen=new Set<string>();let duplicateRows=0,net=0n,charges=0n,credits=0n;
 const rows=raw.map((r:any,i:number)=>{try{
  requireOk(!mapping.currency||String(r[mapping.currency]).trim().toUpperCase()==='AED',422,'statementCurrencyMismatch');
  const date=statementDate(String(r[mapping.date]??''),mapping.dateFormat),reference=String(r[mapping.reference]??'').trim();requireOk(reference.length>0&&reference.length<=200&&!/[\x00-\x1f]/.test(reference),422,'invalidStatementReference');
  requireOk(date>=header.periodFrom&&date<=header.periodTo,422,'statementDateOutsidePeriod');let amount:bigint;
  if(mapping.mode==='signed'){requireOk(String(r[mapping.amount]??'').trim(),422,'invalidStatementAmount');amount=statementDecimal(String(r[mapping.amount]),mapping.numberFormat);}else{
   const debit=statementDecimal(String(r[mapping.debit]??''),mapping.numberFormat,false),credit=statementDecimal(String(r[mapping.credit]??''),mapping.numberFormat,false);requireOk(!(debit&&credit),422,'statementBothSides');amount=debit-credit;
  }
  requireOk(amount!==0n,422,'statementZeroRow');const value={date,reference,amount:L.money(amount)},fingerprint=JSON.stringify(value),duplicate=seen.has(fingerprint);if(duplicate)duplicateRows++;seen.add(fingerprint);
  net+=amount;if(amount>0n)charges+=amount;else credits-=amount;return{line:i+2,value,duplicate,suggestion:amount>0n?'card_charge_review':'issuer_credit_review'};
 }catch(e:any){return{line:i+2,error:e instanceof ApiError?e.code:'invalidStatementRow'};}});
 const difference=L.units(header.closingBalance)-L.units(header.openingBalance)-net,valid=rows.every((r:any)=>r.value);
 return{rows,duplicateRows,charges:L.money(charges),credits:L.money(credits),net:L.money(net),difference:L.money(difference),balanced:valid&&difference===0n,financialEffect:false,classificationAutomatic:false};
}
export function registerCardStatementImport(app:any,route:any,cipher:any,createStatement:any){
 async function context(c:any,m:any,key:string){const card=(await c.query('select * from ab.finance_cards where id=$1',[key])).rows[0];requireOk(card?.active,404,'notFound');need(m,'statement_upload',card.company_id);await assertPersonalCardOperator(c,cipher,m,card.id);requireOk(card.currency==='AED',422,'statementCurrencyMismatch');return card;}
 const file=z.object({format:z.enum(['csv','xlsx']),base64:z.string().min(4).max(7000000)}).strict(),header=cardStatementSchema.omit({lines:true});
 const decode=(d:any)=>{const b=Buffer.from(d.base64,'base64');requireOk(b.toString('base64')===d.base64&&b.length<=5e6,422,'invalidFile');return b;};
 app.get('/api/ledger/cards/:id/statement-import/template',route(async(c:any,m:any,s:any,req:any)=>{await context(c,m,id.parse(req.params.id));return cardStatementTemplate(z.enum(['csv','xlsx']).parse(req.query.format||'xlsx'));}));
 app.post('/api/ledger/cards/:id/statement-import/columns',route(async(c:any,m:any,s:any,req:any)=>{await context(c,m,id.parse(req.params.id));const d=file.parse(req.body),parsed=await statementFileRows(decode(d),d.format);return{columns:parsed.headers,rowCount:parsed.rows.length,financialEffect:false};}));
 app.post('/api/ledger/cards/:id/statement-import/preview',route(async(c:any,m:any,s:any,req:any)=>{
  const card=await context(c,m,id.parse(req.params.id)),d=z.object({file,name:z.string().trim().min(1).max(200),header,mapping:statementMapping,currencyReviewedAsAED:z.literal(true)}).strict().parse(req.body);
  requireOk(d.header.periodTo>=d.header.periodFrom,422,'invalidStatementPeriod');await evidence(c,m,card.company_id,d.header.documentVersionId);
  const bytes=decode(d.file),sourceKey=prefix+'source:'+card.id+':'+sha(JSON.stringify({fileHash:sha(bytes),format:d.file.format,header:d.header,mapping:d.mapping,actor:s.user_id}));
  const pointer=(await c.query('select value from ab.settings where key=$1',[sourceKey])).rows[0];
  if(pointer){const record=(await c.query('select value from ab.settings where key=$1',[prefix+cipher.open(pointer.value.cipher).previewId])).rows[0],p=record?cipher.open(record.value.cipher):null;if(p)requireOk(p.cardId===card.id&&p.companyId===card.company_id&&p.createdBy===s.user_id&&p.fileHash===sha(bytes)&&p.format===d.file.format&&JSON.stringify(p.header)===JSON.stringify(d.header)&&JSON.stringify(p.mapping)===JSON.stringify(d.mapping),409,'statementPreviewChanged');if(p&&(p.statementId||new Date(p.expiresAt).getTime()>Date.now()))return{rows:p.rows,duplicateRows:p.duplicateRows,charges:p.charges,credits:p.credits,net:p.net,difference:p.difference,balanced:p.balanced,id:p.id,digest:p.digest,expiresAt:p.expiresAt,currency:'AED',financialEffect:false,classificationAutomatic:false,existing:true};}
  const parsed=await statementFileRows(bytes,d.file.format),columns=[d.mapping.date,d.mapping.reference,d.mapping.amount,d.mapping.debit,d.mapping.credit,d.mapping.currency].filter(Boolean);
  requireOk(columns.every(k=>parsed.headers.includes(k!)),422,'statementMappingRequired');const result=previewStatementRows(parsed.rows,d.mapping,d.header),pid=randomUUID(),payload={id:pid,cardId:card.id,companyId:card.company_id,createdBy:s.user_id,createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+15*60000).toISOString(),name:d.name,format:d.file.format,fileHash:sha(bytes),header:d.header,mapping:d.mapping,...result};
  const digest=sha(JSON.stringify(payload));await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[s.tenant_id,prefix+pid,{cipher:cipher.seal({...payload,digest})}]);
  await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,sourceKey,{cipher:cipher.seal({previewId:pid})}]);
  await event(c,cipher,s,card.company_id,card.id,'card_statement_import_preview',null,{previewId:pid,fileHash:payload.fileHash,rows:result.rows.length,balanced:result.balanced});return{...result,id:pid,digest,expiresAt:payload.expiresAt,currency:'AED'};
 }));
 app.post('/api/ledger/cards/:id/statement-import/confirm',route(async(c:any,m:any,s:any,req:any)=>{
  const card=await context(c,m,id.parse(req.params.id)),d=z.object({previewId:id,digest:z.string().length(64),duplicateRowsReviewed:z.boolean().default(false),confirm:z.literal(true)}).strict().parse(req.body);
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[prefix+d.previewId]);const stored=(await c.query('select value from ab.settings where key=$1',[prefix+d.previewId])).rows[0];requireOk(stored,404,'notFound');const p=cipher.open(stored.value.cipher);
  requireOk(p.id===d.previewId&&p.cardId===card.id&&p.companyId===card.company_id&&p.createdBy===s.user_id&&p.digest===d.digest,409,'statementPreviewChanged');
  if(p.statementId){const existing=(await c.query('select id,status from ab.finance_statements where id=$1 and card_id=$2 and company_id=$3',[p.statementId,card.id,card.company_id])).rows[0];requireOk(existing,409,'statementHistoryReviewRequired');return{...existing,existing:true,financialEffect:false};}
  requireOk(new Date(p.expiresAt).getTime()>Date.now(),409,'statementPreviewExpired');requireOk(p.balanced&&p.rows.every((r:any)=>r.value),422,'statementImportErrors');requireOk(!p.duplicateRows||d.duplicateRowsReviewed,422,'statementDuplicateRowsReviewRequired');
  await evidence(c,m,card.company_id,p.header.documentVersionId);const result=await createStatement(c,m,s,{params:{id:card.id},body:{...p.header,lines:p.rows.map((r:any)=>r.value)}});
  await c.query('update ab.settings set value=$2 where key=$1',[prefix+p.id,{cipher:cipher.seal({...p,statementId:result.id,confirmedBy:s.user_id,confirmedAt:new Date().toISOString()})}]);
  await event(c,cipher,s,card.company_id,result.id,'card_statement_import_confirmed',null,{previewId:p.id,fileHash:p.fileHash,duplicateRowsReviewed:d.duplicateRowsReviewed,financialEffect:false});return{...result,financialEffect:false};
 }));
}
