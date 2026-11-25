-- Review only. Existing immutable events retain a NULL lookup key.
BEGIN;
ALTER TABLE ab.communication_provider_events ADD COLUMN status_lookup_key text
 CHECK (status_lookup_key IS NULL OR (event_kind='status' AND status_lookup_key ~ '^[a-f0-9]{64}$'));
CREATE INDEX communication_provider_status_lookup
 ON ab.communication_provider_events (tenant_id,status_lookup_key)
 WHERE provider='meta_cloud' AND event_kind='status';
COMMIT;
