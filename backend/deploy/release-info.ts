// Public build identity and hash of public project origin only; never credential hashes.
import {createHash} from 'node:crypto';
export function releaseInfo(env:NodeJS.ProcessEnv){
 let projectOriginSha256:string|null=null;try{const u=new URL(env.SUPABASE_URL||'');if(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/')projectOriginSha256=createHash('sha256').update(u.origin).digest('hex');}catch{}
 return {environment:env.APP_ENV==='staging'?'staging':env.APP_ENV==='local'?'local':'unknown',commit:/^[a-f0-9]{40}$/.test(env.RENDER_GIT_COMMIT||'')?env.RENDER_GIT_COMMIT:null,projectOriginSha256};
}
