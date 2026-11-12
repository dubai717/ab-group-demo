import {requireOk} from './core.js';
import {V} from './vehicle-domain.js';
export const monthlyPolicy='monthly_bank_confirmed_gross';
export const isMonthly=(terms:any)=>terms?.collectionPolicy===monthlyPolicy;
export async function monthlyReady(c:any){if(!(await c.query("select to_regprocedure('ab.investor_monthly_schema_version()') is not null ok")).rows[0].ok)return false;return (await c.query('select ab.investor_monthly_schema_version() version')).rows[0].version==='INVESTOR-MONTHLY-REVIEW-1';}
export const isoDay=(date:any)=>date instanceof Date?date.toISOString().slice(0,10):String(date).slice(0,10);
export function monthBounds(period:string){requireOk(/^\d{4}-(0[1-9]|1[0-2])$/.test(period),422,'invalidMonth');const [year,month]=period.split('-').map(Number);requireOk(year>=2000&&year<=9999,422,'invalidMonth');return {from:period+'-01',to:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)};}
// Cumulative integer quotients allocate a fixed registration share exactly, even across partial receipts.
export function registrationSlice(start:bigint,amount:bigint,base:bigint,share:bigint){requireOk(start>=0n&&amount>=0n&&base>0n&&share>=0n&&share<=base&&start+amount<=base,422,'invalidRegistrationSlice');return (start+amount)*share/base-start*share/base;}
export type Interval={id:string,amount:bigint};
// Stable interval intersections retain unconfirmed and reversed holes; later confirmation cannot reshuffle claims.
export function intersectFunds(allocations:Interval[],bankParts:Interval[]){let allocationStart=0n;const out:{allocationId:string;bankPartId:string;amount:bigint;allocationOffset:bigint}[]=[];
 for(const allocation of allocations){requireOk(allocation.amount>0n,422,'invalidAllocation');let bankStart=0n;for(const part of bankParts){requireOk(part.amount>0n,422,'invalidBankPart');const start=allocationStart>bankStart?allocationStart:bankStart,end=allocationStart+allocation.amount<bankStart+part.amount?allocationStart+allocation.amount:bankStart+part.amount;if(end>start)out.push({allocationId:allocation.id,bankPartId:part.id,amount:end-start,allocationOffset:start-allocationStart});bankStart+=part.amount;}allocationStart+=allocation.amount;}
 return out;
}
export async function monthlyConfiguration(c:any,company:string,currency:string){const row=(await c.query('select * from ab.investor_monthly_configurations where company_id=$1 and currency=$2',[company,currency])).rows[0];requireOk(row,409,'monthlyAccountingApprovalRequired');return row;}
export async function monthlyFunding(c:any,cipher:any,invoice:string,markClassified=false){
 if(!await monthlyReady(c))return null;
 const result=(await c.query('select ab.investor_monthly_invoice_context($1,$2) data',[invoice,markClassified])).rows[0].data;if(!result)return null;
 const {row,cfg}=result,terms=cipher.open(result.terms_cipher);requireOk(isMonthly(terms)&&cfg.id===terms.monthlyConfigurationId&&row.invoice_company===cfg.company_id,409,'monthlyConfigurationMismatch');return {row,terms,cfg,classified:result.classified||markClassified};
}
export function monthlyAmount(kind:string,amount:bigint,offset:bigint,terms:any){if(kind==='finance')return amount;if(kind==='admin')return registrationSlice(offset,amount,V.units(terms.registrationBaseFee),V.units(terms.registrationShareAmount));return 0n;}
