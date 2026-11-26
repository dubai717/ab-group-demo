import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {archive,restoreArchive} from '../src/backup.js';
import {transaction} from '../src/core.js';
import {businessCentersFixture} from './business-centers-fixture.js';
import {applyBusinessCenters} from '../deploy/business-centers-release.js';
import {businessCatalog,catalogueMigration,validateBusinessLedger,type BusinessMigration} from '../deploy/business-centers-catalog.mjs';
import {approvedCatalog} from '../deploy/safe-staging-additives.js';
import {schemaReadiness} from '../deploy/schema-readiness.js';
import {manifest} from '../deploy/backup-restore-drill.js';
import {localTestContainer,localTestPort} from './setup.js';

async function rehearsal(testLater:boolean){
    const f=await businessCentersFixture();
    const name='ab_restore_'+randomUUID().replaceAll('-','');
    const env={...process.env};
    for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[key];
    const docker=(args:string[],input?:Buffer)=>execFileSync('docker',['--host=unix:///var/run/docker.sock','exec',...args],
        {env,input,stdio:['pipe','pipe','pipe'],maxBuffer:64*1024*1024});
    let target:Pool|undefined,runtime:Pool|undefined,created=false;
    try{
        assert.match(f.sourceDatabase,/^ab_backup_[a-f0-9]+$/);
        for(const file of ['026_investor_registry_versions.sql','027_investor_electronic_access.sql'])
            await f.admin.query(await readFile('supabase/additive/'+file,'utf8'));
        const base=await approvedCatalog(),ordinary=businessCatalog(),catalogue=catalogueMigration();
        assert.equal(catalogue.sha256,'715f92c5a1a2977a4722ab6bcaf728bdadd2f91715139ccbec0d407a1f47efac');
        const initial=[...base,...ordinary];
        for(const entry of initial)await f.admin.query('insert into public.ab_schema_migrations(name,sha256) values($1,$2) on conflict(name) do nothing',[entry.name,entry.sha256]);
        await f.admin.query('create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,deleted_at timestamptz,banned_until timestamptz)');
        await f.admin.query('insert into auth.users(id,email,email_confirmed_at) select auth_id,auth_email,now() from ab.users');
        const viewer=await f.employee(),editor=await f.employee();
        for(const [actor,actions] of [[viewer,['ledger_view']],[editor,['ledger_view','ledger_item_manage']]] as const){
            for(const action of actions)await f.req('POST','/api/users/'+actor.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
        }
        const unused=async(companyId:string)=>f.req('POST','/api/ledger/items',{nameAr:'بند اصطناعي',nameEn:'Synthetic item',
            category:'general',companyIds:[companyId],invoice:false,receipt:true,payment:false,methods:['manual']});
        const own=await unused(f.co1),other=await unused(f.co2);
        const invoice=await f.bill('300');
        await f.collection('200');
        await f.proof();
        const tables=(await f.admin.query("select tablename from pg_tables where schemaname='ab' and tablename<>'permissions' order by tablename")).rows.map(r=>String(r.tablename));
        assert(tables.every(name=>/^[a-z0-9_]+$/.test(name)));
        const snapshot=async(pool:Pool)=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,
            (await pool.query("select to_jsonb(t)-'catalogue_company_ids' row from ab."+table+" t order by (to_jsonb(t)-'catalogue_company_ids')::text")).rows])));
        const permissions=async(pool:Pool)=>(await pool.query('select id from ab.permissions order by id')).rows.map(r=>r.id);
        const schema=async(pool:Pool)=>(await pool.query(`select
            (select relrowsecurity from pg_class where oid='ab.finance_items'::regclass) as rls,
            (select json_agg(pg_get_constraintdef(oid) order by conname) from pg_constraint where conrelid='ab.finance_items'::regclass or confrelid='ab.finance_items'::regclass) as links,
            has_table_privilege('ab_runtime','ab.finance_items','DELETE') as runtime_delete`)).rows[0];
        const before=await snapshot(f.admin),previousPermissions=await permissions(f.admin),previousSchema=await schema(f.admin);
        assert.equal(previousSchema.rls,true);
        assert.equal(previousSchema.runtime_delete,false);
        const dump=docker([localTestContainer,'pg_dump','-U','postgres','-d',f.sourceDatabase,'-Fc','--no-owner']);
        const key=randomBytes(32).toString('base64'),restored=restoreArchive(archive(dump,new Map(f.objects.rows),key),key);
        assert.deepEqual(restored.objects,new Map(f.objects.rows));
        docker([localTestContainer,'createdb','-U','postgres',name]);created=true;
        docker(['-i',localTestContainer,'pg_restore','-U','postgres','-d',name,'--no-owner','--exit-on-error'],restored.database);
        const connection={host:'127.0.0.1',port:localTestPort,database:name};
        target=new Pool({...connection,user:'postgres',password:f.secret.admin});
        runtime=new Pool({...connection,user:'ab_runtime',password:f.secret.runtime});
        assert.equal((await schemaReadiness(target,runtime,true)).pending,1);
        assert.deepEqual(await snapshot(target),before);
        assert.deepEqual(await permissions(target),previousPermissions);
        assert.deepEqual(await schema(target),previousSchema);
        const plan=[...ordinary,catalogue];
        const ledger=async()=>(await target!.query('select name,sha256 from public.ab_schema_migrations order by name')).rows;
        const context=async()=>({ledger:await ledger(),manifest:await manifest(target! as any)});
        const initialLedger=await ledger(),backup=await context();
        assert.equal(initialLedger.length,27);
        assert.deepEqual(validateBusinessLedger(initialLedger,base,plan).map(m=>m.name),[catalogue.name]);
        assert.equal((await applyBusinessCenters(target,backup,{dryRun:true,plan})).applied,1);
        assert.deepEqual(await ledger(),initialLedger);
        assert.equal((await schema(target)).runtime_delete,false);
        assert.equal((await applyBusinessCenters(target,backup,{rehearsed:true,plan})).applied,1);
        const after030=await ledger();
        assert.equal(after030.length,28);
        assert.throws(()=>validateBusinessLedger(after030.map(entry=>entry.name===catalogue.name?{...entry,sha256:'0'.repeat(64)}:entry),base,plan),/CATALOGUE_LEDGER_HASH/);
        assert.deepEqual(after030.find(r=>r.name===catalogue.name),{name:catalogue.name,sha256:catalogue.sha256});
        assert.equal((await applyBusinessCenters(target,await context(),{rehearsed:true,plan})).applied,0);
        assert.deepEqual(await ledger(),after030);
        assert.deepEqual(await snapshot(target),before);
        assert.deepEqual((await permissions(target)).filter(id=>!previousPermissions.includes(id)),['ledger_item_create','ledger_item_edit']);
        assert.deepEqual(await schema(target),{...previousSchema,runtime_delete:true});
        assert.equal((await schemaReadiness(target,runtime,true)).pending,0);
        assert.equal((await runtime.query('select id from ab.finance_items')).rowCount,0);
        await transaction(runtime,f.org.tenant,f.org.user,async c=>{
            const balance=(await c.query('select amount::text,ab.financial_allocation_total(id)::text paid,(amount-ab.financial_allocation_total(id))::text outstanding from ab.vehicle_invoices where id=$1',[invoice.id])).rows[0];
            assert.deepEqual(balance,{amount:'300.000',paid:'200.000',outstanding:'100.000'});
        });
        const use=(actor:string,fn:Parameters<typeof transaction>[3])=>transaction(runtime!,f.org.tenant,actor,fn);
        const remove=(actor:string,id:string)=>use(actor,c=>c.query('delete from ab.finance_items where id=$1 returning id',[id]));
        const denied=(error:any)=>error.code==='42501';
        await assert.rejects(remove(f.org.user,own.id),denied); // Legacy item without a protected scope.
        await assert.rejects(use(editor.id,c=>c.query('update ab.finance_items set catalogue_company_ids=$2 where id=$1',[other.id,[f.co1]])),denied);
        for(const [id,scope] of [[own.id,[f.co1]],[other.id,[f.co2]],[f.items.loan,[f.co1,f.co2]]] as const)
            await use(f.org.user,c=>c.query('update ab.finance_items set catalogue_company_ids=$2 where id=$1',[id,scope]));
        await assert.rejects(remove(viewer.id,own.id),denied);
        await assert.rejects(remove(editor.id,other.id),denied);
        await assert.rejects(use(editor.id,c=>c.query('update ab.finance_items set catalogue_company_ids=$2 where id=$1',[other.id,[f.co1]])),denied);
        await assert.rejects(remove(f.org.user,f.items.loan),(error:any)=>error.code==='23503');
        const rollback=new Error('rollback isolated permission probe');
        await assert.rejects(use(editor.id,async c=>{
            assert.equal((await c.query('delete from ab.finance_items where id=$1 returning id',[own.id])).rowCount,1);
            throw rollback;
        }),rollback);
        await assert.rejects(use(f.org.user,async c=>{
            assert.equal((await c.query('update ab.finance_items set active=false where id=$1 returning active',[f.items.loan])).rows[0].active,false);
            assert.equal((await c.query('select id from ab.finance_invoice_links where invoice_id=$1',[invoice.id])).rowCount,1);
            throw rollback;
        }),rollback);
        if(testLater){
            const approved=[
                ['AB_CATALOGUE_028_SQL','028_investor_monthly_settlements.sql','2f997597dfd13540c68f714f191c349e611d7043648871caa4eeefc58938f94c',
                    ['investor_monthly_configurations','investor_monthly_versions','investor_monthly_invoice_classifications','investor_monthly_settlements','investor_monthly_lines','investor_monthly_exclusions']],
                ['AB_CATALOGUE_029_SQL','029_operating_billing.sql','480957d07c28c728a6112d1aab969c5885ab634de0c7ef4da99b0a57825324e4',
                    ['operating_bill_lines','operating_statements','operating_charges']],
            ] as const;
            const later:BusinessMigration[]=[];
            for(const [variable,name,sha256,tables] of approved){
                const sql=await readFile(process.env[variable]!,'utf8');
                assert.equal(createHash('sha256').update(sql).digest('hex'),sha256);
                later.push({name,path:'supabase/additive/'+name,sha256,sql,tables:[...tables]});
            }
            const laterPlan=[...ordinary,...later,catalogue];
            assert.deepEqual(validateBusinessLedger(await ledger(),base,laterPlan).map(m=>m.name),later.map(m=>m.name));
            assert.throws(()=>validateBusinessLedger([...after030,later[1]],base,laterPlan),/BUSINESS_LEDGER_PREFIX/);
            for(const [index,migration] of later.entries()){
                const selected=[...ordinary,...later.slice(0,index+1),catalogue];
                const nextBackup=await context();
                assert.equal((await applyBusinessCenters(target,nextBackup,{dryRun:true,plan:selected})).applied,1);
                assert.deepEqual(await ledger(),nextBackup.ledger);
                assert.equal((await applyBusinessCenters(target,nextBackup,{rehearsed:true,plan:selected})).applied,1);
                assert.deepEqual((await ledger()).find(r=>r.name===migration.name),{name:migration.name,sha256:migration.sha256});
            }
            const final=await ledger();
            assert.equal(final.length,30);
            for(const {name,sha256}of [...later,catalogue])assert.deepEqual(final.find(r=>r.name===name),{name,sha256});
            assert.equal((await applyBusinessCenters(target,await context(),{rehearsed:true,plan:laterPlan})).applied,0);
            assert.deepEqual(await ledger(),final);
            assert.deepEqual(await snapshot(target),before);
            assert.deepEqual(await snapshot(f.admin),before);
            return;
        }
        // Rehearse removing the newly introduced capability without rewriting financial data.
        await target.query(`begin;
            revoke delete on ab.finance_items from ab_runtime;
            drop trigger catalogue_item_scope_guard on ab.finance_items;
            drop function ab.guard_catalogue_item_scope();
            drop function ab.catalogue_item_right(uuid,text[]);
            alter table ab.finance_items drop column catalogue_company_ids;
            delete from ab.permissions where id in ('ledger_item_create','ledger_item_edit');
            commit;`);
        assert.deepEqual(await schema(target),previousSchema);
        assert.deepEqual(await permissions(target),previousPermissions);
        assert.deepEqual(await snapshot(target),before);
        assert.deepEqual(await snapshot(f.admin),before);
    }finally{
        if(runtime)await runtime.end();
        if(target)await target.end();
        if(created)docker([localTestContainer,'dropdb','-U','postgres',name]);
        await f.close();
    }
}
test('030 after 027 on a restored copy preserves balances, enforces company scope and replays as a no-op',()=>rehearsal(false));
test('028 then 029 after 030 on a separate restored copy preserve balances and exact ledger fingerprints',{
    skip:!process.env.AB_CATALOGUE_028_SQL||!process.env.AB_CATALOGUE_029_SQL,
},()=>rehearsal(true));
