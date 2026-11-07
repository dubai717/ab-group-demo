-- Original blobs and version histories remain in their authoritative tables/buckets.
CREATE TABLE ab.document_archive_events (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,
 document_id uuid,customer_file_id uuid,vehicle_file_id uuid,
 action text NOT NULL CHECK(action IN('archive','restore')),reason_cipher text NOT NULL,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(document_id,customer_file_id,vehicle_file_id)=1),
 FOREIGN KEY(tenant_id,document_id)REFERENCES ab.documents(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_file_id)REFERENCES ab.customer_files(tenant_id,id),
 FOREIGN KEY(tenant_id,vehicle_file_id)REFERENCES ab.vehicle_files(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
ALTER TABLE ab.document_archive_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.document_archive_events USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.document_archive_events TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.document_archive_events FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
CREATE INDEX document_archive_lookup ON ab.document_archive_events(tenant_id,document_id,created_at DESC);
CREATE INDEX customer_archive_lookup ON ab.document_archive_events(tenant_id,customer_file_id,created_at DESC);
CREATE INDEX vehicle_archive_lookup ON ab.document_archive_events(tenant_id,vehicle_file_id,created_at DESC);

CREATE TABLE ab.document_links (
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,
 document_id uuid,customer_file_id uuid,vehicle_file_id uuid,
 company_id uuid,customer_id uuid,vehicle_id uuid,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(document_id,customer_file_id,vehicle_file_id)=1),
 CHECK(num_nonnulls(company_id,customer_id,vehicle_id)=1),
 FOREIGN KEY(tenant_id,document_id)REFERENCES ab.documents(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_file_id)REFERENCES ab.customer_files(tenant_id,id),
 FOREIGN KEY(tenant_id,vehicle_file_id)REFERENCES ab.vehicle_files(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id)REFERENCES ab.companies(tenant_id,id),
 FOREIGN KEY(tenant_id,customer_id)REFERENCES ab.customers(tenant_id,id),
 FOREIGN KEY(tenant_id,vehicle_id)REFERENCES ab.vehicles(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
CREATE UNIQUE INDEX document_link_unique ON ab.document_links(tenant_id,coalesce(document_id,customer_file_id,vehicle_file_id),coalesce(company_id,customer_id,vehicle_id));
ALTER TABLE ab.document_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON ab.document_links USING(tenant_id=ab.tenant())WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.document_links TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.document_links FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();

-- Apply the existing account-suspension guard to new tables as well.
DO $$DECLARE tab text;BEGIN FOREACH tab IN ARRAY ARRAY['document_archive_events','document_links']LOOP
 EXECUTE format('CREATE POLICY personnel_active_actor ON ab.%I AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed())',tab);
END LOOP;END$$;
