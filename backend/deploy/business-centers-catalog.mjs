// Trusted controller catalog: candidate SQL is compared as data, never executed/imported.
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Error(code);};
export function businessCatalog(root='.'){
 const plan=JSON.parse(readFileSync('backend/deploy/business-centers-release-plan.json','utf8'));
 need(plan.format==='AB-REVIEWED-BUSINESS-SQL-1'&&plan.migrations?.length===14,'BUSINESS_CATALOG_FORMAT');
 return plan.migrations.map((m,i)=>{
  need(m.name===m.path.split('/').at(-1)&&m.path==='supabase/additive/'+m.name&&/^0\d\d_[a-z_]+\.sql$/.test(m.name)&&Number(m.name.slice(0,3))===14+i&&/^[a-f0-9]{64}$/.test(m.sha256),'BUSINESS_CATALOG_SEQUENCE');
  const sql=readFileSync(root+'/'+m.path,'utf8');need(createHash('sha256').update(sql).digest('hex')===m.sha256,'BUSINESS_SQL_HASH');
  return {...m,sql};
 });
}
export function validateBusinessLedger(rows,base,plan=businessCatalog()){
 need(rows.length>=base.length&&rows.length<=base.length+plan.length,'BUSINESS_LEDGER_COUNT');
 need(base.length===13&&base.every(m=>rows.some(r=>r.name===m.name&&r.sha256===m.sha256)),'BUSINESS_BASE_LEDGER');
 const applied=rows.filter(r=>!base.some(m=>m.name===r.name));
 need(plan.slice(0,applied.length).every(m=>applied.some(r=>r.name===m.name&&r.sha256===m.sha256)),'BUSINESS_LEDGER_PREFIX');
 return plan.slice(applied.length);
}
export function verifyBusinessCandidate(){
 const plan=businessCatalog();businessCatalog('candidate');
 const extra=readdirSync('candidate/supabase/additive').filter(x=>x.endsWith('.sql')||x.endsWith('.json')).sort();
 need(JSON.stringify(extra)===JSON.stringify(plan.map(m=>m.name).sort()),'UNREVIEWED_BUSINESS_ADDITION');return plan;
}
