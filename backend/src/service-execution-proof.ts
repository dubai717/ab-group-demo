// Read-only original execution evidence, not a policy override or approval.
// Never trusts request body dates, mutable display metadata or a newly created task as proof of execution.
import{z}from'zod';import{sha}from'./core.js';import{L}from'./ledger-domain.js';
const instant=(v:unknown)=>v instanceof Date&&Number.isFinite(v.getTime())?v.getTime():null;
const dubaiDay=(ms:number)=>new Date(ms+4*3600000).toISOString().slice(0,10);
export async function originalVehicleExecutionProof(c:any,cipher:any,requestId:string){
 requestId=z.uuid().parse(requestId);const context=(await c.query('select ab.tenant()tenant_id')).rows[0],r=(await c.query('select id,tenant_id,company_id,customer_id,finance_type,funding_state,created_at,case when octet_length(payload_cipher)<=65536 then payload_cipher else null end payload_cipher from ab.vehicle_requests where id=$1',[requestId])).rows[0];
 if(!r||r.tenant_id!==context.tenant_id||r.funding_state!=='Approved'||!['group','investor','bank'].includes(r.finance_type))return null;
 const requestAt=instant(r.created_at);if(requestAt===null)return null;let terms:any;try{terms=cipher.open(r.payload_cipher);}catch{return null;}
 const funds=(await c.query("select id,tenant_id,company_id,request_id,receiver_id,amount::text,currency,state,created_at,received_at from ab.vehicle_funds where request_id=$1 and tenant_id=$2 and company_id=$3 limit 2",[r.id,r.tenant_id,r.company_id])).rows;if(funds.length!==1)return null;const f=funds[0],fundedAt=instant(f.created_at),receivedAt=instant(f.received_at);
 if(!['Held','Settled'].includes(f.state)||fundedAt===null||receivedAt===null||requestAt>fundedAt||fundedAt>receivedAt||receivedAt>Date.now()||f.currency!==terms.currency)return null;
 try{if(L.units(f.amount)<=0n||L.units(f.amount)!==L.units(terms.expectedFunding))return null;}catch{return null;}
 const budget=(await c.query("select count(*)::int n,coalesce(sum(bytes),0)::text bytes from(select octet_length(payload_cipher)bytes from ab.vehicle_events where tenant_id=$1 and company_id=$2 and request_id=$3 and kind in('funding_decision','funds_received')order by created_at,id limit 2001)q",[r.tenant_id,r.company_id,r.id])).rows[0];if(!Number.isInteger(budget?.n)||budget.n>2000||!/^\d+$/.test(budget.bytes)||BigInt(budget.bytes)>1048576n)return null;
 const events=(await c.query("select id,tenant_id,company_id,request_id,actor_id,kind,created_at,case when octet_length(payload_cipher)<=65536 then payload_cipher else null end payload_cipher from ab.vehicle_events where tenant_id=$1 and company_id=$2 and request_id=$3 and kind in('funding_decision','funds_received')order by created_at,id limit 2001",[r.tenant_id,r.company_id,r.id])).rows;if(events.length!==budget.n||events.some((e:any)=>typeof e.payload_cipher!=='string')||events.reduce((n:number,e:any)=>n+Buffer.byteLength(e.payload_cipher),0)!==Number(budget.bytes))return null;
 const approved:number[]=[],received:number[]=[];for(const e of events){const at=instant(e.created_at);if(e.tenant_id!==r.tenant_id||e.company_id!==r.company_id||e.request_id!==r.id||at===null||at<requestAt||at>Date.now())continue;let p:any;try{p=cipher.open(e.payload_cipher)?.after;}catch{continue;}
  if(e.kind==='funding_decision'&&p?.approved===true&&(p.decision===undefined||p.decision==='approve')&&at<=fundedAt)approved.push(at);
  if(e.kind==='funds_received'&&p?.state==='Held'&&p.fundsId===f.id&&p.receivedBy===f.receiver_id&&e.actor_id===f.receiver_id&&at>=receivedAt){try{if(L.units(String(p.receivedAmount))===L.units(f.amount))received.push(at);}catch{}}
 }
 if(!approved.length||!received.length)return null;const approvedAt=Math.min(...approved),startedAt=Math.min(...received),existingExecution={requestId:r.id,createdOn:dubaiDay(requestAt),approvedOn:dubaiDay(approvedAt),startedOn:dubaiDay(startedAt),sourceVerified:true as const};
 return{existingExecution,sourceVersion:sha(JSON.stringify({requestId:r.id,requestAt,approvedAt,fundId:f.id,fundedAt,receivedAt,startedAt,amount:f.amount,currency:f.currency,receiverId:f.receiver_id})),source:'original_request_approval_and_matched_actual_funds_receipt',financialEffect:false};
}
