// Owner source administration only; geographic permission application is a separate review.
import{randomUUID}from'node:crypto';import{z}from'zod';import{ApiError,requireOk}from'./core.js';import{audit,model}from'./data.js';import{operatingCentrePayload,operatingCentreSnapshot}from'./operating-centres.js';import{operatingCentreWriterSourceReady}from'./operating-centre-schema.js';
const uuid=z.uuid().transform(v=>v.toLowerCase()),name=z.string().trim().min(1).max(160);
export const operatingCentreDraft=z.object({centreId:uuid,revision:z.number().int().min(0),effectiveOn:z.iso.date(),state:z.enum(['Active','Inactive']),emirateId:z.string().min(1).max(100),areaId:z.string().min(1).max(200).nullable(),companyIds:z.array(uuid).max(500).refine(ids=>new Set(ids).size===ids.length),nameAr:name,nameEn:name,reason:z.string().trim().min(1).max(2000)}).strict();
const owner=(m:any,s:any)=>{requireOk(m.actor.roleId==='owner',403,'ownerOnly');requireOk(!s.viewAs,403,'viewAsReadOnly');};
export async function planOperatingCentre(c:any,m:any,s:any,cipher:any,input:unknown){
 owner(m,s);const d=operatingCentreDraft.parse(input);requireOk(await operatingCentreWriterSourceReady(c),503,'operatingCentreSourceReviewRequired');d.companyIds.sort();
 const companies=new Map<string,any>(m.state.companies.map((r:any)=>[r.id,r]));
 const rows=(await c.query(`select v.*,v.effective_on::text effective_on_text,array(select l.company_id from ab.operating_centre_companies l where l.tenant_id=v.tenant_id and l.version_id=v.id order by l.company_id)company_ids from ab.operating_centre_versions v where v.tenant_id=$1 and v.centre_id=$2 order by revision desc limit 1`,[s.tenant_id,d.centreId])).rows;
 const before=rows[0]?operatingCentreSnapshot(rows[0],companies,s.tenant_id,cipher):null;requireOk(d.revision===(before?.revision||0),409,'operatingCentreRevisionChanged');
 const geo=(await c.query('select id,data from ab.emirates where id=$1',[d.emirateId])).rows[0];if(!geo)throw Object.assign(new ApiError(422,'invalid'),{fieldErrors:{emirateId:'invalid'}});
 const area=d.areaId?(await c.query('select id,data from ab.areas where tenant_id=$1 and id=$2 and emirate_id=$3',[s.tenant_id,d.areaId,d.emirateId])).rows[0]:null;if(d.areaId&&!area)throw Object.assign(new ApiError(422,'invalid'),{fieldErrors:{areaId:'invalid'}});
 if(d.companyIds.some(id=>!companies.has(id)||companies.get(id).status!=='Active'&&!before?.companyIds.includes(id)))throw Object.assign(new ApiError(422,'invalid'),{fieldErrors:{companyIds:'invalid'}});
 // Existing future snapshots remain scheduled unless explicitly superseded at their own effective date.
 const scheduled=(await c.query('select id,revision,effective_on::text effective_on from ab.operating_centre_versions where tenant_id=$1 and centre_id=$2 and effective_on>$3::date order by effective_on,revision limit 501',[s.tenant_id,d.centreId,d.effectiveOn])).rows;requireOk(scheduled.length<=500,422,'operatingCentreDirectoryReviewRequired');
 const after={...d,revision:d.revision+1},companyFacts=d.companyIds.map(id=>{const r=companies.get(id);return{id,nameAr:r.arabicName,nameEn:r.englishName,state:r.status,revision:r.revision};});
 return{before,after,companyFacts,geographyFacts:{emirate:geo,area},scheduledSnapshotsRetained:scheduled,authorityChanged:false,financialEffect:false,requiresSeparateScopeReview:true,planHash:cipher.digest(JSON.stringify({before,after,companyFacts,geo,area,scheduled,source:rows[0]?.payload_cipher||null,actor:s.user_id,tenantId:s.tenant_id}))};
}
export async function applyOperatingCentre(c:any,m:any,s:any,cipher:any,request:any){
 owner(m,s);requireOk(request.headers['idempotency-key'],422,'idempotencyRequired');const d=operatingCentreDraft.extend({confirm:z.literal(true),planHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(request.body);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenant_id+':operating-centre:'+d.centreId]);const fresh=await model(c,s.user_id,cipher),{confirm,planHash,...input}=d,p=await planOperatingCentre(c,fresh,s,cipher,input);requireOk(p.planHash===planHash,409,'operatingCentrePlanChanged');
 const sourceId=randomUUID(),payload=operatingCentrePayload.parse({format:'operating-centre-v1',tenantId:s.tenant_id,sourceId,...p.after}),sealed=cipher.seal(payload);
 await c.query('insert into ab.operating_centre_versions(id,tenant_id,centre_id,revision,previous_id,effective_on,emirate_id,area_id,state,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[sourceId,s.tenant_id,p.after.centreId,p.after.revision,p.before?.sourceId||null,p.after.effectiveOn,p.after.emirateId,p.after.areaId,p.after.state,sealed,s.user_id]);
 for(const companyId of p.after.companyIds)await c.query('insert into ab.operating_centre_companies(tenant_id,version_id,company_id)values($1,$2,$3)',[s.tenant_id,sourceId,companyId]);
 await audit(c,s.tenant_id,s.user_id,'operating_centre_snapshot_added','operating_centre',p.after.centreId,['beforeCipher:'+cipher.seal(p.before),'afterCipher:'+sealed,'sourceId:'+sourceId]);
 return{saved:true,id:p.after.centreId,sourceId,revision:p.after.revision,authorityChanged:false,financialEffect:false};
}
// Requires original session/CSRF/request receipts plus the uninstalled candidate schema; no automatic scope changes.
export function registerOperatingCentreWriter(app:any,call:any,cipher:any){app.post('/api/operating-centres/plan',call((c:any,m:any,s:any,r:any)=>planOperatingCentre(c,m,s,cipher,r.body)));app.post('/api/operating-centres/apply',call((c:any,m:any,s:any,r:any)=>applyOperatingCentre(c,m,s,cipher,r)));}
