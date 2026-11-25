-- REVIEW ONLY. Original payroll approval and action authorization still apply.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user<>'postgres' OR to_regprocedure('ab.current_company_scope_ids()') IS NULL
 OR EXISTS (SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls) AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR EXISTS (SELECT 1 FROM pg_class WHERE oid='ab.hr_payroll_decisions'::regclass
   AND (NOT relrowsecurity OR pg_has_role('ab_runtime',relowner,'MEMBER')))
 THEN RAISE EXCEPTION 'reviewed payroll link scope prerequisites required' USING ERRCODE='42501';END IF;
 IF (SELECT count(*) FROM pg_policy WHERE NOT polpermissive AND polname='reviewed_company_upper_bound'
   AND polrelid IN ('ab.hr_payroll'::regclass,'ab.hr_decisions'::regclass))<>2
 THEN RAISE EXCEPTION 'reviewed payroll parent boundaries required' USING ERRCODE='42501';END IF;
END$$;
ALTER TABLE ab.hr_payroll_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_payroll_decision_parents ON ab.hr_payroll_decisions AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
 tenant_id=(SELECT ab.tenant()) AND ((SELECT ab.current_company_scope_ids()) IS NULL OR EXISTS (
  SELECT 1 FROM ab.hr_payroll p JOIN ab.hr_decisions d
   ON d.tenant_id=p.tenant_id AND d.company_id=p.company_id AND d.employee_id=p.employee_id AND d.month=p.month
  WHERE p.tenant_id=hr_payroll_decisions.tenant_id AND p.id=hr_payroll_decisions.payroll_id
    AND d.id=hr_payroll_decisions.decision_id
 ))
);
-- The same predicate applies to new and replacement rows.
COMMIT;
