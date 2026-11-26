// Trusted controller catalog: candidate SQL is compared as data, never executed/imported.
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const need=(ok,code)=>{if(!ok)throw Error(code);};
const cataloguePath='supabase/proposed/030_accounting_item_catalogue.sql';
const catalogueName=cataloguePath.split('/').at(-1);
const catalogueHash='715f92c5a1a2977a4722ab6bcaf728bdadd2f91715139ccbec0d407a1f47efac';
const nextApproved=[
 ['028_investor_monthly_settlements.sql','2f997597dfd13540c68f714f191c349e611d7043648871caa4eeefc58938f94c'],
 ['029_operating_billing.sql','480957d07c28c728a6112d1aab969c5885ab634de0c7ef4da99b0a57825324e4'],
];
export function catalogueMigration(root='.'){
 const body=readFileSync(root+'/'+cataloguePath,'utf8');
 need(createHash('sha256').update(body).digest('hex')===catalogueHash,'CATALOGUE_SQL_HASH');
 const envelope=/^-- [^\n]+\nBEGIN;\n([\s\S]+)\nCOMMIT;\n$/.exec(body);
 need(envelope,'CATALOGUE_TRANSACTION_ENVELOPE');
 return {name:catalogueName,path:cataloguePath,sha256:catalogueHash,tables:[],sql:envelope[1]};
}
export function businessCatalog(root='.'){
 const plan=JSON.parse(readFileSync('backend/deploy/business-centers-release-plan.json','utf8'));
 need(plan.format==='AB-REVIEWED-BUSINESS-SQL-1'&&[14,15,16].includes(plan.migrations?.length),'BUSINESS_CATALOG_FORMAT');
 return plan.migrations.map((m,i)=>{
  need(m.name===m.path.split('/').at(-1)&&m.path==='supabase/additive/'+m.name&&/^0\d\d_[a-z_]+\.sql$/.test(m.name)&&Number(m.name.slice(0,3))===14+i&&/^[a-f0-9]{64}$/.test(m.sha256),'BUSINESS_CATALOG_SEQUENCE');
  if(i>=14){const [name,hash]=nextApproved[i-14];need(m.name===name&&m.sha256===hash,'BUSINESS_LATER_APPROVAL_HASH');}
  const sql=readFileSync(root+'/'+m.path,'utf8');need(createHash('sha256').update(sql).digest('hex')===m.sha256,'BUSINESS_SQL_HASH');
  return {...m,sql};
 });
}
export function validateBusinessLedger(rows,base,plan=businessCatalog()){
 need(rows.length>=base.length&&rows.length<=base.length+plan.length,'BUSINESS_LEDGER_COUNT');
 need(base.length===13&&base.every(m=>rows.some(r=>r.name===m.name&&r.sha256===m.sha256)),'BUSINESS_BASE_LEDGER');
 const applied=rows.filter(r=>!base.some(m=>m.name===r.name));
 const special=applied.find(r=>r.name===catalogueName);
 const ordered=plan.filter(m=>m.name!==catalogueName),catalogue=plan.find(m=>m.name===catalogueName);
 const ordinary=applied.filter(r=>r.name!==catalogueName);
 need(new Set(rows.map(r=>r.name)).size===rows.length,'BUSINESS_DUPLICATE_LEDGER_ROW');
 need(ordinary.length<=ordered.length&&ordered.slice(0,ordinary.length).every(m=>ordinary.some(r=>r.name===m.name&&r.sha256===m.sha256)),'BUSINESS_LEDGER_PREFIX');
 if(special||catalogue)need(ordinary.length>=14,'CATALOGUE_REQUIRES_027');
 if(special)need(catalogue&&special.sha256===catalogue.sha256,'CATALOGUE_LEDGER_HASH');
 return [...(catalogue&&!special?[catalogue]:[]),...ordered.slice(ordinary.length)];
}
export function verifyBusinessCandidate(){
 const plan=businessCatalog();businessCatalog('candidate');
 const extra=readdirSync('candidate/supabase/additive').filter(x=>x.endsWith('.sql')||x.endsWith('.json')).sort();
 need(JSON.stringify(extra)===JSON.stringify(plan.map(m=>m.name).sort()),'UNREVIEWED_BUSINESS_ADDITION');if(existsSync('candidate/'+cataloguePath)){
  const trusted=catalogueMigration();catalogueMigration('candidate');plan.push(trusted);
 }
 return plan;
}
