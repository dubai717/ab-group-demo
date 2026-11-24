// A response-review deadline, never proof of customer delivery or debt settlement.
// Count the next three actual scheduled working dates; the starting date is excluded.
import{workingMinutesBetween,workClockSchema,type WorkClock}from'./operational-work-clock.js';
export function caseResponseDeadline(from:string,versions:WorkClock){
 const start=Date.parse(from);if(!Number.isFinite(start)||!/(?:Z|[+-]\d\d:\d\d)$/.test(from))throw Error('timezoneRequired');
 workClockSchema.parse(versions);let date=new Date(start+4*3600000).toISOString().slice(0,10),count=0;
 for(let n=0;n<366;n++){
  date=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
  const next=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10),begin=date+'T00:00:00+04:00',end=next+'T00:00:00+04:00',minutes=workingMinutesBetween(begin,end,versions);
  if(minutes<=0)continue;if(++count!==3)continue;
  // Use the end of the last actual shift, including split and half-day schedules.
  let lo=0,hi=1440;while(lo<hi){const mid=Math.floor((lo+hi)/2),at=new Date(Date.parse(begin)+mid*60000).toISOString();if(workingMinutesBetween(begin,at,versions)>=minutes)hi=mid;else lo=mid+1;}
  return{dueAt:new Date(Date.parse(begin)+lo*60000).toISOString(),dueOn:date,workingDays:3 as const,startDayExcluded:true,timeZone:'Asia/Dubai' as const};
 }
 throw Error('caseResponseCalendarReviewRequired');
}
