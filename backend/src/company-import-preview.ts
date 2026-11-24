import {z} from 'zod';
import {ApiError,requireOk,sha} from './core.js';
import {loadAreas,prepareNewCompany} from './data.js';
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
// Preview only: use the original company policy, not a second company writer or import store.
export function registerCompanyImportPreview(app:any,call:any){
 const need=(m:any)=>requireOk(m.actor?.roleId==='owner'&&m.actor?.status==='Active'&&m.company.canRead()&&m.company.canCreate(),403,'denied');
 app.get('/api/data-imports/companies/template',call(async(_c:any,m:any,_s:any,req:any)=>{
  need(m);const q=z.object({source:z.enum(['csv','xlsx']).default('xlsx')}).strict().parse(req.query);
  return {name:'companies-template.'+q.source,mime:q.source==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',base64:(q.source==='csv'?delimitedImportTemplate(fields):importWorkbook(fields)).toString('base64'),fields,previewOnly:true,canApply:false};
 }));
 app.post('/api/data-imports/companies/preview',call(async(c:any,m:any,_s:any,req:any)=>{
  need(m);const context=(await c.query("select current_setting('transaction_isolation')isolation,current_setting('transaction_read_only')read_only")).rows[0];requireOk(context.isolation==='repeatable read'&&context.read_only==='on',409,'companyPreviewSnapshotRequired');const d=z.object({format:z.enum(['csv','xlsx']),base64:z.string().min(4).max(10666668)}).strict().parse(req.body),bytes=importBytes(d.base64);
  const rows=d.format==='csv'?delimitedImportRows(bytes):await customerSpreadsheet(bytes,null);
  requireOk(rows.length>0&&rows.length<=200,422,'companyPreviewRowLimit');
  const known=new Set(fields.map(f=>f.key)),unknownColumns=[...new Set(rows.flatMap((r:any)=>Object.keys(r).filter(k=>!known.has(k))))];
  requireOk(!unknownColumns.length,422,'importUnknownColumns');
  m.state.areas=await loadAreas(c);const seen=new Set<string>(),plan:any[]=[];
  for(let i=0;i<rows.length;i++){
   const source=rows[i];
   try{
    const prepared=prepareNewCompany(m,source);
    // Licence alone is not a global unique identity. Flag possible matches for review, never merge.
    const identity=JSON.stringify(fields.map(f=>norm(source[f.key]))),sameSource=seen.has(identity);seen.add(identity);
    const matches=m.state.companies.filter((co:any)=>(norm(co.tradeLicenseNumber)&&norm(co.tradeLicenseNumber)===norm(prepared.tradeLicenseNumber))||(norm(co.arabicName)&&norm(co.arabicName)===norm(prepared.arabicName))||(norm(co.englishName)&&norm(co.englishName)===norm(prepared.englishName)));
    plan.push({row:i+2,source,state:sameSource?'duplicateSource':matches.length?'needsReview':'valid',matches:matches.map((co:any)=>({id:co.id,arabicName:co.arabicName,englishName:co.englishName,tradeLicenseNumber:co.tradeLicenseNumber,issuingAuthority:co.issuingAuthority||''}))});
   }catch(e:any){plan.push({row:i+2,source,state:'invalid',code:e instanceof ApiError?e.code:'invalidRow',fieldErrors:e instanceof ApiError?(e as any).fieldErrors||{}:{}});}
  }
  return {snapshot:{isolation:context.isolation,readOnly:true},previewOnly:true,canApply:false,sourceHash:sha(bytes),fields,plan,counts:{total:plan.length,valid:plan.filter(r=>r.state==='valid').length,review:plan.filter(r=>r.state==='needsReview').length,duplicates:plan.filter(r=>r.state==='duplicateSource').length,invalid:plan.filter(r=>r.state==='invalid').length},reason:'companyImportApplyNotAvailable'};
 }));
}
