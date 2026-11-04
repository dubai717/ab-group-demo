CREATE TABLE ab.request_dedup(tenant_id uuid NOT NULL,actor_id uuid NOT NULL,key uuid NOT NULL,fingerprint text NOT NULL,response jsonb NOT NULL,
 PRIMARY KEY(actor_id,key),FOREIGN KEY(tenant_id,actor_id) REFERENCES ab.users(tenant_id,id));
ALTER TABLE ab.request_dedup ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON ab.request_dedup USING(tenant_id=ab.tenant()) WITH CHECK(tenant_id=ab.tenant());
GRANT SELECT,INSERT ON ab.request_dedup TO ab_runtime;
