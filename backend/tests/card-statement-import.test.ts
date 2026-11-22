import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {zipSync,unzipSync,strToU8} from 'fflate';
import {statementDecimal,statementDate,statementFileRows,statementMapping,cardStatementTemplate,previewStatementRows,canonicalCardStatement} from '../src/card-statement-import.js';
import {ledgerFixture} from './ledger-fixture.js';
import {today} from '../src/vehicle-domain.js';
import {sha} from '../src/core.js';

test('statement mapping uses explicit numeric/date formats, exact minor units and visible row errors without inferring financial classification',async()=>{
 assert.equal(statementDecimal('1,234.005','dot_decimal'),1234005n);assert.equal(statementDecimal('1.234,005','comma_decimal'),1234005n);
 assert.equal(statementDecimal('(20.001)','dot_decimal'),-20001n);assert.equal(statementDecimal('١٢٣.٥٠٠','dot_decimal'),123500n);
 for(const x of ['1e3','NaN','1,23.00','0.0001','EUR 10','1000000000000000'])assert.throws(()=>statementDecimal(x,'dot_decimal'));
 assert.throws(()=>statementDecimal('-5','dot_decimal',false));assert.equal(statementDate('31/01/2026','DMY'),'2026-01-31');assert.equal(statementDate('01/31/2026','MDY'),'2026-01-31');assert.throws(()=>statementDate('2026-02-29','ISO'));assert.throws(()=>statementDate('31/01/2026','ISO'));
 const mapping={date:'Date',reference:'Ref',debit:'Debit',credit:'Credit',currency:'CCY',mode:'debit_credit',dateFormat:'ISO',numberFormat:'dot_decimal'},header={periodFrom:'2026-01-01',periodTo:'2026-01-31',openingBalance:'0',closingBalance:'80'};
 assert(statementMapping.safeParse(mapping).success);assert(!statementMapping.safeParse({...mapping,debit:'Credit'}).success);
 const valid=[{Date:'2026-01-05',Ref:'SYN-CHARGE',Debit:'100.001',Credit:'',CCY:'AED'},{Date:'2026-01-06',Ref:'SYN-CREDIT',Debit:'',Credit:'20.001',CCY:'AED'}],preview=previewStatementRows(valid,mapping,header);
 assert.equal(preview.balanced,true);assert.equal(preview.net,'80.000');assert.equal(preview.credits,'20.001');assert.equal(preview.rows[1].suggestion,'issuer_credit_review');assert.equal(preview.classificationAutomatic,false);
 const bad=previewStatementRows([{...valid[0],Debit:'1',Credit:'2'},{...valid[0],CCY:'USD'},{...valid[0],Date:'2026-02-01'}],mapping,header);assert.equal(bad.balanced,false);assert.deepEqual(bad.rows.map(r=>r.error),['statementBothSides','statementCurrencyMismatch','statementDateOutsidePeriod']);
 await assert.rejects(statementFileRows(Buffer.from('Date,Ref,Amount\n2026-01-05,SYN,1,000\n'),'csv'));
 await assert.rejects(statementFileRows(Buffer.from('Date,Ref,Ref\n2026-01-05,SYN,1\n'),'csv'));
 const read=await statementFileRows(Buffer.from('\uFEFFDate,Ref,Amount\n2026-01-05,"SYN,QUOTED",1.001\n'),'csv');assert.equal(read.rows[0].Ref,'SYN,QUOTED');
 assert.equal(canonicalCardStatement('card','AED',{...header,lines:preview.rows.map(r=>r.value)}),canonicalCardStatement('card','AED',{...header,lines:preview.rows.map(r=>r.value).reverse()}));
});

function workbook(rows:string[][]){const template=cardStatementTemplate('xlsx'),files=unzipSync(Buffer.from(template.base64,'base64')),escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');files['xl/worksheets/sheet1.xml']=strToU8('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((r,i)=>'<row r="'+(i+1)+'">'+r.map((v,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t>'+escape(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>');return Buffer.from(zipSync(files));}

test('original personal-card CSV/XLSX imports preserve native statements, credits and legacy documents without double import or any financial posting',async()=>{
 const f=await ledgerFixture();try{
  const payable=await f.req('POST','/api/ledger/accounts',{nameAr:'مستحقات مالك كشف وهمي',nameEn:'Synthetic statement Owner payable',kind:'liability',companyIds:[f.co1],currency:'AED'}),proof=await f.proof(),cardBody={companyId:f.co1,holderId:f.org.user,bankName:'Synthetic issuer',lastFour:'4567',name:'Synthetic personal statement card',currency:'AED',dueDay:15,liabilityId:payable.charts[0].id,ownership:'personal_owner'},card=await f.req('POST','/api/ledger/cards',cardBody),day=today(),from=day.slice(0,7)+'-01';
  const rows=[[day,'SYN-CHARGE-A','100.001','','AED'],[day,'SYN-PERSONAL-B','5','','AED'],[day,'SYN-ISSUER-CREDIT','','20.001','AED']],csv='Date,Reference,Debit,Credit,CCY\n'+rows.map(r=>r.join(',')).join('\n')+'\n',file={format:'csv',base64:Buffer.from(csv).toString('base64')},header={periodFrom:from,periodTo:day,openingBalance:'0',closingBalance:'85',documentVersionId:proof},mapping={date:'Date',reference:'Reference',debit:'Debit',credit:'Credit',currency:'CCY',mode:'debit_credit',dateFormat:'ISO',numberFormat:'dot_decimal'},body={file,name:'synthetic-original.csv',header,mapping,currencyReviewedAsAED:true},base='/api/ledger/cards/'+card.id+'/statement-import';
  const columns=await f.req('POST',base+'/columns',file);assert.equal(columns.rowCount,3);assert.deepEqual(columns.columns,['Date','Reference','Debit','Credit','CCY']);
  const template=await f.req('GET',base+'/template?format=xlsx');assert.equal(template.financialEffect,false);assert.equal(template.filename,'card-statement-template.xlsx');
  const grants=(await f.admin.query('select * from ab.permission_grants order by id')).rows;
  const wrong=await f.req('POST',base+'/preview',{...body,header:{...header,closingBalance:'86'}});assert.equal(wrong.balanced,false);assert.equal(wrong.difference,'1.000');await f.req('POST',base+'/confirm',{previewId:wrong.id,digest:wrong.digest,confirm:true},422);
  assert.equal((await f.admin.query('select count(*)::int n from ab.finance_statements')).rows[0].n,0);
  const preview=await f.req('POST',base+'/preview',body);assert.equal((await f.req('POST',base+'/preview',{...body,name:'same-content-renamed.csv'})).id,preview.id);assert.equal(preview.balanced,true);assert.equal(preview.charges,'105.001');assert.equal(preview.credits,'20.001');assert.equal(preview.classificationAutomatic,false);
  await f.req('POST',base+'/confirm',{previewId:preview.id,digest:'0'.repeat(64),confirm:true},409);
  const forgedPreview=randomUUID(),sourcePreview=(await f.admin.query('select value from ab.settings where key=$1',['card-statement-import-v1:'+preview.id])).rows[0].value;await f.admin.query('insert into ab.settings(tenant_id,key,value)values($1,$2,$3)',[f.org.tenant,'card-statement-import-v1:'+forgedPreview,sourcePreview]);
  await f.req('POST',base+'/confirm',{previewId:forgedPreview,digest:preview.digest,confirm:true},409);
  const commit={previewId:preview.id,digest:preview.digest,confirm:true},[a,b]=await Promise.all([f.req('POST',base+'/confirm',commit),f.req('POST',base+'/confirm',commit)]);assert.equal(a.id,b.id);assert.equal(a.status,'Review');assert.equal(a.financialEffect,false);
  const inputRows=rows.map(r=>({date:r[0],reference:r[1],amount:r[2]||'-'+r[3]})),native=(await f.admin.query('select * from ab.finance_statements where id=$1',[a.id])).rows[0];assert.equal(native.source_hash,canonicalCardStatement(card.id,'AED',{...header,lines:inputRows}));
  const proof2=await f.proof(),xlsx=workbook([['Date','Reference','Debit','Credit','CCY'],...rows.slice().reverse()]),again=await f.req('POST',base+'/preview',{...body,name:'same-statement-different-format.xlsx',file:{format:'xlsx',base64:xlsx.toString('base64')},header:{...header,documentVersionId:proof2}}),same=await f.req('POST',base+'/confirm',{previewId:again.id,digest:again.digest,confirm:true});assert.equal(same.id,a.id);assert.equal(same.existing,true);
  const manual=await f.req('POST','/api/ledger/cards/'+card.id+'/statements',{...header,documentVersionId:proof2,lines:inputRows.slice().reverse()});assert.equal(manual.id,a.id);assert.equal((await f.admin.query('select document_version_id from ab.finance_statements where id=$1',[a.id])).rows[0].document_version_id,proof);
  // Seed a genuine old-format statement in this synthetic DB, without changing any existing row.
  const payable2=await f.req('POST','/api/ledger/accounts',{nameAr:'مستحقات مالك بطاقة اختبار ثانية',nameEn:'Synthetic second card Owner payable',kind:'liability',companyIds:[f.co1],currency:'AED'}),card2=await f.req('POST','/api/ledger/cards',{...cardBody,liabilityId:payable2.charts[0].id,lastFour:'4568',name:'Synthetic legacy statement card'}),legacyId=randomUUID(),legacyHash=sha(JSON.stringify({...header,lines:inputRows}));
  await f.req('POST','/api/ledger/cards/'+card2.id+'/statement-import/confirm',commit,409);
  await f.admin.query('insert into ab.finance_statements(id,tenant_id,company_id,card_id,period_from,period_to,opening_balance,closing_balance,source_hash,document_version_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[legacyId,f.org.tenant,f.co1,card2.id,from,day,'0','85',legacyHash,proof,f.org.user]);
  for(const [i,r]of inputRows.entries())await f.admin.query('insert into ab.finance_statement_lines(id,tenant_id,statement_id,line_no,effective_on,amount,reference)values($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),f.org.tenant,legacyId,i+1,r.date,r.amount,r.reference]);
  const retained=await f.req('POST','/api/ledger/cards/'+card2.id+'/statements',{...header,documentVersionId:proof2,lines:inputRows.slice().reverse()});assert.equal(retained.id,legacyId);assert.equal((await f.admin.query('select source_hash from ab.finance_statements where id=$1',[legacyId])).rows[0].source_hash,legacyHash);
  const negative=await f.req('POST','/api/ledger/cards/'+card.id+'/statements',{...header,closingBalance:'-5',lines:[{date:day,amount:'-5',reference:'SYN-UNMATCHED-CREDIT-BALANCE'}]});assert.equal(negative.status,'Review');
  const duplicateRows=await f.req('POST',base+'/preview',{...body,header:{...header,closingBalance:'10'},file:{format:'csv',base64:Buffer.from('Date,Reference,Debit,Credit,CCY\n'+[day,'SYN-REPEATED','5','','AED'].join(',')+'\n'+[day,'SYN-REPEATED','5','','AED'].join(',')+'\n').toString('base64')}});assert.equal(duplicateRows.duplicateRows,1);
  await f.req('POST',base+'/confirm',{previewId:duplicateRows.id,digest:duplicateRows.digest,confirm:true},422);const accepted=await f.req('POST',base+'/confirm',{previewId:duplicateRows.id,digest:duplicateRows.digest,duplicateRowsReviewed:true,confirm:true});assert.equal((await f.admin.query('select count(*)::int n from ab.finance_statement_lines where statement_id=$1',[accepted.id])).rows[0].n,2);
  await f.req('POST','/api/ledger/card-statements/'+a.id+'/approve',{},409);
  for(const table of ['finance_journals','finance_entries','vehicle_invoices','finance_receipts','finance_card_charges','finance_vouchers'])assert.equal((await f.admin.query('select count(*)::int n from ab.'+table)).rows[0].n,0,table+' unchanged by statement import');
  assert.deepEqual((await f.admin.query('select * from ab.permission_grants order by id')).rows,grants);
  const employee=await f.employee();for(const action of ['ledger_view','ledger_statement_upload','ledger_cards'])await f.req('POST','/api/users/'+employee.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});await f.login(employee.username,employee.password);
  await f.req('GET',base+'/template?format=csv',undefined,403);await f.req('POST',base+'/columns',file,403);await f.req('POST',base+'/preview',body,403);
  const restricted=await f.req('GET','/api/ledger/workbench?companyId='+f.co1);assert(!restricted.finance_cards.some((r:any)=>[card.id,card2.id].includes(r.id)));assert(!restricted.finance_statements.some((r:any)=>[card.id,card2.id].includes(r.card_id)));
 }finally{await f.close();}
});
