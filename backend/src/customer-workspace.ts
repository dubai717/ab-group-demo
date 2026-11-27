// Read-only projections over canonical customer, vehicle and accounting records.
import {customerCan} from './customers.js';
import {financeRight} from './finance.js';
import {vehicleRight,vehicleData,vehicleInvoices,today,V} from './vehicle-domain.js';
import {invoices} from './ledger-domain.js';
import {z} from 'zod';
import {hrRight} from './personnel-domain.js';
import {archivedAttachments,currentAttachmentRows,withdrawnAttachments} from './attachment-history.js';
import {requireOk} from './core.js';
const has=async(c:any,name:string)=>!!(await c.query('select to_regclass($1) ok',['ab.'+name])).rows[0].ok;
export const customerBucket=(s:string)=>['Active','Prospect'].includes(s)?s:['Ended','Archived'].includes(s)?'Ended':'Pending';
const sum=(rows:any[],key:string)=>V.money(rows.reduce((n:bigint,r:any)=>n+V.units(String(r[key]||'0')),0n));
async function summaryVehicles(c:any,m:any){
 const scope=m.state.companies.filter((co:any)=>vehicleRight(m,'view',co.id)).map((co:any)=>co.id);
 if(!scope.length||!await has(c,'vehicles'))return null;
 return (await c.query('select v.customer_id,v.company_id,v.status,r.finance_type from ab.vehicles v join ab.vehicle_requests r on r.id=v.request_id where v.company_id=any($1::uuid[])',[scope])).rows;
}
export async function vehicleRegisterSummary(c:any,m:any){
 const vehicles=await summaryVehicles(c,m);
 if(!vehicles)return null;
 const cells={Active:{cash:0,group:0,bank:0,investor:0},Pending:{cash:0,group:0,bank:0,investor:0},Ended:{cash:0,group:0,bank:0,investor:0}};
 for(const v of vehicles){
  const row=cells[v.status==='Active'?'Active':v.status==='Terminated'?'Ended':'Pending'];
  row[v.finance_type as keyof typeof row]++;
 }
 return {cells,total:vehicles.length};
}
const day=z.iso.date();
async function residenceSummary(c:any,m:any,cipher:any,clients:any[],allowed:Set<string>){
 const current=today();
 const groups={customers:new Map<string,Set<string>>(),employees:new Map<string,Set<string>>()};
 function record(group:keyof typeof groups,person:string,company:string,issued:string,expires:string){
  if(!allowed.has(company)||!day.safeParse(expires).success)return;
  if(expires<current||day.safeParse(issued).success&&issued>current)return;
  const people=groups[group].get(company)||new Set<string>();
  people.add(person);groups[group].set(company,people);
 }
 const clientFiles=new Map<string,any[]>();
 const readable=clients.filter(row=>customerCan(m,'documents',row.company_id)).map(row=>row.id);
 if(readable.length&&await has(c,'customer_files')){
  const rows=(await c.query(`select f.id,f.parent_id,f.customer_id,f.payload_cipher,coalesce(r.verdict,f.scan_status) scan
   from ab.customer_files f left join ab.customer_file_reviews r on r.file_id=f.id
   where f.customer_id=any($1::uuid[])`,[readable])).rows;
  const superseded=new Set(rows.map((row:any)=>row.parent_id));
  for(const row of await currentAttachmentRows(c,'customer_file',rows)){
   if(row.scan!=='clean'||superseded.has(row.id))continue;
   const doc=cipher.open(row.payload_cipher);
   if(!['residence','visa'].includes(doc.kind))continue;
   const files=clientFiles.get(row.customer_id)||[];
   files.push({...doc,id:row.id});clientFiles.set(row.customer_id,files);
  }
 }
 const documentNumber=(value:unknown)=>String(value||'').normalize('NFKC').replace(/[^\p{L}\p{N}]/gu,'').toLowerCase();
 for(const {id,profile} of clients){
  const identity=(profile.identityDocuments||[]).filter((doc:any)=>['residence','visa'].includes(doc.kind));
  const files=clientFiles.get(id)||[],used=new Set<string>(),company=profile.residencyCompanyId||profile.sponsorCompanyId;
  for(const doc of identity){
   const number=documentNumber(doc.number);
   const matches=files.filter(file=>file.kind===doc.kind&&((number&&documentNumber(file.documentNumber)===number)||file.id===doc.verifiedVersionId));
   if(matches.length){
    for(const file of matches){
     used.add(file.id);
     record('customers',id,file.residenceCompanyId||doc.residenceCompanyId||company,file.issuedOn||doc.issuedOn,file.expiresOn||doc.expiresOn);
    }
   }else record('customers',id,doc.residenceCompanyId||company,doc.issuedOn,doc.expiresOn);
  }
  for(const file of files)if(!used.has(file.id))record('customers',id,file.residenceCompanyId||company,file.issuedOn,file.expiresOn);
 }
 const hrScope=[...allowed].filter(co=>hrRight(m,'view',co)&&hrRight(m,'documents',co));
 if(hrScope.length&&await has(c,'hr_document_records')){
  const rows=(await c.query(`select distinct on(v.document_id) r.employee_id,r.expires_on::text expires,
   r.payload_cipher,v.document_id from ab.hr_document_records r
   join ab.hr_employees e on e.id=r.employee_id join ab.document_versions v on v.id=r.version_id
   where e.company_id=any($1::uuid[]) and r.kind in ('residence','visa')
   and r.state='Approved' and v.scan_status='clean'
   order by v.document_id,v.version desc,r.id desc`,[hrScope])).rows;
  const withdrawn=await withdrawnAttachments(c,'document'),archived=await archivedAttachments(c,'document');
  for(const row of rows){
   if(withdrawn.has(row.document_id)||archived.has(row.document_id))continue;
   const doc=cipher.open(row.payload_cipher);
   if(doc.residenceCompanyId&&allowed.has(doc.residenceCompanyId)&&!hrScope.includes(doc.residenceCompanyId))continue;
   record('employees',row.employee_id,doc.residenceCompanyId,doc.issuedOn,row.expires);
  }
 }
 const cells={customers:{},employees:{}} as Record<keyof typeof groups,Record<string,number>>;
 const totals={customers:0,employees:0};
 for(const group of ['customers','employees'] as const){
  const distinct=new Set<string>();
  for(const co of allowed){
   const people=groups[group].get(co)||[];
   cells[group][co]=groups[group].get(co)?.size||0;
   for(const id of people)distinct.add(id);
  }
  totals[group]=distinct.size;
 }
 return {cells,totals};
}
async function pendingResidenceCustomers(c:any,cipher:any,companies:string[]){
 if(!companies.length)return 0;
 const events=(await c.query(`select e.id,e.customer_id,e.company_id,e.kind,e.payload_cipher
  from ab.customer_events e join ab.customers customer on customer.id=e.customer_id
  where e.company_id=any($1::uuid[]) and customer.company_id=any($1::uuid[])
    and e.kind in ('service_request_created','service_request_action')
  order by e.created_at,e.id`,[companies])).rows;
 const requests=new Map<string,{customerId:string;companyId:string;transactionType:string;state:string}>();
 for(const event of events){
  const data=cipher.open(event.payload_cipher).after;
  if(event.kind==='service_request_created'&&data.type==='residence'){
   requests.set(event.id,{customerId:event.customer_id,companyId:event.company_id,transactionType:data.transactionType,state:'Open'});
  }else if(event.kind==='service_request_action'){
   const request=requests.get(data.requestId);
   if(!request||request.customerId!==event.customer_id||request.companyId!==event.company_id)continue;
   if(data.action==='status')request.state=data.state;
   if(data.action==='request_revised'&&data.fields?.transactionType)request.transactionType=data.fields.transactionType;
  }
 }
 // Completed requests can still require follow-up before the separate Closed transition.
 return new Set([...requests.values()].filter(request=>
  ['new','cancellation','amendment'].includes(request.transactionType)&&!['Closed','Cancelled'].includes(request.state)
 ).map(request=>request.customerId)).size;
}
export async function customerRegisterSummary(c:any,m:any,cipher:any){
 const companies=m.state.companies.filter((co:any)=>customerCan(m,'view',co.id));
 const allowed=new Set<string>(companies.map((co:any)=>co.id));
 const clients=(await c.query('select id,company_id,status,payload_cipher from ab.customers where company_id=any($1::uuid[])',[[...allowed]])).rows;
 requireOk(clients.length<=20000,422,'customerSummaryRangeRequired');
 const profiles=clients.map((r:any)=>({...r,profile:cipher.open(r.payload_cipher)}));
 const links=new Map<string,Set<string>>(),operational=new Set<string>();
 for(const r of profiles){
  const recorded=[r.profile.residencyCompanyId,r.profile.sponsorCompanyId].filter(id=>allowed.has(id));
  links.set(r.id,new Set([r.company_id,...recorded]));
  if(recorded.length)operational.add(r.id);
 }
 for(const v of await summaryVehicles(c,m)||[])if(allowed.has(v.company_id)){
  links.get(v.customer_id)?.add(v.company_id);operational.add(v.customer_id);
 }
 const cells:any={Active:{},Pending:{},Prospect:{},Ended:{}},totals:any={Active:0,Pending:0,Prospect:0,Ended:0};
 for(const counts of Object.values(cells) as Record<string,number>[])for(const id of allowed)counts[id]=0;
 for(const r of profiles){
  const bucket=customerBucket(r.status);
  totals[bucket]++;
  for(const co of links.get(r.id)||[])cells[bucket][co]++;
 }
 return {companies:companies.map((x:any)=>({id:x.id,nameAr:x.arabicName,nameEn:x.englishName,licence:x.tradeLicenseNumber})),
  customers:{cells,totals,total:clients.length,withoutOperationalCompany:clients.filter((r:any)=>!operational.has(r.id)).length,relationTypes:['record_scope','residency','sponsor','registered_vehicle'],distinctTotal:true},
  residences:await residenceSummary(c,m,cipher,profiles,allowed),pendingResidenceCustomers:await pendingResidenceCustomers(c,cipher,[...allowed]),asOf:new Date().toISOString()};
}
export async function customerOverview(c:any,m:any,cipher:any,client:any,events:any[]){
 const companyIds=m.state.companies.map((co:any)=>co.id),vehicleScope=companyIds.filter((co:string)=>vehicleRight(m,'view',co)),financialScope=companyIds.filter((co:string)=>financeRight(m,'ledger_view',co)),vehicleAvailable=await has(c,'vehicles'),ledger=await has(c,'finance_invoice_links');
 const vehicleRows=vehicleAvailable?(await c.query('select v.*,r.finance_type from ab.vehicles v join ab.vehicle_requests r on r.id=v.request_id where v.customer_id=$1 and v.company_id=any($2::uuid[]) order by v.file_number',[client.id,vehicleScope])).rows:[];
 const native:any[]=[];
 if(ledger)for(const companyId of financialScope)native.push(...await invoices(c,{companyId,customerId:client.id}));
 const known=new Set(native.map(i=>i.id));
 if(vehicleAvailable)for(const v of vehicleRows.filter((v:any)=>financialScope.includes(v.company_id)))for(const i of await vehicleInvoices(c,v.id))if(!known.has(i.id)){known.add(i.id);native.push({...i,outstanding:i.legalOutstanding,bookOutstanding:i.outstanding,written_off:i.writtenOff});}
 const discountRows=vehicleAvailable&&native.length?(await c.query("select a.invoice_id,sum(a.amount)::text amount from ab.vehicle_invoice_adjustments a left join ab.settings meta on meta.tenant_id=a.tenant_id and meta.key='financial-package-v1:documents:'||a.company_id::text||':'||a.id::text where a.invoice_id=any($1::uuid[]) and a.kind='waiver' and coalesce(meta.value->'index'->>'documentType','Discount')='Discount' group by a.invoice_id",[native.map(i=>i.id)])).rows:[];const discounts=new Map(discountRows.map((r:any)=>[r.invoice_id,r.amount]));
 const groups:any={};
 for(const i of native){const k=i.company_id+':'+i.currency;(groups[k]??=[]).push(i);}
 const finances:any[]|null=financialScope.length&&vehicleAvailable?Object.entries(groups).map(([key,rows]:any)=>{const [companyId,currency]=key.split(':');const due=rows.filter((i:any)=>i.dueOn<=today()),dueAmount=due.reduce((n:bigint,i:any)=>n+V.units(i.amount)-V.units(i.credited),0n),duePaid=due.reduce((n:bigint,i:any)=>n+V.units(i.paid),0n);return{companyId,currency,paymentCompliance:dueAmount>0n?Number(duePaid*10000n/dueAmount)/100:null,invoiced:sum(rows,'amount'),allocatedReceipts:sum(rows,'paid'),discounts:V.money(rows.reduce((n:bigint,i:any)=>n+V.units(String(discounts.get(i.id)||'0')),0n)),noncashCredits:sum(rows,'credited'),legalRemaining:sum(rows,'outstanding'),remaining:sum(rows,'bookOutstanding'),overdue:sum(rows.filter((i:any)=>i.dueOn<today()),'bookOutstanding'),dueToday:sum(rows.filter((i:any)=>i.dueOn===today()),'bookOutstanding'),future:sum(rows.filter((i:any)=>i.dueOn>today()),'bookOutstanding'),writtenOff:sum(rows,'written_off')};}):null;
 // RV totals are independent of invoice allocations; pending/returned cheques and credit notes are not cash.
 if(ledger&&finances){const receipts=(await c.query("select company_id,currency,sum(amount)::text amount from ab.finance_receipts where customer_id=$1 and company_id=any($2::uuid[]) and kind<>'credit' and payment_state='Cleared' group by company_id,currency",[client.id,financialScope])).rows;for(const r of receipts){let g=finances.find((x:any)=>x.companyId===r.company_id&&x.currency===r.currency);if(!g){g={companyId:r.company_id,currency:r.currency,invoiced:'0.000',legalRemaining:'0.000',noncashCredits:'0.000',allocatedReceipts:'0.000',discounts:'0.000',remaining:'0.000',overdue:'0.000',dueToday:'0.000',future:'0.000',writtenOff:'0.000'};finances.push(g);}g.receipts=V.money(V.units(r.amount));}for(const g of finances)g.receipts??='0.000';}
 else if(finances)for(const g of finances)g.receipts=g.allocatedReceipts;
 const violations=ledger&&financialScope.length?Number((await c.query("select count(*) n from ab.vehicle_invoices i left join ab.finance_invoice_links l on l.invoice_id=i.id left join ab.finance_items it on it.id=l.item_id where i.customer_id=$1 and i.company_id=any($2::uuid[]) and (i.kind='fine' or it.category='fine')",[client.id,financialScope])).rows[0].n):null;
 const ve=vehicleAvailable?(await c.query("select vehicle_id,kind,count(*)::int n from ab.vehicle_events where company_id=any($1::uuid[]) and vehicle_id=any($2::uuid[]) and kind in('rescheduled','settlement_executed') group by vehicle_id,kind",[vehicleScope,vehicleRows.map((v:any)=>v.id)])).rows:[];
 const contracts=vehicleRows.length?(await c.query('select distinct on(vehicle_id) vehicle_id,payload_cipher from ab.vehicle_contracts where vehicle_id=any($1::uuid[]) order by vehicle_id,created_at desc,id desc',[vehicleRows.map((v:any)=>v.id)])).rows:[];
 const vehicles=vehicleRows.map((r:any)=>{const d=vehicleData(r,cipher),bills=native.filter(i=>i.vehicle_id===r.id),coFinancial=financialScope.includes(r.company_id),contract=contracts.find((x:any)=>x.vehicle_id===r.id),terms=contract?cipher.open(contract.payload_cipher):{},due=bills.filter(i=>i.dueOn<=today()),dueAmount=due.reduce((n:bigint,i:any)=>n+V.units(i.amount)-V.units(i.credited),0n),duePaid=due.reduce((n:bigint,i:any)=>n+V.units(i.paid),0n);return{id:r.id,fileNumber:d.fileNumber,vehicleType:d.vehicleType,make:d.make,model:d.model,plate:d.plate||'',companyId:r.company_id,financeType:r.finance_type,status:r.status,relationshipType:r.status==='Terminated'?'Historical':'Current',reschedules:coFinancial?ve.find((x:any)=>x.vehicle_id===r.id&&x.kind==='rescheduled')?.n||0:null,financial:coFinancial?{currency:d.currency,balances:[...new Set(bills.map((i:any)=>i.currency))].map(currency=>({currency,remaining:sum(bills.filter((i:any)=>i.currency===currency),'bookOutstanding')})),principal:terms.principal||d.principal||null,registrationMonthlyFee:terms.serviceMonthly||d.registrationMonthlyFee||null,remaining:sum(bills,'bookOutstanding'),overdue:sum(bills.filter(i=>i.dueOn<today()),'bookOutstanding'),paymentState:!bills.length?'NotActivated':bills.some(i=>V.units(i.bookOutstanding)>0n)?'Outstanding':'Paid',commitment:dueAmount>0n?Number(duePaid*10000n/dueAmount)/100:null}:null,rating:null};});
 const serviceEvents=events.filter((e:any)=>e.kind==='service_request_created'),serviceRows=serviceEvents.map((e:any)=>({id:e.id,...e.after}));
 const latestResidence=serviceRows.filter((r:any)=>r.type==='residence').at(-1);const residence=latestResidence?{transactionType:latestResidence.transactionType,status:events.filter((e:any)=>e.kind==='service_request_action'&&e.after.requestId===latestResidence.id&&e.after.action==='status').at(-1)?.after.state||'Open'}:null;
 const serviceCounts={vehicles:vehicles.length,residence:new Set(serviceRows.filter((x:any)=>x.type==='residence').map((x:any)=>x.id)).size,general:new Set(serviceRows.filter((x:any)=>x.type==='general').map((x:any)=>x.id)).size,other:null};
 const custody=events.filter((e:any)=>e.kind==='passport_custody').map((e:any)=>({id:e.id,createdAt:e.createdAt,actorNameAr:m.state.users.find((u:any)=>u.id===e.actorId)?.nameAr||'',actorNameEn:m.state.users.find((u:any)=>u.id===e.actorId)?.nameEn||'',...e.after}));
 const notes=events.filter((e:any)=>e.kind==='note').slice(-3).reverse().map((e:any)=>({...e,actorNameAr:m.state.users.find((u:any)=>u.id===e.actorId)?.nameAr||'',actorNameEn:m.state.users.find((u:any)=>u.id===e.actorId)?.nameEn||''}));
 const recentFinancial=ledger&&financialScope.length?(await c.query(`select * from (select i.id,i.company_id,i.currency,i.created_at at,'Invoice' kind,i.invoice_number::text number,i.amount::text amount from ab.vehicle_invoices i where i.customer_id=$1 and i.company_id=any($2::uuid[]) union all select r.id,r.company_id,r.currency,r.created_at at,'RV' kind,r.receipt_number::text number,r.amount::text amount from ab.finance_receipts r where r.customer_id=$1 and r.company_id=any($2::uuid[]) and r.kind<>'credit' and r.payment_state='Cleared' union all select a.id,a.company_id,i.currency,a.created_at at,a.kind kind,i.invoice_number::text number,a.amount::text amount from ab.vehicle_invoice_adjustments a join ab.vehicle_invoices i on i.id=a.invoice_id where i.customer_id=$1 and i.company_id=any($2::uuid[])) x order by at desc,id desc limit 2`,[client.id,financialScope])).rows:[];
 return{recentFinancial,canStatement:companyIds.some((co:string)=>customerCan(m,'view',co)&&(financeRight(m,'ledger_view',co)||financeRight(m,'finance_view',co))),violations,closureDocumentIds:customerCan(m,'documents',client.company_id)?[...new Set(events.filter((e:any)=>e.kind==='relationship_end_requested').flatMap((e:any)=>e.after.documentIds||[]))]:[],residence,createdAt:client.created_at,vehicles,vehicleAvailable,financials:finances,notes,services:serviceCounts,reschedules:financialScope.length?ve.filter((x:any)=>x.kind==='rescheduled'&&financialScope.includes(vehicleRows.find((v:any)=>v.id===x.vehicle_id)?.company_id)).reduce((n:number,x:any)=>n+x.n,0):null,settlements:financialScope.length?ve.filter((x:any)=>x.kind==='settlement_executed'&&financialScope.includes(vehicleRows.find((v:any)=>v.id===x.vehicle_id)?.company_id)).reduce((n:number,x:any)=>n+x.n,0):null,undertakings:events.filter((e:any)=>e.kind==='undertaking_completed').length,custody:{current:customerCan(m,'documents',client.company_id)?custody.at(-1)?.holder||null:null,history:customerCan(m,'documents',client.company_id)?custody:[]},rating:{total:null,method:null,reason:'policyNotApproved'},asOf:new Date().toISOString()};
}

export async function customerRegisterFacts(c:any,m:any,cipher:any,clients:any[]){
 const ids=clients.map(r=>r.id),companies=m.state.companies,view=companies.filter((x:any)=>vehicleRight(m,'view',x.id)).map((x:any)=>x.id),financial=companies.filter((x:any)=>financeRight(m,'ledger_view',x.id)).map((x:any)=>x.id),result=new Map<string,any>();if(!ids.length)return result;
 const vehicleAvailable=await has(c,'vehicles'),ledger=await has(c,'finance_invoice_links');
 const vehicles=vehicleAvailable?(await c.query('select customer_id,company_id,count(*)::int n from ab.vehicles where customer_id=any($1::uuid[]) and company_id=any($2::uuid[])group by customer_id,company_id',[ids,view])).rows:[];
 const bills=ledger?(await c.query(`select i.customer_id,i.currency,sum(i.amount)::text amount,sum(ab.financial_allocation_total(i.id))::text paid,sum(greatest(0,i.amount-ab.financial_allocation_total(i.id)-coalesce((select sum(a.amount) from ab.vehicle_invoice_adjustments a where a.invoice_id=i.id),0)))::text remaining from ab.vehicle_invoices i where i.customer_id=any($1::uuid[]) and i.company_id=any($2::uuid[])group by i.customer_id,i.currency`,[ids,financial])).rows:[];
 for(const r of clients){const p=cipher.open(r.payload_cipher),vs=vehicles.filter((v:any)=>v.customer_id===r.id),fs=bills.filter((b:any)=>b.customer_id===r.id),cos=[...new Set([r.company_id,p.residencyCompanyId,p.sponsorCompanyId,...vs.map((v:any)=>v.company_id)].filter(id=>companies.some((co:any)=>co.id===id&&customerCan(m,'view',id))))];const coNames=cos.map(id=>{const co=companies.find((x:any)=>x.id===id);return{ar:co.arabicName,en:co.englishName};});const residence=p.identityDocuments?.find((d:any)=>d.kind==='residence');result.set(r.id,{companyNamesAr:coNames.map(x=>x.ar).join(' · '),companyNamesEn:coNames.map(x=>x.en).join(' · '),vehicles:vehicleAvailable&&view.length?vs.reduce((n:number,v:any)=>n+v.n,0):null,invoiced:ledger&&financial.length&&fs.length<=1?fs[0]?.amount||'0.000':null,collected:ledger&&financial.length&&fs.length<=1?fs[0]?.paid||'0.000':null,remaining:ledger&&financial.length&&fs.length<=1?fs[0]?.remaining||'0.000':null,financialCurrency:fs.length===1?fs[0].currency:null,residenceState:residence?.expiresOn?(residence.expiresOn<today()?'Expired':'DocumentCurrent'):'NotRecorded',rating:null});}return result;
}
