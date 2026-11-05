// Inspection only: no source DML, deletion executor, privilege changes or trigger bypass.
import {PoolClient} from 'pg';
import {requireOk,sha} from '../src/core.js';
import {DataManifest,TEST_DATA_KEY} from '../src/test-data-manifest.js';
export const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
const uuid=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi;
export const protectedTables=new Set(['organizations','users','roles','permissions','role_permissions','user_companies','permission_grants','departments','sessions','contact_channels','audit_events','emirates','areas']);
export function classify(table:string,key:string,version:string,d:DataManifest){
 if(protectedTables.has(table))return 'protected';
 if(table==='settings'){
  const parts=JSON.parse(key);if(parts[1]===TEST_DATA_KEY)return 'manifest';
  if(!(d.sharedSettingsTouches||[]).includes(key)||!d.companies.some(c=>String(parts[1]).includes(c.id)))return 'shared';
 }
 return version===d.provenanceRepair?.transaction?'candidate':'modified';
}
export function references(body:any,cipher:any,candidates?:Set<string>){const found=new Set<string>();let opaque=0;
 const walk=(v:any,key='',depth=0)=>{if(depth>24){opaque++;return;}if(Array.isArray(v)){for(const x of v)walk(x,key,depth+1);return;}
  if(v&&typeof v==='object'){for(const [k,x]of Object.entries(v))walk(x,k,depth+1);return;}
  if(typeof v!=='string')return;
  if(/cipher|sealed/i.test(key)&&v){try{walk(cipher.open(v),'',depth+1);}catch{opaque++;}return;}
  if(candidates?.has(v))found.add(v);for(const id of v.match(uuid)||[])found.add(id.toLowerCase());
 };walk(body);return {ids:found,opaque};
}
export async function cleanupPreview(c:PoolClient,cipher:any,d:DataManifest,registry:any){
 requireOk(d.marker==='TEST_DATA'&&d.version===1&&d.state==='ready'&&d.tenant===registry.tenant&&d.owner===registry.owner&&/^\d+$/.test(d.provenanceRepair?.transaction||''),409,'cleanupScopeNeedsReview');
 const catalog=(await c.query("select t.oid::int oid,t.relname name,array_agg(a.attname::text order by k.n)pk from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_index i on i.indrelid=t.oid and i.indisprimary join lateral unnest(i.indkey)with ordinality k(num,n)on true join pg_attribute a on a.attrelid=t.oid and a.attnum=k.num where n.nspname='ab'and t.relkind='r'and exists(select 1 from pg_attribute x where x.attrelid=t.oid and x.attname='tenant_id')group by t.oid,t.relname order by t.relname")).rows;
 const tables=new Map<string,any>(catalog.map(t=>[t.name,t])),all=new Map<string,any[]>(),candidate=new Map<string,Set<string>>(),held:any[]=[],missing:any[]=[],protectedCounts:Record<string,number>={};
 const wanted:Record<string,Set<string>>={};for(const [table,keys]of Object.entries(d.tags))wanted[table]=new Set(keys);
 for(const key of d.sharedSettingsTouches||[])(wanted.settings??=new Set()).add(key);
 let rowsSeen=0;
 for(const table of catalog){const pk='jsonb_build_array('+table.pk.map((p:string)=>'x.'+quote(p)).join(',')+')::text';const rows=(await c.query('select '+pk+' k,x.tenant_id::text tenant,x.xmin::text version,md5(row_to_json(x)::text)hash,to_jsonb(x)body from ab.'+quote(table.name)+' x')).rows;rowsSeen+=rows.length;requireOk(rowsSeen<=100000,409,'previewRowLimitNeedsReview');all.set(table.name,rows);
  const keys=wanted[table.name];if(!keys)continue;
  for(const row of rows){if(row.tenant!==d.tenant||!keys.has(row.k))continue;const kind=classify(table.name,row.k,row.version,d);if(kind==='candidate'){if(!candidate.has(table.name))candidate.set(table.name,new Set());candidate.get(table.name)!.add(row.k);}else{held.push({table:table.name,key:row.k,hash:row.hash,kind});protectedCounts[table.name]=(protectedCounts[table.name]||0)+1;}}
  const existing=new Set(rows.filter(r=>r.tenant===d.tenant).map(r=>r.k));for(const k of keys)if(!existing.has(k))missing.push({table:table.name,key:k});
 }
 for(const name of Object.keys(wanted))requireOk(tables.has(name),409,'unknownProvenanceTable');
 const ids=new Set<string>();for(const [name,keys]of candidate)for(const k of keys){const parts=JSON.parse(k),pk=tables.get(name).pk;for(let i=0;i<pk.length;i++){const v=parts[i];if(typeof v==='string'&&v!==d.tenant&&(pk[i]==='id'||pk[i].endsWith('_id')||name==='settings'&&pk[i]==='key')){ids.add(v);for(const id of v.match(uuid)||[])ids.add(id.toLowerCase());}}}
 const exactRoot=(table:string,values:string[])=>values.filter(id=>(all.get(table)||[]).some(r=>r.tenant===d.tenant&&r.body.id===id)).length;
 const originalCounts={companies:exactRoot('companies',d.companies.map(x=>x.id)),banks:exactRoot('bank_accounts',d.banks.map(x=>x.id)),customers:exactRoot('customers',d.customers.map(x=>x.id)),vehicles:exactRoot('vehicles',d.vehicles.map(x=>x.id)),financings:exactRoot('vehicle_requests',d.financings),invoices:exactRoot('vehicle_invoices',(d.tags.vehicle_invoices||[]).map(k=>JSON.parse(k)[0])),receipts:exactRoot('finance_receipts',d.receipts),tasks:exactRoot('tasks',d.tasks),alerts:exactRoot('finance_notifications',(d.tags.finance_notifications||[]).map(k=>JSON.parse(k)[0]))};
 const fks=(await c.query("select k.conname name,cn.nspname child_schema,ct.relname child,pn.nspname parent_schema,pt.relname parent,k.confdeltype deletion,array_agg(ca.attname::text order by x.n)child_columns,array_agg(pa.attname::text order by x.n)parent_columns from pg_constraint k join pg_class ct on ct.oid=k.conrelid join pg_namespace cn on cn.oid=ct.relnamespace join pg_class pt on pt.oid=k.confrelid join pg_namespace pn on pn.oid=pt.relnamespace join lateral unnest(k.conkey,k.confkey)with ordinality x(ca,pa,n)on true join pg_attribute ca on ca.attrelid=ct.oid and ca.attnum=x.ca join pg_attribute pa on pa.attrelid=pt.oid and pa.attnum=x.pa where k.contype='f'and pn.nspname='ab'group by k.oid,k.conname,cn.nspname,ct.relname,pn.nspname,pt.relname,k.confdeltype order by pn.nspname,pt.relname,cn.nspname,ct.relname,k.conname")).rows;
 const externalFK:any[]=[],internalFK:any[]=[],uninspectable:any[]=[];
 for(const fk of fks){const targets=candidate.get(fk.parent);if(!targets?.size)continue;const parent=tables.get(fk.parent),child=fk.child_schema==='ab'?tables.get(fk.child):null;
  if(!child){uninspectable.push({constraint:fk.name,child:fk.child_schema+'.'+fk.child,parent:fk.parent});continue;}
  const join=fk.child_columns.map((v:string,i:number)=>'c.'+quote(v)+'=p.'+quote(fk.parent_columns[i])).join(' and '),ppk='jsonb_build_array('+parent.pk.map((p:string)=>'p.'+quote(p)).join(',')+')::text',cpk='jsonb_build_array('+child.pk.map((p:string)=>'c.'+quote(p)).join(',')+')::text';
  const refs=(await c.query('select '+cpk+' k from ab.'+quote(fk.child)+' c join ab.'+quote(fk.parent)+' p on '+join+' where '+ppk+'=any($1::text[])',[Array.from(targets)])).rows;const outside=refs.filter(r=>!candidate.get(fk.child)?.has(r.k));
  if(outside.length)externalFK.push({constraint:fk.name,child:fk.child,parent:fk.parent,count:outside.length,keys:outside.map(r=>r.k),onDelete:fk.deletion});
  if(refs.length>outside.length)internalFK.push({constraint:fk.name,child:fk.child,parent:fk.parent,count:refs.length-outside.length,onDelete:fk.deletion});
 }
 const externalJSON:any[]=[],auditHistory:any[]=[],opaque:any[]=[];
 for(const [table,rows]of all)for(const row of rows){if(candidate.get(table)?.has(row.k))continue;if(table==='settings'&&row.tenant===d.tenant&&row.body.key===TEST_DATA_KEY)continue;
  const decoded=references(row.body,cipher,ids),matches=[...decoded.ids].filter(id=>ids.has(id));if(decoded.opaque)opaque.push({table,key:row.k,fields:decoded.opaque});
  if(matches.length)(table==='audit_events'?auditHistory:externalJSON).push({table,key:row.k,hash:row.hash,targetIds:matches});
 }
 const triggers=(await c.query("select c.relname table_name,t.tgname name,p.proname function_name,pg_get_triggerdef(t.oid)definition,pg_get_functiondef(p.oid)function_source,t.tgenabled enabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='ab'and not t.tgisinternal and(t.tgtype::int&8)<>0 order by c.relname,t.tgname")).rows.filter(t=>candidate.has(t.table_name));
 const files=Object.keys(d.objects),fileRefs:any[]=[];for(const name of ['document_versions','customer_files','vehicle_files'])for(const row of all.get(name)||[])if(files.includes(row.body.storage_key)&&!candidate.get(name)?.has(row.k))fileRefs.push({table:name,key:row.k});
 const selectedRows:any[]=[];for(const [table,keys]of candidate)for(const r of all.get(table)||[])if(keys.has(r.k))selectedRows.push({table,key:r.k,hash:r.hash,version:r.version});
 selectedRows.sort((a,b)=>a.table.localeCompare(b.table)||a.key.localeCompare(b.key));
 const protectedUsers=(all.get('users')||[]).filter(r=>registry.users.some((u:any)=>u.id===r.body.id));requireOk(protectedUsers.length===10&&registry.users.every((u:any)=>protectedUsers.some(r=>r.body.id===u.id&&r.body.auth_id===u.authId&&r.body.role_id===u.role)),409,'managedUserProtectionMismatch');
 const fingerprint=sha(JSON.stringify({format:'AB-CLEANUP-SCOPE-1',suite:registry.suite,tenant:d.tenant,key:TEST_DATA_KEY,selectedRows,held,missing,externalFK,externalJSON,opaque,uninspectable,deleteGuards:triggers.map(t=>({table:t.table_name,name:t.name,enabled:t.enabled,definition:t.definition,functionHash:sha(t.function_source)})),files:files.map(k=>({key:k,sha:sha(Buffer.from(d.objects[k],'base64'))}))}));
 return {format:'AB-CLEANUP-PREVIEW-1',createdAt:new Date().toISOString(),suite:registry.suite,tenant:d.tenant,manifest:TEST_DATA_KEY,creationTransaction:d.provenanceRepair!.transaction,fingerprint,readOnly:true,approvalRequired:true,originalCounts,tableCounts:Object.fromEntries([...candidate].map(([name,k])=>[name,k.size])),selectedRows,held,protectedCounts,missing,externalFK,internalFK,externalJSON,auditHistoryReferences:auditHistory.length,opaque,uninspectable,deleteGuards:triggers,privateObjects:files.map(k=>({key:k,sha:sha(Buffer.from(d.objects[k],'base64'))})),externalFileReferences:fileRefs,protectedManagedUsers:10,protectedUserSignatures:protectedUsers.map(r=>({key:r.k,hash:r.hash})),blockers:{foreignKeys:externalFK.length,jsonReferences:externalJSON.length,opaqueFields:opaque.length,unknownRelations:uninspectable.length,modifiedRows:held.filter(r=>r.kind==='modified').length,missingRows:missing.length,deleteTriggers:triggers.length,sharedObjects:fileRefs.length}};
}
