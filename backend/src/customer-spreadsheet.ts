import {inflateRawSync} from 'node:zlib';
import {Worker} from 'node:worker_threads';
// Bound ZIP expansion before a maintained XLSX reader runs in a memory/time limited worker.
export async function customerSpreadsheet(bytes:Buffer,requiredHeader='fullName'):Promise<Record<string,string>[]> {
 if(bytes.length>5e6||bytes.length<22)throw Error('invalidSpreadsheet');
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}
 if(end<0||bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6))throw Error('invalidSpreadsheet');
 const count=bytes.readUInt16LE(end+10);let cursor=bytes.readUInt32LE(end+16),expanded=0;
 if(count>200||cursor>=end)throw Error('spreadsheetLimit');
 for(let i=0;i<count;i++){
  if(cursor+46>end||bytes.readUInt32LE(cursor)!==0x02014b50)throw Error('invalidSpreadsheet');
  const flags=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),compressed=bytes.readUInt32LE(cursor+20),size=bytes.readUInt32LE(cursor+24),nl=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42),name=bytes.subarray(cursor+46,cursor+46+nl).toString();
  expanded+=size;if(flags&1||![0,8].includes(method)||expanded>20e6||size>10e6||name.includes('..')||name.startsWith('/')||name.endsWith('.bin')||offset+30>bytes.length||bytes.readUInt32LE(offset)!==0x04034b50)throw Error('spreadsheetLimit');
  const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);if(start+compressed>bytes.length)throw Error('invalidSpreadsheet');
  const payload=bytes.subarray(start,start+compressed),plain=method===0?payload:inflateRawSync(payload,{maxOutputLength:10e6});
  if(plain.length!==size)throw Error('invalidSpreadsheet');
  if(name.endsWith('.xml')||name.endsWith('.rels')){const xml=plain.toString();if(/<!DOCTYPE|<!ENTITY|TargetMode\s*=\s*["']External/i.test(xml))throw Error('invalidSpreadsheet');if(/worksheets\//.test(name))for(const match of xml.matchAll(/\br=["']([A-Z]+)(\d+)["']/g)){if(match[1].length>2||Number(match[2])>10001)throw Error('spreadsheetLimit');}}
  cursor+=46+nl+extra+comment;
 }
 const raw=await new Promise<string[][]>((resolve,reject)=>{const worker=new Worker(new URL(import.meta.url.endsWith('.ts')?'./customer-spreadsheet-worker.ts':'./customer-spreadsheet-worker.js',import.meta.url),{workerData:bytes,resourceLimits:{maxOldGenerationSizeMb:128,stackSizeMb:4}});const timer=setTimeout(()=>{void worker.terminate();reject(Error('spreadsheetLimit'));},15000);worker.once('message',r=>{clearTimeout(timer);void worker.terminate();r.error?reject(Error(r.error)):resolve(r.rows);});worker.once('error',()=>{clearTimeout(timer);reject(Error('invalidSpreadsheet'));});worker.once('exit',code=>{if(code!==0){clearTimeout(timer);reject(Error('invalidSpreadsheet'));}});});
 const header=raw.shift()||[];if(!header.includes(requiredHeader)||new Set(header).size!==header.length)throw Error('invalidSpreadsheet');return raw.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]||''])));
}
