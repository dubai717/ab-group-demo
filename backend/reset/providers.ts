// Canonical Supabase Admin/Storage HTTP APIs only; never SQL DELETE against managed schemas.
import {requireOk,sha} from '../src/core.js';import {projectHash,protectedObject} from './plan.js';
export function managedProviders(endpoint:string,secret:string,request:typeof fetch=fetch){
 const u=new URL(endpoint);requireOk(u.protocol==='https:'&&sha(u.origin)===projectHash&&!u.username&&!u.password&&u.pathname==='/'&&!u.search&&!u.hash,403,'providerTarget');
 const headers={apikey:secret,...(!secret.startsWith('sb_')?{authorization:'Bearer '+secret}:{})};
 const call=async(path:string,options:RequestInit={})=>{const r=await request(u.origin+path,{...options,headers:{...headers,...options.headers},redirect:'error',signal:AbortSignal.timeout(30000)});requireOk(r.ok||r.status===404,503,'providerOperationFailed');return r;};
 const id=(v:string)=>{requireOk(/^[a-f0-9-]{36}$/.test(v),422,'invalidIdentity');return v;};
 const path=(k:string)=>{requireOk(!protectedObject(k)&&!k.split('/').some(s=>!s||s==='.'||s==='..'),403,'protectedObject');return '/storage/v1/object/ab-private-test/'+k.split('/').map(encodeURIComponent).join('/');};
 return {
  async inspect(identity:string){const r=await call('/auth/v1/admin/users/'+id(identity));return r.status===404?null:await r.json();},
  async removeUser(identity:string,owner:string){requireOk(identity!==owner,403,'ownerProtected');const r=await call('/auth/v1/admin/users/'+id(identity),{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({should_soft_delete:false})});await r.body?.cancel();},
  async restoreUser(row:any){requireOk(/^\$2[aby]\$/.test(row.encrypted_password||''),409,'unsupportedPasswordHash');const r=await call('/auth/v1/admin/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:id(row.id),email:row.email,password_hash:row.encrypted_password,email_confirm:!!row.email_confirmed_at,user_metadata:row.raw_user_meta_data||{},app_metadata:row.raw_app_meta_data||{},role:row.role||'authenticated',ban_duration:row.banned_until&&Date.parse(row.banned_until)>Date.now()?Math.ceil((Date.parse(row.banned_until)-Date.now())/1000)+'s':'none'})});requireOk(r.ok&&(await r.json() as any).id===row.id,503,'identityRestoreFailed');},
  async removeFiles(keys:string[]){requireOk(new Set(keys).size===keys.length,409,'duplicateObject');for(const k of keys)path(k);for(let i=0;i<keys.length;i+=50){const r=await call('/storage/v1/object/ab-private-test',{method:'DELETE',headers:{'content-type':'application/json'},body:JSON.stringify({prefixes:keys.slice(i,i+50)})});requireOk(r.ok,503,'fileCleanupFailed');await r.body?.cancel();}},
  async getFile(k:string){const r=await call(path(k));return r.status===404?null:Buffer.from(await r.arrayBuffer());},
  async restoreFile(k:string,bytes:Buffer){const old=await this.getFile(k);if(old){requireOk(sha(old)===sha(bytes),409,'objectRecoveryConflict');return;}const r=await call(path(k),{method:'POST',headers:{'content-type':'application/octet-stream','x-upsert':'false'},body:new Uint8Array(bytes)});requireOk(r.ok,503,'fileRecoveryFailed');await r.body?.cancel();}
 };
}
export type ManagedProviders=ReturnType<typeof managedProviders>;
