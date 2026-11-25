-- REVIEW ONLY. Not a deployment manifest. No role or user receives this permission automatically.
BEGIN;
DO $$BEGIN IF current_user<>'postgres'OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='ab_runtime'AND NOT rolsuper AND NOT rolbypassrls)THEN RAISE EXCEPTION 'trusted additive permission review required' USING ERRCODE='42501';END IF;END$$;
INSERT INTO ab.permissions(id)VALUES('task_review')ON CONFLICT(id)DO NOTHING;
-- Existing task, HR review, immutable history and financial source validation remain mandatory.
COMMIT;
