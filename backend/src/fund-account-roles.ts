// Prospective role checks only. Existing accounts, fund mappings and historical entries are never rewritten.
import {requireOk} from './core.js';
import {config} from './ledger-domain.js';
import {companyTaxDraft} from './company-tax-preparation.js';
import {assertWalletChartUse} from './wallet-posting-guards.js';
import {assertAdvanceAccountSeparation} from './employee-advances.js';
import {assertNotMonthlyControl} from './investor-monthly-domain.js';
async function controls(c:any,cipher:any,co:string){
 const cfg=await config(c,cipher,co),tax=await companyTaxDraft(c,cipher,co);
 return{chartIds:new Set<string>([cfg?.custodyAccountId,cfg?.chequeTransitAccountId,cfg?.customerCreditAccountId].filter(Boolean)),taxDefinitions:new Set<string>([tax?.vatControls?.inputAccountId,tax?.vatControls?.outputAccountId].filter(Boolean))};
}
// Cache only a derived role projection, bound to canonical ciphertext + actual historical item/company links.
// Hashing stays inside PostgreSQL: repeated fund operations transfer one digest rather than the full guide.
async function receivableDefinitions(c:any,cipher:any,co:string){
 const source=(await c.query(`with items as materialized(select id,payload_cipher from ab.finance_items),used as(select distinct item_id from ab.finance_invoice_links where company_id=$1),parts as(select 'i:'||id::text||':'||encode(sha256(convert_to(payload_cipher,'UTF8')),'hex') part from items union all select 'u:'||item_id::text from used) select encode(sha256(convert_to(coalesce(string_agg(part,E'\\n' order by part),''),'UTF8')),'hex') digest,(select count(*)::int from items) count from parts`,[co])).rows[0];
 requireOk(source.count<=20000,422,'fundAccountRoleReviewRequired');
 const key='financial-cash-role-projection-v1:'+co,old=(await c.query('select value from ab.settings where key=$1',[key])).rows[0],cache=old?cipher.open(old.value.cipher):null;
 if(cache?.version===1&&cache.companyId===co&&cache.sourceDigest===source.digest&&Array.isArray(cache.receivableDefinitionIds))return new Set<string>(cache.receivableDefinitionIds);
 const items=(await c.query('select it.payload_cipher,exists(select 1 from ab.finance_invoice_links l where l.company_id=$1 and l.item_id=it.id) historically_used from ab.finance_items it order by it.id limit 20001',[co])).rows;requireOk(items.length<=20000,422,'fundAccountRoleReviewRequired');
 const definitions=new Set<string>();for(const r of items){const d=cipher.open(r.payload_cipher);if(d.receivableId&&(r.historically_used||d.invoice&&(!d.companyIds?.length||d.companyIds.includes(co))))definitions.add(d.receivableId);}
 await c.query('insert into ab.settings(tenant_id,key,value)values(ab.tenant(),$1,$2)on conflict(tenant_id,key)do update set value=excluded.value',[key,{cipher:cipher.seal({version:1,companyId:co,sourceDigest:source.digest,receivableDefinitionIds:[...definitions].sort()})}]);return definitions;
}
async function definedCharts(c:any,co:string,ids:string[]){const rows=(await c.query('select ch.*,a.eliminate,a.active definition_active from ab.finance_chart ch left join ab.finance_accounts a on a.id=ch.definition_id where ch.company_id=$1 and ch.id=any($2::uuid[])',[co,[...new Set(ids)]])).rows;requireOk(rows.length===new Set(ids).size&&rows.every((r:any)=>r.kind==='asset'&&r.active&&r.definition_active!==false&&!r.bank_account_id),422,'cashFundAccountRequired');return rows;}
export async function assertCashFundAccounts(c:any,cipher:any,co:string,chartIds:string[],newAssignment=false){
 const ids=[...new Set(chartIds)],rows=await definedCharts(c,co,ids),role=await controls(c,cipher,co);
 requireOk(rows.every((r:any)=>!r.eliminate&&!role.chartIds.has(r.id)&&!role.taxDefinitions.has(r.definition_id)&&(!newAssignment||r.definition_id)),422,'cashFundAccountRequired');
 const receivables=await receivableDefinitions(c,cipher,co);
 requireOk(rows.every((r:any)=>!receivables.has(r.definition_id)),422,'cashFundAccountRequired');
 await assertWalletChartUse(c,co,ids);await assertAdvanceAccountSeparation(c,cipher,co,ids);await assertNotMonthlyControl(c,co,ids);
 if(newAssignment)requireOk(!(await c.query('select 1 from ab.finance_entries where chart_id=any($1::uuid[]) limit 1',[ids])).rowCount,409,'fundAccountHistoryReviewRequired');
 return rows;
}
export async function assertReceivableFundSeparation(c:any,cipher:any,co:string,definitionId:string){
 const rows=(await c.query('select ch.id,ch.kind,ch.bank_account_id from ab.finance_chart ch join ab.finance_accounts a on a.id=ch.definition_id where ch.company_id=$1 and ch.definition_id=$2',[co,definitionId])).rows;requireOk(rows.length>0&&rows.every((r:any)=>r.kind==='asset'&&!r.bank_account_id),422,'receivableCashRoleConflict');const role=await controls(c,cipher,co);
 requireOk(rows.every((r:any)=>!role.chartIds.has(r.id))&&!role.taxDefinitions.has(definitionId)&&!(await c.query('select 1 from ab.finance_funds where company_id=$1 and chart_id=any($2::uuid[]) limit 1',[co,rows.map((r:any)=>r.id)])).rowCount,422,'receivableCashRoleConflict');
}

