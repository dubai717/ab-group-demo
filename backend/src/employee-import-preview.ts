import {z} from 'zod';
import {requireOk,ApiError,sha} from './core.js';
import {importBytes,delimitedImportRows,delimitedImportTemplate} from './import-delimited.js';
import {customerSpreadsheet} from './customer-spreadsheet.js';
import {importWorkbook} from './import-files.js';
import {ready} from './personnel-domain.js';
import {audit} from './data.js';
const fields=[
 {key:'companyId',ar:'معرف الشركة المسجلة',en:'Recorded company ID',required:true},
 {key:'nameAr',ar:'الاسم بالعربية',en:'Arabic name',required:true},
 {key:'nameEn',ar:'الاسم بالإنجليزية',en:'English name',required:true},
 {key:'jobTitle',ar:'المسمى الوظيفي',en:'Job title',required:true},
 {key:'hiredOn',ar:'تاريخ التعيين',en:'Hire date',required:true},
 {key:'nationality',ar:'الجنسية',en:'Nationality'},
 {key:'phone',ar:'الهاتف الدولي',en:'International phone'},
 {key:'email',ar:'البريد الإلكتروني',en:'Email'},
];
const norm=(v:any)=>String(v||'').normalize('NFKC').trim().toLowerCase();
// Preview uses the ORIGINAL personnel schema and link/phone/scope checker supplied by its controller.
// Preview never writes; explicitly enabled apply delegates employee numbering/EOS to the original writer.
// No Auth account, salary, private identity or permission import is supported.
export function assertEmployeeImportOperator(m:any){requireOk(m.actor?.roleId==='owner'&&m.actor?.status==='Active',403,'denied');}
export function registerEmployeeImportPreview(app:any,call:any,cipher:any,schema:any,checkLinks:any,createEmployee:any,applyEnabled=false){
 const need=assertEmployeeImportOperator;
 app.get('/api/data-imports/employees/template',call(async(_c:any,m:any,_s:any,req:any)=>{
  need(m);const q=z.object({source:z.enum(['csv','xlsx']).default('xlsx')}).strict().parse(req.query);
  return{name:'employees-template.'+q.source,mime:q.source==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:(q.source==='csv'?delimitedImportTemplate(fields):importWorkbook(fields)).toString('base64'),fields,previewOnly:true,canApply:false};
 }));
 async function reviewFile(c:any,m:any,input:any){
  const d=z.object({format:z.enum(['csv','xlsx']),base64:z.string().min(4).max(10666668)}).strict().parse(input),bytes=importBytes(d.base64),rows=d.format==='csv'?delimitedImportRows(bytes):await customerSpreadsheet(bytes,null);
  requireOk(rows.length>0&&rows.length<=200,422,'employeePreviewRowLimit');const allowed=new Set(fields.map(f=>f.key));requireOk(!rows.some((r:any)=>Object.keys(r).some(k=>!allowed.has(k))),422,'importUnknownColumns');
  await ready(c);const existing=(await c.query('select id,employee_number,revision,payload_cipher from ab.hr_employees order by employee_number')).rows.map((e:any)=>({id:e.id,number:String(e.employee_number),revision:e.revision,data:cipher.open(e.payload_cipher)})),seen:any[]=[],plan:any[]=[];
  const similar=(a:any,b:any)=>['nameAr','nameEn','phone','email'].some(k=>norm(a[k])&&norm(a[k])===norm(b[k]));
  for(let i=0;i<rows.length;i++){
   const source=rows[i];try{
    const parsed=schema.safeParse(source);if(!parsed.success){const fieldErrors=Object.fromEntries(parsed.error.issues.map((e:any)=>[String(e.path[0]||'row'),String(source[String(e.path[0])]??'').trim()===''?'required':'invalid']));plan.push({row:i+2,source,state:'invalid',code:'invalidRow',fieldErrors});continue;}
    const value=parsed.data;await checkLinks(c,m,value);
    const matches=existing.filter((e:any)=>similar(e.data,value)),sourceRows=seen.filter(e=>similar(e.data,value)).map(e=>e.row);seen.push({row:i+2,data:value});
    plan.push({row:i+2,source,state:matches.length||sourceRows.length?'needsReview':'valid',sourceRows,matches:matches.map((e:any)=>({id:e.id,number:e.number}))});
   }catch(e:any){if(!(e instanceof ApiError))throw e;plan.push({row:i+2,source,state:'invalid',code:e.code,fieldErrors:(e as any).fieldErrors||({invalidCompany:{companyId:'invalid'},invalidPhone:{phone:'invalid'},phoneCountryRequired:{phone:'required'}} as Record<string,any>)[e.code]||{}});}
  }
  const counts={total:plan.length,valid:plan.filter(r=>r.state==='valid').length,review:plan.filter(r=>r.state==='needsReview').length,invalid:plan.filter(r=>r.state==='invalid').length};
  const tenant=(await c.query('select ab.tenant()tenant')).rows[0].tenant,sourceHash=sha(bytes),facts=m.state.companies.map((co:any)=>({id:co.id,revision:co.revision,status:co.status})).sort((a:any,b:any)=>a.id.localeCompare(b.id));
  const token=cipher.digest(JSON.stringify({tenant,actor:m.actor.id,sourceHash,existing,facts,plan}));
  return{previewOnly:true,applyEnabled,canApply:applyEnabled&&counts.valid>0&&counts.valid<=25&&counts.valid===counts.total,canApplySkipping:applyEnabled&&counts.valid>0&&counts.valid<=25,reason:applyEnabled?null:'employeeImportApplyNotEnabled',sourceHash,token,fields,plan,counts,batchLimit:25};
 }
 app.post('/api/data-imports/employees/preview',call(async(c:any,m:any,_s:any,req:any)=>{need(m);const context=(await c.query("select current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only")).rows[0];requireOk(context.isolation==='repeatable read'&&context.read_only==='on',409,'employeePreviewSnapshotRequired');return{snapshot:{isolation:context.isolation,readOnly:true},...await reviewFile(c,m,req.body)};}));
 app.post('/api/data-imports/employees/run',call(async(c:any,m:any,s:any,req:any)=>{
  need(m);requireOk(applyEnabled,503,'employeeImportApplyNotEnabled');requireOk(typeof req.headers['idempotency-key']==='string',422,'employeeImportKeyRequired');
  const d=z.object({format:z.enum(['csv','xlsx']),base64:z.string().min(4).max(10666668),token:z.string().regex(/^[a-f0-9]{64}$/),confirmed:z.literal(true),skipRejected:z.boolean().default(false)}).strict().parse(req.body),review=await reviewFile(c,m,{format:d.format,base64:d.base64});
  requireOk(d.token===review.token,409,'employeeImportPreviewChanged');requireOk(review.counts.valid>0,422,'employeeImportNothingNew');requireOk(review.counts.valid<=25,422,'employeeImportBatchLimit');requireOk(d.skipRejected||review.counts.valid===review.counts.total,422,'employeeImportReviewRequired');
  const created:any[]=[],skipped=review.plan.filter((r:any)=>r.state!=='valid').map((r:any)=>({row:r.row,reason:r.state}));
  for(const row of review.plan.filter((r:any)=>r.state==='valid'))created.push({row:row.row,...await createEmployee(c,m,s,row.source)});
  await audit(c,s.tenant_id,s.user_id,'employee_import_batch','employee_import',req.headers['idempotency-key'],['sourceHash','createdRows','skippedRows']);
  return{status:skipped.length?'CompletedWithReviewRows':'Completed',sourceHash:review.sourceHash,created,skipped,financialEffect:false,authAccountsCreated:false,existingEmployeesUpdated:false};
 }));
}
