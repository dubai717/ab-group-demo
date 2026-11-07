import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,cp,mkdir,rm,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Worker} from 'node:worker_threads';
import {PDFDocument,StandardFonts} from 'pdf-lib';

test('Packaged PDF worker extracts text without optional native canvas dependencies',async()=>{
 const root=await mkdtemp(join(tmpdir(),'ab-pdf-portable-'));
 try{
  const pdfPath=join(root,'node_modules/pdfjs-dist');await mkdir(join(pdfPath,'legacy/build'),{recursive:true});
  for(const file of ['package.json','legacy/build/pdf.mjs','legacy/build/pdf.worker.mjs'])await copyFile('node_modules/pdfjs-dist/'+file,join(pdfPath,file));
  await cp('node_modules/pdfjs-dist/standard_fonts',join(pdfPath,'standard_fonts'),{recursive:true});
  await mkdir(join(root,'node_modules/@thednp'),{recursive:true});await cp('node_modules/@thednp/dommatrix',join(root,'node_modules/@thednp/dommatrix'),{recursive:true});
  const workerPath=join(root,'document-text-worker.mjs');await copyFile('backend/src/document-text-worker.mjs',workerPath);
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);doc.addPage().drawText('Portable synthetic PDF text',{x:40,y:700,font});
  const bytes=await doc.save();
  const result:any=await new Promise((resolve,reject)=>{const worker=new Worker(workerPath,{execArgv:[],workerData:{bytes},resourceLimits:{maxOldGenerationSizeMb:128},stdout:true,stderr:true});worker.stdout.resume();worker.stderr.resume();const timer=setTimeout(()=>{void worker.terminate();reject(Error('portableTextTimeout'));},5000);worker.once('message',result=>{clearTimeout(timer);void worker.terminate();resolve(result);});worker.once('error',error=>{clearTimeout(timer);reject(error);});});
  assert.equal(result.status,'indexed');assert.match(result.text,/Portable synthetic PDF text/);

 }finally{await rm(root,{recursive:true,force:true});}
});
