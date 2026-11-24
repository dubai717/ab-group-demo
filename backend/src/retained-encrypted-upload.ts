// Shared recovery for one exact authorized, validated, encrypted file. No overwrite/delete.
import{ApiError,sha}from'./core.js';import type{ObjectStore}from'./core.js';
export type RecoverableEncryptedObjects=ObjectStore&{getIfPresent?:(key:string)=>Promise<Buffer|null>};
export function verifiedEncryptedUpload(cipher:any,encrypted:Buffer,expected:{sha256:string;size:number}){
 try{if(encrypted.length>20*1024*1024)throw Error('size');const data=cipher.open(encrypted.toString());if(typeof data?.bytes!=='string')throw Error('invalid');const bytes=Buffer.from(data.bytes,'base64');if(bytes.length!==expected.size||bytes.toString('base64')!==data.bytes||sha(bytes)!==expected.sha256)throw Error('integrity');return bytes;}
 catch{throw new ApiError(409,'fileIntegrityFailed');}
}
export async function retainEncryptedUpload(objects:RecoverableEncryptedObjects,cipher:any,path:string,bytes:Buffer,reviewCode:string){
 const encrypted=Buffer.from(cipher.seal({bytes:bytes.toString('base64')}));
 try{await objects.put(path,encrypted);return{recovered:false};}catch(error:any){
  if([400,401,403,422].includes(error.status)||(Number.isInteger(error.providerStatus)&&error.providerStatus<500&&error.providerStatus!==409&&error.providerConflict!==true)||!objects.getIfPresent)throw error;
  // A create-only conflict or lost reply may follow a completed upload. Read only that exact key.
  const existing=await objects.getIfPresent(path);if(!existing)throw error;
  try{verifiedEncryptedUpload(cipher,existing,{sha256:sha(bytes),size:bytes.length});}catch{throw new ApiError(409,reviewCode);}
  return{recovered:true};
 }
}

// Stable identity is namespaced by the ORIGINAL validated source and exact request.
export function retainedUploadIdentity(parts:unknown[]){
 const namespace=JSON.stringify(parts);if(namespace.length>16384)throw Error('uploadIdentityReviewRequired');
 const uuid=(purpose:string)=>{const chars=sha(namespace+':'+purpose).slice(0,32).split('');chars[12]='8';chars[16]=((parseInt(chars[16],16)&3)|8).toString(16);const h=chars.join('');return[h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-');};return{documentId:uuid('document'),versionId:uuid('version')};
}
