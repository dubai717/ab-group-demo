// Uses the original immutable audit stream; the reason is encrypted at rest.
const prefix='permission-reset-reason-v1:';
export function resetReasonField(cipher:any,reason:string){return prefix+cipher.seal({kind:'permission-standard-reset-reason',reason});}
export function permissionResetAuditView(cipher:any,row:any,owner:boolean){
 if(row.action!=='owner_permission_standard_reset')return row;
 return {...row,fields:(row.fields||[]).flatMap((field:string)=>{
  if(!field.startsWith(prefix))return[field];
  if(!owner)return[];
  let payload;try{payload=cipher.open(field.slice(prefix.length));}catch{return['reason:unavailable-encrypted-record'];}
  if(payload.kind!=='permission-standard-reset-reason'||typeof payload.reason!=='string')return['reason:unavailable-encrypted-record'];
  return['reason:'+payload.reason];
 })};
}
