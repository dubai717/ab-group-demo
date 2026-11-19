import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
let running=false;
export function receiptImageSize(bytes:Buffer,mime:string):{width:number;height:number}|null{
 if(mime==='image/png'&&bytes.length>=24&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216){let n=2;while(n+8<bytes.length){if(bytes[n]!==255)return null;const marker=bytes[n+1];if(marker===217||marker===218)return null;const length=bytes.readUInt16BE(n+2);if(length<2||n+2+length>bytes.length)return null;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker))return{width:bytes.readUInt16BE(n+7),height:bytes.readUInt16BE(n+5)};n+=2+length;}}
 return null;
}
export async function receiptImageText(bytes:Buffer,mime:string):Promise<any>{
 const size=receiptImageSize(bytes,mime);if(bytes.length>5e6||!size||size.width<1||size.height<1||size.width>4096||size.height>4096||size.width*size.height>4e6)return{status:'manualRequired',confidence:null,text:''};
 if(running)return{status:'deferred',confidence:null,text:''};running=true;
 try{return await new Promise(resolve=>{
  // A separate process makes timeout termination include the decoder and its WASM worker threads.
  const modelDir=mkdtempSync(join(tmpdir(),'ab-receipt-models-'));
  const child=fork(fileURLToPath(new URL('./receipt-ocr-worker.mjs',import.meta.url)),[],{execArgv:['--max-old-space-size=160'],stdio:['ignore','ignore','ignore','ipc'],env:{PATH:process.env.PATH,NODE_PATH:process.env.NODE_PATH,TMPDIR:process.env.TMPDIR||'/tmp',TZ:'UTC'}});
  let done=false;const finish=(r:any)=>{if(done)return;done=true;clearTimeout(timer);child.kill('SIGKILL');rmSync(modelDir,{recursive:true,force:true});resolve(r);};
  const timer=setTimeout(()=>finish({status:'timeout',confidence:null,text:''}),20000);
  child.once('message',(r:any)=>finish(r&&['indexed','lowConfidence','failed'].includes(r.status)&&typeof r.text==='string'&&r.text.length<=15000?r:{status:'failed',confidence:null,text:''}));child.once('error',()=>finish({status:'failed',confidence:null,text:''}));child.once('exit',()=>finish({status:'failed',confidence:null,text:''}));
  child.send({base64:bytes.toString('base64'),modelDir},error=>{if(error)finish({status:'failed',confidence:null,text:''});});
 });}finally{running=false;}
}
