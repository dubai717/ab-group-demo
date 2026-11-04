// Restricted to the existing private test bucket. No bucket configuration or delete/update APIs.
import {randomUUID} from 'node:crypto';
import {sha} from '../src/core.js';
const bucket='ab-private-test',mime='application/octet-stream';
export const backupPrefix='ab-group-backups/v1/';
const pattern=/^ab-group-backups\/v1\/\d{8}T\d{9}Z-[a-f0-9-]{36}\/(database\.abbackup|metadata\.abmeta)$/;
function need(ok:unknown,label:string):asserts ok {if(!ok)throw Error(label);}
export function newBackupPaths(){
 const prefix=backupPrefix+new Date().toISOString().replace(/[-:.]/g,'')+'-'+randomUUID();
 return {archive:prefix+'/database.abbackup',metadata:prefix+'/metadata.abmeta'};
}
export function isRetainedBackupPath(name:string){return pattern.test(name);}
export function checkBackupBucket(value:any,size:number){
 need(value?.id===bucket&&value?.name===bucket&&value.public===false,'BACKUP_BUCKET_NOT_PRIVATE');
 need(Number.isSafeInteger(size)&&size>0&&size<=50*1024*1024,'BACKUP_UPLOAD_SIZE');
 need(value.file_size_limit==null||(Number.isSafeInteger(value.file_size_limit)&&value.file_size_limit>0&&size<=value.file_size_limit),'BACKUP_BUCKET_SIZE_LIMIT');
 const types=value.allowed_mime_types;
 need(types==null||(Array.isArray(types)&&types.every(t=>typeof t==='string')&&types.some(t=>t===mime||t==='application/*'||t==='*/*')),'BACKUP_BUCKET_MIME_LIMIT');
}
export function privateBackupStore(endpoint:string,secret:string,fetcher:typeof fetch=fetch){
 const base=new URL(endpoint);need(base.protocol==='https:'&&/^[a-z0-9]{20}\.supabase\.co$/.test(base.hostname)&&base.pathname==='/'&&!base.search&&!base.hash&&!base.username&&!base.password,'BACKUP_ENDPOINT');
 const path=(name:string)=>{need(pattern.test(name),'BACKUP_OBJECT_PATH');return bucket+'/'+name.split('/').map(encodeURIComponent).join('/');};
 const request=(url:string,init:RequestInit={})=>fetcher(base.origin+url,{...init,redirect:'error',signal:AbortSignal.timeout(30000)});
 async function verifyBucket(size:number){const r=await request('/storage/v1/bucket/'+bucket,{headers:{apikey:secret}});need(r.ok,'BACKUP_BUCKET_READ');checkBackupBucket(await r.json(),size);}
 return {
  verifyBucket,
  async upload(name:string,bytes:Buffer){
   const object=path(name),header=name.endsWith('.abbackup')?'AB-BACKUP-1\n':'AB-BACKUP-META-1\n';
   need(bytes.subarray(0,header.length).toString()===header&&bytes.length>header.length,'BACKUP_ENCRYPTED_FORMAT');
   await verifyBucket(bytes.length);
   const r=await request('/storage/v1/object/'+object,{method:'POST',headers:{apikey:secret,'content-type':mime,'x-upsert':'false'},body:new Uint8Array(bytes)});
   need(r.status===200||r.status===201,r.status===409?'BACKUP_PATH_CONFLICT':'BACKUP_UPLOAD_DENIED');
  },
  async downloadVerified(name:string,expected:Buffer){
   const r=await request('/storage/v1/object/'+path(name),{headers:{apikey:secret}});need(r.ok&&r.body,'BACKUP_DOWNLOAD');
   const chunks:Buffer[]=[];let size=0;for await(const chunk of r.body as any){size+=chunk.length;need(size<=expected.length,'BACKUP_DOWNLOAD_SIZE');chunks.push(Buffer.from(chunk));}
   const bytes=Buffer.concat(chunks);need(bytes.length===expected.length&&sha(bytes)===sha(expected),'BACKUP_DOWNLOAD_HASH');return bytes;
  },
  async verifyNotPublic(name:string){
   const r=await request('/storage/v1/object/public/'+path(name));
   const denied=[400,401,403,404].includes(r.status);await r.body?.cancel();need(denied,'BACKUP_PUBLIC_ACCESS');
  },
 };
}
