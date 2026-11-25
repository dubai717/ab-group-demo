// Official Meta Cloud API HTTP boundary only. Not registered by the application.
// No provider calls, credentials discovery, inferred staff author or financial writes.
import {createHash} from 'node:crypto';
import {normalizeWhatsAppWebhook,whatsappChallenge,validateWhatsAppBindings,type WhatsAppBinding} from './whatsapp-cloud-contract.js';
export type WhatsAppWebhookBatch=ReturnType<typeof normalizeWhatsAppWebhook>;
export interface WhatsAppIngressSink{
 // The original message adapter must durably deduplicate each normalized dedupKey.
 // Return committed only after its original transaction actually commits.
 commit(batch:WhatsAppWebhookBatch,context:{eventHash:string;signal:AbortSignal;rawEnvelope:Buffer}):Promise<{committed:true}>;
}
export async function registerWhatsAppWebhookBoundary(app:any,config:{mode:'disabled'|'sandbox';appSecret?:string;verifyToken?:string;bindings?:WhatsAppBinding[];sink?:WhatsAppIngressSink}){
 if(config.mode==='disabled')return{registered:false,externalSendingEnabled:false};
 if(config.mode!=='sandbox'||!config.appSecret||config.appSecret.trim().length<16||!config.verifyToken||config.verifyToken.trim().length<16||!config.bindings?.length||!config.sink)throw Error('whatsappSandboxIngressReviewRequired');
 let bindings:WhatsAppBinding[];try{bindings=validateWhatsAppBindings(config.bindings);}catch{throw Error('whatsappSandboxIngressReviewRequired');}
 const secret=config.appSecret,token=config.verifyToken,sink=config.sink;let active=0;
 await app.register(async(child:any)=>{
  // Plugin-scoped raw bytes: do not replace the application's login/API JSON parser.
  child.removeContentTypeParser('application/json');
  child.addContentTypeParser('application/json',{parseAs:'buffer',bodyLimit:2e6},(_req:any,body:Buffer,done:any)=>done(null,body));
  child.get('/api/integrations/whatsapp/webhook',async(req:any,reply:any)=>{
   const challenge=whatsappChallenge(req.query,token);if(challenge===null)return reply.code(403).send({error:'whatsappVerificationRejected',reference:req.id});
   return reply.type('text/plain').send(challenge);
  });
  child.post('/api/integrations/whatsapp/webhook',{bodyLimit:2e6},async(req:any,reply:any)=>{
   const rejected=(status:number,error:string)=>reply.code(status).send({error,reference:req.id});
   if(!Buffer.isBuffer(req.body))return rejected(400,'whatsappWebhookRejected');
   let batch:WhatsAppWebhookBatch;
   try{batch=normalizeWhatsAppWebhook(req.body,typeof req.headers['x-hub-signature-256']==='string'?req.headers['x-hub-signature-256']:undefined,secret,bindings);}catch{return rejected(400,'whatsappWebhookRejected');}
   if(active>=4)return rejected(503,'whatsappIngressBusy');active++;
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
   try{
    const context={eventHash:createHash('sha256').update(req.body).digest('hex'),signal:controller.signal,rawEnvelope:req.body};
    const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('whatsappIngressDeadline'));},5000);});
    // A timeout may follow a real commit. Retry safety belongs to the original sink's stable keys.
    const work=Promise.resolve().then(()=>sink.commit(batch,context)).finally(()=>{active--;});
    const result=await Promise.race([work,deadline]);
    if(result?.committed!==true)return rejected(503,'whatsappIngressUnavailable');
    return{received:true,externalSent:false,financialEffect:false};
   }catch{return rejected(503,'whatsappIngressUnavailable');}finally{if(timer)clearTimeout(timer);controller.abort();}
  });
 });
 return{registered:true,mode:'sandbox',externalSendingEnabled:false};
}
