// TEST_DATA fixtures use existing domain services, runtime RLS and an in-process
// adapter which never listens on a network port. Public authentication is unchanged.
import Fastify from 'fastify';
import {createHash,randomUUID} from 'node:crypto';
import {PoolClient} from 'pg';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {ApiError,requireOk,security,sha,ObjectStore} from '../src/core.js';
import {model,persistCompany,persistBank,audit} from '../src/data.js';
import {registerCustomers} from '../src/customers.js';
import {registerVehicles} from '../src/vehicles.js';
import {registerLedger} from '../src/ledger.js';
import {registerPersonnel} from '../src/personnel.js';
export {TEST_DATA_KEY,type DataManifest} from '../src/test-data-manifest.js';
export const dayOffset=(day:string,n:number)=>new Date(Date.parse(day+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export function fictionalIban(n:number){const body='000'+String(n).padStart(16,'0'),rotated=body+'101400';let r=0;for(const c of rotated)r=(r*10+Number(c))%97;return 'AE'+String(98-r).padStart(2,'0')+body;}
export async function syntheticPdf(label:string){const d=await PDFDocument.create(),p=d.addPage([500,240]),f=await d.embedFont(StandardFonts.Helvetica);p.drawText('TEST_DATA - FICTIONAL DOCUMENT ONLY',{x:25,y:180,size:14,font:f});p.drawText(label.replace(/[^a-zA-Z0-9 _-]/g,' ').slice(0,75),{x:25,y:145,size:11,font:f});p.drawText('Not an identity, policy, contract or official evidence.',{x:25,y:110,size:10,font:f});return Buffer.from(await d.save());}
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
export async function tenantKeys(c:PoolClient){
 const tables=(await c.query("select t.relname,array_agg(a.attname order by k.n)pk from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_index i on i.indrelid=t.oid and i.indisprimary join lateral unnest(i.indkey)with ordinality k(num,n)on true join pg_attribute a on a.attrelid=t.oid and a.attnum=k.num where n.nspname='ab'and exists(select 1 from pg_attribute x where x.attrelid=t.oid and x.attname='tenant_id')group by t.relname order by t.relname")).rows;
 const keys:Record<string,string[]>={};for(const t of tables){const pk=Array.isArray(t.pk)?t.pk:[];if(!pk.length)continue;keys[t.relname]=(await c.query('select jsonb_build_array('+pk.map((p:string)=>qi(p)).join(',')+')::text k from ab.'+qi(t.relname)+' where tenant_id=ab.tenant() order by 1')).rows.map(r=>r.k);}return keys;
}
export async function fixtureDriver(c:PoolClient,key:string,tenant:string,owner:string){
 const cipher=security(key),m=await model(c,owner,cipher);requireOk(m.actor.roleId==='owner'&&m.actor.status==='Active',403,'denied');
 const app=Fastify({logger:false,bodyLimit:15*1024*1024}),objects:Record<string,string>={},trusted=new Set<string>(),session={tenant_id:tenant,user_id:owner,actor_type:'user'};
 app.setErrorHandler((e:any,_req,reply)=>reply.code(e.status||e.statusCode||422).send({error:e.code||e.message||'seedRejected'}));
 const call=(fn:any)=>async(req:any)=>fn(c,m,session,req),store:ObjectStore={put:async(k,b)=>{requireOk(!objects[k],409,'objectAlreadyBuffered');objects[k]=b.toString('base64');},get:async k=>{requireOk(objects[k],404,'notFound');return Buffer.from(objects[k],'base64');}};
 const options={objects:store,scan:async(bytes:Buffer)=>trusted.has(sha(bytes))?'clean' as const:'pending' as const};
 registerCustomers(app,call,cipher,options);registerVehicles(app,call,cipher,options);registerLedger(app,call,cipher);registerPersonnel(app,call,cipher,options);await app.ready();
 return {c,cipher,m,objects,session,close:()=>app.close(),
  company:async(d:any,id?:string)=>{const key=await persistCompany(c,m,tenant,d,id);const row=(await c.query('select revision from ab.companies where id=$1',[key])).rows[0];Object.assign(m.state.companies.find((x:any)=>x.id===key),{revision:row.revision});return key;},bank:(d:any)=>persistBank(c,m,cipher,tenant,d),
  reference:async(kind:string,data:any)=>{const row=m.bank.addReference(kind,data);await c.query('insert into ab.bank_references values($1,$2,$3,$4)on conflict do nothing',[tenant,row.id,kind,row]);return row.id;},
  proof:async(url:string,label:string,kind:string)=>{const bytes=await syntheticPdf(label);trusted.add(sha(bytes));const r=await app.inject({method:'POST',url,payload:{name:'TEST_DATA-'+label+'.pdf',title:'TEST_DATA '+label,kind,mime:'application/pdf',base64:bytes.toString('base64')},headers:{'idempotency-key':randomUUID()}});if(r.statusCode!==200)throw new ApiError(r.statusCode,'seedProofRejected');return r.json().id;},
  req:async(method:any,url:string,body?:any)=>{const r=await app.inject({method,url,payload:body,headers:{'idempotency-key':randomUUID()}});if(r.statusCode!==200){const e=r.json();throw new ApiError(r.statusCode,'TEST_DATA '+method+' '+url+' '+String(e.error).slice(0,150));}return r.json();}
 };
}
