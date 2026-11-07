// Analyze UI preference changes without disclosing keys, users, company IDs or values.
import {Pool} from 'pg';
import {z} from 'zod';
import {security} from '../src/core.js';
import {docker} from './backup-restore-drill.js';
const need=(ok:unknown,code:string)=>{if(!ok)throw Error(code);};
const ledger=z.object({companyId:z.uuid(),tab:z.enum(['dashboard','invoices','collect','custody','deposits','vouchers','funds','cards','journals','reports','setup','import','closing','work','intercompany','reconciliation']),columns:z.array(z.string().max(60)).max(30).default([])}).strict();
const customer=z.object({columns:z.array(z.string().max(40)).max(30),filters:z.record(z.string(),z.string().max(4000)),scroll:z.number().min(0).max(1e7)}).strict();
export function isolatedSettingsCopy(text:string){
 const matches=[...text.matchAll(/^COPY ab\.settings \(tenant_id, key, value\) FROM stdin;\r?\n([\s\S]*?)^\\\.\r?$/gm)];need(matches.length===1,'DIAGNOSTIC_SETTINGS_COPY_FORMAT');
 return Buffer.from('COPY ab_drift_diagnostic.settings (tenant_id, key, value) FROM stdin;\n'+matches[0][1]+'\\.\n');
}
export async function oldSettingsFromIsolatedCopy(database:Buffer){
 const pool=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1});pool.on('error',()=>{});try{
 const c=await pool.connect();try{need((await c.query('select current_database()d')).rows[0].d==='ab_drill','DIAGNOSTIC_LOCAL_TARGET');need((await c.query("select 1 from pg_namespace where nspname in('ab','auth','storage','ab_drift_diagnostic')")).rowCount===0,'DIAGNOSTIC_LOCAL_NOT_EMPTY');await c.query('create schema ab_drift_diagnostic;create table ab_drift_diagnostic.settings(tenant_id uuid not null,key text not null,value jsonb not null)');}finally{c.release();}
 const sql=await docker(['exec','-i','ab-backup-drill-postgres','pg_restore','--data-only','--schema=ab','--table=settings','--no-owner','--no-privileges','--file=-'],{},database);
 await docker(['exec','-i','ab-backup-drill-postgres','psql','--host=127.0.0.1','--port=5432','--username=postgres','--dbname=ab_drill','--no-psqlrc','--set=ON_ERROR_STOP=1'],{},isolatedSettingsCopy(sql.toString()));
 return(await pool.query('select tenant_id,key,value,value::text raw_value from ab_drift_diagnostic.settings')).rows;
 }finally{await pool.end();}
}
export function classifySettingsChanges(before:any[],after:any[],key:string){
 const map=(rows:any[])=>new Map(rows.map(r=>[r.tenant_id+'\0'+r.key,r]));const old=map(before),now=map(after),changes=[];const cipher=security(key);
 for(const id of new Set([...old.keys(),...now.keys()])){const a=old.get(id),b=now.get(id);if(a&&b&&(a.raw_value??JSON.stringify(a.value))===(b.raw_value??JSON.stringify(b.value)))continue;let kind='UNKNOWN_SETTING_CHANGE',sameLogical=false;
 try{const row=b||a,prefix=/^(ledger-prefs|customer-prefs):[a-f0-9-]{36}$/.exec(row.key);if(prefix&&b&&[a,b].filter(Boolean).every(r=>r.value&&Object.keys(r.value).join(',')==='cipher')){const schema=prefix[1]==='ledger-prefs'?ledger:customer,latest=schema.parse(cipher.open(b.value.cipher)),prior=a?schema.parse(cipher.open(a.value.cipher)):undefined;sameLogical=!!prior&&JSON.stringify(prior)===JSON.stringify(latest);kind=sameLogical?'UI_PREFERENCE_CIPHER_REFRESH':'UI_NAVIGATION_PREFERENCE_CHANGE';}}catch{}
 changes.push({kind,sameLogical,added:!a,removed:!b});
 }return{mayRetry:changes.length>0&&changes.every(c=>c.kind!=='UNKNOWN_SETTING_CHANGE'),changes};
}
