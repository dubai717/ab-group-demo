-- REVIEW ONLY. Direct company and bank ownership follow the original parent.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres' OR to_regprocedure('ab.current_company_scope_ids()') IS NULL
 OR EXISTS (SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls) AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE NOT polpermissive AND polname='reviewed_personnel_document_version_owner'
   AND polrelid='ab.document_versions'::regclass)
 OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE NOT polpermissive AND polname='reviewed_company_upper_bound'
   AND polrelid='ab.bank_accounts'::regclass)
 THEN RAISE EXCEPTION 'reviewed company document scope prerequisites required' USING ERRCODE='42501';END IF;
END$$;
CREATE POLICY reviewed_company_or_bank_document_owner ON ab.documents AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
 tenant_id=(SELECT ab.tenant()) AND (
  (SELECT ab.current_company_scope_ids()) IS NULL
  OR (company_id IS NULL AND bank_account_id IS NULL)
  OR company_id=ANY(ab.current_company_scope_ids())
  OR (bank_account_id IS NOT NULL AND EXISTS (
   SELECT 1 FROM ab.bank_accounts b WHERE b.tenant_id=documents.tenant_id AND b.id=documents.bank_account_id
  ))
 )
);
COMMIT;
