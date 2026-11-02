import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {isolatedEnvironment} from '../windows/terminal-trial.js';
test('terminal backend environment excludes administrator, platform and unrelated secrets',()=>{
 const env=isolatedEnvironment({PATH:'/bin',MIGRATION_DATABASE_URL:'ADMIN_CANARY',GITHUB_TOKEN:'TOKEN_CANARY',OTHER_SECRET:'OTHER_CANARY'},{DATABASE_URL:'runtime',DATA_ENCRYPTION_KEY:'key'});
 assert.equal(env.DATABASE_URL,'runtime');assert(!JSON.stringify(env).includes('CANARY'));
});
test('manual terminal path runs emitted JavaScript without CMD, PS1, native esbuild or policy overrides',async()=>{
 const source=await readFile(new URL('../windows/terminal-trial.ts',import.meta.url),'utf8');
 assert(!/cmd\.exe|\.ps1|ExecutionPolicy|Unblock-File|eval\(|writeFile|setEnvironmentVariable/i.test(source));
 assert(source.includes('setRawMode(true)'));assert(source.includes("bootstrap-trial.js"));assert(source.includes("local-server.js"));
});
