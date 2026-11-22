import {importWorkbook} from './import-files.js';
export const invoiceImportFields=[
 {key:'sourceKey',ar:'مرجع العملية الأصلي الفريد',en:'Unique original transaction reference',type:'text',required:true,example:'SYN-EXAMPLE-ONLY'},
 {key:'customerNumber',ar:'رقم ملف العميل',en:'Customer file number',type:'text',required:true},
 {key:'vehicleNumber',ar:'رقم ملف المركبة',en:'Vehicle file number',type:'text',required:false},
 {key:'plate',ar:'رقم اللوحة',en:'Plate',type:'text',required:false},
 {key:'itemCode',ar:'رمز البند المعتمد',en:'Approved item code',type:'text',required:true},
 {key:'amount',ar:'المبلغ',en:'Amount',type:'decimal',required:true},
 {key:'currency',ar:'العملة',en:'Currency',type:'text',required:true,allowed:['AED'],example:'AED'},
 {key:'dueOn',ar:'تاريخ الاستحقاق',en:'Due date',type:'date YYYY-MM-DD',required:true},
 {key:'occurredOn',ar:'تاريخ المخالفة الأصلية — مطلوب للمخالفات',en:'Original violation date — required for traffic fines',type:'date YYYY-MM-DD',required:false}
];
export function invoiceImportTemplate(format:'csv'|'xlsx',monthlySalik=false){
 const fields=monthlySalik?[...invoiceImportFields.filter(f=>!['plate','occurredOn'].includes(f.key)).map(f=>({...f,required:true})),{key:'occurredOn',ar:'تاريخ عملية سالك الأصلية',en:'Original toll transaction date',type:'date YYYY-MM-DD',required:true}]:invoiceImportFields;
 const bytes=format==='xlsx'?importWorkbook(fields):Buffer.from('\uFEFF'+fields.map(r=>r.key).join(',')+'\r\n');
 return{filename:(monthlySalik?'monthly-salik-template.':'invoice-import-template.')+format,mime:format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8',base64:bytes.toString('base64'),fields,
  financialEffect:false,previewRequired:true,instructionsAr:monthlySalik?'ورقة البيانات فارغة. أدخل تاريخ ومرجع كل عملية، وراجع مسؤولية العميل والشركة. ينتج التجميع فاتورة واحدة لكل مركبة وشهر؛ العمليات اللاحقة تحتاج معالجة معتمدة.':'ورقة البيانات فارغة. استخدم المراجع الأصلية وراجع مطابقة الشركة والمركبة والعميل قبل الاعتماد. القالب لا ينفذ تجميع سالك الشهري.',instructionsEn:monthlySalik?'Empty data sheet. Supply each transaction date/reference and review customer/company responsibility. One invoice per vehicle/month; later transactions require approved correction.':'The data sheet is empty. Use original references and review company, vehicle and customer matching before commit. This template does not implement monthly Salik aggregation.'};
}
