import {z} from 'zod';
import {requireOk} from './core.js';
import {hrRight,auditHR} from './personnel-domain.js';
import {personnelDepartments} from './personnel-directory.js';
import {personnelPositions} from './personnel-structure.js';

// A projection of existing HR records, never a second organizational directory.
export function registerPersonnelOrganization(app:any,route:any,cipher:any){
 app.get('/api/personnel/organization',route(async(c:any,m:any,s:any,r:any)=>{
  const q=z.object({companyId:z.uuid().optional(),departmentId:z.uuid().optional(),search:z.string().max(200).optional(),position:z.string().max(200).optional(),state:z.enum(['active','all']).default('active'),print:z.enum(['true']).optional()}).strict().parse(r.query);
  const companies=m.state.companies.filter((co:any)=>hrRight(m,'view',co.id));
  requireOk(companies.length||m.actor.roleId==='owner',403,'denied');
  if(q.companyId)requireOk(companies.some((co:any)=>co.id===q.companyId),403,'companyScopeDenied');
  const departments=(await personnelDepartments(c,m)).filter((d:any)=>d.scope==='group'||companies.some((co:any)=>co.id===d.companyId));
  if(q.departmentId)requireOk(departments.some((d:any)=>d.id===q.departmentId),403,'departmentScopeDenied');
  const depIds=new Set(departments.map((d:any)=>d.id)),companyIds=new Set(companies.map((co:any)=>co.id));
  const assignmentRows=(await c.query('select employee_id,company_id from ab.hr_assignments where effective_on<=current_date and(until_on is null or until_on>=current_date)')).rows;const assignments=new Map<string,string[]>();for(const a of assignmentRows)assignments.set(a.employee_id,[...(assignments.get(a.employee_id)||[]),a.company_id]);
  const rows:any[]=[];const normalize=(v:any)=>String(v||'').normalize('NFKC').toLocaleLowerCase();
  // Authorization uses exactly the existing active assignment scope. Payloads are decrypted only after authorization.
  for(const e of (await c.query('select * from ab.hr_employees order by employee_number')).rows){
   const assigned=[...new Set<string>([e.company_id,...(assignments.get(e.id)||[])])];if(!assigned.some(id=>companyIds.has(id)))continue;
   if(q.state==='active'&&!['Active','OnLeave','Notice'].includes(e.state))continue;
   const p=cipher.open(e.payload_cipher),workCompanies=[...new Set<string>([...assigned,...(p.workCompanyIds||[])])].filter(id=>companyIds.has(id));if(q.companyId&&!workCompanies.includes(q.companyId))continue;const additional=(p.additionalDepartmentIds||[]).filter((id:string)=>depIds.has(id));
   if(q.departmentId&&e.department_id!==q.departmentId&&!additional.includes(q.departmentId))continue;
   if(q.search&&!normalize([p.nameAr,p.nameEn,e.employee_number].join(' ')).includes(normalize(q.search)))continue;
   if(q.position&&!normalize(e.job_title).includes(normalize(q.position)))continue;
   rows.push({id:e.id,number:String(e.employee_number),nameAr:p.nameAr,nameEn:p.nameEn,jobTitle:e.job_title,positionId:p.positionId||null,departmentId:depIds.has(e.department_id)?e.department_id:null,additionalDepartmentIds:additional,companyId:companyIds.has(e.company_id)?e.company_id:null,companyIds:workCompanies,state:e.state,supervisorEmployeeId:p.supervisorEmployeeId||null,legacyManagerId:e.manager_id,userId:e.user_id});
  }
  const visible=new Map(rows.map(e=>[e.id,e])),byUser=new Map(rows.filter(e=>e.userId).map(e=>[e.userId,e.id]));
  for(const e of rows){const supervisor=e.supervisorEmployeeId||byUser.get(e.legacyManagerId)||null;e.supervisorUnavailable=!!(e.supervisorEmployeeId||e.legacyManagerId)&&!visible.has(supervisor);e.supervisorEmployeeId=visible.has(supervisor)?supervisor:null;delete e.legacyManagerId;delete e.userId;}
  const warnings:any[]=[],finished=new Set();for(const e of rows){let at:any=e;const path=new Set();while(at&&!finished.has(at.id)){if(path.has(at.id)){warnings.push({kind:'supervisionCycle',employeeId:at.id});break;}path.add(at.id);at=visible.get(at.supervisorEmployeeId);}for(const id of path)finished.add(id);}
  const shownDepartments=departments.filter((d:any)=>(!q.companyId||d.scope==='group'||d.companyId===q.companyId||rows.some(e=>e.departmentId===d.id||e.additionalDepartmentIds.includes(d.id)))&&(!q.departmentId||d.id===q.departmentId));
  const printCompanies=q.companyId?[q.companyId]:companies.map((co:any)=>co.id);const canPrint=printCompanies.length>0&&printCompanies.every((co:string)=>hrRight(m,'view',co)&&hrRight(m,'export',co));
  if(q.print){requireOk(canPrint,403,'exportDenied');await auditHR(c,cipher,s,{id:null,company_id:q.companyId||companies[0]?.id},'organization_print',null,{count:rows.length,companyId:q.companyId||null});}
  return {rows,departments:shownDepartments.map((d:any)=>({id:d.id,nameAr:d.nameAr,nameEn:d.nameEn,scope:d.scope,companyId:d.scope==='group'?null:d.companyId,status:d.status,managerEmployeeId:visible.has(d.managerEmployeeId)?d.managerEmployeeId:byUser.get(d.managerId)||null,managerUnavailable:!!(d.managerEmployeeId||d.managerId)&&!visible.has(d.managerEmployeeId)&&!byUser.has(d.managerId)})),companies:companies.map((co:any)=>({id:co.id,nameAr:co.arabicName,nameEn:co.englishName})),positions:(await personnelPositions(c)).filter((p:any)=>!p.departmentId||depIds.has(p.departmentId)).map((p:any)=>({id:p.id,nameAr:p.nameAr,nameEn:p.nameEn})),warnings:m.actor.roleId==='owner'?warnings:[],canPrint,changesAccessRights:false};
 }));
}
