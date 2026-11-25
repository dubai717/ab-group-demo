-- REVIEW ONLY. Not in migration/release manifests. No webhook registration or external send.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$DECLARE original_check text;BEGIN
 IF current_user<>'postgres'OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='postgres'AND(rolsuper OR rolbypassrls))OR to_regclass('ab.communication_provider_events')IS NULL OR to_regprocedure('ab.hr_actor_allowed()')IS NULL THEN RAISE EXCEPTION 'reviewed original communication source required; no privilege repair permitted' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE(rolsuper OR rolbypassrls)AND pg_catalog.pg_has_role('ab_runtime',oid,'MEMBER'))THEN RAISE EXCEPTION 'non-bypass runtime required' USING ERRCODE='42501';END IF;
 SELECT pg_get_constraintdef(oid)INTO original_check FROM pg_catalog.pg_constraint WHERE conrelid='ab.communication_messages'::regclass AND conname='communication_messages_channel_check'AND contype='c';
 IF original_check IS DISTINCT FROM 'CHECK ((channel = ''internal''::text))'THEN RAISE EXCEPTION 'original channel constraint review required' USING ERRCODE='42501';END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid='ab.communication_messages'::regclass AND pg_catalog.pg_has_role('ab_runtime',c.relowner,'MEMBER'))THEN RAISE EXCEPTION 'runtime cannot own message source' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.communication_messages ADD COLUMN sender_kind text NOT NULL DEFAULT 'user';
ALTER TABLE ab.communication_messages ADD COLUMN provider_event_id uuid;
ALTER TABLE ab.communication_messages ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE ab.communication_messages DROP CONSTRAINT communication_messages_channel_check;
ALTER TABLE ab.communication_messages ADD CONSTRAINT reviewed_message_authorship CHECK(
 (sender_kind='user'AND sender_id IS NOT NULL AND channel='internal'AND provider_event_id IS NULL)
 OR(sender_kind='external'AND sender_id IS NULL AND channel='whatsapp'AND provider_event_id IS NOT NULL));
ALTER TABLE ab.communication_messages ADD CONSTRAINT reviewed_provider_event_source FOREIGN KEY(tenant_id,provider_event_id)REFERENCES ab.communication_provider_events(tenant_id,id);
ALTER TABLE ab.communication_messages ADD CONSTRAINT reviewed_provider_event_once UNIQUE(tenant_id,provider_event_id);
CREATE POLICY reviewed_external_message_principal ON ab.communication_messages AS RESTRICTIVE FOR INSERT TO ab_runtime WITH CHECK(
 sender_kind='user'OR(tenant_id=(SELECT ab.tenant())AND ab.hr_actor_allowed()AND EXISTS(
 SELECT 1 FROM ab.communication_provider_events e JOIN ab.users u ON u.tenant_id=e.tenant_id AND u.id=nullif(current_setting('ab.actor',true),'')::uuid
 WHERE e.tenant_id=communication_messages.tenant_id AND e.id=communication_messages.provider_event_id AND e.event_kind='message'AND u.role_id='owner'AND u.status='Active')));
-- Existing tenant/company/thread checks, insert-only grants and immutable history trigger remain.
-- External author is never recorded as the processing Owner or another employee.
COMMIT;
