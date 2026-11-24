// Bounded catalog-only review. Never reads business rows, grants access or proves activation readiness.
import{directCompanyTables,specialCompanyTables,nullableCompanyTables,controlPlaneCompanyTables}from'./company-scope-manifest.js';
const childCandidates:Record<string,string>={customer_files:'company-scope-customer-files.sql',customer_file_reviews:'company-scope-customer-files.sql',document_text_index:'company-scope-document-children.sql',document_archive_events:'company-scope-document-children.sql',finance_statement_lines:'company-scope-statement-lines.sql',communication_messages:'company-scope-communication-children.sql',communication_participants:'company-scope-communication-children.sql',notification_receipts:'company-scope-notification-receipts.sql',finance_handover_items:'company-scope-handover-items.sql'};
export async function companyScopeRelationshipInventory(c:any){
 const rows=(await c.query(`select t.relname,t.relrowsecurity,t.relforcerowsecurity,
 exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attname='company_id'and a.attnum>0 and not a.attisdropped)has_company,
 (select count(*)::int from pg_catalog.pg_policy p where p.polrelid=t.oid and not p.polpermissive)restrictive_policies,
 array(select distinct parent.relname::text from pg_catalog.pg_constraint k join pg_catalog.pg_class parent on parent.oid=k.confrelid join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace where k.conrelid=t.oid and k.contype='f'and pn.nspname='ab'order by parent.relname::text limit 64)parents,
 (select count(distinct parent.oid)::int from pg_catalog.pg_constraint k join pg_catalog.pg_class parent on parent.oid=k.confrelid join pg_catalog.pg_namespace pn on pn.oid=parent.relnamespace where k.conrelid=t.oid and k.contype='f'and pn.nspname='ab')parent_count,
 count(*)over()::int total_tables
 from pg_catalog.pg_class t join pg_catalog.pg_namespace n on n.oid=t.relnamespace
 where n.nspname='ab'and t.relkind in('r','p')and exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=t.oid and a.attname='tenant_id'and a.attnum>0 and not a.attisdropped)
 order by t.relname limit 512`)).rows;
 const set=(xs:readonly string[])=>new Set(xs),direct=set(directCompanyTables),special=set(specialCompanyTables),nullable=set(nullableCompanyTables),control=set(controlPlaneCompanyTables);
 const tables=rows.map((r:any)=>({table:r.relname,classification:direct.has(r.relname)?'direct_company_candidate':special.has(r.relname)?'special_relationship_review':nullable.has(r.relname)?'nullable_relationship_review':control.has(r.relname)||r.relname==='user_access_scope_versions'?'scope_control_plane':childCandidates[r.relname]?'child_relationship_candidate':'unreviewed_tenant_table',hasCompanyColumn:r.has_company,parents:r.parents,parentCount:r.parent_count,parentsTruncated:r.parent_count>64,rlsEnabled:r.relrowsecurity,rlsForced:r.relforcerowsecurity,restrictivePolicies:r.restrictive_policies,candidateFile:childCandidates[r.relname]||null,relationshipAccepted:false}));
 return{catalogOnly:true,maximumTables:512,totalTenantTables:rows[0]?.total_tables||0,truncated:(rows[0]?.total_tables||0)>512,tables,unreviewedTables:tables.filter((t:any)=>t.classification==='unreviewed_tenant_table').map((t:any)=>t.table),complete:false,canApply:false,installedPoliciesProveAcceptance:false};
}
