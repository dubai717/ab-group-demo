// Content integrity against the reviewed manifest; not a code-signing certificate.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
try{
 const manifest=JSON.parse(await readFile(new URL('./source-integrity.json',import.meta.url),'utf8'));
 let count=0;
 for(const [path,expected] of Object.entries(manifest.files)){
  if(path.includes('..')||path.startsWith('/')||!(/^[a-f0-9]{64}$/.test(expected)))throw Error('invalid manifest');
  const bytes=await readFile(new URL(path,root));
  const canonical=/\.(ts|mts|cts|js|mjs|cjs|json|html|css|ps1|sql|crt|txt|svg|md|yaml|yml|example)$/i.test(path)||['Dockerfile.staging','.dockerignore'].includes(path)?Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n')):bytes;
  const actual=createHash('sha256').update(canonical).digest('hex');
  if(actual!==expected){console.log('STOP: integrity mismatch for reviewed file '+path);throw Error('content mismatch');}count++;
 }
 console.log('PASS: source SHA-256 integrity ('+count+' reviewed files)');
}catch{console.log('STOP: package contents differ from the reviewed manifest; do not enter secrets.');process.exitCode=1;}
