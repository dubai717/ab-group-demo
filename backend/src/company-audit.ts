// Versioned encrypted metadata in the existing immutable audit record. Legacy field names stay intact.
// No schema/grant change; old records without an envelope remain readable.
import type {Cipher} from './data.js';
const prefix='ab-company-change:v1:';
const retained=new Set(['status','arabicName','englishName','shortName','legalType','emirate','emirateId','areaId','region','issuingEmirate','licenseStatus','issueDate','expiryDate','establishmentDate','establishmentCardExpiryDate','labourCardExpiryDate']);
export function companyAuditFields(cipher:Cipher,fields:string[],before:any,after:any){
 const changes=Object.fromEntries(fields.map(key=>[key,retained.has(key)?{before:before?.[key]??null,after:after[key]??null}:{redacted:true}]));
 const operation=!before?'created':before.status!==after.status?(after.status==='Active'?'activated':after.status==='Inactive'?'deactivated':'status_changed'):'updated';
 return [...fields,prefix+cipher.seal({version:1,operation,changes})];
}
export function companyAuditView(cipher:Cipher,row:any,allowDetails:boolean){
 const fields=(row.fields||[]).filter((f:string)=>!f.startsWith(prefix));
 const envelope=(row.fields||[]).find((f:string)=>f.startsWith(prefix));let changes;
 if(allowDetails&&row.entity_type==='company'&&envelope){try{const parsed=cipher.open(envelope.slice(prefix.length));if(parsed.version===1&&parsed.changes&&typeof parsed.operation==='string')changes=parsed;}catch{/* Legacy/unreadable details never fail the main audit trail. */}}
 return {...row,fields,...(changes?{companyChange:changes}:{})};
}
