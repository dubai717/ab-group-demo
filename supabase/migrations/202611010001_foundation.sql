-- Applied only by the migration/admin connection, never by the web process.
CREATE SCHEMA IF NOT EXISTS ab;
REVOKE ALL ON SCHEMA ab FROM PUBLIC;
DO $$ BEGIN
 IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='ab_runtime') THEN
  CREATE ROLE ab_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
END $$;
CREATE FUNCTION ab.tenant() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('ab.tenant',true),'')::uuid $$;
CREATE TABLE ab.organizations(id uuid PRIMARY KEY, name text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ab.roles(id text PRIMARY KEY, data jsonb NOT NULL CHECK(jsonb_typeof(data)='object'));
CREATE TABLE ab.permissions(id text PRIMARY KEY);
CREATE TABLE ab.role_permissions(role_id text REFERENCES ab.roles ON DELETE RESTRICT, permission_id text REFERENCES ab.permissions ON DELETE RESTRICT, PRIMARY KEY(role_id,permission_id));
CREATE TABLE ab.users(
 id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ab.organizations ON DELETE RESTRICT,
 auth_id uuid UNIQUE NOT NULL, auth_email text NOT NULL, username text NOT NULL,
 normalized_username text GENERATED ALWAYS AS (lower(username)) STORED UNIQUE,
 role_id text NOT NULL REFERENCES ab.roles ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('Active','Pending','Disabled')),
 manager_id uuid, data jsonb NOT NULL DEFAULT '{}', private_cipher text,
 revision integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,manager_id) REFERENCES ab.users(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX one_owner_per_group ON ab.users(tenant_id) WHERE role_id='owner';
CREATE TABLE ab.emirates(id text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE ab.areas(tenant_id uuid NOT NULL REFERENCES ab.organizations, id text NOT NULL, emirate_id text NOT NULL REFERENCES ab.emirates,
 data jsonb NOT NULL, created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,emirate_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.area_aliases(tenant_id uuid NOT NULL, emirate_id text NOT NULL, normalized_name text NOT NULL,
 area_id text NOT NULL, PRIMARY KEY(tenant_id,emirate_id,normalized_name), FOREIGN KEY(tenant_id,area_id) REFERENCES ab.areas(tenant_id,id));
CREATE TABLE ab.companies(id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES ab.organizations,
 data jsonb NOT NULL, emirate_id text REFERENCES ab.emirates,area_id text, revision integer NOT NULL DEFAULT 1, created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(tenant_id,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,emirate_id,area_id) REFERENCES ab.areas(tenant_id,emirate_id,id));
CREATE TABLE ab.company_licenses(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, company_id uuid NOT NULL,
 number text NOT NULL, authority text, issued_on date, expires_on date, is_primary boolean NOT NULL DEFAULT false,
 UNIQUE(tenant_id,company_id,id), FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id));
CREATE UNIQUE INDEX one_primary_license ON ab.company_licenses(company_id) WHERE is_primary;
CREATE TABLE ab.departments(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, company_id uuid NOT NULL, name text NOT NULL, manager_id uuid,
 UNIQUE(tenant_id,id), FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id), FOREIGN KEY(tenant_id,manager_id) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.user_companies(tenant_id uuid NOT NULL,user_id uuid NOT NULL,company_id uuid NOT NULL,
 PRIMARY KEY(user_id,company_id),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id));
CREATE TABLE ab.user_departments(tenant_id uuid NOT NULL,user_id uuid NOT NULL,department_id uuid NOT NULL,
 PRIMARY KEY(user_id,department_id),FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,department_id) REFERENCES ab.departments(tenant_id,id));
CREATE TABLE ab.permission_grants(id uuid PRIMARY KEY, tenant_id uuid NOT NULL, user_id uuid NOT NULL, issuer_id uuid NOT NULL,
 permission_id text NOT NULL REFERENCES ab.permissions, scope_type text NOT NULL CHECK(scope_type IN('group','company','department','reports')),
 company_id uuid, department_id uuid, manager_id uuid, delegable boolean NOT NULL DEFAULT false, revoked_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((scope_type='group' AND num_nonnulls(company_id,department_id,manager_id)=0) OR
 (scope_type='company' AND company_id IS NOT NULL AND num_nonnulls(company_id,department_id,manager_id)=1) OR
 (scope_type='department' AND department_id IS NOT NULL AND num_nonnulls(company_id,department_id,manager_id)=1) OR
 (scope_type='reports' AND manager_id IS NOT NULL AND num_nonnulls(company_id,department_id,manager_id)=1)),
 FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id), FOREIGN KEY(tenant_id,issuer_id) REFERENCES ab.users(tenant_id,id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id), FOREIGN KEY(tenant_id,department_id) REFERENCES ab.departments(tenant_id,id), FOREIGN KEY(tenant_id,manager_id) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.bank_references(tenant_id uuid NOT NULL REFERENCES ab.organizations,id text NOT NULL,kind text NOT NULL CHECK(kind IN('bank','purpose')),data jsonb NOT NULL, PRIMARY KEY(tenant_id,kind,id));
CREATE TABLE ab.bank_accounts(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid NOT NULL, license_id uuid,
 bank_kind text NOT NULL DEFAULT 'bank' CHECK(bank_kind='bank'),bank_id text NOT NULL,
 purpose_kind text NOT NULL DEFAULT 'purpose' CHECK(purpose_kind='purpose'),purpose_id text NOT NULL,
 status text NOT NULL CHECK(status IN('Active','Inactive','Closed')),opened_on date NOT NULL,closed_on date,
 opening_balance numeric(21,3) NOT NULL,currency char(3) NOT NULL CHECK(currency~'^[A-Z]{3}$'),
 iban_digest text NOT NULL,account_digest text NOT NULL, payload_cipher text NOT NULL,
 revision integer NOT NULL DEFAULT 1,created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='Closed' AND closed_on>=opened_on) OR(status<>'Closed' AND closed_on IS NULL)),
 UNIQUE(tenant_id,id),UNIQUE(tenant_id,iban_digest),UNIQUE(tenant_id,bank_id,account_digest),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id), FOREIGN KEY(tenant_id,company_id,license_id) REFERENCES ab.company_licenses(tenant_id,company_id,id),
 FOREIGN KEY(tenant_id,bank_kind,bank_id) REFERENCES ab.bank_references(tenant_id,kind,id), FOREIGN KEY(tenant_id,purpose_kind,purpose_id) REFERENCES ab.bank_references(tenant_id,kind,id),
 FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.documents(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,company_id uuid,bank_account_id uuid,user_id uuid,
 category text NOT NULL, title text NOT NULL,description text NOT NULL DEFAULT '',document_date date NOT NULL,related_id uuid,
 created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(tenant_id,id),
 CHECK(num_nonnulls(company_id,bank_account_id,user_id)=1),
 FOREIGN KEY(tenant_id,company_id) REFERENCES ab.companies(tenant_id,id),FOREIGN KEY(tenant_id,bank_account_id) REFERENCES ab.bank_accounts(tenant_id,id),
 FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id),FOREIGN KEY(tenant_id,related_id) REFERENCES ab.documents(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.document_versions(id uuid PRIMARY KEY,tenant_id uuid NOT NULL,document_id uuid NOT NULL,version integer NOT NULL CHECK(version>0),
 storage_key text NOT NULL UNIQUE, original_name text NOT NULL,mime text NOT NULL,size integer NOT NULL CHECK(size BETWEEN 1 AND 10485760),sha256 text NOT NULL,
 scan_status text NOT NULL CHECK(scan_status IN('pending','clean','rejected')),created_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(document_id,version), FOREIGN KEY(tenant_id,document_id) REFERENCES ab.documents(tenant_id,id),FOREIGN KEY(tenant_id,created_by) REFERENCES ab.users(tenant_id,id));
CREATE TABLE ab.settings(tenant_id uuid NOT NULL REFERENCES ab.organizations,key text NOT NULL,value jsonb NOT NULL,PRIMARY KEY(tenant_id,key));
CREATE TABLE ab.audit_events(id uuid PRIMARY KEY,tenant_id uuid NOT NULL REFERENCES ab.organizations,actor_id uuid NOT NULL,action text NOT NULL,
 entity_type text NOT NULL,entity_id text, fields text[] NOT NULL DEFAULT '{}',request_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE ab.sessions(id_hash text PRIMARY KEY,tenant_id uuid NOT NULL,user_id uuid NOT NULL,token_cipher text NOT NULL,expires_at timestamptz NOT NULL,
 FOREIGN KEY(tenant_id,user_id) REFERENCES ab.users(tenant_id,id));
-- Only these narrow functions may be called before a tenant transaction exists.
CREATE FUNCTION ab.login_identity(name text) RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT auth_email FROM ab.users WHERE normalized_username=lower(name) AND status='Active'
$$;
CREATE FUNCTION ab.principal(subject uuid) RETURNS TABLE(id uuid,tenant_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT id,tenant_id FROM ab.users WHERE auth_id=subject AND status='Active'
$$;
CREATE FUNCTION ab.read_session(hash text) RETURNS TABLE(tenant_id uuid,user_id uuid,token_cipher text,expires_at timestamptz) LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,ab AS $$
 SELECT s.tenant_id,s.user_id,s.token_cipher,s.expires_at FROM ab.sessions s JOIN ab.users u ON u.id=s.user_id WHERE s.id_hash=hash AND s.expires_at>now() AND u.status='Active'
$$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ab FROM PUBLIC;
GRANT USAGE ON SCHEMA ab TO ab_runtime;
GRANT EXECUTE ON FUNCTION ab.tenant(),ab.login_identity(text),ab.principal(uuid),ab.read_session(text) TO ab_runtime;
GRANT SELECT ON ab.roles,ab.permissions,ab.role_permissions,ab.emirates TO ab_runtime;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['organizations','users','areas','area_aliases','companies','company_licenses','departments','user_companies','user_departments','permission_grants','bank_references','bank_accounts','documents','document_versions','settings','audit_events','sessions'] LOOP
  EXECUTE format('ALTER TABLE ab.%I ENABLE ROW LEVEL SECURITY',tab);
  -- Runtime is not owner/superuser; API enforces finer action/company scopes as well.
  EXECUTE format('CREATE POLICY tenant_isolation ON ab.%I USING (%s=ab.tenant()) WITH CHECK (%s=ab.tenant())',tab,CASE WHEN tab='organizations' THEN 'id' ELSE 'tenant_id' END,CASE WHEN tab='organizations' THEN 'id' ELSE 'tenant_id' END);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE ON ab.%I TO ab_runtime',tab);
 END LOOP;
END $$;
-- No runtime deletes. Documents/versions/audit are append-only, including metadata history.
REVOKE UPDATE ON ab.documents,ab.document_versions,ab.audit_events FROM ab_runtime;
CREATE INDEX company_tenant ON ab.companies(tenant_id);
CREATE INDEX accounts_company ON ab.bank_accounts(tenant_id,company_id);
CREATE INDEX grants_user ON ab.permission_grants(tenant_id,user_id) WHERE revoked_at IS NULL;
CREATE INDEX audit_entity ON ab.audit_events(tenant_id,entity_type,entity_id,created_at);
