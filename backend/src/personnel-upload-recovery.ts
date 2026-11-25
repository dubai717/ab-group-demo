// Recovery for this exact validated personnel upload only. Never overwrites or deletes objects.
import type{ObjectStore}from'./core.js';import{retainEncryptedUpload,retainedUploadIdentity}from'./retained-encrypted-upload.js';
export type RecoverablePersonnelObjects=ObjectStore&{getIfPresent?:(key:string)=>Promise<Buffer|null>};
export function personnelUploadIdentity(input:{tenant:string;actor:string;owner:string;kind:string;parent:string|null;sha256:string;requestKey:string}){
 return retainedUploadIdentity(['AB-PERSONNEL-UPLOAD-1',input.tenant,input.actor,input.owner,input.kind,input.parent,input.sha256,input.requestKey.toLowerCase()]);
}
export {verifiedEncryptedUpload as verifiedPersonnelUpload} from './retained-encrypted-upload.js';
export const retainPersonnelUpload=(objects:RecoverablePersonnelObjects,cipher:any,path:string,bytes:Buffer)=>retainEncryptedUpload(objects,cipher,path,bytes,'personnelUploadOutcomeReviewRequired');
