CREATE TABLE ab.contact_channels(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,kind text NOT NULL CHECK(kind IN('email','sms','whatsapp')),value_cipher text NOT NULL,verified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id));
ALTER TABLE ab.contact_channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ab.contact_channels USING(tenant_id=ab.tenant()) WITH CHECK(tenant_id=ab.tenant());
-- Contact verification and challenge routes are intentionally not enabled yet.
ALTER TABLE ab.audit_events ADD COLUMN actor_type text NOT NULL DEFAULT 'user' CHECK(actor_type IN('user','service'));
DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ab_scanner') THEN CREATE ROLE ab_scanner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS; END IF;END $$;
CREATE FUNCTION ab.pending_documents() RETURNS TABLE(id uuid,storage_key text,mime text,sha256 text) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT id,storage_key,mime,sha256 FROM ab.document_versions WHERE scan_status='pending' ORDER BY created_at LIMIT 20
$$;
CREATE FUNCTION ab.record_scan(target uuid,result text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
DECLARE org uuid;
BEGIN
 IF result NOT IN('clean','rejected') THEN RAISE EXCEPTION 'invalid scan result'; END IF;
 UPDATE ab.document_versions SET scan_status=result WHERE id=target AND scan_status='pending' RETURNING tenant_id INTO org;
 IF org IS NOT NULL THEN INSERT INTO ab.audit_events(id,tenant_id,actor_id,actor_type,action,entity_type,entity_id,fields,request_id) VALUES(gen_random_uuid(),org,'00000000-0000-4000-8000-000000000001','service','scanned','document_version',target,ARRAY['scan_status',result],gen_random_uuid()); END IF;
END $$;
REVOKE ALL ON FUNCTION ab.pending_documents(),ab.record_scan(uuid,text) FROM PUBLIC;
GRANT USAGE ON SCHEMA ab TO ab_scanner;
GRANT EXECUTE ON FUNCTION ab.pending_documents(),ab.record_scan(uuid,text) TO ab_scanner;
