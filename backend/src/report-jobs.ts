import {randomUUID} from 'node:crypto';
import {model,has} from './data.js';
import {transaction,security} from './core.js';
import {runCentralReport} from './central-reports.js';

export function nextReportDate(value:Date,frequency:string,anchorDay:number,now:Date){
 if(frequency==='once')return null;
 const local=new Date(value.getTime()+4*3600000),advance=()=>{if(frequency==='monthly'){local.setUTCDate(1);local.setUTCMonth(local.getUTCMonth()+1);const end=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,0)).getUTCDate();local.setUTCDate(Math.min(anchorDay,end));}else local.setUTCDate(local.getUTCDate()+(frequency==='weekly'?7:1));};
 let n=0;do{advance();if(++n>10000)throw Error('scheduleCatchupLimit');}while(local.getTime()-4*3600000<=now.getTime());return new Date(local.getTime()-4*3600000);
}
export async function executeReportSchedules(c:any,cipher:any,m:any,s:any,now=new Date()){
 if(!has(m.actor,'view_reports'))return {processed:0,available:0,denied:0};
 const schedules=(await c.query("select s.*,r.definition_cipher,r.owner_id report_owner from ab.report_schedules s join ab.saved_reports r on r.id=s.report_id where s.owner_id=$1 and s.state='Active'and s.next_at<=$2 order by s.next_at limit 25 for update of s",[m.actor.id,now])).rows;let available=0,denied=0;
 for(const r of schedules){const config=cipher.open(r.payload_cipher);for(const user of config.recipientIds){if((await c.query('select 1 from ab.report_runs where schedule_id=$1 and user_id=$2 and due_at=$3',[r.id,user,r.next_at])).rowCount)continue;let allowed=false;
   const active=(await c.query("select 1 from ab.users where id=$1 and status='Active'",[user])).rowCount;
   if(active){const target=await model(c,user,cipher),shared=user===r.report_owner||target.actor.roleId==='owner'||(await c.query('select 1 from ab.report_shares where report_id=$1 and user_id=$2',[r.report_id,user])).rowCount;if(shared&&has(target.actor,'view_reports')){await runCentralReport(c,target,cipher,cipher.open(r.definition_cipher));allowed=true;}}
   await c.query('insert into ab.report_runs(id,tenant_id,schedule_id,user_id,due_at,status)values($1,$2,$3,$4,$5,$6)',[randomUUID(),s.tenant_id,r.id,user,r.next_at,allowed?'available':'access_denied']);
   if(allowed&&config.companyId){await c.query("insert into ab.finance_notifications(id,tenant_id,company_id,user_id,action,event_key,entity_id)values($1,$2,$3,$4,'report:available',$5,$6)on conflict(tenant_id,user_id,event_key)do nothing",[randomUUID(),s.tenant_id,config.companyId,user,'report:'+r.id+':'+r.next_at.toISOString(),r.report_id]);available++;}else denied++;
  }
  const next=nextReportDate(r.next_at,r.frequency,config.anchorDay||new Date(r.next_at.getTime()+4*3600000).getUTCDate(),now);await c.query('update ab.report_schedules set next_at=coalesce($2,next_at),state=$3 where id=$1',[r.id,next,next?'Active':'Completed']);
  await c.query("insert into ab.audit_events(id,tenant_id,actor_id,actor_type,action,entity_type,entity_id,fields,request_id)values($1,$2,$3,'service','report_scheduled_run','report',$4,ARRAY['schedule','recipients','source_permissions_rechecked'],$5)",[randomUUID(),s.tenant_id,s.user_id,r.report_id,randomUUID()]);
 }
 return {processed:schedules.length,available,denied};
}
export async function reportTick(pool:any,key:string){if(!(await pool.query("select to_regprocedure('ab.report_job_scopes()') ok")).rows[0].ok)return;const cipher=security(key);for(const job of(await pool.query('select * from ab.report_job_scopes()')).rows)await transaction(pool,job.tenant_id,job.actor_id,async c=>executeReportSchedules(c,cipher,await model(c,job.actor_id,cipher),{tenant_id:job.tenant_id,user_id:job.actor_id}));}
export function startReportSchedules(pool:any,key:string){let running:Promise<any>|null=null;const tick=()=>{if(running)return;running=reportTick(pool,key).catch(()=>console.log('REPORT_JOB_FAILED_DETAILS_WITHHELD')).finally(()=>{running=null;});};const timer=setInterval(tick,60000);timer.unref();return async()=>{clearInterval(timer);if(running)await running;};}
