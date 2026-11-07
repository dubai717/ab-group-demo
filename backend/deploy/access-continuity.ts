// Explicit operational policy, not a table exclusion. Witnesses stay ONLY in
// encrypted backup context; never log IDs, hashes, tokens or row contents.
import type {PoolClient} from 'pg';
import {sha} from '../src/core.js';
type Audit={id:string;hash:string;tenant:string;actor:string;action:string;kind:string;entity:string|null;fields:string[];actorType:string;valid:boolean};
type Session={id:string;hash:string;immutable:string;tenant:string;actor:string;expiry:number;valid:boolean};
export type AccessWitness={version:1;audit:Audit[];sessions:Session[]};
const need=(v:unknown,code:string)=>{if(!v)throw Error(code);};
export async function accessWitness(c:PoolClient):Promise<AccessWitness>{
 const audit=(await c.query("select a.*,row_to_json(a)::text witness_row,exists(select 1 from ab.users u where u.id=a.actor_id and u.tenant_id=a.tenant_id and u.status='Active') witness_valid from ab.audit_events a order by a.id")).rows.map(r=>({id:r.id,hash:sha(r.witness_row),tenant:r.tenant_id,actor:r.actor_id,action:r.action,kind:r.entity_type,entity:r.entity_id,fields:r.fields,actorType:r.actor_type||'user',valid:r.witness_valid}));
 const sessions=(await c.query("select s.id_hash,s.tenant_id,s.user_id,row_to_json(s)::text witness_row,(to_jsonb(s)-'expires_at')::text witness_immutable,extract(epoch from s.expires_at)::text witness_expiry,exists(select 1 from ab.users u where u.id=s.user_id and u.tenant_id=s.tenant_id and u.status='Active') witness_valid from ab.sessions s order by s.id_hash")).rows.map(r=>({id:r.id_hash,hash:sha(r.witness_row),immutable:sha(r.witness_immutable),tenant:r.tenant_id,actor:r.user_id,expiry:Number(r.witness_expiry),valid:r.witness_valid}));
 return{version:1,audit,sessions};
}
export function assertAccessContinuity(before:AccessWitness,after:AccessWitness,now=Date.now()/1000){
 need(before?.version===1&&after?.version===1,'ACCESS_WITNESS_REQUIRED');
 const map=<T extends{id:string}>(xs:T[])=>{const m=new Map(xs.map(x=>[x.id,x]));need(m.size===xs.length,'ACCESS_DUPLICATE_ID');return m;};
 const oldAudit=map(before.audit),audit=map(after.audit),oldSessions=map(before.sessions),sessions=map(after.sessions);
 // Every previous audit record must survive byte-for-byte, including metadata.
 for(const a of before.audit)need(audit.get(a.id)?.hash===a.hash,'ACCESS_AUDIT_LOST_OR_MODIFIED');
 const counts=new Map<string,number>(),added=new Map<string,number>(),revoked=new Map<string,number>();
 const actor=(x:{tenant:string;actor:string})=>x.tenant+':'+x.actor;
 const add=(m:Map<string,number>,k:string)=>m.set(k,(m.get(k)||0)+1);
 for(const a of after.audit.filter(a=>!oldAudit.has(a.id))){
  need(a.valid&&a.actorType==='user'&&a.kind==='session'&&a.entity===null&&a.fields.length===0&&['login','logout'].includes(a.action),'ACCESS_UNCLASSIFIED_AUDIT_ADDITION');
  add(counts,actor(a)+':'+a.action);
 }
 for(const s of before.sessions){const n=sessions.get(s.id);need(n,'ACCESS_SESSION_LOST');
  if(n!.hash!==s.hash){need(n!.immutable===s.immutable&&n!.valid&&Number.isFinite(n!.expiry)&&n!.expiry<s.expiry&&n!.expiry<=now+5,'ACCESS_SESSION_UNSAFE_CHANGE');add(revoked,actor(s));}
 }
 for(const s of after.sessions.filter(s=>!oldSessions.has(s.id))){need(s.valid&&Number.isFinite(s.expiry)&&s.expiry<=now+3605,'ACCESS_SESSION_INVALID_ADDITION');add(added,actor(s));}
 // A login atomically writes exactly one session and one audit entry. Logout
 // only shortens expiry, never changes identity/cipher or reactivates a session.
 const actors=new Set([...after.audit.filter(a=>!oldAudit.has(a.id)).map(actor),...added.keys(),...revoked.keys()]);
 for(const a of actors){need((counts.get(a+':login')||0)===(added.get(a)||0),'ACCESS_LOGIN_SESSION_MISMATCH');need((counts.get(a+':logout')||0)>=(revoked.get(a)||0),'ACCESS_LOGOUT_AUDIT_REQUIRED');}
 return{auditAdded:after.audit.length-before.audit.length,sessionsAdded:after.sessions.length-before.sessions.length,sessionsExpired:[...revoked.values()].reduce((a,b)=>a+b,0)};
}
