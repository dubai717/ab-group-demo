import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {businessCentersFixture} from './business-centers-fixture.js';
import {transaction} from '../src/core.js';
import {monthlyReady} from '../src/investor-monthly-domain.js';
import {investorRegistryRestoreDrill} from './investor-registry-restore-drill.js';

test('Review-only monthly structures roll back atomically, preserve all old data/grants, enforce owner scope and restore in isolation',async()=>{
 const f=await businessCentersFixture();try{
 await f.admin.query(await readFile('supabase/additive/026_investor_registry_versions.sql','utf8'));await f.admin.query(await readFile('supabase/additive/027_investor_electronic_access.sql','utf8'));
 const person=await f.req('POST','/api/investor-registry/profiles',{nameAr:'مستثمر اختبار تسوية',nameEn:'Isolated monthly investor',type:'individual',identityNumber:'MONTHLY-SCHEMA',identityAuthority:'Synthetic',nationality:'AE',phone:'000',address:'Isolated'});
 const names=(await f.admin.query("select tablename from pg_tables where schemaname='ab' order by tablename")).rows.map((r:any)=>r.tablename);assert(names.every((s:string)=>/^[a-z0-9_]+$/.test(s)));
 const snapshot=async()=>{const result:any={};for(const name of names)result[name]=(await f.admin.query('select to_jsonb(x) row from ab.'+name+' x order by to_jsonb(x)::text')).rows;return result;};
 const before=await snapshot(),funcs=(await f.admin.query("select oid,pg_get_functiondef(oid) definition from pg_proc where pronamespace='ab'::regnamespace order by oid")).rows;
 assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>monthlyReady(c)),false);
 const sql=await readFile('docs/proposals/028_investor_monthly_settlements.review-only.sql','utf8');
 await f.admin.query('BEGIN');await f.admin.query(sql);await assert.rejects(f.admin.query('select 1/0'));await f.admin.query('ROLLBACK');assert.equal((await f.admin.query("select to_regclass('ab.investor_monthly_settlements') id")).rows[0].id,null);assert.deepEqual(await snapshot(),before);
 await f.admin.query('BEGIN');try{await f.admin.query(sql);await f.admin.query('COMMIT');}catch(error){await f.admin.query('ROLLBACK');throw error;}
 assert.equal(await transaction(f.runtime,f.org.tenant,f.org.user,c=>monthlyReady(c)),true);assert.deepEqual(await snapshot(),before);
 for(const fn of funcs)assert.equal((await f.admin.query('select pg_get_functiondef($1::oid) definition',[fn.oid])).rows[0].definition,fn.definition);
 const proof=await f.proof(),cfg=randomUUID();const values=[cfg,f.org.tenant,f.co1,'AED',f.accounts.payable.charts[f.co1],f.accounts.credit.charts[f.co1],f.accounts.income.charts[f.co1],f.items.commission,proof,f.org.user];
 const insert='insert into ab.investor_monthly_configurations(id,tenant_id,company_id,currency,capital_chart_id,payable_chart_id,fee_income_chart_id,payout_item_id,document_version_id,accounting_basis,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,\'gross_agency_on_collection\',$10)';
 await transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query(insert,values));
 assert.equal((await f.runtime.query('select * from ab.investor_monthly_configurations')).rowCount,0);
 const worker=await f.employee();await assert.rejects(transaction(f.runtime,f.org.tenant,worker.id,c=>c.query(insert,[randomUUID(),...values.slice(1,-1),worker.id])),(e:any)=>e.code==='42501');
 // The review-only classifier reuses live permission rows; it cannot expand a company's scope.
 const right=async(actor:string,company:string)=>(await transaction(f.runtime,f.org.tenant,actor,c=>c.query("select ab.investor_monthly_existing_right($1,ARRAY['ledger_collect']) ok",[company]))).rows[0].ok;
 assert.equal(await right(f.org.user,f.co1),true);assert.equal(await right(worker.id,f.co1),false);
 const grant=randomUUID();await f.admin.query("insert into ab.permission_grants(id,tenant_id,user_id,issuer_id,permission_id,scope_type,company_id)values($1,$2,$3,$4,'ledger_collect','company',$5)",[grant,f.org.tenant,worker.id,f.org.user,f.co1]);
 assert.equal(await right(worker.id,f.co1),true);assert.equal(await right(worker.id,f.co2),false);
 await f.admin.query('update ab.permission_grants set revoked_at=now()where id=$1',[grant]);assert.equal(await right(worker.id,f.co1),false);
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query('update ab.investor_monthly_configurations set currency=\'USD\'where id=$1',[cfg])),(e:any)=>e.code==='42501');
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query('delete from ab.investor_monthly_configurations where id=$1',[cfg])),(e:any)=>e.code==='42501');
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query("insert into ab.investor_monthly_settlements(id,tenant_id,company_id,investor_id,currency,period,configuration_id,status,amount,payload_cipher,created_by)values($1,$2,$3,$4,'AED','2026-11',$5,'Paid',1250,'synthetic',$6)",[randomUUID(),f.org.tenant,f.co1,person.id,cfg,f.org.user])),(e:any)=>e.code==='23514');
 const settlement=randomUUID(),draftSql="insert into ab.investor_monthly_settlements(id,tenant_id,company_id,investor_id,currency,period,configuration_id,amount,payload_cipher,created_by)values($1,$2,$3,$4,'AED','2026-11',$5,1250,'synthetic',$6)",draft=[settlement,f.org.tenant,f.co1,person.id,cfg,f.org.user];
 await transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query(draftSql,draft));
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query(draftSql,[randomUUID(),...draft.slice(1)])),(e:any)=>e.code==='23505');
 await assert.rejects(transaction(f.runtime,f.org.tenant,f.org.user,c=>c.query("update ab.investor_monthly_settlements set status='Reviewed',revision=revision+1 where id=$1",[settlement])),(e:any)=>e.code==='23514');
 assert.equal((await transaction(f.runtime,f.org.tenant,worker.id,c=>c.query("update ab.investor_monthly_settlements set status='Reviewed',revision=revision+1 where id=$1 returning id",[settlement]))).rowCount,0);
 await investorRegistryRestoreDrill(f,false);
 }finally{await f.close();}
});
