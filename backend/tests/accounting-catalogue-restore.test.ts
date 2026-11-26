import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {archive,restoreArchive} from '../src/backup.js';
import {transaction} from '../src/core.js';
import {businessCentersFixture} from './business-centers-fixture.js';
import {localTestContainer,localTestPort} from './setup.js';

test('030 restores and preserves accounting records, balances and links',async()=>{
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
        const predecessors=[
            ['AB_CATALOGUE_028_SQL','2f997597dfd13540c68f714f191c349e611d7043648871caa4eeefc58938f94c'],
            ['AB_CATALOGUE_029_SQL','480957d07c28c728a6112d1aab969c5885ab634de0c7ef4da99b0a57825324e4'],
        ];
        const checksum=(sql:Buffer|string)=>createHash('sha256').update(sql).digest('hex');
        assert.equal(Boolean(process.env.AB_CATALOGUE_028_SQL),Boolean(process.env.AB_CATALOGUE_029_SQL));
        for(const [variable,expected] of predecessors){
            const path=process.env[variable];
            if(path){const sql=await readFile(path);assert.equal(checksum(sql),expected);await f.admin.query(sql.toString());}
        }
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
        assert.deepEqual(await snapshot(target),before);
        assert.deepEqual(await permissions(target),previousPermissions);
        assert.deepEqual(await schema(target),previousSchema);
        const sql=await readFile('supabase/proposed/030_accounting_item_catalogue.sql','utf8');
        assert.equal(checksum(sql),'715f92c5a1a2977a4722ab6bcaf728bdadd2f91715139ccbec0d407a1f47efac');
        await target.query(sql);
        assert.deepEqual(await snapshot(target),before);
        assert.deepEqual((await permissions(target)).filter(id=>!previousPermissions.includes(id)),['ledger_item_create','ledger_item_edit']);
        assert.deepEqual(await schema(target),{...previousSchema,runtime_delete:true});
        runtime=new Pool({...connection,user:'ab_runtime',password:f.secret.runtime});
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
});
