"""Prepare schema-only SQL Editor handoff for the approved clean Supabase project."""
from pathlib import Path
import json, hashlib, sys, re
from build import build, ROOT
TARGET='rdsqerenobigacmetryv'
def release(destination):
    build(destination)
    out=Path(destination)
    manifest=json.loads((out/'manifest.json').read_text())
    plan=json.loads((ROOT/'backend/deploy/personnel-release-plan.json').read_text())
    expected_tables=[]
    for item in manifest['migrations']:
        expected_tables += re.findall(r'CREATE TABLE ab\.([a-z_]+)',(ROOT/item['path']).read_text())
    def literals(xs):return ','.join("'"+x+"'" for x in xs)
    ledger=' OR '.join("NOT EXISTS(SELECT FROM public.ab_schema_migrations WHERE name='%s' AND sha256='%s')"%(m['name'],m['sha256']) for m in manifest['migrations'])
    checks=f"""
-- Validation runs BEFORE COMMIT. Any error rolls back the complete schema installation.
DO $verify_clean$ DECLARE t text; n bigint; BEGIN
 IF (SELECT count(*) FROM public.ab_schema_migrations)<>13 OR {ledger} THEN
  RAISE EXCEPTION 'MIGRATION_LEDGER_MISMATCH'; END IF;
 FOREACH t IN ARRAY ARRAY[{literals(sorted(set(expected_tables)))}] LOOP
  IF to_regclass('ab.'||t) IS NULL THEN RAISE EXCEPTION 'EXPECTED_TABLE_MISSING: %',t; END IF;
 END LOOP;
 FOREACH t IN ARRAY ARRAY[{literals(['organizations','users','companies','bank_accounts','audit_events']+plan['rlsTables'])}] LOOP
  IF NOT EXISTS(SELECT FROM pg_class WHERE oid=to_regclass('ab.'||t) AND relrowsecurity)
   OR NOT EXISTS(SELECT FROM pg_policy WHERE polrelid=to_regclass('ab.'||t)) THEN
   RAISE EXCEPTION 'RLS_OR_POLICY_MISSING: %',t; END IF;
 END LOOP;
 IF EXISTS(SELECT FROM pg_constraint WHERE connamespace='ab'::regnamespace AND NOT convalidated) THEN
  RAISE EXCEPTION 'UNVALIDATED_CONSTRAINT'; END IF;
 IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='ab_runtime' AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole) THEN
  RAISE EXCEPTION 'UNEXPECTED_RUNTIME_PRIVILEGES'; END IF;
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='ab' AND tablename NOT IN ('roles','permissions','role_permissions') LOOP
  EXECUTE format('SELECT count(*) FROM ab.%I',t) INTO n;
  IF n<>0 THEN RAISE EXCEPTION 'UNEXPECTED_INITIAL_DATA: %',t; END IF;
 END LOOP;
END $verify_clean$;
"""
    sql=(out/'clean-schema.sql').read_text()
    assert sql.count('COMMIT;\nSELECT')==1
    sql=sql.replace('COMMIT;\nSELECT',checks+'COMMIT;\nSELECT')
    sql=('-- APPROVED DESTINATION ONLY: '+TARGET+' (ab-group-erp-clean-test, Singapore).\n'
         '-- Open https://supabase.com/dashboard/project/'+TARGET+'/sql/new\n'
         '-- Destination identity is selected by the dashboard URL; SQL cannot attest the project ref.\n'
         '-- DO NOT run in the old project. No source connection or Auth data is included.\n'+sql)
    sql=sql.replace("'CLEAN_SCHEMA_13_APPLIED'","'CLEAN_SCHEMA_13_APPLIED_AND_VERIFIED'")
    filename='ab-group-clean-'+TARGET+'.sql'
    (out/filename).write_text(sql)
    manifest.update(destinationProjectRef=TARGET,destinationRegion='Singapore',targetBinding='operator must verify dashboard project URL; not SQL-attested',file=filename,bundleSha256=hashlib.sha256(sql.encode()).hexdigest())
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    # The isolated checker tests this exact release payload, not merely the earlier generic bundle.
    (out/'clean-schema.sql').write_text(sql)
    print('CHECK: TARGET_RELEASE_WITH_PRECOMMIT_VALIDATION_READY')
if __name__=='__main__':release(sys.argv[1])
