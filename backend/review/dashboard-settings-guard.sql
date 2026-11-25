-- REVIEW CANDIDATE ONLY. Never automatically applied to hosted databases.
-- Narrows writes/reads only for the original dashboard settings namespaces.
BEGIN;
SET LOCAL search_path=pg_catalog,ab;
CREATE FUNCTION ab.dashboard_settings_write_allowed(namespace_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users actor WHERE actor.tenant_id=ab.tenant()
 AND actor.id=nullif(current_setting('ab.actor',true),'')::uuid AND actor.role_id='owner' AND actor.status='Active'
 AND ((namespace_key LIKE 'dashboard-security-user:%' AND EXISTS(SELECT 1 FROM ab.users target
  WHERE target.tenant_id=actor.tenant_id AND target.role_id<>'owner' AND target.id<>actor.id
  AND target.id::text=substring(namespace_key from length('dashboard-security-user:')+1)))
 OR(namespace_key LIKE 'dashboard-security-role:%' AND EXISTS(SELECT 1 FROM ab.roles target
  WHERE target.id<>'owner' AND target.id=substring(namespace_key from length('dashboard-security-role:')+1)
  AND(target.id NOT LIKE 'security:%' OR target.id LIKE 'security:'||actor.tenant_id::text||':%')))));
$$;
CREATE FUNCTION ab.dashboard_settings_read_allowed(namespace_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM ab.users actor WHERE actor.tenant_id=ab.tenant()
 AND actor.id=nullif(current_setting('ab.actor',true),'')::uuid AND actor.status='Active'
 AND(actor.role_id='owner' OR namespace_key='dashboard-security-user:'||actor.id::text
 OR(namespace_key='dashboard-security-role:'||actor.role_id
 AND(actor.role_id NOT LIKE 'security:%' OR actor.role_id LIKE 'security:'||actor.tenant_id::text||':%'))));
$$;
REVOKE ALL ON FUNCTION ab.dashboard_settings_write_allowed(text),ab.dashboard_settings_read_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.dashboard_settings_write_allowed(text),ab.dashboard_settings_read_allowed(text) TO ab_runtime;
CREATE POLICY dashboard_settings_select_guard ON ab.settings AS RESTRICTIVE FOR SELECT
 USING((key NOT LIKE 'dashboard-security-user:%' AND key NOT LIKE 'dashboard-security-role:%') OR ab.dashboard_settings_read_allowed(key));
CREATE POLICY dashboard_settings_insert_guard ON ab.settings AS RESTRICTIVE FOR INSERT
 WITH CHECK((key NOT LIKE 'dashboard-security-user:%' AND key NOT LIKE 'dashboard-security-role:%') OR ab.dashboard_settings_write_allowed(key));
CREATE POLICY dashboard_settings_update_guard ON ab.settings AS RESTRICTIVE FOR UPDATE
 USING((key NOT LIKE 'dashboard-security-user:%' AND key NOT LIKE 'dashboard-security-role:%') OR ab.dashboard_settings_write_allowed(key))
 WITH CHECK((key NOT LIKE 'dashboard-security-user:%' AND key NOT LIKE 'dashboard-security-role:%') OR ab.dashboard_settings_write_allowed(key));
CREATE POLICY dashboard_settings_delete_guard ON ab.settings AS RESTRICTIVE FOR DELETE
 USING(key NOT LIKE 'dashboard-security-user:%' AND key NOT LIKE 'dashboard-security-role:%');
-- Bind readiness to this server's compiled approved policies and invoker helpers.
-- It therefore detects changed expressions/roles, not only matching policy names.
DO $install$
DECLARE approved jsonb;
BEGIN
 approved := (SELECT jsonb_build_object('policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'command',polcmd::text,'roles',polroles::text,'permissive',polpermissive,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid='ab.settings'::regclass AND polname IN('dashboard_settings_select_guard','dashboard_settings_insert_guard','dashboard_settings_update_guard','dashboard_settings_delete_guard')),'functions',(SELECT jsonb_agg(jsonb_build_object('identity',oid::regprocedure::text,'definition',pg_get_functiondef(oid)) ORDER BY proname) FROM pg_proc WHERE oid IN(to_regprocedure('ab.dashboard_settings_write_allowed(text)'),to_regprocedure('ab.dashboard_settings_read_allowed(text)')))));
 IF jsonb_array_length(approved->'policies')<>4 OR jsonb_array_length(approved->'functions')<>2 THEN RAISE EXCEPTION 'dashboard guard source incomplete'; END IF;
 EXECUTE format($definition$
 CREATE FUNCTION ab.dashboard_settings_guard_ready() RETURNS boolean
 LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab AS $ready$
 SELECT EXISTS(SELECT 1 FROM pg_class WHERE oid='ab.settings'::regclass AND relrowsecurity AND relowner<>current_user::regrole)
 AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND(rolsuper OR rolbypassrls))
 AND (SELECT jsonb_build_object('policies',(SELECT jsonb_agg(jsonb_build_object('name',polname,'command',polcmd::text,'roles',polroles::text,'permissive',polpermissive,'using',pg_get_expr(polqual,polrelid),'check',pg_get_expr(polwithcheck,polrelid)) ORDER BY polname) FROM pg_policy WHERE polrelid='ab.settings'::regclass AND polname IN('dashboard_settings_select_guard','dashboard_settings_insert_guard','dashboard_settings_update_guard','dashboard_settings_delete_guard')),'functions',(SELECT jsonb_agg(jsonb_build_object('identity',oid::regprocedure::text,'definition',pg_get_functiondef(oid)) ORDER BY proname) FROM pg_proc WHERE oid IN(to_regprocedure('ab.dashboard_settings_write_allowed(text)'),to_regprocedure('ab.dashboard_settings_read_allowed(text)')))))=%L::jsonb
 AND has_function_privilege(current_user,to_regprocedure('ab.dashboard_settings_write_allowed(text)'),'EXECUTE')
 AND has_function_privilege(current_user,to_regprocedure('ab.dashboard_settings_read_allowed(text)'),'EXECUTE');
 $ready$;
 $definition$,approved::text);
END;
$install$;
REVOKE ALL ON FUNCTION ab.dashboard_settings_guard_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.dashboard_settings_guard_ready() TO ab_runtime;
COMMIT;
