-- REVIEW ONLY: not an automatic migration or runtime installer.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres'OR to_regprocedure('ab.current_company_scope_ids()')IS NULL THEN RAISE EXCEPTION 'reviewed notification parent required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_policy WHERE polrelid='ab.finance_notifications'::regclass AND polname='reviewed_company_upper_bound'AND NOT polpermissive)THEN RAISE EXCEPTION 'reviewed notification upper bound required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))OR EXISTS(SELECT 1 FROM pg_catalog.pg_class WHERE oid='ab.notification_receipts'::regclass AND pg_catalog.pg_has_role('ab_runtime',relowner,'MEMBER'))THEN RAISE EXCEPTION 'non-owner non-bypass runtime required' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.notification_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab.notification_receipts FORCE ROW LEVEL SECURITY;
-- Reading original peer acknowledgement metadata remains subject to original API authority.
CREATE POLICY reviewed_notification_parent_read ON ab.notification_receipts AS RESTRICTIVE FOR SELECT TO ab_runtime USING(
 tenant_id=(SELECT ab.tenant())AND EXISTS(SELECT 1 FROM ab.finance_notifications n WHERE n.tenant_id=notification_receipts.tenant_id AND n.id=notification_receipts.notification_id AND n.user_id=notification_receipts.user_id));
-- An Owner may view a recipient's state, but cannot acknowledge on their behalf.
CREATE POLICY reviewed_notification_own_ack ON ab.notification_receipts AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(
 tenant_id=(SELECT ab.tenant())AND user_id=(SELECT nullif(pg_catalog.current_setting('ab.actor',true),'')::uuid)
 AND EXISTS(SELECT 1 FROM ab.finance_notifications n WHERE n.tenant_id=notification_receipts.tenant_id AND n.id=notification_receipts.notification_id AND n.user_id=notification_receipts.user_id));
-- No new permission, privileged function, notification send or financial state transition.
COMMIT;
