import {disposeSyntheticRestoreCopy} from './dispose-synthetic-database.js';
import {localTestPort,localTestContainer} from './setup.js';
import {assertEncryptedBackupEnvelope} from './backup-envelope-assertions.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import{isolatedPgTools}from'./isolated-pg-tools.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ledgerFixture } from './ledger-fixture.js';
import { archive, restoreArchive } from '../src/backup.js';
import { security, transaction } from '../src/core.js';
test('financial backup restores journals, invoices, allocations, custody, private evidence, RLS and immutable history into a separate local database without touching source', async () => { const f = await ledgerFixture(); let target: Pool | undefined,ownedRestore:string|undefined; try {
    const bill = await f.bill('1000');
    await f.collection('600');
    const proofId = await f.proof();
    const tools=isolatedPgTools(f.adminUrl,f.sourceDatabase,localTestContainer),dump=tools.dump();
    const key = randomBytes(32).toString('base64'), sealed = archive(dump, new Map(f.objects.rows), key);
    assertEncryptedBackupEnvelope(sealed,key,dump);
    assert.throws(() => restoreArchive(sealed, randomBytes(32).toString('base64')));
    const restored = restoreArchive(sealed, key), name = 'ab_restore_' + randomUUID().replaceAll('-', '');
    await tools.createRestore(name);ownedRestore=name;
    tools.restore(name,restored.database);
    target = new Pool({ host: '127.0.0.1', port: localTestPort, user: 'postgres', password: f.secret.admin, database: name });
    for (const table of ['companies', 'customers', 'finance_accounts', 'finance_items', 'finance_chart', 'finance_journals', 'finance_entries', 'vehicle_invoices', 'finance_invoice_links', 'finance_receipts', 'vehicle_allocations', 'finance_custody_moves', 'finance_events', 'documents', 'document_versions', 'role_permissions'])
        assert.deepEqual((await target.query('select row_to_json(x) row from ab.' + table + ' x order by row_to_json(x)::text')).rows, (await f.admin.query('select row_to_json(x) row from ab.' + table + ' x order by row_to_json(x)::text')).rows);
    const file = (await target.query('select * from ab.document_versions where id=$1', [proofId])).rows[0];
    assert.ok(security(f.secret.key).open(restored.objects.get(file.storage_key)!.toString()));
    const runtime = new Pool({ host: '127.0.0.1', port: localTestPort, user: 'ab_runtime', password: f.secret.runtime, database: name });
    try {
        assert.equal((await runtime.query('select * from ab.finance_journals')).rowCount, 0);
        await transaction(runtime, f.org.tenant, f.org.user, async (c) => assert.ok((await c.query('select * from ab.finance_journals')).rowCount! > 0));
        await assert.rejects(() => runtime.query("update ab.vehicle_invoices set amount=1"), (e: any) => e.code === '42501');
    }
    finally {
        await runtime.end();
    }
    assert.equal((await f.req('GET', '/api/ledger/invoices?companyId=' + f.co1)).rows.find((x: any) => x.id === bill.id).outstanding, '400.000');
    console.log('PASS financial restore drill: separate local database and encrypted objects; original database preserved.');
}
finally {
    if (target)
        await target.end();
    if(ownedRestore)await disposeSyntheticRestoreCopy(f.adminUrl,f.sourceDatabase,ownedRestore);
    await f.close();
} });
