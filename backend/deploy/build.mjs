// Shared native-Render and portable-image build; no cloud keys or DB connection.
import {spawnSync} from 'node:child_process';
import {copyFile,mkdir} from 'node:fs/promises';
const r=spawnSync(process.execPath,['node_modules/typescript-portable/bin/tsc','-p','backend/tsconfig.json','--noEmit','false','--outDir','backend-build'],{stdio:'inherit'});
if(r.status!==0)process.exit(1);
await mkdir('backend-build',{recursive:true});
await copyFile('backend/package.json','backend-build/package.json');
console.log('PASS: staging JavaScript build complete; no migrations or cloud connections');
