import {parentPort,workerData} from 'node:worker_threads';
import {readSheet} from 'read-excel-file/node';
try {
 const rows=await readSheet(Buffer.from(workerData),1,{parseNumber:(value:string)=>value});
 if(rows.length>10001||rows.some(r=>r.length>100))throw Error('spreadsheetLimit');
 parentPort!.postMessage({rows:rows.map(r=>r.map(v=>v instanceof Date?v.toISOString().slice(0,10):v==null?'':String(v)))});
}catch{parentPort!.postMessage({error:'invalidSpreadsheet'});}
