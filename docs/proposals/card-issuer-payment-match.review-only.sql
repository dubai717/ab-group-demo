-- REVIEW ONLY: extend original immutable matches, never create another reconciliation ledger.
-- Not in the approved migration catalog. Hosted application requires specific financial schema approval.
-- Existing charge/voucher rows remain unchanged; nullable columns do not reclassify history.
DO $$DECLARE definition text;BEGIN
 SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conrelid='ab.finance_card_matches'::regclass AND conname='finance_card_matches_check' AND contype='c';
 IF definition IS DISTINCT FROM 'CHECK (((charge_id IS NULL) <> (voucher_id IS NULL)))' THEN RAISE EXCEPTION 'unreviewed original card match source constraint' USING ERRCODE='23514';END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='ab.finance_card_matches'::regclass) OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='ab.finance_card_matches'::regclass AND tgname='immutable_history' AND NOT tgisinternal AND tgfoid='ab.vehicle_immutable()'::regprocedure) THEN RAISE EXCEPTION 'unreviewed original card match protection' USING ERRCODE='23514';END IF;
END$$;
ALTER TABLE ab.finance_card_matches
 ADD COLUMN issuer_payment_source_key text,
 ADD COLUMN issuer_payment_amount numeric(21,3),
 DROP CONSTRAINT finance_card_matches_check,
 ADD CONSTRAINT card_match_exact_source_v2 CHECK((charge_id IS NOT NULL)::int+(voucher_id IS NOT NULL)::int+(issuer_payment_source_key IS NOT NULL)::int=1),
 ADD CONSTRAINT card_match_issuer_shape CHECK((issuer_payment_source_key IS NULL AND issuer_payment_amount IS NULL)OR(issuer_payment_source_key IS NOT NULL AND issuer_payment_amount IS NOT NULL AND issuer_payment_source_key ~ '^owner-card-bank-payment-v1:[0-9a-f-]{36}:[0-9a-f]{64}$' AND issuer_payment_amount<0)),
 ADD CONSTRAINT card_match_issuer_setting_fk FOREIGN KEY(tenant_id,issuer_payment_source_key)REFERENCES ab.settings(tenant_id,key);
CREATE UNIQUE INDEX card_match_issuer_source_once ON ab.finance_card_matches(tenant_id,issuer_payment_source_key)WHERE issuer_payment_source_key IS NOT NULL;
CREATE FUNCTION ab.card_issuer_payment_schema_version()RETURNS text LANGUAGE sql IMMUTABLE AS $$SELECT 'CARD-ISSUER-PAYMENT-MATCH-REVIEW-1'::text$$;
REVOKE ALL ON FUNCTION ab.card_issuer_payment_schema_version()FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ab.card_issuer_payment_schema_version()TO ab_runtime;
