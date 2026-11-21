import {z} from 'zod';
// Read-only disclosure from the invoice's original contract; never infer a lender from customer residence.
import {requireOk} from './core.js';
import {need} from './ledger-domain.js';
export function financierLabel(type:string,party:any){
 const ar=party?.nameAr||party?.nameEn,en=party?.nameEn||party?.nameAr;
 if(type==='cash')return null;
 if(!ar||!en)return{type,status:'ReviewRequired',labelAr:'جهة التمويل تحتاج مراجعة العقد',labelEn:'Financier requires contract review'};
 const captions:any={group:['قسط تمويل المجموعة — ','Group financing installment — '],bank:['قسط تمويل بنك — ','Bank financing installment — '],investor:['قسط تمويل المستثمر — ','Investor financing installment — ']};
 if(!captions[type])return null;
 return{type,status:'ContractReference',labelAr:captions[type][0]+ar+(type==='investor'&&party?.profileNumber?' ('+party.profileNumber+')':''),labelEn:captions[type][1]+en+(type==='investor'&&party?.profileNumber?' ('+party.profileNumber+')':'')};
}
export async function contractFinanciers(c:any,m:any,cipher:any,rows:any[]){
 const targets=rows.filter(r=>r.contractId&&r.kind==='finance'),ids=[...new Set(targets.map(r=>r.contractId))],cos=[...new Set(targets.map(r=>r.companyId))];
 const result=new Map<string,any>();if(!ids.length)return result;requireOk(ids.length<=20000,422,'registerTooLarge');for(const co of cos)need(m,'view',co as string);
 const contracts=(await c.query('select ct.id,ct.company_id,ct.vehicle_id,ct.payload_cipher,r.id request_id,r.payload_cipher request_payload from ab.vehicle_contracts ct join ab.vehicles v on v.id=ct.vehicle_id and v.company_id=ct.company_id join ab.vehicle_requests r on r.id=v.request_id and r.company_id=v.company_id where ct.id=any($1::uuid[]) and ct.company_id=any($2::uuid[])',[ids,cos])).rows;
 const snapshots=new Map<string,any>();
 const requestIds=contracts.map((r:any)=>r.request_id);
 const stored=(await c.query("select key,value from ab.settings where key=any($1::text[])",[requestIds.map((id:string)=>'contract-financier-source-v1:'+id)])).rows;
 for(const row of stored){const value=row.value?.cipher?cipher.open(row.value.cipher):null;if(value&&row.key==='contract-financier-source-v1:'+value.requestId)snapshots.set(value.requestId,value);}
 const investors=new Map<string,any>();
 const agreementIds=[...new Set(contracts.map((r:any)=>{const terms=cipher.open(r.payload_cipher),request=cipher.open(r.request_payload);return terms.financeType==='investor'&&z.uuid().safeParse(request.investorAgreementId).success?request.investorAgreementId:null;}).filter(Boolean))];
 if(agreementIds.length&&(await c.query("select to_regclass('ab.investor_profiles') is not null available")).rows[0].available){
  const profiles=(await c.query('select a.id,a.company_id,p.payload_cipher from ab.investor_agreements a join ab.investor_profiles p on p.id=a.investor_id where a.id=any($1::uuid[]) and a.company_id=any($2::uuid[])',[agreementIds,cos])).rows;
  for(const p of profiles)investors.set(p.company_id+':'+p.id,cipher.open(p.payload_cipher));
 }
 const byContract=new Map(contracts.map((r:any)=>[r.id+':'+r.company_id+':'+r.vehicle_id,r]));
 for(const row of targets){const contract:any=byContract.get(row.contractId+':'+row.companyId+':'+row.vehicleId);if(!contract)continue;
  const terms=cipher.open(contract.payload_cipher),request=cipher.open(contract.request_payload),co=m.state.companies.find((r:any)=>r.id===row.companyId);
  const snapshot=snapshots.get(contract.request_id),trusted=snapshot&&snapshot.companyId===row.companyId&&(!request.investorAgreementId||request.investorAgreementId===snapshot.agreementId)&&(!request.investorId||request.investorId===snapshot.investorId)?snapshot:null;
  const party=terms.financeType==='group'?{nameAr:co?.arabicName,nameEn:co?.englishName}:terms.financeType==='bank'?{nameAr:terms.bankContract?.lenderSnapshot?.nameAr||terms.bankContract?.lender,nameEn:terms.bankContract?.lenderSnapshot?.nameEn||terms.bankContract?.lender}:trusted||investors.get(row.companyId+':'+request.investorAgreementId);
  result.set(row.id,financierLabel(terms.financeType,party));
 }
 return result;
}
export async function receiptContractFinanciers(c:any,m:any,cipher:any,co:string,receiptIds:string[]){
 need(m,'view',co);const result=new Map<string,any[]>();if(!receiptIds.length)return result;requireOk(receiptIds.length<=20000,422,'registerTooLarge');
 const rows=(await c.query("select a.receipt_id,i.id,i.company_id,i.vehicle_id,i.contract_id,i.kind from ab.vehicle_allocations a join ab.vehicle_invoices i on i.id=a.invoice_id join ab.finance_receipts r on r.id=a.receipt_id and r.company_id=i.company_id and r.customer_id=i.customer_id where a.receipt_id=any($1::uuid[]) and r.company_id=$2 and not exists(select 1 from ab.finance_allocation_reversals x where x.allocation_id=a.id) limit 20001",[receiptIds,co])).rows;requireOk(rows.length<=20000,422,'registerTooLarge');
 const sources=await contractFinanciers(c,m,cipher,rows.map((r:any)=>({id:r.id,companyId:r.company_id,vehicleId:r.vehicle_id,contractId:r.contract_id,kind:r.kind})));
 for(const r of rows){const label=sources.get(r.id);if(!label)continue;const current=result.get(r.receipt_id)||[];if(!current.some(x=>x.contractId===r.contract_id))current.push({...label,contractId:r.contract_id});result.set(r.receipt_id,current);}
 return result;
}
