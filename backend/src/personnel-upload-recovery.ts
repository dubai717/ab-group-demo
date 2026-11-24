// Recovery for this exact validated personnel upload only. Never overwrites or deletes objects.
import{createHash}from'node:crypto';import type{ObjectStore}from'./core.js';import{retainEncryptedUpload}from'./retained-encrypted-upload.js';
export type RecoverablePersonnelObjects=ObjectStore&{getIfPresent?:(key:string)=>Promise<Buffer|null>};
export function personnelUploadIdentity(input:{tenant:string;actor:string;owner:string;kind:string;parent:string|null;sha256:string;requestKey:string}){
 const namespace=JSON.stringify(['AB-PERSONNEL-UPLOAD-1',input.tenant,input.actor,input.owner,input.kind,input.parent,input.sha256,input.requestKey.toLowerCase()]);
 const uuid=(purpose:string)=>{const chars=createHash('sha256').update(namespace+':'+purpose).digest('hex').slice(0,32).split('');chars[12]='8';chars[16]=((parseInt(chars[16],16)&3)|8).toString(16);const h=chars.join('');return[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');};return{documentId:uuid('document'),versionId:uuid('version')};
}
export {verifiedEncryptedUpload as verifiedPersonnelUpload} from './retained-encrypted-upload.js';
export const retainPersonnelUpload=(objects:RecoverablePersonnelObjects,cipher:any,path:string,bytes:Buffer)=>retainEncryptedUpload(objects,cipher,path,bytes,'personnelUploadOutcomeReviewRequired');
