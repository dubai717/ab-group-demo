// Inactive official-media read seam. Explicit sandbox transport only; no global fetch,
// storage writes, automatic customer matching, attachment approval or live registration.
import{createHash}from'node:crypto';import{z}from'zod';
const id=z.string().regex(/^\d{1,30}$/),mediaType=z.enum(['image/jpeg','image/png','application/pdf']);
const configSchema=z.object({mode:z.enum(['disabled','sandbox']),graphVersion:z.string().regex(/^v\d{1,3}\.\d{1,2}$/),phoneNumberId:id,token:z.string().min(1).max(4096),allowedTestMediaIds:z.array(id).min(1).max(100),maximumBytes:z.number().int().min(1).max(8*1024*1024)}).strict();
export type WhatsAppMediaSandboxConfig=z.infer<typeof configSchema>;
function mediaUrl(raw:string){let u:URL;try{u=new URL(raw);}catch{throw Error('whatsappMediaLocationRefused');}if(u.protocol!=='https:'||u.hostname!=='lookaside.fbsbx.com'||u.port||u.username||u.password||u.hash||u.pathname!=='/whatsapp_business/attachments/'||!u.search||raw.length>8192)throw Error('whatsappMediaLocationRefused');return u.href;}
async function bounded(response:Response,limit:number){
 const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>limit)){await response.body?.cancel().catch(()=>{});throw Error('whatsappMediaSizeRefused');}
 if(!response.body)throw Error('whatsappMediaBodyMissing');const reader=response.body.getReader(),chunks:Uint8Array[]=[];let total=0;
 try{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>limit)throw Error('whatsappMediaSizeRefused');chunks.push(part.value);}if(declared!==null&&total!==Number(declared))throw Error('whatsappMediaLengthMismatch');return Buffer.concat(chunks);}
 catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
function digest(raw:string){if(!/^(?:[A-Za-z0-9+/]{4}){10}[A-Za-z0-9+/]{3}=$/.test(raw))throw Error('whatsappMediaChecksumRequired');const value=Buffer.from(raw,'base64');if(value.length!==32||value.toString('base64')!==raw)throw Error('whatsappMediaChecksumRequired');return value;}
export async function readWhatsAppSandboxMedia(raw:unknown,configuration:WhatsAppMediaSandboxConfig,fetcher:typeof fetch){
 const config=configSchema.parse(configuration);if(config.mode!=='sandbox'||typeof fetcher!=='function')throw Error('whatsappMediaNotEnabled');
 const input=z.object({phoneNumberId:id,mediaId:id}).strict().parse(raw);if(input.phoneNumberId!==config.phoneNumberId||!config.allowedTestMediaIds.includes(input.mediaId))throw Error('whatsappMediaSandboxBindingRequired');
 const request={headers:{Authorization:'Bearer '+config.token},redirect:'error' as const,signal:AbortSignal.timeout(15000)};
 const meta=await fetcher('https://graph.facebook.com/'+config.graphVersion+'/'+input.mediaId+'?phone_number_id='+config.phoneNumberId,request);if(!meta.ok){await meta.body?.cancel().catch(()=>{});throw Error('whatsappMediaMetadataUnavailable');}
 const m=z.object({id,messaging_product:z.literal('whatsapp').optional(),url:z.string().max(8192),mime_type:mediaType,sha256:z.string(),file_size:z.number().int().positive()}).passthrough().parse(JSON.parse((await bounded(meta,16384)).toString('utf8')));
 if(m.id!==input.mediaId)throw Error('whatsappMediaIdentityMismatch');if(m.file_size>config.maximumBytes)throw Error('whatsappMediaSizeRefused');const expected=digest(m.sha256),url=mediaUrl(m.url);
 const response=await fetcher(url,{...request,signal:AbortSignal.timeout(30000)});if(!response.ok){await response.body?.cancel().catch(()=>{});throw Error('whatsappMediaDownloadUnavailable');}
 const receivedType=response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();if(receivedType!==m.mime_type){await response.body?.cancel().catch(()=>{});throw Error('whatsappMediaTypeMismatch');}
 const bytes=await bounded(response,Math.min(config.maximumBytes,m.file_size));if(bytes.length!==m.file_size)throw Error('whatsappMediaLengthMismatch');const actual=createHash('sha256').update(bytes).digest();if(!actual.equals(expected))throw Error('whatsappMediaChecksumMismatch');
 return{bytes,mediaId:input.mediaId,phoneNumberId:input.phoneNumberId,mime:m.mime_type,sha256:actual.toString('hex'),size:bytes.length,checksumVerified:true,scanRequired:true,attachmentStored:false,documentVerified:false,externalSent:false,financialEffect:false};
}
