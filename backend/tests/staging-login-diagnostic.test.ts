import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectAccount} from '../actions/staging-login-diagnostic.js';
test('absent profile diagnosis performs only lookup and emits no target or SQL rows',async()=>{
 const lines:string[]=[],queries:string[]=[];const original=console.log;console.log=(s:string)=>{lines.push(s);};
 try{const status=await inspectAccount({query:async(sql:string,args:string[])=>{queries.push(sql);assert.equal(args[0],'trial_123456abcdef');return {rows:[]};}},{query:()=>{throw Error('unexpected runtime lookup');}},'trial_123456abcdef');assert.equal(status,'PROFILE_ABSENT');}finally{console.log=original;}
 assert(queries.every(x=>x.trim().startsWith('select')));assert(!lines.join().includes('123456abcdef'));
});
test('linked profile diagnosis checks identity without printing IDs email or password material',async()=>{
 const marker='PRIVATE_ROW_CANARY';const lines:string[]=[];const original=console.log;console.log=(s:string)=>{lines.push(s);};let n=0;
 try{await inspectAccount({query:async()=>({rows:[{id:marker,tenant_id:marker,auth_id:marker,status:'Active',role_id:'owner',auth_exists:true,email_matches:true,email_confirmed:true,password_configured:true,auth_banned:false}]})},{query:async()=>({rows:n++===0?[{email:marker}]:[{id:marker,tenant_id:marker}]})},'trial_123456abcdef');}finally{console.log=original;}
 assert(!lines.join().includes(marker));assert(lines.includes('DIAGNOSTIC: RUNTIME_PRINCIPAL_MATCH=true'));
});

test('Render Shell probe limits output, checks existing profile and never provisions or resets accounts',async()=>{
 const {readFile}=await import('node:fs/promises');const s=await readFile('backend/actions/render-shell-login-probe.mjs','utf8');
 assert(s.includes('secretPrompt'));assert(s.includes('BEGIN READ ONLY'));assert(s.includes('/logout?scope=local'));
 assert(!/writeFile|ALTER ROLE|CREATE ROLE|auth\.create|initializeOrganization|admin\/users|JSON\.stringify\(body\)/.test(s));
 assert(s.includes('AUTH_PASSWORD_REQUEST_REJECTED'));assert(s.includes('RENDER_AUTH_CONFIGURATION_REJECTED'));
});
