// Explicit dated schedules over original employees/settings/audit. No invented office hours,
// payroll effect, permission grant, attendance requirement or task rescheduling on save.
import {z} from 'zod';
import {requireOk,sha} from './core.js';
import {employee,hrRight,scope,auditHR} from './personnel-domain.js';
import {today} from './vehicle-domain.js';
import {workClockSchema,workingMinutesBetween} from './operational-work-clock.js';
const id=z.uuid(),day=z.iso.date(),key=(employeeId:string)=>'personnel:work-calendar-v1:'+employeeId;
const input=z.object({revision:z.number().int().min(0),reason:z.string().trim().min(1).max(2000),schedule:workClockSchema.element}).strict();
function previousDay(date:string){return new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
async function source(c:any,cipher:any,tenant:string,employeeId:string){
 const r=(await c.query('select value from ab.settings where tenant_id=$1 and key=$2',[tenant,key(employeeId)])).rows[0];if(!r)return{revision:0,versions:[]};
 const d=cipher.open(r.value.cipher);requireOk(d.employeeId===employeeId&&d.status==='Recorded'&&Array.isArray(d.versions),409,'workCalendarSourceReviewRequired');return d;
}
export async function employeeWorkCalendar(c:any,cipher:any,tenant:string,employeeId:string){
 const d=await source(c,cipher,tenant,employeeId);return{revision:d.revision,versions:d.versions.map((v:any,i:number)=>({...v,effectiveUntil:d.versions[i+1]?previousDay(d.versions[i+1].effectiveFrom):null}))};
}
function validateSchedule(s:any,employeeId:string){
 requireOk(s.employeeId===employeeId&&s.effectiveUntil===null,422,'invalidWorkCalendarSource');requireOk(Object.keys(s.weekly).length===7,422,'completeWeekRequired');
 requireOk(new Set(s.holidays).size===s.holidays.length&&new Set(s.overrides.map((r:any)=>r.date)).size===s.overrides.length,422,'duplicateCalendarDate');
 requireOk(s.overrides.every((r:any)=>r.date>=s.effectiveFrom),422,'calendarDateBeforeEffective');
 // Probe a complete week and each dated override through the same clock used by tasks.
 // A separate explicit probe validates both configured shift sets even on a week off.
 const until=new Date(Date.parse(s.effectiveFrom+'T00:00:00Z')+7*86400000).toISOString().slice(0,10);
 try{workingMinutesBetween(s.effectiveFrom+'T00:00:00+04:00',until+'T00:00:00+04:00',[s]);
  for(const code of ['X','/'])if((code==='X'?s.full:s.half).length){const probe={...s,holidays:[],overrides:[],weekly:Object.fromEntries(Array.from({length:7},(_,i)=>[String(i),code]))};workingMinutesBetween(s.effectiveFrom+'T00:00:00+04:00',until+'T00:00:00+04:00',[probe]);}
  for(const override of s.overrides){const end=new Date(Date.parse(override.date+'T00:00:00Z')+86400000).toISOString().slice(0,10);workingMinutesBetween(override.date+'T00:00:00+04:00',end+'T00:00:00+04:00',[s]);}
 }catch{requireOk(false,422,'workHoursReviewRequired');}
}
export function registerEmployeeWorkCalendar(app:any,route:any,cipher:any){
 app.get('/api/personnel/work-calendar',route(async(c:any,m:any,s:any,req:any)=>{
  const q=z.object({companyIds:z.string().max(4000),asOf:day}).strict().parse(req.query),ids=z.array(id).min(1).max(100).parse(q.companyIds.split(','));requireOk(new Set(ids).size===ids.length,422,'duplicateCompany');
  const allowed=m.state.companies.filter((co:any)=>hrRight(m,'view',co.id));requireOk(ids.every(co=>allowed.some((a:any)=>a.id===co)),403,'companyScopeDenied');
  const rows=(await c.query("select e.* from ab.hr_employees e where e.state in('Active','OnLeave','Notice')and(e.company_id=any($1::uuid[])or exists(select 1 from ab.hr_assignments a where a.employee_id=e.id and a.company_id=any($1::uuid[])and a.effective_on<=$2 and(a.until_on is null or a.until_on>=$2)))order by e.employee_number limit 201",[ids,q.asOf])).rows;requireOk(rows.length<=200,422,'workCalendarRangeRequired');
  const keys=rows.map((e:any)=>key(e.id)),values=(await c.query('select key,value from ab.settings where tenant_id=$1 and key=any($2::text[])',[s.tenant_id,keys])).rows,stored=new Map(values.map((r:any)=>[r.key,r.value]));
  const assignments=(await c.query('select employee_id,company_id from ab.hr_assignments where employee_id=any($1::uuid[])and effective_on<=$2 and(until_on is null or until_on>=$2)',[rows.map((e:any)=>e.id),q.asOf])).rows;
  return{asOf:q.asOf,timeZone:'Asia/Dubai',companies:allowed.map((co:any)=>({id:co.id,nameAr:co.arabicName,nameEn:co.englishName,areaId:co.areaId||null,region:co.region||'',emirateId:co.emirateId||null})),rows:rows.map((e:any)=>{
   const p=cipher.open(e.payload_cipher),value:any=stored.get(key(e.id)),d=value?cipher.open(value.cipher):{employeeId:e.id,status:'Recorded',revision:0,versions:[]};requireOk(d.employeeId===e.id&&d.status==='Recorded'&&Array.isArray(d.versions),409,'workCalendarSourceReviewRequired');
   const companies=[...new Set<string>([e.company_id,...assignments.filter((a:any)=>a.employee_id===e.id).map((a:any)=>a.company_id)])];return{employeeId:e.id,number:String(e.employee_number),nameAr:p.nameAr,nameEn:p.nameEn,companyIds:companies.filter(co=>ids.includes(co)),revision:d.revision,versions:d.versions.map((v:any,i:number)=>({...v,effectiveUntil:d.versions[i+1]?previousDay(d.versions[i+1].effectiveFrom):null})),canEdit:!s.viewAs&&companies.every(co=>hrRight(m,'configure',co))};
  }),financialEffect:false,permissionsChanged:false};
 }));
 app.get('/api/personnel/employees/:id/work-calendar',route(async(c:any,m:any,s:any,req:any)=>{
  const e=await employee(c,m,id.parse(req.params.id)),companies=await scope(c,e),canEdit=!s.viewAs&&['Active','OnLeave','Notice'].includes(e.state)&&companies.every(co=>hrRight(m,'configure',co));
  const d=await employeeWorkCalendar(c,cipher,s.tenant_id,e.id);return{employeeId:e.id,nameAr:cipher.open(e.payload_cipher).nameAr,nameEn:cipher.open(e.payload_cipher).nameEn,...d,canEdit,timeZone:'Asia/Dubai',attendanceRequired:false,financialEffect:false};
 }));
 app.post('/api/personnel/employees/:id/work-calendar',route(async(c:any,m:any,s:any,req:any)=>{
  const e=await employee(c,m,id.parse(req.params.id)),d=input.parse(req.body),companies=[...new Set([...(await scope(c,e)),...(await scope(c,e,d.schedule.effectiveFrom))])];
  // A person's schedule is shared across their real work assignments. A single-company
  // grant must not silently change working time in another company.
  requireOk(companies.every(co=>hrRight(m,'configure',co)),403,'workCalendarScopeDenied');requireOk(['Active','OnLeave','Notice'].includes(e.state),409,'employeeStateReviewRequired');validateSchedule(d.schedule,e.id);
  requireOk(d.schedule.effectiveFrom>=today(),409,'historicalWorkCalendarProtected');
  await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenant_id+':'+key(e.id)]);const old=await source(c,cipher,s.tenant_id,e.id),digest=sha(JSON.stringify({schedule:d.schedule,reason:d.reason}));
  if(old.digest===digest)return{id:e.id,revision:old.revision,existing:true,financialEffect:false};requireOk(old.revision===d.revision,409,'revisionConflict');
  requireOk(!old.versions.length||d.schedule.effectiveFrom>old.versions.at(-1).effectiveFrom,409,'calendarEffectiveDateAlreadyRecorded');requireOk(old.versions.length<50,409,'workCalendarArchiveReviewRequired');
  const next={employeeId:e.id,status:'Recorded',revision:d.revision+1,versions:[...old.versions,d.schedule],digest,reason:d.reason,recordedBy:s.user_id,recordedAt:new Date().toISOString()};
  await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[s.tenant_id,key(e.id)+':version:'+next.revision,{cipher:cipher.seal(next)}]);
  await c.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)on conflict(tenant_id,key)do update set value=excluded.value',[s.tenant_id,key(e.id),{cipher:cipher.seal(next)}]);await auditHR(c,cipher,s,e,'work_calendar_recorded',old,next);
  return{id:e.id,revision:next.revision,saved:true,financialEffect:false,permissionsChanged:false,tasksRescheduled:false};
 }));
}
