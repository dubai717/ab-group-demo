// Review-only source guard. This does not install SQL, grant rights or enable a writer.
import {createHash} from 'node:crypto';
const expectedFunctions=[{"name": "operating_centre_owner", "digest": "4137198aa6593f02049fc777e9e5548fea4f0eae9f2d969f7369a804d6cdad2c", "language": "sql", "volatility": "s", "returns": "boolean"}, {"name": "operating_centre_version_guard", "digest": "f5542b4bab99dc5ad2d231f20203b5d5d13ae312e7c4d26d3f9abfc758df80b7", "language": "plpgsql", "volatility": "v", "returns": "trigger"}, {"name": "operating_centre_link_guard", "digest": "8d6604e705e5a2192e4e34e529eaf4f42cef23bf34558605edc6aee6647817a4", "language": "plpgsql", "volatility": "v", "returns": "trigger"}] as const;
const tableNames=['operating_centre_versions','operating_centre_companies'];
const policyNames=new Map([
 ['operating_centre_owner_read',{table:'operating_centre_versions',command:'r'}],
 ['operating_centre_owner_insert',{table:'operating_centre_versions',command:'a'}],
 ['operating_centre_link_owner_read',{table:'operating_centre_companies',command:'r'}],
 ['operating_centre_link_owner_insert',{table:'operating_centre_companies',command:'a'}]
]);
const expression=(value:string|null)=>value?.replace(/\bab\./g,'').replace(/\s|[()]/g,'').toLowerCase();
const expectedExpression='tenant_id=tenantandoperating_centre_owner';
export async function operatingCentreSourceReady(c:any):Promise<boolean>{
 const tables=(await c.query(`select t.oid,t.relname,t.relrowsecurity,t.relforcerowsecurity,
 r.rolsuper,r.rolbypassrls,pg_has_role(current_user,t.relowner,'USAGE') owns,
 has_table_privilege(current_user,t.oid,'SELECT') can_read,
 has_table_privilege(current_user,t.oid,'INSERT') can_insert,
 has_table_privilege(current_user,t.oid,'UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') can_modify
 from pg_class t join pg_namespace n on n.oid=t.relnamespace
 join pg_roles r on r.rolname=current_user where n.nspname='ab' and t.relname=any($1::text[]) and t.relkind='r'`,[tableNames])).rows;
 if(tables.length!==2||tables.some((r:any)=>!r.relrowsecurity||!r.relforcerowsecurity||r.rolsuper||r.rolbypassrls||r.owns||!r.can_read||!r.can_insert||r.can_modify))return false;
 const functions=(await c.query(`select p.oid,p.proname,p.prosrc,p.prosecdef,p.proleakproof,p.provolatile,p.proretset,p.prokind,p.proconfig,
 l.lanname,p.prorettype::regtype::text returns from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 join pg_language l on l.oid=p.prolang where n.nspname='ab' and p.proname=any($1::text[]) and p.pronargs=0`,[expectedFunctions.map(r=>r.name)])).rows;
 if(functions.length!==3)return false;
 for(const expected of expectedFunctions){const f=functions.find((r:any)=>r.proname===expected.name);
  if(!f||f.prosecdef||f.proleakproof||f.proretset||f.prokind!=='f'||f.provolatile!==expected.volatility||f.lanname!==expected.language||f.returns!==expected.returns||createHash('sha256').update(f.prosrc).digest('hex')!==expected.digest||JSON.stringify(f.proconfig?.map((s:string)=>s.replace(/\s/g,'')))!==JSON.stringify(['search_path=pg_catalog,ab']))return false;
 }
 const owner=functions.find((f:any)=>f.proname==='operating_centre_owner').oid,tenant=(await c.query("select to_regprocedure('ab.tenant()')::oid id")).rows[0].id;
 const policies=(await c.query(`select p.oid,p.polname,p.polcmd,p.polpermissive,t.relname,
 pg_get_expr(p.polqual,p.polrelid) qual,pg_get_expr(p.polwithcheck,p.polrelid) check_expr,
 array(select r.rolname::text from pg_roles r where r.oid=any(p.polroles) order by r.rolname) roles,
 array(select d.refobjid from pg_depend d where d.classid='pg_policy'::regclass and d.objid=p.oid and d.refclassid='pg_proc'::regclass order by d.refobjid) functions
 from pg_policy p join pg_class t on t.oid=p.polrelid where p.polrelid=any($1::oid[])`,[tables.map((r:any)=>r.oid)])).rows;
 if(policies.length!==4)return false;
 for(const p of policies){const expected=policyNames.get(p.polname);if(!expected||p.relname!==expected.table||p.polcmd!==expected.command||!p.polpermissive||JSON.stringify(p.roles)!==JSON.stringify(['ab_runtime'])||JSON.stringify(p.functions.map(Number).sort((a:number,b:number)=>a-b))!==JSON.stringify([Number(owner),Number(tenant)].sort((a,b)=>a-b)))return false;
  if(expected.command==='r'?(expression(p.qual)!==expectedExpression||p.check_expr!==null):(p.qual!==null||expression(p.check_expr)!==expectedExpression))return false;
 }
 const triggers=(await c.query(`select tgname,tgfoid,tgtype,tgenabled,tgqual is null unqualified,octet_length(tgargs)=0 no_args,t.tgrelid
 from pg_trigger t where t.tgrelid=any($1::oid[]) and not t.tgisinternal`,[tables.map((r:any)=>r.oid)])).rows;
 if(triggers.length!==2)return false;
 for(const [table,name] of [['operating_centre_versions','operating_centre_version_guard'],['operating_centre_companies','operating_centre_link_guard']]){const r=triggers.find((t:any)=>t.tgname===name),f=functions.find((f:any)=>f.proname===name),relation=tables.find((t:any)=>t.relname===table);if(!r||r.tgfoid!==f.oid||r.tgrelid!==relation.oid||r.tgtype!==7||!['O','A'].includes(r.tgenabled)||!r.unqualified||!r.no_args)return false;}
 return true;
}
