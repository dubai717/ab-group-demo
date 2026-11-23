// Physical-centre source reader. No grants or memberships; the separate writer is strictly guarded.
import{z}from'zod';import{ApiError,requireOk}from'./core.js';import{operatingCentreSourceReady}from'./operating-centre-readiness.js';import{operatingCentreWriterSourceReady}from'./operating-centre-schema.js';
export const operatingCentrePayload=z.object({format:z.literal('operating-centre-v1'),tenantId:z.uuid(),centreId:z.uuid(),sourceId:z.uuid(),revision:z.number().int().positive(),effectiveOn:z.iso.date(),state:z.enum(['Active','Inactive']),emirateId:z.string().min(1).max(100),areaId:z.string().min(1).max(200).nullable(),companyIds:z.array(z.uuid()).max(500),nameAr:z.string().trim().min(1).max(160),nameEn:z.string().trim().min(1).max(160),reason:z.string().trim().min(1).max(2000)}).strict();
const todayUAE=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date());
export function operatingCentreSnapshot(row:any,companies:Map<string,any>,tenantId:string,cipher:any){let p:z.infer<typeof operatingCentrePayload>;try{p=operatingCentrePayload.parse(cipher.open(row.payload_cipher));}catch{throw new ApiError(503,'operatingCentreSourceReviewRequired');}
  const companyIds=row.company_ids;requireOk(p.tenantId===tenantId&&p.centreId===row.centre_id&&p.sourceId===row.id&&p.revision===row.revision&&p.effectiveOn===row.effective_on_text&&p.state===row.state&&p.emirateId===row.emirate_id&&p.areaId===row.area_id,503,'operatingCentreSourceReviewRequired');requireOk(Array.isArray(companyIds)&&companyIds.every(id=>typeof id==='string'&&companies.has(id))&&JSON.stringify([...p.companyIds].sort())===JSON.stringify(companyIds),503,'operatingCentreSourceReviewRequired');
 return p;
}
export async function operatingCentreDirectory(c:any,m:any,s:any,cipher:any,query:unknown){
 requireOk(m.actor.roleId==='owner',403,'ownerOnly');requireOk(!s.viewAs,403,'viewAsReadOnly');const q=z.object({asOf:z.iso.date().default(todayUAE()),view:z.enum(['effective','latest']).default('effective')}).strict().parse(query);
 const presence=(await c.query("select to_regclass('ab.operating_centre_versions')versions,to_regclass('ab.operating_centre_companies')links")).rows[0];
 const base={asOf:q.asOf,selection:q.view,readOnly:true,writeReady:false,authorityChanged:false,areaIsNotCentre:true,financialEffect:false};
 if(!presence.versions&&!presence.links)return{...base,available:false,state:'unconfigured',centres:[],sourceVersion:null};
 if(!await operatingCentreSourceReady(c))throw new ApiError(503,'operatingCentreSourceReviewRequired');
 const rows=(await c.query(`with current_sources as(
 select distinct on(centre_id)* from ab.operating_centre_versions where tenant_id=$1 and($3::boolean or effective_on<=$2::date)
 order by centre_id,case when $3::boolean then null::date else effective_on end desc,revision desc)
 select v.*,v.effective_on::text effective_on_text,array(select l.company_id from ab.operating_centre_companies l
 where l.tenant_id=v.tenant_id and l.version_id=v.id order by l.company_id)company_ids
 from current_sources v order by v.centre_id limit 501`,[s.tenant_id,q.asOf,q.view==='latest'])).rows;
 requireOk(rows.length<=500,422,'operatingCentreDirectoryReviewRequired');
 const companies=new Map<string,any>(m.state.companies.map((r:any)=>[r.id,r]));const centres=[];
 for(const row of rows){const p=operatingCentreSnapshot(row,companies,s.tenant_id,cipher),companyIds=row.company_ids;
  centres.push({id:row.centre_id,sourceId:row.id,revision:row.revision,nameAr:p.nameAr,nameEn:p.nameEn,state:row.state,effectiveOn:row.effective_on_text,emirateId:row.emirate_id,areaId:row.area_id,companies:companyIds.map((id:string)=>{const company=companies.get(id);return{id,nameAr:company.arabicName,nameEn:company.englishName,licenseNumber:company.tradeLicenseNumber||null,state:company.status};})});
 }
 return{...base,writeReady:await operatingCentreWriterSourceReady(c),available:true,state:'recorded_readonly',centres,sourceVersion:cipher.digest(JSON.stringify({asOf:q.asOf,view:q.view,centres,sources:rows.map((r:any)=>({id:r.id,payload:r.payload_cipher}))})),source:'explicit_dated_operating_centre_snapshots'};
}
export async function operatingCentreHistory(c:any,m:any,s:any,cipher:any,centreId:string,query:unknown){
 requireOk(m.actor.roleId==='owner',403,'ownerOnly');requireOk(!s.viewAs,403,'viewAsReadOnly');centreId=z.uuid().parse(centreId);const q=z.object({asOf:z.iso.date().default(todayUAE())}).strict().parse(query);requireOk(await operatingCentreSourceReady(c),503,'operatingCentreSourceReviewRequired');
 const rows=(await c.query(`select v.*,v.effective_on::text effective_on_text,array(select l.company_id from ab.operating_centre_companies l where l.tenant_id=v.tenant_id and l.version_id=v.id order by l.company_id)company_ids from ab.operating_centre_versions v where v.tenant_id=$1 and v.centre_id=$2 order by revision desc limit 501`,[s.tenant_id,centreId])).rows;requireOk(rows.length,404,'notFound');requireOk(rows.length<=500,422,'operatingCentreDirectoryReviewRequired');const companies=new Map<string,any>(m.state.companies.map((r:any)=>[r.id,r]));
 const history=rows.map((row:any)=>{const p=operatingCentreSnapshot(row,companies,s.tenant_id,cipher),actor=m.state.users.find((u:any)=>u.id===row.created_by);return{sourceId:p.sourceId,revision:p.revision,effectiveOn:p.effectiveOn,state:p.state,nameAr:p.nameAr,nameEn:p.nameEn,emirateId:p.emirateId,areaId:p.areaId,companyIds:p.companyIds,companies:p.companyIds.map(id=>{const co=companies.get(id);return{id,nameAr:co.arabicName,nameEn:co.englishName,licenseNumber:co.tradeLicenseNumber||null,state:co.status};}),reason:p.reason,createdAt:row.created_at,actor:{id:row.created_by,nameAr:actor?.nameAr||null,nameEn:actor?.nameEn||null}};});
 const effective=history.filter((p:any)=>p.effectiveOn<=q.asOf).sort((a:any,b:any)=>b.effectiveOn.localeCompare(a.effectiveOn)||b.revision-a.revision)[0]||null;
 return{id:centreId,asOf:q.asOf,head:history[0],effectiveSourceId:effective?.sourceId||null,rows:history,authorityChanged:false,financialEffect:false,sourceVersion:cipher.digest(JSON.stringify({asOf:q.asOf,rows:history}))};
}
export function registerOperatingCentres(app:any,call:any,cipher:any){app.get('/api/operating-centres',call((c:any,m:any,s:any,r:any)=>operatingCentreDirectory(c,m,s,cipher,r.query)));app.get('/api/operating-centres/:id',call((c:any,m:any,s:any,r:any)=>operatingCentreHistory(c,m,s,cipher,r.params.id,r.query)));}
