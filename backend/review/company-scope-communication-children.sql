-- REVIEW ONLY. Excluded from automatic manifests. Owned synthetic DB installation only.
-- This adds a company upper bound; original participant/action authority remains required.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL THEN RAISE EXCEPTION 'reviewed parent company scope required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid IN('ab.communication_participants'::regclass,'ab.communication_messages'::regclass)AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own communication children' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='ab.communication_threads'::regclass AND polname='reviewed_company_upper_bound'AND NOT polpermissive)THEN RAISE EXCEPTION 'reviewed thread upper bound required' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.communication_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.communication_participants FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_communication_parent_scope ON ab.communication_participants AS RESTRICTIVE TO ab_runtime
 USING(tenant_id=(SELECT ab.tenant())AND EXISTS(SELECT 1 FROM ab.communication_threads t WHERE t.tenant_id=communication_participants.tenant_id AND t.id=communication_participants.thread_id))
 WITH CHECK(tenant_id=(SELECT ab.tenant())AND EXISTS(SELECT 1 FROM ab.communication_threads t WHERE t.tenant_id=communication_participants.tenant_id AND t.id=communication_participants.thread_id));
ALTER TABLE ab.communication_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.communication_messages FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_communication_parent_scope ON ab.communication_messages AS RESTRICTIVE TO ab_runtime
 USING(tenant_id=(SELECT ab.tenant())AND EXISTS(SELECT 1 FROM ab.communication_threads t WHERE t.tenant_id=communication_messages.tenant_id AND t.id=communication_messages.thread_id))
 WITH CHECK(tenant_id=(SELECT ab.tenant())AND EXISTS(SELECT 1 FROM ab.communication_threads t WHERE t.tenant_id=communication_messages.tenant_id AND t.id=communication_messages.thread_id));
-- No new grant, role, SECURITY DEFINER, sender inference, provider/channel or delivery claim.
-- Existing append-only triggers and SELECT/INSERT-only grants remain unchanged.
COMMIT;
