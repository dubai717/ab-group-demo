// Side-effect-free daily/monthly proposal. No job dispatch, retention deletion or source read.
import {z}from'zod';
const day=z.iso.date(),hash=z.string().regex(/^[a-f0-9]{64}$/),iso=z.iso.datetime({offset:true});
const policySchema=z.object({version:z.string().min(1).max(100),approved:z.boolean(),effectiveOn:day,timeZone:z.literal('Asia/Dubai'),dailyAt:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),monthlyDay:z.number().int().min(1).max(28),dailyRetentionDays:z.number().int().min(1).max(3650),monthlyRetentionMonths:z.number().int().min(1).max(120),sourceProjectHash:hash,destinationProjectHash:hash}).strict();
export type BackupCadencePolicy=z.infer<typeof policySchema>;
export function planBackupCadence(input:{now:string;policy:BackupCadencePolicy|null;completedSlots?:string[]}){
 const now=iso.parse(input.now),base={canExecute:false,canDelete:false,systemRestorePerformed:false,historicalBackfillPlanned:false,actualSchedulerInstalled:false};
 if(!input.policy)return{...base,state:'awaiting_approved_policy',slots:[]};
 const p=policySchema.parse(input.policy);if(p.sourceProjectHash===p.destinationProjectHash)throw Error('independentBackupSeparateProjectRequired');
 const today=new Date(Date.parse(now)+4*3600000).toISOString().slice(0,10),month=today.slice(0,7);if(!p.approved||today<p.effectiveOn)return{...base,state:'awaiting_approved_policy',slots:[]};
 const completed=new Set(z.array(z.string().max(400)).max(1000).parse(input.completedSlots||[])),prefix='backup:v1:'+p.sourceProjectHash+':'+p.destinationProjectHash,group=prefix+':capture:'+today;
 const definitions=[{cadence:'daily',dueDay:today,period:today},{cadence:'monthly',dueDay:month+'-'+String(p.monthlyDay).padStart(2,'0'),period:month}];
 const slots=definitions.filter(d=>d.dueDay>=p.effectiveOn&&Date.parse(d.dueDay+'T'+p.dailyAt+':00+04:00')<=Date.parse(now)).map(d=>({key:prefix+':'+d.cadence+':'+d.period,captureGroupKey:group,cadence:d.cadence,period:d.period,dueAt:new Date(d.dueDay+'T'+p.dailyAt+':00+04:00').toISOString(),policyVersion:p.version,retention:d.cadence==='daily'?{days:p.dailyRetentionDays}:{months:p.monthlyRetentionMonths},captureTimestampMustBeActual:true})).filter(s=>!completed.has(s.key));
 return{...base,state:slots.length?'due_preview':'no_due_slot',policyVersion:p.version,slots};
}
