// Schema-only handoff: no Auth creation, passwords, source import or network access.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),seed=require('../../data/uae-areas.js'),area=require('../../area-reference.js');
const q=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const aliases=seed.areas.flatMap(a=>[...new Set([a.ar,a.en,...(a.aliases||[])].map(area.normalize).filter(Boolean))].map(normalized_name=>({area_id:a.id,emirate_id:a.emirateId,normalized_name})));
const purposes=['operations','payroll','savings','investment','other'].map(id=>({id,kind:'purpose',data:{ar:{operations:'تشغيلي',payroll:'رواتب',savings:'ادخار',investment:'استثمار',other:'أخرى'}[id],en:id}}));
const sql=`-- NEW PROJECT ONLY: rdsqerenobigacmetryv. Run AFTER schema verification.
-- In that project's Auth dashboard first create ONE confirmed email/password Owner account.
-- Keep password in a password manager; never paste it into SQL. No old identity is imported.
-- Username for the one account below: owner. No other accounts or business records are created.
BEGIN;
SELECT pg_advisory_xact_lock(hashtext('ab-clean-owner-initialization'));
DO $owner$ DECLARE subject uuid; mail text; tenant uuid:=gen_random_uuid(); actor uuid:=gen_random_uuid(); BEGIN
 IF (SELECT count(*) FROM public.ab_schema_migrations)<>13 THEN RAISE EXCEPTION 'SCHEMA_13_REQUIRED'; END IF;
 IF EXISTS(SELECT FROM ab.organizations) OR EXISTS(SELECT FROM ab.users) THEN RAISE EXCEPTION 'OWNER_OR_ORGANIZATION_ALREADY_EXISTS'; END IF;
 IF (SELECT count(*) FROM auth.users)<>1 THEN RAISE EXCEPTION 'EXACTLY_ONE_AUTH_OWNER_REQUIRED'; END IF;
 SELECT id,email INTO subject,mail FROM auth.users WHERE email_confirmed_at IS NOT NULL AND email IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now());
 IF subject IS NULL THEN RAISE EXCEPTION 'CONFIRMED_ACTIVE_AUTH_OWNER_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT FROM ab.roles WHERE id='owner') THEN RAISE EXCEPTION 'APPROVED_OWNER_ROLE_REQUIRED'; END IF;
 INSERT INTO ab.organizations(id,name) VALUES(tenant,'AB Group');
 INSERT INTO ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status,data)
 VALUES(actor,tenant,subject,mail,'owner','owner','Active',jsonb_build_object('fullName','AB Group Owner','nameAr','مالك المجموعة','nameEn','AB Group Owner','email',mail));
 INSERT INTO ab.emirates(id,data) SELECT x->>'id',x FROM jsonb_array_elements(${q(seed.emirates)}) x ON CONFLICT DO NOTHING;
 INSERT INTO ab.areas(tenant_id,id,emirate_id,data) SELECT tenant,x->>'id',x->>'emirateId',x FROM jsonb_array_elements(${q(seed.areas)}) x;
 INSERT INTO ab.area_aliases(tenant_id,emirate_id,normalized_name,area_id)
 SELECT tenant,x.emirate_id,x.normalized_name,x.area_id FROM jsonb_to_recordset(${q(aliases)}) AS x(emirate_id text,normalized_name text,area_id text) ON CONFLICT DO NOTHING;
 INSERT INTO ab.bank_references(tenant_id,id,kind,data) SELECT tenant,x->>'id',x->>'kind',x->'data' FROM jsonb_array_elements(${q(purposes)}) x;
 INSERT INTO ab.audit_events(id,tenant_id,actor_id,action,entity_type,entity_id,fields,request_id)
 VALUES(gen_random_uuid(),tenant,actor,'cleanOwnerInitialized','user',actor::text,ARRAY['auth_id','role_id'],gen_random_uuid());
 IF EXISTS(SELECT FROM ab.companies) OR EXISTS(SELECT FROM ab.bank_accounts) OR EXISTS(SELECT FROM ab.customers) OR EXISTS(SELECT FROM ab.vehicles) THEN RAISE EXCEPTION 'UNEXPECTED_BUSINESS_DATA'; END IF;
END $owner$;
COMMIT;
SELECT 'SINGLE_OWNER_INITIALIZED_NO_BUSINESS_DATA' AS result,count(*) AS users FROM ab.users;
`;
writeFileSync(process.argv[2],sql);console.log('CHECK: OWNER_ONLY_HANDOFF_NO_AUTH_OR_PASSWORD_IMPORT_READY');
