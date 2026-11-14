import {z} from 'zod';
import {requireOk} from './core.js';
import {V} from './vehicle-domain.js';
export const monthPolicy=z.enum(['calendar_actual','full_month']);
const amount=z.string().regex(/^\d{1,15}(\.\d{1,3})?$/);
export const operatingService=z.object({id:z.uuid(),name:z.string().trim().min(1).max(120),description:z.string().max(2000).default(''),amount,currency:z.string().regex(/^[A-Z]{3}$/),startsOn:z.iso.date(),endsOn:z.iso.date().optional(),monthly:z.boolean()}).strict();
export type OperatingService=z.infer<typeof operatingService>;
const day=(s:string)=>{requireOk(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s,422,'invalidOperatingPeriod');return Date.parse(s+'T00:00:00Z')/86400000;};
const iso=(n:number)=>new Date(n*86400000).toISOString().slice(0,10);
const rounded=(n:bigint,d:bigint)=>(n+d/2n)/d;
export function operatingPeriods(startsOn:string,endsOn:string,rate:string,policy:z.infer<typeof monthPolicy>){
 monthPolicy.parse(policy);let cursor=day(startsOn);const end=day(endsOn),price=V.units(rate);requireOk(end>=cursor&&end-cursor<=36600,422,'invalidOperatingPeriod');const rows:any[]=[];let fractionNumerator=0n,fractionDenominator=1n;
 while(cursor<=end){const d=new Date(cursor*86400000),first=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)/86400000,next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1)/86400000,last=Math.min(end,next-1),days=last-cursor+1,denominator=policy==='full_month'?1n:BigInt(next-first),numerator=policy==='full_month'?1n:BigInt(days);
  rows.push({period:iso(first),startsOn:iso(cursor),endsOn:iso(last),days,daysInMonth:next-first,amount:V.money(rounded(price*numerator,denominator)),dueOn:iso(cursor)});
  fractionNumerator=fractionNumerator*denominator+numerator*fractionDenominator;fractionDenominator*=denominator;const gcd=(a:bigint,b:bigint):bigint=>b?gcd(b,a%b):a,g=gcd(fractionNumerator,fractionDenominator);fractionNumerator/=g;fractionDenominator/=g;cursor=next;
 }
 return {policy,months:V.money(rounded(fractionNumerator*1000n,fractionDenominator)),total:V.money(rows.reduce((n,x)=>n+V.units(x.amount),0n)),periods:rows};
}
export function operatingPlan(v:any,currency:string){
 requireOk(v.termsVersion===2&&v.startsOn&&v.endsOn,422,'operatingTermsRequired');const base=operatingPeriods(v.startsOn,v.endsOn,v.rate,v.monthPolicy),services:OperatingService[]=z.array(operatingService).max(100).parse(v.services||[]),lines:any[]=base.periods.map(x=>({...x,key:'vehicle:'+v.vehicleId+':'+x.period,vehicleId:v.vehicleId,kind:'operation',description:v.type,rate:v.rate}));
 requireOk(new Set(services.map(s=>s.id)).size===services.length,422,'duplicateService');
 for(const s of services){requireOk(s.currency===currency,422,'serviceCurrencyMismatch');requireOk(s.startsOn>=v.startsOn&&s.startsOn<=v.endsOn&&(!s.endsOn||s.endsOn>=s.startsOn&&s.endsOn<=v.endsOn),422,'invalidServicePeriod');
  if(s.monthly){for(const p of operatingPeriods(s.startsOn,s.endsOn||v.endsOn,s.amount,v.monthPolicy).periods)lines.push({...p,key:'service:'+s.id+':'+p.period,vehicleId:v.vehicleId,serviceId:s.id,kind:'service_recurring',description:s.name,rate:s.amount});}
  else lines.push({key:'service:'+s.id+':once',vehicleId:v.vehicleId,serviceId:s.id,kind:'service_once',description:s.name,amount:s.amount,dueOn:s.startsOn,period:s.startsOn.slice(0,7)+'-01',startsOn:s.startsOn,endsOn:s.startsOn});
 }
 return {months:base.months,operatingTotal:base.total,total:V.money(lines.reduce((n,x)=>n+V.units(x.amount),0n)),lines};
}
