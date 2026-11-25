import{individualDenialKey,individualDenialSchema}from'./individual-denials-source.js';
import{audit}from'./data.js';
import{requireOk}from'./core.js';

// Reuses the original encrypted denial history in the caller's existing transaction.
export async function persistIndividualDenialChange(c:any,cipher:any,s:any,u:any,change:any,standardChanged=false){
 if(!change.changed)return;requireOk(u.id!==s.user_id&&u.roleId!=='owner',403,'ownerProtected');requireOk(change.reason?.trim(),422,'individualDenialReasonRequired');
 const record=individualDenialSchema.parse({version:1,tenantId:s.tenant_id,userId:u.id,revision:change.revision+1,actions:change.after,updatedBy:s.user_id,updatedAt:new Date().toISOString()});
   await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[s.tenant_id,'user-denials-history-v1:'+u.id+':'+String(record.revision).padStart(10,'0'),{cipher:cipher.seal({...record,beforeActions:change.before,reason:change.reason})}]);
   await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,individualDenialKey(u.id),{cipher:cipher.seal(record)}]);
   await audit(c,s.tenant_id,s.user_id,'owner_individual_denials_applied','user',u.id,['before:'+JSON.stringify(change.before),'after:'+JSON.stringify(change.after),'revision:'+record.revision,'reason-sha256:'+cipher.digest(change.reason),'denial_write_does_not_modify_grants',standardChanged?'standard_changed':'standard_unchanged']);
}
