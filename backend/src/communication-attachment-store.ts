// Shared ORIGINAL message attachment validation/scan/encrypted writer.
// Authorization and original message/source binding remain the caller's responsibility.
import{z}from'zod';import{requireOk,sha}from'./core.js';import{retainEncryptedUpload}from'./retained-encrypted-upload.js';
const file=z.object({name:z.string().min(1).max(200),mime:z.enum(['application/pdf','image/png','image/jpeg']),base64:z.string().min(4).max(6990508)}).strict();
export async function retainCommunicationAttachment(cipher:any,options:any,storageKey:string,raw:unknown){
 const d=file.parse(raw),bytes=Buffer.from(d.base64,'base64');requireOk(bytes.length>0&&bytes.length<=5242880&&bytes.toString('base64')===d.base64&&/\.(pdf|png|jpe?g)$/i.test(d.name),422,'invalidFile');requireOk(d.mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':d.mime==='image/png'?bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a':bytes[0]===255&&bytes[1]===216,422,'invalidFile');const scan=options.scan?await options.scan(bytes,d.mime):'pending';requireOk(scan==='clean',409,'filePending');const retained=await retainEncryptedUpload(options.objects,cipher,storageKey,bytes,'messageUploadOutcomeReviewRequired');return{name:d.name,mime:d.mime,size:bytes.length,digest:sha(bytes),storageKey,scanStatus:scan,recovered:retained.recovered};
}
