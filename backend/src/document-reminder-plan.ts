// Read-only projection of an already authorized/current document. No transport or scheduler.
import{z}from'zod';import{createHash}from'node:crypto';
const day=z.iso.date(),id=z.string().min(1).max(256),input=z.object({source:id,id,field:id.optional(),type:id.optional(),versionId:id.nullable().optional(),expiresOn:day,archived:z.boolean().optional(),withdrawn:z.boolean().optional()}).strict();
export function documentReminderPlan(raw:unknown,asOf:string){
 const r=input.parse(raw);day.parse(asOf);const inactive=r.archived||r.withdrawn;
 const events=[30,0].map(daysBefore=>{const scheduledOn=new Date(Date.parse(r.expiresOn+'T00:00:00Z')-daysBefore*86400000).toISOString().slice(0,10),identity={source:r.source,id:r.id,field:r.field||r.type||'',versionId:r.versionId||null,expiresOn:r.expiresOn,daysBefore};return{daysBefore,scheduledOn,key:createHash('sha256').update(JSON.stringify(identity)).digest('hex'),state:inactive?'suppressed':scheduledOn===asOf?'due':scheduledOn>asOf?'future':'past',reason:inactive?'not_current_document':'delivery_configuration_and_consent_required'};});
 return{events,asOf,currentVersionOnly:true,planningOnly:true,externalSent:false,financialEffect:false,serviceFeeAED:'0.000',liveEnabled:false,documentExpiryBlocksCollection:false};
}
