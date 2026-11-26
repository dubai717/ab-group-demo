-- Separate owner-approved release; the protected application ledger must be contiguous through 029.
BEGIN;
INSERT INTO ab.permissions(id) VALUES ('ledger_item_create'), ('ledger_item_edit') ON CONFLICT DO NOTHING;

-- Existing scopes are encrypted. NULL deliberately fails closed for physical removal.
ALTER TABLE ab.finance_items ADD COLUMN catalogue_company_ids uuid[];

CREATE FUNCTION ab.catalogue_item_right(co uuid, wanted text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
    SELECT EXISTS (
        SELECT 1 FROM ab.users u JOIN ab.roles r ON r.id=u.role_id
        WHERE u.id=nullif(current_setting('ab.actor',true),'')::uuid
          AND u.tenant_id=ab.tenant() AND u.status='Active'
          AND (u.role_id='owner' OR EXISTS (
              SELECT 1 FROM ab.permission_grants g
              WHERE g.tenant_id=u.tenant_id AND g.user_id=u.id AND g.revoked_at IS NULL
                AND g.permission_id=ANY(wanted)
                AND (g.scope_type='group' OR (g.scope_type='company' AND g.company_id=co))
          ) OR (
              u.role_id LIKE 'security:%' AND r.data->>'securityManaged'='true'
              AND (r.data->'permissions') ?| wanted
              AND EXISTS (SELECT 1 FROM ab.user_companies m WHERE m.tenant_id=u.tenant_id
                  AND m.user_id=u.id AND m.company_id=co AND m.active)
          ))
    )
$$;

CREATE FUNCTION ab.guard_catalogue_item_scope()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
    scope_ids uuid[];
    edit_rights text[] := ARRAY['ledger_item_edit','ledger_item_manage'];
BEGIN
    IF TG_OP='DELETE' THEN
        scope_ids:=OLD.catalogue_company_ids;
        IF OLD.tenant_id IS DISTINCT FROM ab.tenant() OR OLD.category='monthly_followup'
           OR coalesce(cardinality(scope_ids),0)=0
           OR EXISTS (SELECT 1 FROM unnest(scope_ids) co
               WHERE NOT ab.catalogue_item_right(co,ARRAY['ledger_view'])
                  OR NOT ab.catalogue_item_right(co,edit_rights))
        THEN RAISE EXCEPTION 'catalogue item removal denied' USING ERRCODE='42501';
        END IF;
        IF EXISTS (
            SELECT 1 FROM ab.finance_invoice_links WHERE tenant_id=OLD.tenant_id AND item_id=OLD.id
            UNION ALL SELECT 1 FROM ab.finance_receipts WHERE tenant_id=OLD.tenant_id AND item_id=OLD.id
            UNION ALL SELECT 1 FROM ab.finance_vouchers WHERE tenant_id=OLD.tenant_id AND item_id=OLD.id
            UNION ALL SELECT 1 FROM ab.finance_card_splits WHERE tenant_id=OLD.tenant_id AND item_id=OLD.id
        ) THEN RAISE EXCEPTION 'catalogue item in use; disable it' USING ERRCODE='23503';
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP='INSERT' AND NEW.catalogue_company_ids IS NULL THEN RETURN NEW; END IF;
    IF TG_OP='UPDATE' AND OLD.catalogue_company_ids IS NOT DISTINCT FROM NEW.catalogue_company_ids THEN RETURN NEW; END IF;
    scope_ids:=NEW.catalogue_company_ids;
    IF NEW.tenant_id IS DISTINCT FROM ab.tenant() OR coalesce(cardinality(scope_ids),0) NOT BETWEEN 1 AND 100
       OR (SELECT count(DISTINCT co) FROM unnest(scope_ids) co)<>cardinality(scope_ids)
       OR EXISTS (SELECT 1 FROM unnest(scope_ids) co WHERE NOT EXISTS (
           SELECT 1 FROM ab.companies c WHERE c.tenant_id=NEW.tenant_id AND c.id=co
       ))
    THEN RAISE EXCEPTION 'invalid catalogue scope' USING ERRCODE='42501';
    END IF;

    IF TG_OP='UPDATE' THEN
        IF OLD.catalogue_company_ids IS NULL AND NOT EXISTS (
            SELECT 1 FROM ab.users u WHERE u.tenant_id=NEW.tenant_id
              AND u.id=nullif(current_setting('ab.actor',true),'')::uuid AND u.role_id='owner' AND u.status='Active'
        ) THEN RAISE EXCEPTION 'legacy catalogue scope requires owner' USING ERRCODE='42501';
        END IF;
        scope_ids:=scope_ids||OLD.catalogue_company_ids;
    ELSE
        edit_rights:=ARRAY['ledger_item_create','ledger_item_manage'];
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(scope_ids) co
        WHERE NOT ab.catalogue_item_right(co,ARRAY['ledger_view']) OR NOT ab.catalogue_item_right(co,edit_rights))
    THEN RAISE EXCEPTION 'catalogue scope change denied' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION ab.catalogue_item_right(uuid,text[]),ab.guard_catalogue_item_scope() FROM PUBLIC;
CREATE TRIGGER catalogue_item_scope_guard
BEFORE INSERT OR UPDATE OF catalogue_company_ids OR DELETE ON ab.finance_items
FOR EACH ROW EXECUTE FUNCTION ab.guard_catalogue_item_scope();
GRANT DELETE ON ab.finance_items TO ab_runtime;
COMMIT;
