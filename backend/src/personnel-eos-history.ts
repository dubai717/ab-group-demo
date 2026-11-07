import { randomUUID } from 'node:crypto';
import { employee, legalEOS } from './personnel-domain.js';
import { z } from 'zod';

// Writes only within an already-authorized HR mutation transaction. GET is strictly read-only.
export async function snapshotEOS(c: any, cipher: any, session: any, employeeId: string, kind: string, sourceKey: string, asOf?: string) {
    if (!(await c.query("select to_regclass('ab.hr_eos_estimates') ok")).rows[0].ok) return;
    const e = (await c.query('select * from ab.hr_employees where id=$1', [employeeId])).rows[0];
    if (!e) return;
    const date = asOf || new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
    const estimate = await legalEOS(c, cipher, e, date);
    await c.query(`insert into ab.hr_eos_estimates(id,tenant_id,employee_id,company_id,as_of,source_kind,source_key,payload_cipher,created_by)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(tenant_id,employee_id,source_key) do nothing`,
        [randomUUID(), session.tenant_id, e.id, estimate.companyId || e.company_id, date, kind, sourceKey, cipher.seal({ ...estimate, estimate: true, asOf: date }), session.user_id]);
}
export function registerEOSHistory(app: any, route: any, cipher: any) {
    app.get('/api/personnel/employees/:id/eos/history', route(async (c: any, m: any, _s: any, req: any) => {
        const e = await employee(c, m, z.uuid().parse(req.params.id), 'eos_view');
        const available = !!(await c.query("select to_regclass('ab.hr_eos_estimates') ok")).rows[0].ok;
        if (!available) return { available: false, reason: 'eosHistoryMigrationPending', rows: [] };
        const rows = (await c.query(`select id,as_of,source_kind,payload_cipher,created_at from ab.hr_eos_estimates
            where employee_id=$1 order by created_at desc,id desc limit 200`, [e.id])).rows;
        return { available: true, estimate: true, rows: rows.map((r: any) => ({ id: r.id, asOf: r.as_of, source: r.source_kind, createdAt: r.created_at, estimate: cipher.open(r.payload_cipher) })) };
    }));
}
