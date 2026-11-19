// Local models and byte buffers only: no image URL, provider credential or document logging.
import {createRequire} from 'node:module';
import {symlinkSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
const require=createRequire(import.meta.url);
process.once('message',async input=>{
 let worker;
 try{
  const {createWorker,OEM}=require('tesseract.js');
  const languages=['eng','ara'].map(code=>{const model=require('@tesseract.js-data/'+code),fast=join(dirname(model.langPath),'4.0.0_best_int',code+'.traineddata.gz');symlinkSync(existsSync(fast)?fast:join(model.langPath,code+'.traineddata.gz'),join(input.modelDir,code+'.traineddata.gz'));return code;});
  worker=await createWorker(languages,OEM.LSTM_ONLY,{cacheMethod:'none',langPath:input.modelDir,logger:()=>{},errorHandler:()=>{}});
  await worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'150'});
  const {data}=await worker.recognize(Buffer.from(input.base64,'base64'));
  const result={status:Number(data.confidence)>=65?'indexed':'lowConfidence',confidence:Math.round(Number(data.confidence)||0),text:String(data.text||'').slice(0,15000)};
  await worker.terminate();worker=null;process.send?.(result);
 }catch{try{await worker?.terminate();}catch{}process.send?.({status:'failed',confidence:null,text:''});}
});
