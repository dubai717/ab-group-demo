import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';

let running=0;
export async function extractDocumentText(bytes:Buffer,mime:string):Promise<{status:string;text:string;truncated:boolean}>{
 if(mime!=='application/pdf')return {status:'unsupported',text:'',truncated:false};
 if(running>=2)return {status:'deferred',text:'',truncated:false};
 running++;
 try{return await new Promise(resolve=>{let complete=false;const worker=new Worker(new URL('./document-text-worker.mjs',import.meta.url),{execArgv:[],workerData:{bytes:new Uint8Array(bytes)},resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:32,stackSizeMb:4},stdout:true,stderr:true});
  // Parser diagnostics are deliberately withheld; the caller receives only a bounded status.
  worker.stdout.resume();worker.stderr.resume();const finish=(result:any)=>{if(complete)return;complete=true;clearTimeout(timer);void worker.terminate();resolve(result);};
  const timer=setTimeout(()=>finish({status:'timeout',text:'',truncated:false}),5000);
  worker.once('message',result=>finish(result));worker.once('error',()=>finish({status:'failed',text:'',truncated:false}));worker.once('exit',()=>finish({status:'failed',text:'',truncated:false}));
 });}finally{running--;}
}
export const normalizeDocumentText=(v:string)=>v.normalize('NFKC').toLowerCase().replace(/[\u064b-\u065f\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');
export const documentSearchTokens=(cipher:any,text:string)=>[...new Set((normalizeDocumentText(text).match(/[\p{L}\p{N}]+/gu)||[]).slice(0,20000))].slice(0,8000).map(word=>cipher.digest('document-text:'+word));
export async function indexDocumentText(c:any,cipher:any,s:any,column:'version_id'|'customer_file_id'|'vehicle_file_id',versionId:string,bytes:Buffer,mime:string,scanStatus:string){
 if(scanStatus!=='clean'||!(await c.query("select to_regclass('ab.document_text_index') ok")).rows[0].ok)return;
 if((await c.query('select 1 from ab.document_text_index where '+column+'=$1',[versionId])).rowCount)return;
 const result=await extractDocumentText(bytes,mime);
 await c.query('insert into ab.document_text_index(id,tenant_id,'+column+',status,text_cipher,search_tokens,truncated,created_by)values($1,$2,$3,$4,$5,$6,$7,$8)on conflict do nothing',[randomUUID(),s.tenant_id,versionId,result.status,cipher.seal({text:result.text}),documentSearchTokens(cipher,result.text),result.truncated,s.user_id]);
}
