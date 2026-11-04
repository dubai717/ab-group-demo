-- Preserve metadata for every revision instead of replacing the logical document's original data.
ALTER TABLE ab.document_versions ADD COLUMN title text, ADD COLUMN description text, ADD COLUMN document_date date, ADD COLUMN category text;
UPDATE ab.document_versions v SET title=d.title,description=d.description,document_date=d.document_date,category=d.category FROM ab.documents d WHERE d.id=v.document_id;
ALTER TABLE ab.document_versions ALTER COLUMN title SET NOT NULL, ALTER COLUMN description SET NOT NULL, ALTER COLUMN document_date SET NOT NULL, ALTER COLUMN category SET NOT NULL;
ALTER TABLE ab.document_versions ADD CONSTRAINT document_versions_tenant_id_unique UNIQUE(tenant_id,id);
ALTER TABLE ab.document_versions ADD COLUMN parent_version_id uuid;
ALTER TABLE ab.document_versions ADD FOREIGN KEY(tenant_id,parent_version_id) REFERENCES ab.document_versions(tenant_id,id);
