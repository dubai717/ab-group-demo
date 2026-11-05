// Fixed private control namespace; no browser credentials. Mutable marker is never a backup object.
import {security,sha,requireOk} from '../src/core.js';import {projectHash,controlPrefix} from './plan.js';
export function remoteControl(endpoint:string,secret:string,key:string,request:typeof fetch=fetch){
 const u=new URL(endpoint);requireOk(u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&sha(u.origin)===projectHash,403,'resetTargetMismatch');const cipher=security(key);
 const headers={apikey:secret,...(!secret.startsWith('sb_')?{authorization:'Bearer '+secret}:{})};
 const path=(name:string)=>{requireOk(name.startsWith(controlPrefix)&&!name.split('/').some(s=>!s||s==='.'||s==='..'),403,'controlPath');return u.origin+'/storage/v1/object/ab-private-test/'+name.split('/').map(encodeURIComponent).join('/');};
 return {async get(name:string){const r=await request(path(name),{headers,redirect:'error',signal:AbortSignal.timeout(15000)});if(r.status===404||r.status===400){const b=await r.json().catch(()=>({})) as any;if(['404','NoSuchKey'].includes(String(b.statusCode||b.code)))return null;throw Error('controlReadFailed');}requireOk(r.ok,503,'controlReadFailed');return cipher.open(await r.text());},async put(name:string,value:any,replace=false){const r=await request(path(name),{method:replace?'PUT':'POST',headers:{...headers,'content-type':'application/octet-stream','x-upsert':replace?'true':'false'},body:cipher.seal(value),redirect:'error',signal:AbortSignal.timeout(15000)});requireOk(r.ok,503,'controlWriteFailed');await r.body?.cancel();}};
}
export type ControlStore=ReturnType<typeof remoteControl>;
export const markerPath=controlPrefix+'maintenance.enc';
