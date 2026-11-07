-- Bounded local PDF text-layer indexing only. No OCR/AI service, no duplicate file or blob.
CREATE TABLE ab.document_text_index(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,version_id uuid,customer_file_id uuid,vehicle_file_id uuid,
 status text NOT NULL CHECK(status IN('indexed','no_text','unsupported','deferred','timeout','failed')),
 text_cipher text NOT NULL,search_tokens text[]NOT NULL DEFAULT '{}',truncated boolean NOT NULL DEFAULT false,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),CHECK(num_nonnulls(version_id,customer_file_id,vehicle_file_id)=1),
 UNIQUE(tenant_id,version_id),UNIQUE(tenant_id,customer_file_id),UNIQUE(tenant_id,vehicle_file_id),
 FOREIGN KEY(tenant_id,version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,customer_file_id)REFERENCES ab.customer_files(tenant_id,id),FOREIGN KEY(tenant_id,vehicle_file_id)REFERENCES ab.vehicle_files(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE INDEX document_text_tokens ON ab.document_text_index USING gin(search_tokens);
ALTER TABLE ab.document_text_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.document_text_index USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.document_text_index TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.document_text_index FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['document_text_index']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
