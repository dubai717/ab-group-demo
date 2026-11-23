// Working-time arithmetic only. Uses explicit versioned employee schedules, never a guessed office day.
import {z} from 'zod';
const day=z.iso.date(),time=z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),slot=z.object({from:time,to:time}).strict(),code=z.enum(['X','/','']);
const schedule=z.object({employeeId:z.string().min(1),effectiveFrom:day,effectiveUntil:day.nullable(),weekly:z.record(z.string().regex(/^[0-6]$/),code),full:z.array(slot).max(6),half:z.array(slot).max(6),holidays:z.array(day).max(200),overrides:z.array(z.object({date:day,code,holidayWorkApproved:z.boolean().default(false)}).strict()).max(366)}).strict();
export const workClockSchema=z.array(schedule).min(1).max(50);
export type WorkClock=z.infer<typeof workClockSchema>;
const minute=60000,ymd=(ms:number)=>new Date(ms+4*3600000).toISOString().slice(0,10),midnight=(d:string)=>Date.parse(d+'T00:00:00+04:00'),clock=(s:string)=>Number(s.slice(0,2))*60+Number(s.slice(3));
function intervals(date:string,versions:WorkClock){
 const matches=versions.filter(v=>v.effectiveFrom<=date&&(!v.effectiveUntil||v.effectiveUntil>=date));if(matches.length!==1)throw Error('employeeScheduleReviewRequired');const v=matches[0],override=v.overrides.filter(r=>r.date===date);if(override.length>1)throw Error('duplicateDayOverride');
 const entry=override[0];if(v.holidays.includes(date)&&!entry?.holidayWorkApproved)return[];const status=entry?.code??v.weekly[String((new Date(midnight(date)).getUTCDay()+1)%7)];
 if(status===undefined)throw Error('employeeScheduleReviewRequired');if(status==='')return[];const shifts=status==='X'?v.full:v.half;if(!shifts.length)throw Error(status==='/'?'halfDayHoursRequired':'fullDayHoursRequired');
 const out=shifts.map(s=>[midnight(date)+clock(s.from)*minute,midnight(date)+clock(s.to)*minute]).sort((a,b)=>a[0]-b[0]);if(out.some((s,i)=>s[1]<=s[0]||i>0&&s[0]<out[i-1][1]))throw Error('workHoursReviewRequired');return out;
}
function checked(versions:WorkClock){const parsed=workClockSchema.parse(versions);if(new Set(parsed.map(v=>v.employeeId)).size!==1||parsed.some(v=>v.effectiveUntil&&v.effectiveUntil<v.effectiveFrom))throw Error('employeeScheduleReviewRequired');return parsed;}
function instant(value:string){const ms=Date.parse(value);if(!Number.isFinite(ms)||!/(?:Z|[+-]\d\d:\d\d)$/.test(value))throw Error('timezoneRequired');return ms;}
export function workingMinutesBetween(from:string,to:string,versions:WorkClock){
 const start=instant(from),end=instant(to),cal=checked(versions);if(end<start)throw Error('invalidWorkInterval');let total=0,date=ymd(start),count=0;
 for(let at=midnight(date);at<end;at+=86400000){if(++count>3660)throw Error('workCalendarRangeRequired');date=ymd(at);for(const [a,b]of intervals(date,cal))total+=Math.max(0,Math.min(end,b)-Math.max(start,a))/minute;}
 return total;
}
export function addWorkingMinutes(from:string,minutes:number,versions:WorkClock){
 let cursor=instant(from);const cal=checked(versions);if(!Number.isSafeInteger(minutes)||minutes<0||minutes>525600)throw Error('invalidWorkingMinutes');if(minutes===0)return new Date(cursor).toISOString();let remaining=minutes;
 for(let n=0;n<3660;n++){const date=ymd(cursor);for(const [a,b]of intervals(date,cal)){const start=Math.max(cursor,a),available=Math.max(0,(b-start)/minute);if(remaining<=available&&available>0)return new Date(start+remaining*minute).toISOString();remaining-=available;}cursor=midnight(date)+86400000;}
 throw Error('workCalendarRangeRequired');
}
export function annualLeavePlanningWindow(date:string){day.parse(date);return{year:Number(date.slice(0,4)),open:date.slice(5)>='01-01'&&date.slice(5)<='01-15',startsOn:date.slice(0,4)+'-01-01',endsOn:date.slice(0,4)+'-01-15',approval:false,balanceDeduction:false};}
export function dueTaskEscalations(input:{taskId:string;deadlineRevision:number;dueAt:string;now:string;completed:boolean;managerIds:string[];sentKeys:string[];approvedWaiting:Array<{from:string;to:string;approvedBy:string;reason:string}>},versions:WorkClock){
 if(input.completed)return{events:[],lateWorkingMinutes:0,automaticPenalty:false};
 if(!input.taskId||!Number.isSafeInteger(input.deadlineRevision)||input.deadlineRevision<1||new Set(input.managerIds).size!==input.managerIds.length)throw Error('taskEscalationSourceReviewRequired');
 const due=instant(input.dueAt),now=instant(input.now);if(now<=due)return{events:[],lateWorkingMinutes:0,automaticPenalty:false};
 const periods=input.approvedWaiting.map(p=>{if(!p.approvedBy?.trim()||!p.reason?.trim())throw Error('approvedWaitingReasonRequired');const a=instant(p.from),b=instant(p.to);if(b<a)throw Error('invalidWorkInterval');return[Math.max(a,due),Math.min(b,now)];}).filter(p=>p[1]>p[0]).sort((a,b)=>a[0]-b[0]);
 const merged:number[][]=[];for(const p of periods){const previous=merged.at(-1);if(previous&&p[0]<=previous[1])previous[1]=Math.max(previous[1],p[1]);else merged.push(p);}
 let late=workingMinutesBetween(input.dueAt,input.now,versions);for(const [a,b]of merged)late-=workingMinutesBetween(new Date(a).toISOString(),new Date(b).toISOString(),versions);
 const sent=new Set(input.sentKeys),levels=Math.min(Math.floor(late/30),input.managerIds.length),events=Array.from({length:levels},(_,i)=>({level:i+1,userId:input.managerIds[i],key:input.taskId+':'+input.deadlineRevision+':'+(i+1)})).filter(e=>!sent.has(e.key));
 return{events,lateWorkingMinutes:late,automaticPenalty:false};
}
