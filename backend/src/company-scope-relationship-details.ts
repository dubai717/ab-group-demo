// Per-table, catalog-only relationship review. Never scans business records or approves scope activation.
import{z}from'zod';import{requireOk}from'./core.js';
export async function companyScopeRelationshipDetails(c:any,table:string){
 table=z.string().regex(/^[a-z][a-z0-9_]{0,62}$/).parse(table);
 const source=(await c.query(`select t.oid,t.relrowsecurity,t.relforcerowsecurity from pg_catalog.pg_class t join pg_catalog.pg_namespace n on n.oid=t.relnamespace where n.nspname='ab'and t.relname=$1 and t.relkind in('r','p')and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attname='tenant_id'and a.attnum>0 and not a.attisdropped)`,[table])).rows[0];requireOk(source,404,'scopeRelationshipSourceUnavailable');
 const rows=(await c.query(`select k.conname,pn.nspname parent_schema,p.relname parent_table,k.convalidated,k.condeferrable,k.condeferred,
 cardinality(k.conkey)::int column_count,count(*)over()::int relationship_count,
 (select jsonb_agg(jsonb_build_object('child',ca.attname,'parent',pa.attname)order by cols.ordinality)from unnest(k.conkey,k.confkey)with ordinality cols(child_num,parent_num,ordinality)join pg_catalog.pg_attribute ca on ca.attrelid=k.conrelid and ca.attnum=cols.child_num join pg_catalog.pg_attribute pa on pa.attrelid=k.confrelid and pa.attnum=cols.parent_num where cols.ordinality<=32)columns
 from pg_catalog.pg_constraint k join pg_catalog.pg_class p on p.oid=k.confrelid join pg_catalog.pg_namespace pn on pn.oid=p.relnamespace
 where k.conrelid=$1::oid and k.contype='f'order by k.conname limit 65`,[source.oid])).rows;
 const total=rows[0]?.relationship_count||0,relationships=rows.slice(0,64).map((r:any)=>({name:r.conname,parentSchema:r.parent_schema,parentTable:r.parent_table,columns:r.columns,columnCount:r.column_count,columnsTruncated:r.column_count>32,tenantPairPresent:r.columns.some((p:any)=>p.child==='tenant_id'&&p.parent==='tenant_id'),validated:r.convalidated,deferrable:r.condeferrable,initiallyDeferred:r.condeferred,relationshipAccepted:false}));
 return{table,catalogOnly:true,maximumRelationships:64,totalRelationships:total,truncated:total>64,relationships,rlsEnabled:source.relrowsecurity,rlsForced:source.relforcerowsecurity,complete:false,canApply:false,foreignKeyAloneProvesAuthorization:false};
}
