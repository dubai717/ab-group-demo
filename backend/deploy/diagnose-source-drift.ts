import {Pool} from 'pg';
import {backupConnection} from './backup-staging.js';
import {verifiedBackup} from './staging-migration-rehearsal.js';
import {assertVerifiedDatabaseTls,databaseOptions} from '../src/database.js';
import {sha} from '../src/core.js';
import {controllerContext,project} from './v2/context.mjs';
import {sourceDifference,sourceTableFingerprints} from './source-fingerprint.js';

let pool:Pool|undefined;
try {
    const env=process.env;
    if (!controllerContext(env) || env.AB_STAGING_AUTOMATION!=='controlled-test-only' ||
        sha(new URL(env.SUPABASE_URL||'').origin)!==project) {
        throw Error('SOURCE_DIAGNOSTIC_CONTEXT_REQUIRED');
    }
    const {context,proof}=await verifiedBackup();
    if (proof.sourceCommit!==env.AB_STAGING_SOURCE_SHA || proof.sourceReadOnly!==true) {
        throw Error('SOURCE_DIAGNOSTIC_BACKUP_MISMATCH');
    }
    const tables=context.manifest.rows.filter((row:{s:string;t:string})=>row.s==='ab' &&
        !['audit_events','sessions'].includes(row.t));
    if (!tables.length) throw Error('SOURCE_DIAGNOSTIC_MANIFEST_EMPTY');
    pool=new Pool({...databaseOptions(backupConnection(env).uri),max:1,statement_timeout:120000,
        options:'-c default_transaction_read_only=on -c timezone=UTC -c search_path=pg_catalog'});
    const client=await pool.connect();
    try {
        assertVerifiedDatabaseTls(client);
        await client.query('BEGIN READ ONLY');
        const ledger=(await client.query('select name,sha256 from public.ab_schema_migrations order by name')).rows;
        if (JSON.stringify(ledger)!==JSON.stringify(context.ledger)) throw Error('BUSINESS_BACKUP_LEDGER_CHANGED');
        const current=await sourceTableFingerprints(client,tables);
        for (const row of tables) {
            const observed=current.find(entry=>entry.s===row.s&&entry.t===row.t);
            if (!observed || sourceDifference(row,observed)) {
                console.log('CHECK: SOURCE_DRIFT_TABLE='+row.s+'.'+row.t+'; VALUES_AND_HASHES_WITHHELD');
                throw Error('BUSINESS_SOURCE_CHANGED_SINCE_BACKUP');
            }
        }
        console.log('RESULT: SOURCE_MATCHES_VERIFIED_BACKUP; READ_ONLY; TABLES='+tables.length);
    } finally {
        await client.query('ROLLBACK').catch(()=>{});
        client.release();
    }
} catch (error) {
    const code=error instanceof Error&&/^[A-Z_]+$/.test(error.message)?error.message:'DETAILS_WITHHELD';
    console.log('RESULT: SOURCE_DIAGNOSTIC_STOP; CODE='+code);
    process.exitCode=1;
} finally {
    await pool?.end().catch(()=>{});
}
