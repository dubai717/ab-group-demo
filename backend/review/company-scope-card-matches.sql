-- Review only. Preserve original reconciliation and apply parent's active row bounds.
BEGIN;
SET LOCAL search_path=pg_catalog,ab,pg_temp;
DO $$BEGIN
 IF current_user <> 'postgres' OR to_regprocedure('ab.current_company_scope_ids()') IS NULL
 OR EXISTS (SELECT 1 FROM pg_roles WHERE (rolsuper OR rolbypassrls) AND pg_has_role('ab_runtime',oid,'MEMBER'))
 OR EXISTS (SELECT 1 FROM pg_class WHERE oid='ab.finance_card_matches'::regclass
   AND (NOT relrowsecurity OR pg_has_role('ab_runtime',relowner,'MEMBER')))
 THEN RAISE EXCEPTION 'reviewed card match scope prerequisites required' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM pg_policy WHERE NOT polpermissive AND
   ((polname='reviewed_company_upper_bound' AND polrelid IN
     ('ab.finance_statements'::regclass,'ab.finance_card_charges'::regclass,'ab.finance_vouchers'::regclass,'ab.finance_card_settlements'::regclass))
    OR (polname='reviewed_statement_line_parent' AND polrelid='ab.finance_statement_lines'::regclass)))<>5
 THEN RAISE EXCEPTION 'reviewed card match parent boundaries required' USING ERRCODE='42501'; END IF;
END$$;

ALTER TABLE ab.finance_card_matches FORCE ROW LEVEL SECURITY;
CREATE POLICY reviewed_card_match_parents ON ab.finance_card_matches AS RESTRICTIVE FOR ALL TO ab_runtime
USING (
  tenant_id=(SELECT ab.tenant()) AND ((SELECT ab.current_company_scope_ids()) IS NULL OR EXISTS (
    SELECT 1 FROM ab.finance_statements s JOIN ab.finance_statement_lines l
      ON l.tenant_id=s.tenant_id AND l.statement_id=s.id
    WHERE s.tenant_id=finance_card_matches.tenant_id AND s.id=finance_card_matches.statement_id
      AND l.id=finance_card_matches.line_id AND s.card_id IS NOT NULL
      AND (EXISTS (SELECT 1 FROM ab.finance_card_charges c WHERE c.tenant_id=s.tenant_id
                    AND c.id=finance_card_matches.charge_id AND c.card_id=s.card_id)
        OR EXISTS (SELECT 1 FROM ab.finance_vouchers v JOIN ab.finance_card_settlements p
                    ON p.tenant_id=v.tenant_id AND p.voucher_id=v.id
                    WHERE v.tenant_id=s.tenant_id AND v.id=finance_card_matches.voucher_id AND p.card_id=s.card_id))
  ))
);
-- With no explicit WITH CHECK PostgreSQL applies the same predicate to writes.
COMMIT;
