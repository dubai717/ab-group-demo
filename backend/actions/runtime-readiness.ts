// No network or database calls. Only fixed secret names/status labels are emitted.
export function runtimeReadiness(env:NodeJS.ProcessEnv){
 const missing:string[]=[],invalid:string[]=[];
 if(!env.DATABASE_URL?.trim())missing.push('DATABASE_URL');
 const key=env.DATA_ENCRYPTION_KEY;
 if(!key)missing.push('DATA_ENCRYPTION_KEY');
 else if(Buffer.from(key,'base64').length!==32||Buffer.from(key,'base64').toString('base64')!==key)invalid.push('DATA_ENCRYPTION_KEY');
 return {missing,invalid,ready:missing.length===0&&invalid.length===0};
}
export function run(){
 const state=runtimeReadiness(process.env);
 if(state.missing.length)console.log('MANUAL_REQUIRED: add protected Environment secrets: '+state.missing.join(', '));
 if(state.invalid.length)console.log('MANUAL_REQUIRED: correct protected Environment secret format: '+state.invalid.join(', '));
 if(!state.ready){console.log('STOP: before any role password assignment, database access or fixture creation');process.exitCode=2;return;}
 console.log('PASS: runtime connection secret and durable encryption-key format ready; values withheld');
}
if(process.argv[1]?.endsWith('/runtime-readiness.ts')||process.argv[1]?.endsWith('/runtime-readiness.js'))run();
