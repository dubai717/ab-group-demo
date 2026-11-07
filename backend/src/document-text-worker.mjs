import DOMMatrix from '@thednp/dommatrix';
// Text extraction needs the matrix API, not a native canvas renderer. Render omits optional binaries.
globalThis.DOMMatrix ??= DOMMatrix;
import {parentPort,workerData} from 'node:worker_threads';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
const require=createRequire(import.meta.url);
let loading;
try{
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 loading=getDocument({data:new Uint8Array(workerData.bytes),isEvalSupported:false,enableXfa:false,useWorkerFetch:false,useSystemFonts:false,disableFontFace:true,disableAutoFetch:true,disableStream:true,disableRange:true,stopAtErrors:true,verbosity:0,maxImageSize:0,standardFontDataUrl:join(dirname(require.resolve('pdfjs-dist/package.json')),'standard_fonts/')});
 const pdf=await loading.promise;let text='';for(let n=1;n<=Math.min(pdf.numPages,200)&&text.length<100000;n++){const page=await pdf.getPage(n);const content=await page.getTextContent();text+=content.items.slice(0,10000).map(item=>'str'in item?item.str:'').join(' ')+'\n';}
 const truncated=pdf.numPages>200||text.length>100000;parentPort.postMessage({status:text.trim()?'indexed':'no_text',text:text.slice(0,100000),truncated});
}catch{parentPort.postMessage({status:'failed',text:'',truncated:false});}
finally{try{await loading?.destroy();}catch{}}
