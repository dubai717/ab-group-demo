// Inactive durable technical ingress adapter. No app registration, provider calls or environment reads.
import {randomUUID,createHash} from 'node:crypto';import{z}from'zod';
import{transaction,requireOk}from'./core.js';
import type{WhatsAppIngressSink,WhatsAppWebhookBatch}from'./whatsapp-webhook-boundary.js';
const hex=z.string().regex(/^[a-f0-9]{64}$/),id=z.string().min(1).max(256);
const route={externalId:id,dedupKey:hex,phoneNumberId:z.string().regex(/^\d{1,30}$/),providerAccountId:z.string().regex(/^\d{1,30}$/),centerId:id,companyId:id.nullable(),companyIds:z.array(id).min(1).max(100),companyResolved:z.literal(false),occurredAt:z.iso.datetime()};
const message=z.object({...route,from:z.string().regex(/^[1-9]\d{6,14}$/),type:z.enum(['text','image','document','audio','video','sticker','location','contacts','interactive','button','reaction','unsupported']),text:z.string().max(10000).nullable(),mediaId:id.nullable(),contextId:id.nullable(),financialEffect:z.literal(false)}).strict();
const status=z.object({...route,status:z.enum(['sent','delivered','read','failed']),providerCode:z.number().nullable()}).strict();
const input=z.object({messages:z.array(message).max(1000),statuses:z.array(status).max(1000),financialEffect:z.literal(false)}).strict().refine(v=>v.messages.length+v.statuses.length<=1000);
const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function canonical(value:any,depth=0):any{if(depth>32)throw Error('whatsappIngressDepthReviewRequired');if(Array.isArray(value))return value.map(v=>canonical(v,depth+1));if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k],depth+1)]));return value;}
export function whatsappProviderEventHash(kind:string,phoneNumberId:string,providerAccountId:string,payload:unknown){return digest(canonical({kind,phoneNumberId,providerAccountId,payload}));}
function rawProviderEvents(bytes:Buffer){
 const raw=JSON.parse(bytes.toString('utf8')),out=new Map<string,any>();requireOk(raw.object==='whatsapp_business_account'&&Array.isArray(raw.entry),422,'whatsappIngressEnvelopeRequired');let count=0;
 for(const entry of raw.entry)for(const change of entry.changes||[]){if(change.field!=='messages')continue;const value=change.value,phone=value?.metadata?.phone_number_id;
  for(const [kind,events]of[['message',value?.messages||[]],['status',value?.statuses||[]]]as const)for(const event of events){requireOk(++count<=1000,422,'whatsappIngressLimit');const key=createHash('sha256').update(phone+':'+kind+':'+event.id+(kind==='status'?':'+event.status+':'+event.timestamp:'')).digest('hex'),facts={kind,phoneNumberId:phone,providerAccountId:entry.id,payload:event},hash=whatsappProviderEventHash(kind,phone,entry.id,event);requireOk(!out.has(key)||out.get(key).hash===hash,409,'whatsappIngressContentReviewRequired');out.set(key,{...facts,hash});}
 }return out;
}

export function createWhatsAppIngressStore(config:{mode:'disabled'|'sandbox';pool:any;cipher:any;tenantId:string;processingActorId:string}):WhatsAppIngressSink{
 if(config.mode!=='sandbox')throw Error('whatsappIngressNotEnabled');const tenant=z.uuid().parse(config.tenantId),actor=z.uuid().parse(config.processingActorId);
 // An explicit existing processing principal is not the external message's author.
 return{async commit(raw:WhatsAppWebhookBatch,context:{eventHash:string;signal:AbortSignal;rawEnvelope:Buffer}){
  const batch=input.parse(raw),envelopeHash=hex.parse(context.eventHash);requireOk(Buffer.isBuffer(context.rawEnvelope)&&context.rawEnvelope.length<=2e6&&createHash('sha256').update(context.rawEnvelope).digest('hex')===envelopeHash,422,'whatsappIngressEnvelopeRequired');if(context.signal.aborted)throw Error('whatsappIngressAborted');const providerEvents=rawProviderEvents(context.rawEnvelope);const keys=[...batch.messages,...batch.statuses].map(e=>e.dedupKey);requireOk(keys.length===providerEvents.size&&new Set(keys).size===keys.length,422,'whatsappIngressEnvelopeMismatch');
  await transaction(config.pool,tenant,actor,async c=>{
   await c.query("set local statement_timeout='4000ms'");await c.query("set local lock_timeout='3000ms'");
   if(context.signal.aborted)throw Error('whatsappIngressAborted');
   requireOk((await c.query("select 1 from ab.users where tenant_id=ab.tenant()and id=$1 and role_id='owner'and status='Active'",[actor])).rowCount===1,403,'whatsappIngressPrincipalReviewRequired');
   requireOk((await c.query("select to_regclass('ab.communication_provider_events')ok")).rows[0].ok,503,'whatsappIngressSchemaReviewRequired');
   let inserted=0;
   for(const [kind,events]of[['message',batch.messages],['status',batch.statuses]]as const)for(const event of events){
    if(context.signal.aborted)throw Error('whatsappIngressAborted');
    // Stable provider content excludes mutable configured routing hints and envelope bundling/order.
    const {dedupKey}=event,provider=providerEvents.get(dedupKey);requireOk(provider?.kind===kind&&provider.phoneNumberId===event.phoneNumberId&&provider.providerAccountId===event.providerAccountId,422,'whatsappIngressEnvelopeMismatch');const p=provider.payload;requireOk(event.externalId===p.id&&typeof p.timestamp==='string'&&/^\d{1,12}$/.test(p.timestamp)&&event.occurredAt===new Date(Number(p.timestamp)*1000).toISOString(),422,'whatsappIngressEnvelopeMismatch');if(kind==='message'){const m=event as z.infer<typeof message>;requireOk(m.from===p.from&&m.type===p.type&&m.text===(p.type==='text'?p.text?.body:null)&&m.mediaId===(['image','document','audio','video','sticker'].includes(p.type)?p[p.type]?.id:null)&&m.contextId===(p.context?.id||null),422,'whatsappIngressEnvelopeMismatch');}else{const s=event as z.infer<typeof status>;requireOk(s.status===p.status&&s.providerCode===(typeof p.errors?.[0]?.code==='number'?p.errors[0].code:null),422,'whatsappIngressEnvelopeMismatch');}const payloadHash=provider.hash;
    const added=await c.query("insert into ab.communication_provider_events(tenant_id,id,provider,event_key,event_kind,payload_hash,envelope_hash,payload_cipher,received_by)values($1,$2,'meta_cloud',$3,$4,$5,$6,$7,$8)on conflict(tenant_id,provider,event_key)do nothing",[tenant,randomUUID(),dedupKey,kind,payloadHash,envelopeHash,config.cipher.seal({kind,event}),actor]);
    inserted+=added.rowCount||0;
    const saved=(await c.query("select event_kind,payload_hash from ab.communication_provider_events where tenant_id=$1 and provider='meta_cloud'and event_key=$2",[tenant,dedupKey])).rows[0];
    requireOk(saved?.event_kind===kind&&saved?.payload_hash===payloadHash,409,'whatsappIngressContentReviewRequired');
   }
   if(inserted)await c.query("insert into ab.communication_provider_envelopes(tenant_id,envelope_hash,payload_cipher,received_by)values($1,$2,$3,$4)on conflict(tenant_id,envelope_hash)do nothing",[tenant,envelopeHash,config.cipher.seal({base64:context.rawEnvelope.toString('base64')}),actor]);
   if(context.signal.aborted)throw Error('whatsappIngressAborted');
  });
  return{committed:true};
 }};
}
