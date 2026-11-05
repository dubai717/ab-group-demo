"""Build an empty-project-only SQL kit. Reads source files, never connects to a database."""
from pathlib import Path
import hashlib, json, sys
ROOT = Path(__file__).resolve().parents[2]
def build(destination):
    foundation = json.loads((ROOT/'backend/actions/approved-migrations.json').read_text())['migrations']
    proposed = json.loads((ROOT/'backend/deploy/personnel-release-plan.json').read_text())['migrations']
    rows = [dict(x, path='supabase/migrations/'+x['name']) for x in foundation] + proposed
    assert len(rows) == 13 and len({x['name'] for x in rows}) == 13
    sql = """-- AB clean test project only. No account or business data import.
-- Run as project administrator in the NEW project's SQL Editor, never the old project.
BEGIN;
DO $clean_guard$ BEGIN
 IF to_regnamespace('ab') IS NOT NULL OR to_regclass('public.ab_schema_migrations') IS NOT NULL
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN ('ab_runtime','ab_scanner'))
 OR EXISTS(SELECT FROM pg_tables WHERE schemaname='public') THEN
  RAISE EXCEPTION 'CLEAN_PROJECT_REQUIRED';
 END IF;
 IF to_regclass('auth.users') IS NOT NULL THEN
  IF EXISTS(SELECT FROM auth.users) THEN RAISE EXCEPTION 'EMPTY_AUTH_REQUIRED'; END IF;
 END IF;
 IF to_regclass('storage.objects') IS NOT NULL THEN
  IF EXISTS(SELECT FROM storage.objects) THEN RAISE EXCEPTION 'EMPTY_STORAGE_REQUIRED'; END IF;
 END IF;
END $clean_guard$;
CREATE TABLE public.ab_schema_migrations(name text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
"""
    for row in rows:
        body = (ROOT/row['path']).read_bytes()
        assert hashlib.sha256(body).hexdigest() == row['sha256'], 'Approved source checksum mismatch: '+row['name']
        sql += '\n-- BEGIN APPROVED '+row['name']+'\n'+body.decode()+'\n'
        sql += "INSERT INTO public.ab_schema_migrations(name,sha256) VALUES ('%s','%s');\n" % (row['name'],row['sha256'])
    sql += "COMMIT;\nSELECT 'CLEAN_SCHEMA_13_APPLIED' AS result, count(*) AS migrations FROM public.ab_schema_migrations;\n"
    out=Path(destination);out.mkdir(parents=True,exist_ok=True)
    (out/'clean-schema.sql').write_text(sql)
    manifest={'format':'AB-CLEAN-SCHEMA-1','migrations':rows,'bundleSha256':hashlib.sha256(sql.encode()).hexdigest(),'containsSecrets':False,'importsAccountsOrBusinessData':False}
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('CHECK: APPROVED_SOURCE_HASHES_13_OK')
if __name__=='__main__':build(sys.argv[1])
