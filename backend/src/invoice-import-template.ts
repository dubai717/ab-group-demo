import {importWorkbook} from './import-files.js';
export const invoiceImportFields=[
 {key:'sourceKey',ar:'مرجع العملية الأصلي الفريد',en:'Unique original transaction reference',type:'text',required:true,example:'SYN-EXAMPLE-ONLY'},
 {key:'customerNumber',ar:'رقم ملف العميل',en:'Customer file number',type:'text',required:true},
 {key:'vehicleNumber',ar:'رقم ملف المركبة',en:'Vehicle file number',type:'text',required:false},
 {key:'plate',ar:'رقم اللوحة',en:'Plate',type:'text',required:false},
 {key:'itemCode',ar:'رمز البند المعتمد',en:'Approved item code',type:'text',required:true},
 {key:'amount',ar:'المبلغ',en:'Amount',type:'decimal',required:true},
 {key:'currency',ar:'العملة',en:'Currency',type:'text',required:true,allowed:['AED'],example:'AED'},
 {key:'dueOn',ar:'تاريخ الاستحقاق',en:'Due date',type:'date YYYY-MM-DD',required:true}
];
export function invoiceImportTemplate(format:'csv'|'xlsx'){
 const bytes=format==='xlsx'?importWorkbook(invoiceImportFields):Buffer.from('\uFEFF'+invoiceImportFields.map(r=>r.key).join(',')+'\r\n');
 return{filename:'invoice-import-template.'+format,mime:format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv;charset=utf-8',base64:bytes.toString('base64'),fields:invoiceImportFields,
  financialEffect:false,previewRequired:true,instructionsAr:'ورقة البيانات فارغة. استخدم المراجع الأصلية وراجع مطابقة الشركة والمركبة والعميل قبل الاعتماد. القالب لا ينفذ تجميع سالك الشهري.',instructionsEn:'The data sheet is empty. Use original references and review company, vehicle and customer matching before commit. This template does not implement monthly Salik aggregation.'};
}
