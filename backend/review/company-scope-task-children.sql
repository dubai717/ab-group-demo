-- REVIEW ONLY: not in manifests or a runtime installer. Does not complete source-task authorization.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL THEN RAISE EXCEPTION 'reviewed scope prerequisite required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='ab'AND c.relname IN('tasks','hr_task_events')AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own task source' USING ERRCODE='42501';END IF;
END$$;
-- A task's legal company, not its employee's primary employer, bounds work access.
-- Original action/assignment/source restrictions remain in their original APIs.
ALTER TABLE ab.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.tasks FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_task_company_scope ON ab.tasks AS RESTRICTIVE FOR ALL TO ab_runtime
 USING(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())))
 WITH CHECK(tenant_id=ab.tenant()AND(ab.current_company_scope_ids()IS NULL OR company_id=ANY(ab.current_company_scope_ids())));
ALTER TABLE ab.hr_task_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.hr_task_events FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_task_event_parent_scope ON ab.hr_task_events AS RESTRICTIVE FOR ALL TO ab_runtime
 USING(tenant_id=ab.tenant()AND EXISTS(SELECT 1 FROM ab.tasks t WHERE t.tenant_id=hr_task_events.tenant_id AND t.id=hr_task_events.task_id))
 WITH CHECK(tenant_id=ab.tenant()AND EXISTS(SELECT 1 FROM ab.tasks t WHERE t.tenant_id=hr_task_events.tenant_id AND t.id=hr_task_events.task_id));
-- No grants, membership writes, source payload decryption, task transfer or compiled-gate repin.
COMMIT;
