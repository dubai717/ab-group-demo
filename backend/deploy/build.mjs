// Shared native-Render and portable-image build; no cloud keys or DB connection.
import {spawnSync} from 'node:child_process';
import {copyFile,mkdir} from 'node:fs/promises';
const r=spawnSync(process.execPath,['node_modules/typescript-portable/bin/tsc','-p','backend/tsconfig.json','--noEmit','false','--outDir','backend-build'],{stdio:'inherit'});
if(r.status!==0)process.exit(1);
await mkdir('backend-build',{recursive:true});
await copyFile('backend/package.json','backend-build/package.json');
// TypeScript does not emit this existing .mjs dependency reached through reset/gateway.
await mkdir('backend-build/deploy/v2',{recursive:true});
await copyFile('backend/deploy/v2/context.mjs','backend-build/deploy/v2/context.mjs');
await mkdir('backend-build/src',{recursive:true});
await copyFile('backend/src/document-text-worker.mjs','backend-build/src/document-text-worker.mjs');
// Load the compiled runtime graph without starting the server or connecting to providers.
await import(new URL('../../backend-build/reset/gateway.js',import.meta.url));
console.log('PASS: compiled runtime module graph loads without provider connections');
console.log('PASS: staging JavaScript build complete; no migrations or cloud connections');
