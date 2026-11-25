import{companyScopeRelationshipDetails}from'./company-scope-relationship-details.js';
import{companyScopeReadiness}from'./company-scope-readiness.js';
// Owner-only preparation using original facts/action policy; not an applied authorization boundary.
import{z}from'zod';import{today}from'./vehicle-domain.js';import{requireOk}from'./core.js';import{Areas,audit,loadAreas,UserPolicy}from'./data.js';import{workScopeSources}from'./work-scope-sources.js';import{resolveWorkScopeSelection,workScopeSelection}from'./work-scope-selection.js';import{operatingCentreDirectory}from'./operating-centres.js';
const input=z.object({revision:z.number().int().positive(),asOf:z.iso.date(),selection:workScopeSelection}).strict();
async function compiledMembershipSource(c:any,tenantId:string,userId:string){
 const presence=(await c.query("select to_regclass('ab.user_access_scope_versions') versions,to_regclass('ab.user_access_scope_companies') links")).rows[0];
 if(!presence.versions&&!presence.links)return null;
 if(!presence.versions||!presence.links)return {partial:true};
 return (await c.query(`select v.id,v.revision,array(select l.company_id::text from ab.user_access_scope_companies l
   where l.tenant_id=v.tenant_id and l.user_id=v.user_id and l.version_id=v.id order by l.company_id) "companyIds"
   from ab.user_access_scope_versions v where v.tenant_id=$1 and v.user_id=$2 order by v.revision desc limit 1`,
   [tenantId,userId])).rows[0]||null;
}
export async function previewWorkScope(c:any,m:any,s:any,cipher:any,userId:string,body:unknown){
 requireOk(m.actor.roleId==='owner',403,'ownerOnly');requireOk(!s.viewAs,403,'viewAsReadOnly');userId=z.uuid().parse(userId);const u=m.state.users.find((r:any)=>r.id===userId);requireOk(u,404,'notFound');requireOk(u.roleId!=='owner'&&u.id!==s.user_id,403,'ownerProtected');const d=input.parse(body);requireOk(u.revision===d.revision,409,'revisionConflict');requireOk(m.state.companies.length<=500,422,'workScopeRangeReviewRequired');
 const geography=workScopeSources(m.state.companies,Areas.emirates,await loadAreas(c),u.companyIds),directory=d.selection.kind==='centres'?await operatingCentreDirectory(c,m,s,cipher,{asOf:d.asOf,view:'effective'}):{available:false,selection:'effective',centres:[],sourceVersion:null},resolution=resolveWorkScopeSelection(d.selection,{companies:m.state.companies,geography,centres:directory});
 const companies=new Map<string,any>(m.state.companies.map((r:any)=>[r.id,r])),caption=(id:string)=>{const r=companies.get(id);requireOk(r,503,'workScopeSourceReviewRequired');return{id,nameAr:r.arabicName,nameEn:r.englishName,licenseNumber:r.tradeLicenseNumber||null,state:r.status};},before=[...new Set<string>(u.companyIds)].sort(),after=resolution.companyIds,grants=m.initialGrants,denials=m.initialDenials.filter((r:any)=>r.userId===userId),proposed=UserPolicy.createService({...m.state,users:m.state.users.map((r:any)=>r.id===userId?{...r,companyIds:after,companyId:after[0]||''}:r)},undefined,{initialGrants:grants,initialDenials:m.initialDenials});
 let added=0,removed=0,outside=0;const changes:any[]=[];if(resolution.state==='resolved')for(const co of m.state.companies)for(const action of m.policy.actions){const target={companyIds:[co.id],departmentIds:[],managerId:''},was=m.policy.can(userId,action,target),next=proposed.can(userId,action,target);if(was!==next){next?added++:removed++;if(changes.length<100)changes.push({companyId:co.id,action,before:was,after:next});}if(next&&!after.includes(co.id))outside++;}
 const compiledMembership=await compiledMembershipSource(c,s.tenant_id,userId);
 const identity={compiledMembership,userId,revision:u.revision,asOf:d.asOf,selection:resolution.selection,before,after,companies:[...m.state.companies].sort((a:any,b:any)=>a.id.localeCompare(b.id)),geography,directory:directory.sourceVersion,grants:[...grants].sort((a:any,b:any)=>a.entry.id.localeCompare(b.entry.id)),denials:[...m.initialDenials].sort((a:any,b:any)=>a.userId.localeCompare(b.userId)),roles:[...m.state.roles].sort((a:any,b:any)=>a.id.localeCompare(b.id)),actor:s.user_id,tenant:s.tenant_id};
 const databaseScopeReadiness=await companyScopeReadiness(c);
 return{databaseScopeReadiness,compiledMembership,user:{id:u.id,nameAr:u.nameAr,nameEn:u.nameEn},asOf:d.asOf,resolution,beforeCompanies:before.map(caption),proposedCompanies:after.map(caption),addedCompanies:after.filter(id=>!before.includes(id)).map(caption),removedCompanies:before.filter(id=>!after.includes(id)).map(caption),originalPolicyImpact:resolution.state==='resolved'?{added,removed,rightsStillEffectiveOutsideSelection:outside,changes,changesTruncated:added+removed>changes.length,originalActionPolicyOnly:true,companyTargetProbeOnly:true}:null,retainedExceptions:{directGrants:grants.filter((r:any)=>r.userId===userId).length,individualDenials:denials[0]?.actions.length||0},reviewHash:cipher.digest(JSON.stringify(identity)),simulationOnly:true,canApply:false,authorityChanged:false,financialEffect:false,primaryLocationUsed:false,requiredNext:['original_scope_apply_and_exception_preservation','actual_api_and_database_bounds','compatible_rollback_and_acceptance']};
}
const membershipApply=input.extend({confirm:z.literal(true),reviewHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export async function assertWorkScopeMembershipOperator(c:any,m:any,s:any,enabled:boolean){
 requireOk(enabled,503,'workScopeMembershipApplyNotEnabled');
 requireOk(!s.viewAs&&(s.actor_type===undefined||s.actor_type==='user')&&m.actor.id===s.user_id&&
   m.actor.roleId==='owner'&&m.actor.status==='Active',403,'ownerOnly');
 const context=(await c.query("select current_database() database, exists(select 1 from ab.users where tenant_id=ab.tenant() and id=$1 and role_id='owner' and status='Active') owner",[s.user_id])).rows[0];
 requireOk(/^ab_backup_[a-f0-9]{32}$/.test(context?.database||''),503,'workScopeMembershipApplyNotEnabled');
 requireOk(context.owner===true,403,'ownerOnly');
}
function reviewedMembershipCompanies(m:any,userId:string,preview:Awaited<ReturnType<typeof previewWorkScope>>){
 requireOk(preview.resolution.state==='resolved'&&preview.proposedCompanies.length>0&&
   preview.proposedCompanies.every((company:any)=>company.state==='Active'),409,'workScopeSourceReviewRequired');
 const companyIds=preview.proposedCompanies.map((company:any)=>company.id);
 if(preview.compiledMembership){
   const compiled=preview.compiledMembership;
   requireOk(!compiled.partial&&preview.databaseScopeReadiness.directRowsReady&&
     JSON.stringify(compiled.companyIds)===JSON.stringify([...companyIds].sort()),
     409,'workScopeCompiledMembershipReviewRequired');
 }
 requireOk(preview.originalPolicyImpact?.rightsStillEffectiveOutsideSelection===0,409,'workScopeOutsideRightsReviewRequired');
 const u=m.state.users.find((r:any)=>r.id===userId);
 const selected=new Set(companyIds),departments=new Map(m.state.departments.map((d:any)=>[d.id,d.companyId]));
 const allCompanies=m.state.companies.every((company:any)=>selected.has(company.id));
 for(const grant of m.initialGrants.filter((grant:any)=>grant.userId===userId)){
   const scope=grant.entry.scope;
   const contained=scope.type==='company'?selected.has(scope.id):
     scope.type==='department'?selected.has(String(departments.get(scope.id)||'')):
     (scope.type==='group'||scope.type==='reports')&&allCompanies;
   requireOk(contained,409,'workScopeOutsideRightsReviewRequired');
 }
 requireOk(u.departmentIds.every((departmentId:string)=>m.state.departments.some((department:any)=>
   department.id===departmentId&&companyIds.includes(department.companyId))),409,'workScopeDepartmentReviewRequired');
 return companyIds;
}
async function applyReviewedMemberships(c:any,m:any,s:any,cipher:any,req:any,enabled:boolean){
 await assertWorkScopeMembershipOperator(c,m,s,enabled);
 requireOk(typeof req.headers['idempotency-key']==='string',422,'idempotencyRequired');
 const {confirm,reviewHash,...d}=membershipApply.parse(req.body);
 requireOk(d.asOf===today(),422,'workScopeEffectiveTodayRequired');
 const userId=z.uuid().parse(req.params.id);
 await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenant_id+':user-access-scope:'+userId]);
 const preview=await previewWorkScope(c,m,s,cipher,userId,d);
 requireOk(preview.reviewHash===reviewHash,409,'workScopeReviewChanged');
 const companyIds=reviewedMembershipCompanies(m,userId,preview);
 const u=m.state.users.find((r:any)=>r.id===userId);
 const before=preview.beforeCompanies.map((company:any)=>company.id);
 if(JSON.stringify(before)===JSON.stringify(companyIds))return{userId,revision:d.revision,companyIds,changed:false};
 const updated=await c.query("update ab.users set revision=revision+1,updated_at=now() where id=$1 and tenant_id=$2 and role_id<>'owner' and revision=$3 returning revision",[userId,s.tenant_id,d.revision]);
 requireOk(updated.rowCount===1,409,'revisionConflict');
 await c.query('select ab.replace_memberships($1,$2,$3,$4)',[userId,s.tenant_id,companyIds,u.departmentIds]);
 await audit(c,s.tenant_id,s.user_id,'work_scope_memberships_applied','user',userId,['companyIds']);
 return{userId,revision:updated.rows[0].revision,companyIds,reviewHash,changed:true};
}
export function registerWorkScopePreview(app:any,call:any,cipher:any,enabled=false){app.get('/api/users/work-scope/relationships/:table',call(async(c:any,m:any,s:any,r:any)=>{requireOk(m.actor.roleId==='owner'&&m.actor.status==='Active',403,'ownerOnly');requireOk(!s.viewAs,403,'viewAsReadOnly');z.object({}).strict().parse(r.query);return companyScopeRelationshipDetails(c,r.params.table);}));app.post('/api/users/:id/work-scope/preview',call(async(c:any,m:any,s:any,r:any)=>{
 const preview=await previewWorkScope(c,m,s,cipher,r.params.id,r.body);
 if(!enabled||preview.asOf!==today())return preview;
 await assertWorkScopeMembershipOperator(c,m,s,enabled);
 try{
   reviewedMembershipCompanies(m,r.params.id,preview);
   return {...preview,membershipApplication:{available:true}};
 }catch(error:any){
   if(error?.status!==409)throw error;
   return {...preview,membershipApplication:{available:false,reason:error.code}};
 }
}));app.post('/api/users/:id/work-scope/apply-memberships',call((c:any,m:any,s:any,r:any)=>applyReviewedMemberships(c,m,s,cipher,r,enabled)));}
