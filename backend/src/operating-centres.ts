// Physical-centre source reader. No grants or memberships; the separate writer is strictly guarded.
import{z}from'zod';import{ApiError,requireOk}from'./core.js';import{operatingCentreSourceReady}from'./operating-centre-readiness.js';import{operatingCentreWriterSourceReady}from'./operating-centre-schema.js';
export const operatingCentrePayload=z.object({format:z.literal('operating-centre-v1'),tenantId:z.uuid(),centreId:z.uuid(),sourceId:z.uuid(),revision:z.number().int().positive(),effectiveOn:z.iso.date(),state:z.enum(['Active','Inactive']),emirateId:z.string().min(1).max(100),areaId:z.string().min(1).max(200).nullable(),companyIds:z.array(z.uuid()).max(500),nameAr:z.string().trim().min(1).max(160),nameEn:z.string().trim().min(1).max(160),reason:z.string().trim().min(1).max(2000)}).strict();
const todayUAE=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date());
export function operatingCentreSnapshot(row:any,companies:Map<string,any>,tenantId:string,cipher:any){let p:z.infer<typeof operatingCentrePayload>;try{p=operatingCentrePayload.parse(cipher.open(row.payload_cipher));}catch{throw new ApiError(503,'operatingCentreSourceReviewRequired');}
  const companyIds=row.company_ids;requireOk(p.tenantId===tenantId&&p.centreId===row.centre_id&&p.sourceId===row.id&&p.revision===row.revision&&p.effectiveOn===row.effective_on_text&&p.state===row.state&&p.emirateId===row.emirate_id&&p.areaId===row.area_id,503,'operatingCentreSourceReviewRequired');requireOk(Array.isArray(companyIds)&&companyIds.every(id=>typeof id==='string'&&companies.has(id))&&JSON.stringify([...p.companyIds].sort())===JSON.stringify(companyIds),503,'operatingCentreSourceReviewRequired');
 return p;
}
export async function operatingCentreDirectory(c:any,m:any,s:any,cipher:any,query:unknown){
 requireOk(m.actor.roleId==='owner',403,'ownerOnly');requireOk(!s.viewAs,403,'viewAsReadOnly');const q=z.object({asOf:z.iso.date().default(todayUAE())}).strict().parse(query);
 const presence=(await c.query("select to_regclass('ab.operating_centre_versions')versions,to_regclass('ab.operating_centre_companies')links")).rows[0];
 const base={asOf:q.asOf,readOnly:true,writeReady:false,authorityChanged:false,areaIsNotCentre:true,financialEffect:false};
 if(!presence.versions&&!presence.links)return{...base,available:false,state:'unconfigured',centres:[],sourceVersion:null};
 if(!await operatingCentreSourceReady(c))throw new ApiError(503,'operatingCentreSourceReviewRequired');
 const rows=(await c.query(`with current_sources as(
 select distinct on(centre_id)* from ab.operating_centre_versions where tenant_id=$1 and effective_on<=$2::date
 order by centre_id,effective_on desc,revision desc)
 select v.*,v.effective_on::text effective_on_text,array(select l.company_id from ab.operating_centre_companies l
 where l.tenant_id=v.tenant_id and l.version_id=v.id order by l.company_id)company_ids
 from current_sources v order by v.centre_id limit 501`,[s.tenant_id,q.asOf])).rows;
 requireOk(rows.length<=500,422,'operatingCentreDirectoryReviewRequired');
 const companies=new Map<string,any>(m.state.companies.map((r:any)=>[r.id,r]));const centres=[];
 for(const row of rows){const p=operatingCentreSnapshot(row,companies,s.tenant_id,cipher),companyIds=row.company_ids;
  centres.push({id:row.centre_id,sourceId:row.id,revision:row.revision,nameAr:p.nameAr,nameEn:p.nameEn,state:row.state,effectiveOn:row.effective_on_text,emirateId:row.emirate_id,areaId:row.area_id,companies:companyIds.map((id:string)=>{const company=companies.get(id);return{id,nameAr:company.arabicName,nameEn:company.englishName,state:company.status};})});
 }
 return{...base,writeReady:await operatingCentreWriterSourceReady(c),available:true,state:'recorded_readonly',centres,sourceVersion:cipher.digest(JSON.stringify({asOf:q.asOf,centres,sources:rows.map((r:any)=>({id:r.id,payload:r.payload_cipher}))})),source:'explicit_dated_operating_centre_snapshots'};
}
export function registerOperatingCentres(app:any,call:any,cipher:any){app.get('/api/operating-centres',call((c:any,m:any,s:any,r:any)=>operatingCentreDirectory(c,m,s,cipher,r.query)));}
