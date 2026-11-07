-- Reuse encrypted original documents, versions, scanning and private storage.
-- Evidence never creates capital, receipts or a financial entitlement.
CREATE TABLE ab.investor_evidence_links(
 id uuid PRIMARY KEY,tenant_id uuid NOT NULL,agreement_id uuid NOT NULL,document_id uuid NOT NULL,version_id uuid NOT NULL,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,version_id),FOREIGN KEY(tenant_id,agreement_id)REFERENCES ab.investor_agreements(tenant_id,id),FOREIGN KEY(tenant_id,document_id)REFERENCES ab.documents(tenant_id,id),FOREIGN KEY(tenant_id,version_id)REFERENCES ab.document_versions(tenant_id,id),FOREIGN KEY(tenant_id,created_by)REFERENCES ab.users(tenant_id,id)
);
ALTER TABLE ab.investor_evidence_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_read ON ab.investor_evidence_links FOR SELECT USING(tenant_id=ab.tenant()AND ab.investor_agreement_access(agreement_id,false));
CREATE POLICY evidence_create ON ab.investor_evidence_links FOR INSERT WITH CHECK(tenant_id=ab.tenant()AND created_by=nullif(current_setting('ab.actor',true),'')::uuid AND EXISTS(SELECT 1 FROM ab.investor_agreements a JOIN ab.investor_profiles p ON p.id=a.investor_id JOIN ab.documents d ON d.id=investor_evidence_links.document_id JOIN ab.document_versions v ON v.id=investor_evidence_links.version_id AND v.document_id=d.id WHERE a.tenant_id=ab.tenant()AND a.id=investor_evidence_links.agreement_id AND p.user_id=investor_evidence_links.created_by AND d.tenant_id=a.tenant_id AND d.user_id=investor_evidence_links.created_by AND d.category='investorEvidence'AND d.created_by=investor_evidence_links.created_by AND v.tenant_id=a.tenant_id AND v.created_by=investor_evidence_links.created_by));
CREATE POLICY personnel_active_actor ON ab.investor_evidence_links AS RESTRICTIVE TO ab_runtime USING(ab.hr_actor_allowed())WITH CHECK(ab.hr_actor_allowed());
GRANT SELECT,INSERT ON ab.investor_evidence_links TO ab_runtime;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON ab.investor_evidence_links FOR EACH ROW EXECUTE FUNCTION ab.vehicle_immutable();
