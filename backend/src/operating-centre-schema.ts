// Exact reviewed structural source; never learns or approves a hosted schema at runtime.
import{createHash}from'node:crypto';import{operatingCentreSourceReady}from'./operating-centre-readiness.js';
const tables=['operating_centre_versions','operating_centre_companies'];
// Build-time fingerprint of the uninstalled candidate from a synthetic database; not installation approval.
const reviewedFingerprint='b0550ee45700108888ace75c4957b376b962128f9f213b9831424236393462e9';
const dependencies=(catalogue:'pg_attrdef'|'pg_constraint',sourceId:'defaults.oid'|'k.oid')=>`coalesce((select jsonb_agg(jsonb_build_object('class',dep.refclassid::regclass::text,'identity',(pg_identify_object(dep.refclassid,dep.refobjid,dep.refobjsubid)).identity)order by dep.refclassid::regclass::text,(pg_identify_object(dep.refclassid,dep.refobjid,dep.refobjsubid)).identity)from pg_depend dep where dep.classid='${catalogue}'::regclass and dep.objid=${sourceId} and dep.deptype='n'),'[]'::jsonb)`;
export async function operatingCentreSchemaFingerprint(c:any){
 const attributes=(await c.query(`select t.relname,a.attname,format_type(a.atttypid,a.atttypmod)type,a.attnotnull,a.attgenerated,a.attidentity,
 a.attcollation::regcollation::text collation,pg_get_expr(defaults.adbin,defaults.adrelid)default_expression,
 ${dependencies('pg_attrdef','defaults.oid')} default_dependencies
 from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_attribute a on a.attrelid=t.oid
 left join pg_attrdef defaults on defaults.adrelid=t.oid and defaults.adnum=a.attnum
 where n.nspname='ab'and t.relname=any($1::text[])and a.attnum>0 and not a.attisdropped order by t.relname,a.attnum`,[tables])).rows;
 const constraints=(await c.query(`select t.relname,k.contype,pg_get_constraintdef(k.oid,true)definition,k.condeferrable,k.condeferred,k.convalidated,k.connoinherit,
 i.indisvalid,i.indisready,i.indisunique,
 ${dependencies('pg_constraint','k.oid')} dependencies
 from pg_constraint k join pg_class t on t.oid=k.conrelid join pg_namespace n on n.oid=t.relnamespace
 left join pg_index i on i.indexrelid=k.conindid
 where n.nspname='ab'and t.relname=any($1::text[])order by t.relname,k.contype,pg_get_constraintdef(k.oid,true)`,[tables])).rows;
 return createHash('sha256').update(JSON.stringify({attributes,constraints})).digest('hex');
}
export async function operatingCentreWriterSourceReady(c:any){return await operatingCentreSourceReady(c)&&await operatingCentreSchemaFingerprint(c)===reviewedFingerprint;}
