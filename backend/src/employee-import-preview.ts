import {z} from 'zod';
import {requireOk,ApiError,sha} from './core.js';
import {importBytes,delimitedImportRows,delimitedImportTemplate} from './import-delimited.js';
import {customerSpreadsheet} from './customer-spreadsheet.js';
import {importWorkbook} from './import-files.js';
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
// No salary, identity, Auth linkage, permission assignment, employee number or EOS write is permitted.
export function registerEmployeeImportPreview(app:any,call:any,cipher:any,schema:any,checkLinks:any){
 const need=(m:any)=>requireOk(m.actor?.roleId==='owner'&&m.actor?.status==='Active',403,'denied');
 app.get('/api/data-imports/employees/template',call(async(_c:any,m:any,_s:any,req:any)=>{
  need(m);const q=z.object({source:z.enum(['csv','xlsx']).default('xlsx')}).strict().parse(req.query);
  return{name:'employees-template.'+q.source,mime:q.source==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:(q.source==='csv'?delimitedImportTemplate(fields):importWorkbook(fields)).toString('base64'),fields,previewOnly:true,canApply:false};
 }));
 app.post('/api/data-imports/employees/preview',call(async(c:any,m:any,_s:any,req:any)=>{
  need(m);const context=(await c.query("select current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only")).rows[0];requireOk(context.isolation==='repeatable read'&&context.read_only==='on',409,'employeePreviewSnapshotRequired');
  const d=z.object({format:z.enum(['csv','xlsx']),base64:z.string().min(4).max(10666668)}).strict().parse(req.body),bytes=importBytes(d.base64),rows=d.format==='csv'?delimitedImportRows(bytes):await customerSpreadsheet(bytes,null);
  requireOk(rows.length>0&&rows.length<=200,422,'employeePreviewRowLimit');const allowed=new Set(fields.map(f=>f.key));requireOk(!rows.some((r:any)=>Object.keys(r).some(k=>!allowed.has(k))),422,'importUnknownColumns');
  const existing=(await c.query('select id,employee_number,payload_cipher from ab.hr_employees order by employee_number')).rows.map((e:any)=>({id:e.id,number:String(e.employee_number),data:cipher.open(e.payload_cipher)})),seen:any[]=[],plan:any[]=[];
  const similar=(a:any,b:any)=>['nameAr','nameEn','phone','email'].some(k=>norm(a[k])&&norm(a[k])===norm(b[k]));
  for(let i=0;i<rows.length;i++){
   const source=rows[i];try{
    const parsed=schema.safeParse(source);if(!parsed.success){const fieldErrors=Object.fromEntries(parsed.error.issues.map((e:any)=>[String(e.path[0]||'row'),'invalid']));plan.push({row:i+2,source,state:'invalid',code:'invalidRow',fieldErrors});continue;}
    const value=parsed.data;await checkLinks(c,m,value);
    const matches=existing.filter((e:any)=>similar(e.data,value)),sourceRows=seen.filter(e=>similar(e.data,value)).map(e=>e.row);seen.push({row:i+2,data:value});
    plan.push({row:i+2,source,state:matches.length||sourceRows.length?'needsReview':'valid',sourceRows,matches:matches.map((e:any)=>({id:e.id,number:e.number}))});
   }catch(e:any){if(!(e instanceof ApiError))throw e;plan.push({row:i+2,source,state:'invalid',code:e.code,fieldErrors:(e as any).fieldErrors||{}});}
  }
  return{previewOnly:true,canApply:false,reason:'employeeImportApplyNotImplemented',snapshot:{isolation:context.isolation,readOnly:true},sourceHash:sha(bytes),fields,plan,counts:{total:plan.length,valid:plan.filter(r=>r.state==='valid').length,review:plan.filter(r=>r.state==='needsReview').length,invalid:plan.filter(r=>r.state==='invalid').length}};
 }));
}
