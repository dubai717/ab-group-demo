-- REVIEW CANDIDATE ONLY: never part of automatic/hosted migration manifests.
-- Applies only to this narrowing-override namespace in the original settings.
BEGIN;
CREATE FUNCTION ab.individual_denials_write_allowed(namespace_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
 SELECT (namespace_key ~ '^user-denials-v1:[0-9a-f-]{36}$' OR namespace_key ~ '^user-denials-history-v1:[0-9a-f-]{36}:[0-9]{10}$')
 AND EXISTS(SELECT 1 FROM ab.users a JOIN ab.users target ON target.tenant_id=a.tenant_id
 WHERE a.tenant_id=ab.tenant() AND a.id=nullif(current_setting('ab.actor',true),'')::uuid
 AND a.role_id='owner' AND a.status='Active' AND target.role_id<>'owner'
 AND target.id<>a.id AND target.id::text=split_part(namespace_key,':',2));
$$;
REVOKE ALL ON FUNCTION ab.individual_denials_write_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.individual_denials_write_allowed(text) TO ab_runtime;
CREATE POLICY individual_denials_insert_guard ON ab.settings AS RESTRICTIVE FOR INSERT
 WITH CHECK((key NOT LIKE 'user-denials-v1:%' AND key NOT LIKE 'user-denials-history-v1:%') OR ab.individual_denials_write_allowed(key));
CREATE POLICY individual_denials_update_guard ON ab.settings AS RESTRICTIVE FOR UPDATE
 USING((key NOT LIKE 'user-denials-v1:%' AND key NOT LIKE 'user-denials-history-v1:%') OR (key LIKE 'user-denials-v1:%' AND ab.individual_denials_write_allowed(key)))
 WITH CHECK((key NOT LIKE 'user-denials-v1:%' AND key NOT LIKE 'user-denials-history-v1:%') OR (key LIKE 'user-denials-v1:%' AND ab.individual_denials_write_allowed(key)));
CREATE POLICY individual_denials_delete_guard ON ab.settings AS RESTRICTIVE FOR DELETE
 USING(key NOT LIKE 'user-denials-v1:%' AND key NOT LIKE 'user-denials-history-v1:%');
CREATE FUNCTION ab.individual_denials_guard_ready() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,ab AS $$
 SELECT EXISTS(SELECT 1 FROM pg_class WHERE oid='ab.settings'::regclass AND relrowsecurity)
 AND (SELECT count(*)=3 FROM pg_policy WHERE polrelid='ab.settings'::regclass AND NOT polpermissive
 AND polname IN('individual_denials_insert_guard','individual_denials_update_guard','individual_denials_delete_guard') AND polcmd IN('a','w','d'));
$$;
REVOKE ALL ON FUNCTION ab.individual_denials_guard_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.individual_denials_guard_ready() TO ab_runtime;
COMMIT;
