// Deliberative, narrowly additive schema operations. No arbitrary SQL/defaults/constraints/grants.
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {sha} from '../src/core.js';
import {personnelReleasePlan} from './personnel-release.js';
const allowedTables=new Set(['companies','company_licenses','bank_accounts','customers','vehicles','hr_employees']);
const types=new Set(['text','boolean','date','timestamptz','uuid']);
const ident=(v:unknown)=>typeof v==='string'&&/^[a-z][a-z0-9_]{0,47}$/.test(v);
const qi=(s:string)=>'"'+s+'"';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
export function additiveSql(name:string,body:any){
 need(/^0[1-9][0-9]_[a-z0-9_]+\.json$/.test(name)&&Number(name.slice(0,3))>=14,'ADDITIVE_NAME');
 need(body?.format==='AB-SAFE-ADDITIVE-1'&&Object.keys(body).sort().join(',')==='format,operations'&&Array.isArray(body.operations)&&body.operations.length>0&&body.operations.length<=8,'ADDITIVE_FORMAT');
 return body.operations.map((op:any,i:number)=>{
  need(op&&ident(op.table)&&allowedTables.has(op.table),'ADDITIVE_TABLE');
  if(op.kind==='addNullableColumn'){
   need(Object.keys(op).sort().join(',')==='column,kind,table,type'&&ident(op.column)&&op.column.startsWith('custom_')&&types.has(op.type),'ADDITIVE_COLUMN');
   return `ALTER TABLE ab.${qi(op.table)} ADD COLUMN ${qi(op.column)} ${op.type}`;
  }
  need(op.kind==='createIndex'&&Object.keys(op).sort().join(',')==='columns,kind,table'&&Array.isArray(op.columns)&&op.columns.length>0&&op.columns.length<=3&&op.columns.every(ident)&&new Set(op.columns).size===op.columns.length,'ADDITIVE_INDEX');
  return `CREATE INDEX ${qi('auto_'+name.slice(0,3)+'_'+i+'_'+op.table)} ON ab.${qi(op.table)} (${op.columns.map(qi).join(',')})`;
 });
}
export async function approvedCatalog(){const base=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations;for(const m of base)need(sha(await readFile('supabase/migrations/'+m.name,'utf8'))===m.sha256,'BASE_SQL_CHANGED');return [...base,...(await personnelReleasePlan()).migrations];}
export async function loadAdditives(root='.'){
 let names:string[];try{names=(await readdir(join(root,'supabase/additive'))).filter(x=>x.endsWith('.json')).sort();}catch(e:any){if(e.code==='ENOENT')return [];throw Error('ADDITIVE_DIRECTORY');}
 const rows=[];for(let i=0;i<names.length;i++){const name=names[i];need(Number(name.slice(0,3))===14+i,'ADDITIVE_SEQUENCE');const text=await readFile(join(root,'supabase/additive',name),'utf8');rows.push({name,sha256:sha(text),sql:additiveSql(name,JSON.parse(text))});}return rows;
}
export async function validateStagingLedger(rows:any[],root='.'){
 const base=await approvedCatalog(),extra=await loadAdditives(root);need(rows.length>=13&&rows.length<=base.length+extra.length,'STAGING_LEDGER_COUNT');
 need(base.every((m:any)=>rows.some(r=>r.name===m.name&&r.sha256===m.sha256)),'APPROVED_SCHEMA_HASH');
 const applied=rows.filter(r=>!base.some((m:any)=>m.name===r.name));for(let i=0;i<applied.length;i++)need(extra[i]&&applied.some(r=>r.name===extra[i].name&&r.sha256===extra[i].sha256),'ADDITIVE_HISTORY_CHANGED');
 return extra.slice(applied.length);
}
