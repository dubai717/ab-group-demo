import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {fixture} from './fixture.js';
import {transaction} from '../src/core.js';
async function setup(){
 const f=await fixture('ab_backup_'+randomUUID().replaceAll('-',''));
 const catalog=(await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows;
 await f.admin.query(await readFile('supabase/proposed/009_financial_workbench.sql','utf8'));
 assert.deepEqual((await f.admin.query('select * from ab.role_permissions order by role_id,permission_id')).rows,catalog);
 let cookie='',csrf='';const sessions=new Map<string,{cookie:string;csrf:string}>();
 async function request(method:any,url:string,body?:any,expected=200,key:string=randomUUID()){
  const r=await f.app.inject({method,url,payload:body,headers:{origin:'http://127.0.0.1:3100','x-ab-request':'1','x-csrf-token':csrf,cookie,...(method!=='GET'?{'idempotency-key':key}:{})}});
  assert.equal(r.statusCode,expected,url+' '+r.body);return r;
 }
 async function login(username=f.username,password=f.password){const cached=sessions.get(username);if(cached){cookie=cached.cookie;csrf=cached.csrf;return;}const r=await request('POST','/api/login',{username,password});cookie=String(r.headers['set-cookie']).split(';')[0];csrf=(await request('GET','/api/bootstrap')).json().csrfToken;sessions.set(username,{cookie,csrf});}
 await login();
 const co1=(await request('POST','/api/companies',{arabicName:'شركة مالية وهمية',englishName:'Fictional finance company',tradeLicenseNumber:'FIN-'+randomUUID(),status:'Active'})).json().id;
 const co2=(await request('POST','/api/companies',{arabicName:'شركة ثانية وهمية',englishName:'Fictional second company',tradeLicenseNumber:'FIN-'+randomUUID(),status:'Active'})).json().id;
 async function createBank(companyId:string,n:number,iban:string){return (await request('POST','/api/bank-accounts',{companyId,bankId:'demo-bank',branch:'Fictional',accountName:'Synthetic '+n,accountNumber:'FIN-'+n,iban,openedAt:'2026-01-01',status:'Active',purposeId:'operations',openingBalance:'1000.125',currency:'AED'})).json().id;}
 const b1=await createBank(co1,1,'AE070331234567890123456'),b2=await createBank(co1,2,'GB82WEST12345698765432'),b3=await createBank(co2,3,'FR1420041010050500013M02606');
 async function chart(companyId:string,code:string,kind:string,bankAccountId?:string){return(await request('POST','/api/finance/chart',{companyId,code,nameAr:code,nameEn:code,kind,bankAccountId,currency:'AED'})).json().id;}
 const cb1=await chart(co1,'BANK1','bank',b1),cb2=await chart(co1,'BANK2','bank',b2),cb3=await chart(co2,'BANK3','bank',b3),income=await chart(co1,'RECEIVABLE','asset'),from=await chart(co1,'INTERCOMPANY','asset'),to=await chart(co2,'INTERCOMPANY','liability');
 async function operation(patch:any={},key?:string){return(await request('POST','/api/finance/operations',{companyId:co1,kind:'receipt',bankAccountId:b1,amount:'25.125',currency:'AED',effectiveOn:'2026-02-01',direction:'credit',reason:'Synthetic operation',reference:randomUUID(),counterpartId:income,...patch},200,key)).json();}
 async function approve(op:string,body:any={revision:1},expected=200,key?:string){return request('POST','/api/finance/operations/'+op+'/approve',body,expected,key);}
 const work=async()=> (await request('GET','/api/finance/workbench')).json();
 async function proof(){return(await request('POST','/api/documents',{bankAccountId:b1,title:'Fictional bank confirmation',description:'Test evidence only',category:'original',date:'2026-02-01',name:'evidence.pdf',mime:'application/pdf',base64:Buffer.from('%PDF-1.4 synthetic').toString('base64')})).json().versionId;}
 async function employee(name:string){const username='fin_'+name+'_'+randomUUID().slice(0,8),email=username+'@example.test';const user=(await request('POST','/api/users',{nameAr:'موظف اختبار',nameEn:'Synthetic employee',username,email,phone:'',status:'Active',jobTitle:'Test',hireDate:'2026-01-01',managerId:f.org.user,companyIds:[co1],departmentIds:[],password:'Synthetic-Employee@123'})).json().id;return {user,username,password:'Synthetic-Employee@123'};}
 async function grant(user:string,action:string){await request('POST','/api/users/'+user+'/grants',{action,scope:{type:'company',id:co1},delegable:false});}
 return {...f,request,login,co1,co2,b1,b2,b3,cb1,cb2,cb3,income,from,to,operation,approve,work,proof,employee,grant,close:async()=>{await f.app.close();await f.runtime.end();await f.admin.end();}};
}
test('exact immutable posting, active bank selection, balanced cross-company transfers and deduplication',async()=>{const f=await setup();try{
 const initial=await f.work();assert.equal(initial.balances.find((b:any)=>b.id===f.b1).bookBalance,'1000.125');
 const key=randomUUID(),data={reference:'retry-safe'};const o=await f.operation(data,key);assert.equal((await f.operation(data,key)).id,o.id);
 assert.equal((await f.work()).balances.find((b:any)=>b.id===f.b1).bookBalance,'1000.125');
 const approvalKey=randomUUID();await f.approve(o.id,{revision:1},200,approvalKey);await f.approve(o.id,{revision:1},200,approvalKey);
 assert.equal((await f.work()).balances.find((b:any)=>b.id===f.b1).bookBalance,'1025.250');
 assert.equal(Number((await f.admin.query('select count(*) n from ab.finance_entries where operation_id=$1',[o.id])).rows[0].n),2);
 const transfer=await f.operation({kind:'transfer',toBankAccountId:f.b3,amount:'20',counterpartId:null,intercompanyFromId:f.from,intercompanyToId:f.to});await f.approve(transfer.id);
 const sums=(await f.admin.query('select company_id,sum(debit-credit)::text total from ab.finance_entries where operation_id=$1 group by company_id',[transfer.id])).rows;assert.equal(sums.length,2);assert(sums.every((r:any)=>Number(r.total)===0));
 const b=(await f.request('GET','/api/bank-accounts/'+f.b1)).json();await f.request('PATCH','/api/bank-accounts/'+f.b1,{...b,openingBalance:'999',revision:b.revision},409);
 await f.request('PATCH','/api/bank-accounts/'+f.b1,{...b,status:'Inactive',revision:b.revision});
 await f.request('POST','/api/finance/operations',{companyId:f.co1,kind:'receipt',bankAccountId:f.b1,amount:'1',currency:'AED',effectiveOn:'2026-02-01',reason:'Blocked inactive bank',reference:randomUUID(),counterpartId:f.income},422);
 await assert.rejects(()=>f.runtime.query('update ab.finance_entries set debit=999'),(e:any)=>e.code==='42501');
 await assert.rejects(()=>transaction(f.runtime,f.org.tenant,f.org.user,async c=>{await c.query('insert into ab.finance_operations(id,tenant_id,company_id,kind,bank_account_id,amount,currency,effective_on,direction,reason,reference,status,created_by,approved_by,approved_at)values($1,$2,$3,$4,$5,1,$6,$7,$8,$9,$10,$11,$12,$12,now())',[randomUUID(),f.org.tenant,f.co1,'receipt',f.b2,'AED','2026-02-01','credit','Invalid raw approval',randomUUID(),'Approved',f.org.user]);}), (e:any)=>e.code==='23514');
 }finally{await f.close();}});
test('cheques do not post until linked clearing settlement with scanned proof and bank confirmation',async()=>{const f=await setup();try{
 const cheque=(await f.request('POST','/api/finance/cheques',{companyId:f.co1,bankAccountId:f.b1,direction:'incoming',number:'SYNTHETIC-001',beneficiary:'Fictional client',amount:'50',currency:'AED',issuedOn:'2026-01-01',dueOn:'2026-02-01'})).json();
 let revision=1;for(const status of ['Deposited','Clearing']){await f.request('POST','/api/finance/cheques/'+cheque.id+'/status',{status,revision:revision++,reason:'Manual synthetic check'});assert.equal((await f.work()).balances.find((b:any)=>b.id===f.b1).bookBalance,'1000.125');}
 await f.request('POST','/api/finance/cheques/'+cheque.id+'/status',{status:'Collected',revision,reason:'Cannot bypass settlement'},422);
 const doc=await f.proof(),op=await f.operation({amount:'50',chequeId:cheque.id,documentVersionId:doc});await f.approve(op.id,{revision:1},422);await f.approve(op.id,{revision:1,bankConfirmation:'FAKE-BANK-REF'});
 assert.equal((await f.work()).cheques.find((c:any)=>c.id===cheque.id).status,'Collected');assert.equal((await f.work()).balances.find((b:any)=>b.id===f.b1).bookBalance,'1050.125');
 await f.request('POST','/api/finance/cheques/'+cheque.id+'/status',{status:'Returned',revision:4,reason:'Terminal'},422);
 }finally{await f.close();}});
test('custody stays with sender until named receiver accepts, rejection preserves holder and deposit posts once',async()=>{const f=await setup();try{
 const receiver=await f.employee('receiver');await f.grant(receiver.user,'finance_receive_custody');await f.grant(receiver.user,'finance_custody');await f.grant(receiver.user,'bank_view');
 const receipt=(await f.request('POST','/api/finance/receipts',{companyId:f.co1,kind:'cash',amount:'20',currency:'AED',reference:'CUSTODY-ONE'})).json();
 const h=(await f.request('POST','/api/finance/handovers',{companyId:f.co1,receiverId:receiver.user,receiptIds:[receipt.id]})).json();
 assert.equal((await f.admin.query('select holder_id from ab.finance_receipts where id=$1',[receipt.id])).rows[0].holder_id,f.org.user);
 await f.request('POST','/api/finance/handovers/'+h.id+'/receive',{accept:true,reason:''},403);
 await f.login(receiver.username,receiver.password);await f.request('POST','/api/finance/handovers/'+h.id+'/receive',{accept:false,reason:'Synthetic discrepancy'});
 assert.equal((await f.admin.query('select holder_id from ab.finance_receipts where id=$1',[receipt.id])).rows[0].holder_id,f.org.user);
 await f.login();const h2=(await f.request('POST','/api/finance/handovers',{companyId:f.co1,receiverId:receiver.user,receiptIds:[receipt.id]})).json();await f.login(receiver.username,receiver.password);await f.request('POST','/api/finance/handovers/'+h2.id+'/receive',{accept:true});
 assert.equal((await f.admin.query('select holder_id from ab.finance_receipts where id=$1',[receipt.id])).rows[0].holder_id,receiver.user);
 await f.login();const doc=await f.proof(),op=await f.operation({amount:'20',documentVersionId:doc});await f.login(receiver.username,receiver.password);await f.request('POST','/api/finance/receipts/deposit',{operationId:op.id,receiptIds:[receipt.id]});await f.login();await f.approve(op.id,{revision:1,bankConfirmation:'SYNTHETIC-CONFIRM'});
 await f.login(receiver.username,receiver.password);await f.request('POST','/api/finance/receipts/deposit',{operationId:op.id,receiptIds:[receipt.id]},422);
 }finally{await f.close();}});
test('manual statement review blocks unexplained differences, deduplicates uploads and matches posted entries only',async()=>{const f=await setup();try{
 const op=await f.operation({amount:'10',reference:'BANK-REF'});await f.approve(op.id);const doc=await f.proof();const input={bankAccountId:f.b1,periodFrom:'2026-02-01',periodTo:'2026-02-28',openingBalance:'1000.125',closingBalance:'1010.125',csv:'date,amount,reference\n2026-02-01,10,BANK-REF',documentVersionId:doc};
 const statement=(await f.request('POST','/api/finance/statements',input)).json();assert.equal((await f.request('POST','/api/finance/statements',input)).json().id,statement.id);
 await f.request('POST','/api/finance/statements',{...input,periodTo:'2026-03-01'},409);await f.request('POST','/api/finance/statements/'+statement.id+'/approve',{},422);
 const review=(await f.request('GET','/api/finance/statements/'+statement.id)).json();assert.equal(review.entries.length,1);await f.request('POST','/api/finance/statement-lines/'+review.lines[0].id+'/match',{entryId:review.entries[0].id,explanation:'Checked by human'});await f.request('POST','/api/finance/statements/'+statement.id+'/approve',{});
 await f.request('POST','/api/finance/statement-lines/'+review.lines[0].id+'/match',{entryId:review.entries[0].id},409);
 const out=(await f.request('GET','/api/finance/report?companyId='+f.co1+'&format=excel')).json();assert(out.data.includes('<Workbook'));assert(!out.data.includes('ss:Formula'));
 }finally{await f.close();}});
test('new rights are opt-in, company scoped, separate from approval and do not expose personal profiles; RLS denies unscoped reads',async()=>{const f=await setup();try{
 const user=await f.employee('limited');await f.grant(user.user,'bank_view');await f.grant(user.user,'finance_view');await f.grant(user.user,'finance_create');const op=await f.operation();
 await f.login(user.username,user.password);const work=await f.work();assert.deepEqual(work.companies.map((c:any)=>c.id),[f.co1]);await f.approve(op.id,{revision:1},403);
 await f.request('POST','/api/finance/chart',{companyId:f.co1,code:'DENY',nameAr:'x',nameEn:'x',kind:'asset',currency:'AED'},403);
 await f.request('GET','/api/finance/report?companyId='+f.co1+'&format=excel',undefined,403);
 const bootstrap=(await f.request('GET','/api/bootstrap')).json();assert(!bootstrap.users.some((u:any)=>u.id===f.org.user));
 for(const table of ['finance_operations','finance_entries','finance_chart','finance_cheques','finance_receipts','finance_handovers','finance_events'])assert.equal((await f.runtime.query('select * from ab.'+table)).rowCount,0);
 await f.request('POST','/api/finance/operations',{companyId:f.co2,kind:'receipt',bankAccountId:f.b3,amount:'1',currency:'AED',effectiveOn:'2026-02-01',reason:'Unauthorized company',reference:randomUUID(),counterpartId:f.income},403);
 }finally{await f.close();}});
test('registers, immutable encrypted audit, scoped notifications, retention and grouped bank totals',async()=>{const f=await setup();try{
 const recipient=await f.employee('notified');await f.grant(recipient.user,'bank_view');await f.grant(recipient.user,'finance_view');
 await f.request('POST','/api/finance/notification-rules',{companyId:f.co1,userId:recipient.user,action:'updated',region:'',jobTitle:''});
 const before=(await f.request('GET','/api/bank-accounts/'+f.b1)).json();const key=randomUUID();await f.request('PATCH','/api/bank-accounts/'+f.b1,{...before,relationshipManagerName:'Fictional updated manager',revision:before.revision},200,key);await f.request('PATCH','/api/bank-accounts/'+f.b1,{...before,relationshipManagerName:'Fictional updated manager',revision:before.revision},200,key);
 await f.request('POST','/api/finance/configuration',{companyId:f.co1,retentionDays:3650,budgetBytes:50000000});
 const op=await f.operation({reference:'=FORMULA-MUST-STAY-TEXT'});await f.approve(op.id);
 const doc=await f.proof();const expense=(await f.request('POST','/api/finance/expenses',{companyId:f.co1,path:'operational',amount:'2',currency:'AED',reason:'Fictional expense request',operationId:op.id,documentVersionId:doc})).json();assert.equal(expense.postingAvailable,false);await f.request('POST','/api/finance/expenses',{companyId:f.co2,path:'operational',amount:'2',currency:'AED',reason:'Wrong company link',operationId:op.id,documentVersionId:doc},422);
 const register=(await f.request('GET','/api/finance/register?companyId='+f.co1+'&kind=operations&status=Approved&bankId=demo-bank')).json();assert.equal(register.total,1);assert.equal(register.rows[0].id,op.id);
 const csv=(await f.request('GET','/api/finance/register?companyId='+f.co1+'&kind=operations&format=csv')).json();assert(csv.data.includes("'=FORMULA"));
 await f.request('GET','/api/finance/register?companyId='+f.co1+'&kind=receipts&status=Approved',undefined,422);
 const group=(await f.request('GET','/api/finance/group-report')).json();assert.equal(group.totals.AED,'3025.500');assert.equal(group.financialStatements,false);assert.equal(group.accountingEliminations,false);
 const events=(await f.request('GET','/api/finance/events?companyId='+f.co1)).json();const update=events.find((e:any)=>e.entity_id===f.b1&&e.action==='updated');assert.equal(update.payload.before.relationshipManagerName,'');assert.equal(update.payload.after.relationshipManagerName,'Fictional updated manager');assert(!('payload_cipher' in update));
 const raw=(await f.admin.query('select payload_cipher from ab.finance_events where id=$1',[update.id])).rows[0].payload_cipher;assert(!JSON.stringify(raw).includes('Fictional updated manager'));
 const w=await f.work();assert.equal(w.configuration.find((v:any)=>v.key==='finance:'+f.co1).value.autoDelete,false);
 await f.login(recipient.username,recipient.password);assert.equal((await f.work()).notifications.length,1);await f.request('GET','/api/finance/events?companyId='+f.co1,undefined,403);const limited=(await f.request('GET','/api/finance/group-report')).json();assert.equal(limited.rows.length,2);assert.equal(limited.totals.AED,'2025.375');
 }finally{await f.close();}});
