import {investorRegistryDocumentRead} from './investor-registry.js';
import {investorEvidenceRead} from './investor-evidence.js';
import { documentSearchTokens,normalizeDocumentText,indexDocumentText } from './document-text.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireOk, ApiError, sha } from './core.js';
import { audit } from './data.js';
import { documentRight } from './document-access.js';
import { customerCan } from './customers.js';
import { vehicleRight } from './vehicle-domain.js';
import { employee,hrRight } from './personnel-domain.js';
import { attachmentRoot } from './attachment-history.js';

const kind=z.enum(['document','customer','vehicle']);
const schema=z.object({q:z.string().max(200).default(''),companyId:z.uuid().optional(),customerId:z.uuid().optional(),vehicleId:z.uuid().optional(),type:z.string().max(60).optional(),from:z.iso.date().optional(),to:z.iso.date().optional(),archive:z.enum(['current','archived','all']).default('current')}).strict();
async function permitted(fn:()=>Promise<any>|any){try{await fn();return true;}catch(e){if(e instanceof ApiError&&[403,404].includes(e.status))return false;throw e;}}
export function registerDocumentCenter(app:any,call:any,cipher:any,options:any){
    async function authorize(c:any,m:any,source:string,r:any,write=false){
        if(source==='customer'){requireOk(customerCan(m,'documents',r.company_id));return;}
        if(source==='vehicle'){requireOk(vehicleRight(m,'documents',r.company_id));return;}
        if(r.employee_id){const e=await employee(c,m,r.employee_id);requireOk(hrRight(m,write?'document_update':'documents',e.company_id)||e.user_id===m.actor.id);return;}
        if(r.personnel_library_id){const l=(await c.query('select * from ab.hr_library where id=$1',[r.personnel_library_id])).rows[0];requireOk(l,404,'notFound');requireOk(hrRight(m,write?'library_manage':'library_download',l.company_id));const p=cipher.open(l.payload_cipher);requireOk(write||m.actor.roleId==='owner'||!p.readerIds?.length||p.readerIds.includes(m.actor.id));return;}
        r.investor_registry=await investorRegistryDocumentRead(c,m,r.id);if(r.category==='investorEvidence')r.investor_evidence=await investorEvidenceRead(c,m,r.id);documentRight(m,r,write);
    }
    async function original(c:any,m:any,source:string,id:string,write=false){
        const table=source==='document'?'documents':source==='customer'?'customer_files':'vehicle_files';
        const r=(await c.query('select * from ab.'+table+' where id=$1',[id])).rows[0];requireOk(r,404,'notFound');await authorize(c,m,source,r,write);
        const root=source==='document'?r.id:await attachmentRoot(c,table as 'customer_files'|'vehicle_files',r.id);
        return {row:r,root,table,column:source==='document'?'document_id':source==='customer'?'customer_file_id':'vehicle_file_id'};
    }
    async function targetAllowed(c:any,m:any,d:any){
        if(d.companyId){documentRight(m,{company_id:d.companyId},false);return;}
        if(d.customerId){const r=(await c.query('select company_id from ab.customers where id=$1',[d.customerId])).rows[0];requireOk(r&&customerCan(m,'documents',r.company_id));return;}
        const r=(await c.query('select company_id from ab.vehicles where id=$1',[d.vehicleId])).rows[0];requireOk(r&&vehicleRight(m,'documents',r.company_id));
    }
    const route=(fn:any)=>call(async(c:any,m:any,s:any,req:any)=>{if(req.method!=='GET')requireOk(req.headers['idempotency-key'],422,'idempotencyRequired');return fn(c,m,s,req);});
    app.get('/api/document-center',route(async(c:any,m:any,_s:any,req:any)=>{
        const q=schema.parse(req.query),available=!!(await c.query("select to_regclass('ab.document_archive_events') ok")).rows[0].ok;
        const sources:any[]=[];
        const docRows=(await c.query(`select d.*,v.id version_id,v.version,v.original_name,v.title version_title,v.category version_category,v.document_date version_date,v.mime,v.size,v.scan_status,v.created_at version_created_at from ab.documents d join ab.document_versions v on v.document_id=d.id order by v.created_at desc limit 20001`)).rows;
        requireOk(docRows.length<=20000,422,'registerTooLarge');
        for(const r of docRows){
            if(!await permitted(()=>authorize(c,m,'document',r)))continue;
            let meta:any={name:r.original_name,title:r.version_title,kind:r.version_category};let companyId=r.company_id,endpoint='documents/'+r.version_id+'/file';
            if(r.employee_id){const rec=(await c.query('select r.payload_cipher,r.expires_on,e.company_id from ab.hr_document_records r join ab.hr_employees e on e.id=r.employee_id where r.version_id=$1',[r.version_id])).rows[0];if(!rec)continue;meta={...cipher.open(rec.payload_cipher),expiresOn:rec.expires_on};companyId=rec.company_id;endpoint='personnel/employees/'+r.employee_id+'/documents/'+r.version_id;}
            else if(r.personnel_library_id){const rec=(await c.query('select v.payload_cipher,l.company_id from ab.hr_library_versions v join ab.hr_library l on l.id=v.library_id where v.version_id=$1',[r.version_id])).rows[0];if(!rec)continue;meta=cipher.open(rec.payload_cipher);companyId=rec.company_id;endpoint='personnel/library/'+r.personnel_library_id+'/documents/'+r.version_id;}
            if(r.bank_account_id)companyId=m.state.bankAccounts.find((b:any)=>b.id===r.bank_account_id)?.companyId;
            sources.push({source:'document',canManage:await permitted(()=>authorize(c,m,'document',r,true)),id:r.id,versionId:r.version_id,version:r.version,companyId,name:meta.name,title:meta.title,type:meta.kind,mime:r.mime,size:r.size,scanStatus:r.scan_status,date:r.version_date,createdAt:r.version_created_at,expiresOn:meta.expiresOn||null,endpoint});
        }
        for(const source of ['customer','vehicle']){
            if(!(await c.query('select to_regclass($1) ok',['ab.'+source+'_files'])).rows[0].ok)continue;
            const owner=source+'_id',table=source+'_files';
            const rows=(await c.query('select * from ab.'+table+' order by created_at desc limit 20001')).rows;requireOk(rows.length<=20000,422,'registerTooLarge');
            for(const r of rows){if(!await permitted(()=>authorize(c,m,source,r)))continue;const meta=cipher.open(r.payload_cipher),root=await attachmentRoot(c,table as 'customer_files'|'vehicle_files',r.id);sources.push({source,canManage:await permitted(()=>authorize(c,m,source,r,true)),id:root,versionId:r.id,version:r.version,companyId:r.company_id,[source+'Id']:r[owner],name:meta.name,title:meta.title,type:meta.kind,mime:r.mime,size:r.size,scanStatus:r.scan_status,date:meta.issuedOn||r.created_at,createdAt:r.created_at,expiresOn:meta.expiresOn||null,endpoint:source+'s/'+r[owner]+'/files/'+r.id});}
        }
        const archiveRows=available?(await c.query('select document_id,customer_file_id,vehicle_file_id,action from ab.document_archive_events order by created_at desc,id desc')).rows:[];
        const archiveState=new Map<string,string>();for(const r of archiveRows){const k=r.document_id?'document:'+r.document_id:r.customer_file_id?'customer:'+r.customer_file_id:'vehicle:'+r.vehicle_file_id;if(!archiveState.has(k))archiveState.set(k,r.action);}
        const withdrawnRows=(await c.query("select entity_type,entity_id from ab.audit_events where action='attachment_withdrawn'")).rows;
        const withdrawnSet=new Set(withdrawnRows.map((r:any)=>r.entity_type+':'+r.entity_id));
        const linkRows=available?(await c.query('select document_id,customer_file_id,vehicle_file_id,company_id,customer_id,vehicle_id from ab.document_links')).rows:[];
        const bySource=new Map<string,any[]>();for(const r of linkRows){const k=r.document_id?'document:'+r.document_id:r.customer_file_id?'customer:'+r.customer_file_id:'vehicle:'+r.vehicle_file_id;const list=bySource.get(k)||[];list.push(r);bySource.set(k,list);}
        const targetCache=new Map<string,boolean>();
        const textReady=!!(await c.query("select to_regclass('ab.document_text_index') ok")).rows[0].ok;const textIds=new Set<string>();if(textReady&&q.q){const tokens=documentSearchTokens(cipher,q.q);if(tokens.length&&tokens.length<=32)for(const row of(await c.query("select version_id,customer_file_id,vehicle_file_id from ab.document_text_index where status='indexed' and search_tokens @> $1::text[]",[tokens])).rows)textIds.add(row.version_id||row.customer_file_id||row.vehicle_file_id);}
        const out=[];
        for(const r of sources){
                        const archive=archiveState.get(r.source+':'+r.id)==='archive';
            const withdrawn=withdrawnSet.has((r.source==='document'?'document':r.source+'_file')+':'+r.id);
            const linked=bySource.get(r.source+':'+r.id)||[];
            const links=[];for(const l of linked){const key=JSON.stringify([l.company_id,l.customer_id,l.vehicle_id]);if(!targetCache.has(key))targetCache.set(key,await permitted(()=>targetAllowed(c,m,{companyId:l.company_id,customerId:l.customer_id,vehicleId:l.vehicle_id})));if(targetCache.get(key))links.push({companyId:l.company_id,customerId:l.customer_id,vehicleId:l.vehicle_id});}
            const entityMatch=(!q.companyId||r.companyId===q.companyId||links.some(l=>l.companyId===q.companyId))&&(!q.customerId||r.customerId===q.customerId||links.some(l=>l.customerId===q.customerId))&&(!q.vehicleId||r.vehicleId===q.vehicleId||links.some(l=>l.vehicleId===q.vehicleId));
            const date=r.date instanceof Date?r.date.toISOString().slice(0,10):String(r.date||'').slice(0,10);
            if(!entityMatch||q.type&&r.type!==q.type||q.from&&date<q.from||q.to&&date>q.to)continue;
            if(q.archive==='current'&&(archive||withdrawn)||q.archive==='archived'&&!archive)continue;
            const words=normalizeDocumentText([r.name,r.title,r.type,date].join(' '));if(q.q&&!words.includes(normalizeDocumentText(q.q))&&!textIds.has(r.versionId))continue;
            out.push({...r,date,archived:archive,withdrawn,links});
        }
        return {rows:out,archiveAvailable:available,contentSearch:textReady,contentSearchMode:'PDF text layers and metadata; no OCR or AI',ai:'notActivated',ocr:'notActivated',originalStorageOnly:true};
    }));
    app.post('/api/document-center/:source/:id/archive',route(async(c:any,m:any,s:any,req:any)=>{
        const d=z.object({action:z.enum(['archive','restore']),reason:z.string().trim().min(1).max(2000)}).strict().parse(req.body),source=kind.parse(req.params.source),r=await original(c,m,source,z.uuid().parse(req.params.id),true);
        requireOk((await c.query("select to_regclass('ab.document_archive_events') ok")).rows[0].ok,503,'documentCenterMigrationPending');
        await c.query('select pg_advisory_xact_lock(hashtext($1))',['archive:'+r.root]);
        const latest=(await c.query('select action from ab.document_archive_events where '+r.column+'=$1 order by created_at desc,id desc limit 1',[r.root])).rows[0]?.action;
        requireOk(latest!==d.action&&(d.action==='archive'||latest==='archive'),409,'archiveStateConflict');
        await c.query('insert into ab.document_archive_events(id,tenant_id,'+r.column+',action,reason_cipher,created_by)values($1,$2,$3,$4,$5,$6)',[randomUUID(),s.tenant_id,r.root,d.action,cipher.seal({reason:d.reason}),s.user_id]);
        await audit(c,s.tenant_id,s.user_id,'document_'+d.action,'document_center',r.root,['state']);return {saved:true,archived:d.action==='archive',fileDeleted:false};
    }));
    app.get('/api/document-center/:source/:id/link-options',route(async(c:any,m:any,_s:any,req:any)=>{await original(c,m,z.enum(['document','customer','vehicle']).parse(req.params.source),z.uuid().parse(req.params.id),true);const options:any[]=[];for(const [type,table]of [['company','companies'],['customer','customers'],['vehicle','vehicles']]){const rows=(await c.query('select * from ab.'+table+' limit 20001')).rows;requireOk(rows.length<=20000,422,'registerTooLarge');for(const r of rows){try{await targetAllowed(c,m,{[type+'Id']:r.id});const p=type==='company'?r.data:cipher.open(r.payload_cipher);options.push({type,id:r.id,name:p.arabicName||p.englishName||p.fullName||p.plate||r.id});}catch(e:any){if(![403,404].includes(e.status))throw e;}}}return {options,originalFilesOnly:true};}));
    app.post('/api/document-center/:source/:id/links',route(async(c:any,m:any,s:any,req:any)=>{
        const d=z.object({companyId:z.uuid().optional(),customerId:z.uuid().optional(),vehicleId:z.uuid().optional()}).strict().refine(v=>Object.values(v).filter(Boolean).length===1).parse(req.body),source=kind.parse(req.params.source),r=await original(c,m,source,z.uuid().parse(req.params.id),true);await targetAllowed(c,m,d);
        requireOk((await c.query("select to_regclass('ab.document_links') ok")).rows[0].ok,503,'documentCenterMigrationPending');
        const target=d.companyId?'company_id':d.customerId?'customer_id':'vehicle_id';
        const inserted=await c.query('insert into ab.document_links(id,tenant_id,'+r.column+','+target+',created_by)values($1,$2,$3,$4,$5) on conflict do nothing returning id',[randomUUID(),s.tenant_id,r.root,d.companyId||d.customerId||d.vehicleId,s.user_id]);
        if(inserted.rowCount)await audit(c,s.tenant_id,s.user_id,'document_linked','document_center',r.root,[target]);return {saved:true,created:!!inserted.rowCount,storageDuplicated:false};
    }));
    app.post('/api/document-center/:source/:id/index-text',route(async(c:any,m:any,s:any,req:any)=>{
        const source=kind.parse(req.params.source),r=await original(c,m,source,z.uuid().parse(req.params.id)),d=z.object({versionId:z.uuid()}).strict().parse(req.body);
        requireOk((await c.query("select to_regclass('ab.document_text_index') ok")).rows[0].ok,503,'documentTextMigrationPending');let file:any,column:'version_id'|'customer_file_id'|'vehicle_file_id';
        if(source==='document'){file=(await c.query('select * from ab.document_versions where id=$1 and document_id=$2',[d.versionId,r.root])).rows[0];column='version_id';}
        else{file=(await c.query('select * from ab.'+r.table+' where id=$1',[d.versionId])).rows[0];column=source==='customer'?'customer_file_id':'vehicle_file_id';requireOk(file&&await attachmentRoot(c,r.table as 'customer_files'|'vehicle_files',file.id)===r.root,404,'notFound');}
        requireOk(file,404,'notFound');requireOk(file.scan_status==='clean',423,'fileQuarantined');const bytes=Buffer.from(cipher.open((await options.objects.get(file.storage_key)).toString()).bytes,'base64');
        requireOk(sha(bytes)===(file.sha256||file.digest),502,'integrityFailed');
        const result=await indexDocumentText(c,cipher,s,column,file.id,bytes,file.mime,file.scan_status);await audit(c,s.tenant_id,s.user_id,'document_text_indexed','document_center',r.root,['text_layer']);return {...result,originalFileChanged:false,aiUsed:false};
    }));

}
