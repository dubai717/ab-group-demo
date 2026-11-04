// Read-only project pin, schema inventory and conservative recognition of known synthetic fixtures.
import {Pool} from 'pg';
import {readFile} from 'node:fs/promises';
import {databaseOptions,assertVerifiedDatabaseTls} from '../src/database.js';
import {sha,security} from '../src/core.js';
function need(ok:unknown,label:string):asserts ok{if(!ok)throw Error(label);}
async function run(){let pool:Pool|undefined,stage='GUARD';try{
 need(process.env.GITHUB_ACTIONS==='true'&&process.env.GITHUB_REPOSITORY==='dubai717/ab-group-demo'&&['refs/heads/verify/staging-safety-before-migrations-20261104','refs/heads/activate/personnel-staging-approved','refs/heads/verify/staging-rehearsal-009-013-20261104'].includes(process.env.GITHUB_REF||''),'RUNNER');
 const u=new URL(process.env.SUPABASE_URL||''),d=new URL(process.env.MIGRATION_DATABASE_URL||'');
 need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==='/'&&sha(u.origin)==='9ea1a5dcb06a135b7c29d99699651b34d11f795d525b7861865c0c842fff954f','PROJECT_PIN');
 need(['postgres:','postgresql:'].includes(d.protocol)&&decodeURIComponent(d.username)==='postgres.'+u.hostname.split('.')[0]&&d.hostname.endsWith('.pooler.supabase.com')&&(d.port||'5432')==='5432'&&d.pathname==='/postgres'&&[...d.searchParams.keys()].every(k=>k==='sslmode'),'ADMIN_TARGET');
 stage='READ_ONLY_DATABASE';pool=new Pool({...databaseOptions(d.href),max:1,options:'-c default_transaction_read_only=on'});pool.on('error',()=>{});const c=await pool.connect();try{
 assertVerifiedDatabaseTls(c);await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const approved=JSON.parse(await readFile('backend/actions/approved-migrations.json','utf8')).migrations,ledger=(await c.query('select name,sha256 from public.ab_schema_migrations')).rows;
 need(ledger.length===8&&approved.every((m:any)=>ledger.some(r=>r.name===m.name&&r.sha256===m.sha256)),'LEDGER');
 const expected=new Set<string>();for(const m of approved){const sql=await readFile('supabase/migrations/'+m.name,'utf8');need(sha(sql)===m.sha256,'BASE_HASH');for(const match of sql.matchAll(/\bCREATE TABLE ab\.([a-z_]+)/g))expected.add(match[1]);}
 const tables=(await c.query("select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relkind in('r','p')")).rows.map(r=>r.relname);need(tables.length===expected.size&&tables.every(t=>expected.has(t)),'UNTRACKED_TABLES');
 console.log('CHECK: PINNED_TEST_PROJECT_AND_EIGHT_MIGRATIONS=PASS');
 const users=(await c.query('select id,tenant_id,username,auth_email from ab.users')).rows;
 const knownUsers=new Set(users.filter(r=>/^(?:trial_[a-f0-9]{12}|ci_(?:owner_)?[a-f0-9]{12})$/.test(r.username)&&r.auth_email.endsWith('@example.test')).map(r=>r.id));
 const unknown:Record<string,number>={users:users.length-knownUsers.size};
 unknown.organizations=Number((await c.query("select count(*) n from ab.organizations where name<>'AB Group — synthetic test environment'")).rows[0].n);
 const companies=(await c.query('select id,created_by,data from ab.companies')).rows;
 const knownCompanies=new Set(companies.filter(r=>knownUsers.has(r.created_by)&&r.data.englishName==='Fictional CI company'&&/^CI-[a-f0-9-]+$/.test(r.data.companyCode||'')).map(r=>r.id));
 unknown.companies=companies.length-knownCompanies.size;
 const cipher=security(process.env.DATA_ENCRYPTION_KEY||'');unknown.bank_accounts=0;
 for(const r of(await c.query('select company_id,created_by,payload_cipher from ab.bank_accounts')).rows){const p=cipher.open(r.payload_cipher);if(!knownCompanies.has(r.company_id)||!knownUsers.has(r.created_by)||p.accountName!=='Fictional CI account'||p.branch!=='Fictional branch'||!['000123','000456'].includes(p.accountNumber))unknown.bank_accounts++;}
 unknown.licenses=Number((await c.query("select count(*) n from ab.company_licenses where number not like 'CI-%'")).rows[0].n);
 unknown.documents=0;for(const r of(await c.query('select title,created_by,company_id,bank_account_id from ab.documents')).rows)if(r.title!=='Fictional CI document'||!knownUsers.has(r.created_by))unknown.documents++;
 unknown.document_versions=Number((await c.query("select count(*) n from ab.document_versions where original_name<>'fictional-ci.pdf'")).rows[0].n);
 unknown.departments=Number((await c.query('select count(*) n from ab.departments')).rows[0].n);
 unknown.unlinked_auth_users=Number((await c.query('select count(*) n from auth.users a left join ab.users u on u.auth_id=a.id where u.id is null')).rows[0].n);
 // Any configured job/provider or unclassified setting needs explicit review, never automatic activation.
 unknown.settings=Number((await c.query('select count(*) n from ab.settings')).rows[0].n);
 console.log('CHECK: UNCLASSIFIED_COUNTS='+JSON.stringify(unknown));
 console.log('CHECK: RECOGNIZED_FIXTURE_COUNTS='+JSON.stringify({users:knownUsers.size,companies:knownCompanies.size}));
 await c.query('ROLLBACK');
 if(Object.values(unknown).some(n=>n!==0)){console.log('RESULT: STOP_UNCLASSIFIED_DATA; NO_MIGRATIONS_WRITES_OR_DEPLOYMENT; NOT_A_CLAIM_OF_REAL_DATA');process.exitCode=2;return;}
 console.log('RESULT: KNOWN_SYNTHETIC_FIXTURES_ONLY_IN_REVIEWED_CORE_TABLES; NO_WRITES; RESTORE_AND_MIGRATION_REHEARSAL_REQUIRED');
 }finally{await c.query('ROLLBACK').catch(()=>{});c.release();}
 }catch(error){const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'WITHHELD';console.log('RESULT: PREFLIGHT_STOP; STAGE='+stage+'; CODE='+code+'; NO_CHANGES');process.exitCode=1;}finally{await pool?.end().catch(()=>{});}}
await run();
