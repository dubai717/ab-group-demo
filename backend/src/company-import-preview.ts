import {z} from 'zod';
import {ApiError,requireOk,sha} from './core.js';
import {loadAreas,prepareNewCompany,persistCompany,audit} from './data.js';
import {importBytes,delimitedImportRows,delimitedImportTemplate} from './import-delimited.js';
import {customerSpreadsheet} from './customer-spreadsheet.js';
import {importWorkbook} from './import-files.js';
const fields=[
 {key:'arabicName',ar:'اسم الشركة بالعربية',en:'Arabic company name',required:true},
 {key:'englishName',ar:'اسم الشركة بالإنجليزية',en:'English company name',required:true},
 {key:'tradeLicenseNumber',ar:'رقم الرخصة',en:'Trade licence number',required:true},
 {key:'issuingAuthority',ar:'جهة إصدار الرخصة',en:'Issuing authority'},
 {key:'issueDate',ar:'تاريخ الإصدار',en:'Issue date'},
 {key:'expiryDate',ar:'تاريخ الانتهاء',en:'Expiry date'},
 {key:'emirate',ar:'الإمارة',en:'Emirate'},
 {key:'areaId',ar:'المنطقة المسجلة',en:'Recorded area'},
 {key:'phone',ar:'الهاتف',en:'Phone'},
 {key:'email',ar:'البريد الإلكتروني',en:'Email'},
 {key:'notes',ar:'ملاحظات',en:'Notes'},
];
const norm=(v:any)=>String(v||'').normalize('NFKC').trim().toLocaleLowerCase();
// The original company writer and request receipt remain the only persistence paths.
export function assertCompanyImportOperator(m:any){requireOk(m.actor?.roleId==='owner'&&m.actor?.status==='Active'&&m.company.canRead()&&m.company.canCreate(),403,'denied');}
const sourceInput=z.object({format:z.enum(['csv','xlsx']),base64:z.string().min(4).max(10666668)}).strict();
const similar=(a:any,b:any)=>['tradeLicenseNumber','arabicName','englishName'].some(key=>norm(a[key])&&norm(a[key])===norm(b[key]));
async function companyFileReview(c:any,m:any,d:any,cipher:any,applyEnabled:boolean){
 const bytes=importBytes(d.base64),rows=d.format==='csv'?delimitedImportRows(bytes):await customerSpreadsheet(bytes,null);
 requireOk(rows.length>0&&rows.length<=200,422,'companyPreviewRowLimit');
 const known=new Set(fields.map(f=>f.key));requireOk(!rows.some((r:any)=>Object.keys(r).some(k=>!known.has(k))),422,'importUnknownColumns');
 m.state.areas=await loadAreas(c);const seen=new Set<string>(),preparedSources:any[]=[],plan:any[]=[];
 for(let i=0;i<rows.length;i++){
  const source=rows[i];try{
   const prepared=prepareNewCompany(m,source),identity=JSON.stringify(fields.map(f=>norm(source[f.key]))),sameSource=seen.has(identity);seen.add(identity);
   const matches=m.state.companies.filter((co:any)=>similar(co,prepared)),sourceRows=preparedSources.filter(p=>similar(p.prepared,prepared)).map(p=>p.row);preparedSources.push({row:i+2,prepared});
   plan.push({row:i+2,source,state:sameSource?'duplicateSource':matches.length||sourceRows.length?'needsReview':'valid',sourceRows,matches:matches.map((co:any)=>({id:co.id,arabicName:co.arabicName,englishName:co.englishName,tradeLicenseNumber:co.tradeLicenseNumber,issuingAuthority:co.issuingAuthority||''}))});
  }catch(e:any){plan.push({row:i+2,source,state:'invalid',code:e instanceof ApiError?e.code:'invalidRow',fieldErrors:e instanceof ApiError?(e as any).fieldErrors||{}:{}});}
 }
 const sourceHash=sha(bytes),counts={total:plan.length,valid:plan.filter(r=>r.state==='valid').length,review:plan.filter(r=>r.state==='needsReview').length,duplicates:plan.filter(r=>r.state==='duplicateSource').length,invalid:plan.filter(r=>r.state==='invalid').length};
 const facts=m.state.companies.map((co:any)=>Object.fromEntries(['id','revision','status','arabicName','englishName','tradeLicenseNumber','issuingAuthority','emirate','areaId'].map(key=>[key,co[key]??null]))).sort((a:any,b:any)=>a.id.localeCompare(b.id));
 const tenant=(await c.query('select ab.tenant()tenant_id')).rows[0].tenant_id,token=cipher.digest(JSON.stringify({tenant,actor:m.actor.id,sourceHash,facts,plan}));
 return{previewOnly:true,applyEnabled,canApply:applyEnabled&&counts.valid>0&&counts.valid<=25&&counts.valid===counts.total,canApplySkipping:applyEnabled&&counts.valid>0&&counts.valid<=25,sourceHash,token,fields,plan,counts,batchLimit:25,reason:!applyEnabled?'companyImportApplyNotEnabled':counts.valid>25?'companyImportBatchLimit':counts.valid!==counts.total?'companyImportReviewRequired':null};
}
export function registerCompanyImportPreview(app:any,call:any,cipher:any,applyEnabled=false){
 const need=assertCompanyImportOperator;
 app.get('/api/data-imports/companies/template',call(async(_c:any,m:any,_s:any,req:any)=>{
  need(m);const q=z.object({source:z.enum(['csv','xlsx']).default('xlsx')}).strict().parse(req.query);
  return{name:'companies-template.'+q.source,mime:q.source==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:(q.source==='csv'?delimitedImportTemplate(fields):importWorkbook(fields)).toString('base64'),fields,previewOnly:true,canApply:false,applyEnabled};
 }));
 app.post('/api/data-imports/companies/preview',call(async(c:any,m:any,_s:any,req:any)=>{
  need(m);const context=(await c.query("select current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only")).rows[0];requireOk(context.isolation==='repeatable read'&&context.read_only==='on',409,'companyPreviewSnapshotRequired');
  return{snapshot:{isolation:context.isolation,readOnly:true},...await companyFileReview(c,m,sourceInput.parse(req.body),cipher,applyEnabled)};
 }));
 app.post('/api/data-imports/companies/run',call(async(c:any,m:any,s:any,req:any)=>{
  need(m);requireOk(applyEnabled,503,'companyImportApplyNotEnabled');requireOk(typeof req.headers['idempotency-key']==='string',422,'companyImportKeyRequired');
  const d=sourceInput.extend({token:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true),skipRejected:z.boolean().default(false)}).parse(req.body),review=await companyFileReview(c,m,{format:d.format,base64:d.base64},cipher,applyEnabled);
  requireOk(d.token===review.token,409,'companyImportPreviewChanged');requireOk(review.counts.valid>0,422,'companyImportNothingNew');requireOk(review.counts.valid<=25,422,'companyImportBatchLimit');requireOk(d.skipRejected||review.counts.valid===review.counts.total,422,'companyImportReviewRequired');
  const created:any[]=[],skipped=review.plan.filter((p:any)=>p.state!=='valid').map((p:any)=>({row:p.row,reason:p.state}));
  for(const row of review.plan.filter((p:any)=>p.state==='valid')){const id=await persistCompany(c,m,s.tenant_id,row.source);created.push({row:row.row,id,arabicName:row.source.arabicName,englishName:row.source.englishName});}
  await audit(c,s.tenant_id,s.user_id,'company_import_batch','company_import',req.headers['idempotency-key'],['sourceHash','createdRows','skippedRows']);
  return{status:skipped.length?'CompletedWithReviewRows':'Completed',sourceHash:review.sourceHash,created,skipped,financialEffect:false,existingCompaniesUpdated:false};
 }));
}
