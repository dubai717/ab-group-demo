// Storage write collision metadata only; no provider messages or secrets retained.
const duplicateCodes=new Set(['ResourceAlreadyExists','KeyAlreadyExists','already_exists','Duplicate']);
export async function storageWriteConflict(response:Response){
 if(response.status!==400){await response.body?.cancel().catch(()=>{});return response.status===409;}
 if(!response.body)return false;const reader=response.body.getReader(),chunks:Buffer[]=[];let size=0;
 try{const declared=response.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>4096))return false;
  for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>4096)return false;chunks.push(Buffer.from(part.value));}
  const body=JSON.parse(Buffer.concat(chunks).toString());return[body?.code,body?.error].some(code=>typeof code==='string'&&duplicateCodes.has(code));
 }catch{return false;}finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
