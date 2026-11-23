// Exact original renewal source; neither a task assignment nor an unexpired old
// document is evidence of a completed renewal. No file bytes or rights are copied.
import{z}from'zod';
import{today}from'./vehicle-domain.js';
export async function employeeDocumentTaskSource(c:any,cipher:any,t:any){
 const d=cipher.open(t.payload_cipher);if(!z.uuid().safeParse(d.recordId).success||t.source_key!=='document:'+d.recordId||typeof d.documentKind!=='string')return null;
 const r=(await c.query('select r.id,r.employee_id,r.kind,r.expires_on,r.created_at,r.version_id,e.company_id from ab.hr_document_records r join ab.hr_employees e on e.id=r.employee_id join ab.document_versions v on v.id=r.version_id where r.id=$1 and r.employee_id=$2',[d.recordId,t.source_id])).rows[0];return r&&r.company_id===t.company_id&&r.kind===d.documentKind?r:null;
}
export async function employeeDocumentTaskComplete(c:any,cipher:any,t:any){
 const source=await employeeDocumentTaskSource(c,cipher,t);if(!source)return false;
 const archives=!!(await c.query("select to_regclass('ab.document_archive_events') ok")).rows[0].ok;
 // Bounded original metadata only: no ciphertext, attachment bytes, historical
 // file bodies, or repeated full employee-document projection are transferred.
 const current=(await c.query("select r.id,r.created_at,r.expires_on from ab.hr_document_records r join ab.document_versions v on v.id=r.version_id where r.employee_id=$1 and r.kind=$2 and r.state='Approved'and v.scan_status='clean'"+(archives?"and not exists(select 1 from(select action from ab.document_archive_events where document_id=v.document_id order by created_at desc,id desc limit 1)a where action='archive')":'')+" order by r.created_at desc,r.id limit 1",[source.employee_id,source.kind])).rows[0];
 if(!current||current.id===source.id||new Date(current.created_at).getTime()<=new Date(source.created_at).getTime())return false;
 // Compare the approved current version, rather than any historical valid copy.
 if(current.expires_on){const expiry=new Date(current.expires_on).toISOString().slice(0,10);if(expiry<today()||source.expires_on&&expiry<=new Date(source.expires_on).toISOString().slice(0,10))return false;}
 return true;
}
