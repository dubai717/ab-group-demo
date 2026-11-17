import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {assertNotMaintenance,requireOk} from './core.js';
import {audit} from './data.js';

// Durable, encrypted enrollment receipt. No password, reset, Auth deletion or implicit linking.
export function userEnrollment(pool:any,auth:any,cipher:any){
 const receipts=new Pool({...pool.options,max:2,idleTimeoutMillis:1000});
 // Parent enrollment owns the ordinary tenant lock. Receipt transactions write only
 // their encrypted settings key, and keep the same maintenance barrier and tenant RLS.
 const metadata=async(s:any,fn:(c:any)=>Promise<any>)=>{await assertNotMaintenance();const c=await receipts.connect();try{await c.query('BEGIN');await c.query('select pg_advisory_xact_lock_shared(91717,1)');await assertNotMaintenance();await c.query("select set_config('ab.tenant',$1,true),set_config('ab.actor',$2,true)",[s.tenant_id,s.user_id]);const value=await fn(c);await c.query('COMMIT');return value;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
 const write=async(s:any,key:string,value:any)=>metadata(s,async(c:any)=>{await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,key,{sealed:cipher.seal(value)}]);});
 return {
  async close(){await receipts.end();},
  async reserve(s:any,input:any,saved:any,employeeId?:string){
   const key='user-enrollment-v1:'+cipher.digest(s.user_id+':'+saved.username.toLowerCase());
   const fingerprint=cipher.digest(JSON.stringify({saved:{...saved,id:undefined,revision:undefined},employeeId:employeeId||null,password:input.password}));
   const record=await metadata(s,async(c:any)=>{const old=(await c.query('select value from ab.settings where key=$1',[key])).rows[0];if(old){const v=cipher.open(old.value.sealed);if(v.fingerprint!==fingerprint){requireOk(['reserved','rejected'].includes(v.state)&&!v.authId&&!v.attempted,409,'enrollmentInputChanged');v.fingerprint=fingerprint;v.email=saved.email;v.employeeId=employeeId||null;v.state='reserved';await c.query('update ab.settings set value=$2 where key=$1',[key,{sealed:cipher.seal(v)}]);}return v;}const value={id:randomUUID(),userId:randomUUID(),fingerprint,email:saved.email,employeeId:employeeId||null,attempted:false,authId:null,state:'reserved'};await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[s.tenant_id,key,{sealed:cipher.seal(value)}]);return value;});
   return {key,record};
  },
  async authenticate(s:any,ticket:any,password:string){const {key,record}=ticket;let authId=record.authId;
   if(!authId&&record.attempted){requireOk(auth.recoverEnrollment,503,'enrollmentNeedsReview');const found=await auth.recoverEnrollment(record.email,{id:record.id,tenant:s.tenant_id});authId=found?.id||null;}
   if(!authId){record.attempted=true;await write(s,key,record);try{authId=await auth.create(record.email,password,{id:record.id,tenant:s.tenant_id});}catch(e:any){if(e.enrollmentRejected===true){record.state='rejected';record.attempted=false;await write(s,key,record);}throw e;}}
   requireOk(typeof authId==='string'&&/^[a-f0-9]{8}-[a-f0-9-]{27}$/i.test(authId),502,'authEnrollmentInvalid');record.authId=authId;record.state='auth-created';await write(s,key,record);
   if(auth.inspect){const identity=await auth.inspect(authId);requireOk(identity.id===authId&&identity.email.trim().toLowerCase()===record.email.trim().toLowerCase()&&identity.confirmed,409,'enrollmentIdentityMismatch');}
   return authId;
  },
  async complete(c:any,s:any,ticket:any){const value={...ticket.record,state:'complete'};await c.query('update ab.settings set value=$2 where key=$1',[ticket.key,{sealed:cipher.seal(value)}]);await audit(c,s.tenant_id,s.user_id,'user_enrollment_completed','user',value.userId,['enrollment:'+value.id,'employee_link:'+(value.employeeId?'confirmed':'independent'),'authentication_and_memberships_committed']);}
 };
}
