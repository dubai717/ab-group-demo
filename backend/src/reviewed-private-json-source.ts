// Exact build-reviewed private purpose-source check. No schema installation or learned pins.
export async function reviewedPrivateJsonSourceReady(c:any,signature:string,bodyHash:string){
 const r=(await c.query(`select p.prosecdef,p.provolatile,p.proretset,p.prokind,p.proleakproof,p.proconfig,p.prorettype='jsonb'::pg_catalog.regtype returns_json,
 pg_catalog.pg_get_userbyid(p.proowner)owner,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc,'UTF8')),'hex')body_hash,
 pg_catalog.has_function_privilege(current_user,p.oid,'EXECUTE')can_execute,
 exists(select 1 from pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))a where a.privilege_type='EXECUTE'and a.grantee not in(p.proowner,'ab_runtime'::pg_catalog.regrole::oid))public_execute,
 exists(select 1 from pg_catalog.pg_roles r where r.rolname=current_user and current_user='ab_runtime' and not r.rolsuper and not r.rolbypassrls and pg_catalog.pg_has_role(current_user,'ab_runtime','USAGE'))private_runtime,
 exists(select 1 from pg_catalog.pg_roles r where(r.rolsuper or r.rolbypassrls)and pg_catalog.pg_has_role(current_user,r.oid,'MEMBER'))bypass_member
 from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure($1)`,[signature])).rows[0];
 return !!r&&r.prosecdef&&r.provolatile==='s'&&!r.proretset&&r.prokind==='f'&&!r.proleakproof&&r.returns_json&&r.owner==='postgres'&&r.body_hash===bodyHash&&JSON.stringify(r.proconfig)===JSON.stringify(['search_path=pg_catalog, ab, pg_temp'])&&r.can_execute&&!r.public_execute&&r.private_runtime&&!r.bypass_member;
}
