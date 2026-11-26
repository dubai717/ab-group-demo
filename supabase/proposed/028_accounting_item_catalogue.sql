-- Apply only through a separately reviewed schema release.
BEGIN;
INSERT INTO ab.permissions(id) VALUES ('ledger_item_create'), ('ledger_item_edit') ON CONFLICT DO NOTHING;
GRANT DELETE ON ab.finance_items TO ab_runtime;
COMMIT;
