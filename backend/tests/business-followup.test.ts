import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { personnelFixture } from './personnel-fixture.js';

test('EOS estimates preserve existing legal rules, self access and immutable history', async t => {
    const f = await personnelFixture();
    try {
        await f.admin.query(await readFile('supabase/additive/014_followup_and_eos.sql','utf8'));
        const worker = await f.employee();
        const create = (userId?: string) => f.req('POST','/api/personnel/employees', {
            companyId:f.co1,userId,nameAr:'موظف اختبار معزول',nameEn:'Isolated EOS test',jobTitle:'Operations',hiredOn:'2024-01-01'
        });
        const e = await create(worker.id), other = await create();
        await f.req('POST',`/api/personnel/employees/${e.id}/compensation`,{companyId:f.co1,effectiveOn:'2024-01-01',currency:'AED',basic:'3000',allowances:'500',allocations:[{companyId:f.co1,bps:10000}],reason:'Synthetic legal estimate test'});
        await t.test('no legal regime is assigned implicitly',async()=>{
            assert.equal((await f.req('GET',`/api/personnel/employees/${e.id}/eos`)).available,false);
        });
        await f.req('POST',`/api/personnel/employees/${e.id}/private`,{legalRegime:'uae_private_general'});
        await t.test('existing approved formula remains unchanged',async()=>{
            const r=await f.req('GET',`/api/personnel/employees/${e.id}/eos?asOf=2026-01-01`);
            assert.equal(r.available,true);assert.equal(r.estimate,true);assert.equal(r.gross,'4200.000');
        });
        await f.login(worker.username,worker.password);
        await t.test('self can see own estimate without a company-wide salary or EOS grant',async()=>{
            const r=await f.req('GET',`/api/personnel/employees/${e.id}`);
            assert.equal(r.endOfService.available,true);assert.equal(r.compensation,undefined);assert.equal(r.private,undefined);
            const h=await f.req('GET',`/api/personnel/employees/${e.id}/eos/history`);
            assert.equal(h.rows.length,3);assert.ok(h.rows.some((r:any)=>r.source==='compensation_version'));
        });
        await t.test('self cannot view another employee or alter estimates',async()=>{
            await f.req('GET',`/api/personnel/employees/${other.id}/eos`,undefined,403);
            await f.req('GET',`/api/personnel/employees/${other.id}/eos/history`,undefined,403);
            await f.req('POST',`/api/personnel/employees/${e.id}/private`,{legalRegime:'uae_private_general'},403);
        });
        await f.login();
        await t.test('GET does not write history and salary changes preserve prior estimates',async()=>{
            const before=(await f.req('GET',`/api/personnel/employees/${e.id}/eos/history`)).rows;
            await f.req('GET',`/api/personnel/employees/${e.id}/eos`);
            await f.req('POST',`/api/personnel/employees/${e.id}/compensation`,{companyId:f.co1,effectiveOn:'2026-01-01',currency:'AED',basic:'4000',allowances:'500',allocations:[{companyId:f.co1,bps:10000}],reason:'Synthetic new effective salary'});
            const after=(await f.req('GET',`/api/personnel/employees/${e.id}/eos/history`)).rows;
            assert.equal(after.length,before.length+1);
            for(const row of before)assert.deepEqual(after.find((r:any)=>r.id===row.id),row);
            const raw=(await f.admin.query('select * from ab.hr_eos_estimates where employee_id=$1',[e.id])).rows;
            assert.ok(raw.every(r=>!r.payload_cipher.includes('3000')));
            await assert.rejects(f.admin.query('update ab.hr_eos_estimates set as_of=current_date where employee_id=$1',[e.id]));
        });
    } finally { await f.close(); }
});

test('Collection attempts use existing tasks, invoice balances and delayed internal notifications',async t=>{
    const f=await personnelFixture();
    try{
        await f.admin.query(await readFile('supabase/additive/014_followup_and_eos.sql','utf8'));
        const e=(await f.req('POST','/api/personnel/employees',{companyId:f.co1,userId:f.org.user,nameAr:'مالك اختبار',nameEn:'Synthetic owner employee',jobTitle:'Collections',hiredOn:'2024-01-01'})).id;
        const raw=(await f.admin.query('select * from ab.customers where id=$1',[f.client])).rows[0];
        const {security}=await import('../src/core.js'),cipher=security(f.secret.key),profile=cipher.open(raw.payload_cipher);
        // Synthetic fixture only. The real customer UI uses the existing phone validation workflow.
        await f.admin.query('update ab.customers set payload_cipher=$2 where id=$1',[f.client,cipher.seal({...profile,phones:[{id:'fixture-phone',number:'+971500000001',status:'valid'}]})]);
        const invoice=await f.bill(),created=await f.req('POST','/api/collections/tasks',{invoiceId:invoice.id,employeeId:e,dueOn:'2026-01-01'});
        await t.test('task creation deduplicates by canonical invoice',async()=>{
            const again=await f.req('POST','/api/collections/tasks',{invoiceId:invoice.id,employeeId:e,dueOn:'2026-01-01'});assert.equal(again.id,created.id);assert.equal(again.created,false);
        });
        await t.test('invoice amount, customer and optional vehicle are authoritative',async()=>{
            const r=await f.req('GET','/api/collections/tasks/'+created.id);assert.equal(r.invoice.outstanding,'1000.000');assert.equal(r.invoice.customerId,f.client);assert.equal(r.invoice.vehicleId,null);
        });
        let first:any;
        await t.test('off creates 60-minute reminder without closing the task or posting money',async()=>{
            first=await f.req('POST','/api/collections/tasks/'+created.id+'/attempts',{outcome:'off',phoneId:'fixture-phone',note:'Synthetic switched off'});
            assert.equal(first.taskClosed,false);const delay=new Date(first.nextAt).getTime()-Date.now();assert.ok(delay>59*60000&&delay<=60*60000);
            assert.equal((await f.req('GET','/api/collections/tasks/'+created.id)).task.state,'Open');
            const rows=(await f.admin.query("select * from ab.finance_notifications where action='collection:followup'")).rows;assert.equal(rows.length,1);assert.equal(rows[0].entity_id,created.id);
            assert.equal((await f.req('GET','/api/notifications')).rows.some((r:any)=>r.id===rows[0].id),false);
        });
        await t.test('paid is a report, not evidence of settlement or permission to close',async()=>{
            const r=await f.req('POST','/api/collections/tasks/'+created.id+'/attempts',{outcome:'paid',phoneId:'fixture-phone',note:'Synthetic customer claim'});assert.equal(r.reportedPaidVerified,false);assert.equal(r.taskClosed,false);
            await f.req('POST','/api/personnel/tasks/'+created.id+'/action',{action:'submit',note:'Reported claim only',revision:1});
            await f.req('POST','/api/personnel/tasks/'+created.id+'/action',{action:'complete',note:'Cannot verify unfunded claim',revision:2},409);
            assert.equal((await f.req('GET','/api/collections/tasks/'+created.id)).invoice.outstanding,'1000.000');
        });
        await t.test('promise requires a future followup; bad phones and outcomes are rejected',async()=>{
            const url='/api/collections/tasks/'+created.id+'/attempts';
            await f.req('POST',url,{outcome:'promise',phoneId:'fixture-phone',note:'No date'},422);
            await f.req('POST',url,{outcome:'off',phoneId:'not-owned',note:'Not a valid customer phone'},422);
            await f.req('POST',url,{outcome:'invented',phoneId:'fixture-phone',note:'Not configured'},422);
            assert.equal((await f.req('GET','/api/collections/tasks/'+created.id)).attempts.length,2);
        });
        await t.test('another employee cannot read or record collection details without both scopes',async()=>{
            const u=await f.employee();await f.login(u.username,u.password);await f.req('GET','/api/collections/tasks/'+created.id,undefined,403);await f.req('POST','/api/collections/tasks/'+created.id+'/attempts',{outcome:'off',phoneId:'fixture-phone',note:'Denied'},403);await f.login();
        });
    }finally{await f.close();}
});
