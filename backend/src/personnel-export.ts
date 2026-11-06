import { z } from 'zod';
import { requireOk } from './core.js';
import { hrRight, scope, profile, auditHR } from './personnel-domain.js';
import { L } from './ledger-domain.js';
export function registerPersonnelExport(app: any, route: any, cipher: any) { app.post('/api/personnel/export', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyIds: z.array(z.uuid()).min(1).max(100), employeeIds:z.array(z.uuid()).max(100000).optional(),departmentId: z.uuid().optional(), managerId: z.uuid().optional(), state: z.string().max(30).optional(),jobTitle:z.string().max(200).optional(), search: z.string().max(200).default(''), format: z.enum(['csv', 'excel']).default('excel') }).strict().parse(req.body); for (const co of d.companyIds)
    requireOk(hrRight(m, 'export', co) && hrRight(m, 'view', co)); const rows = [];const source=(await c.query('select * from ab.hr_employees order by employee_number')).rows;if(d.employeeIds){const order=new Map(d.employeeIds.map((key,index)=>[key,index]));source.sort((a:any,b:any)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity));} for (const e of source) {
    if(d.employeeIds&&!d.employeeIds.includes(e.id))continue;if (!hrRight(m, 'view', e.company_id) || !(await scope(c, e)).some(co => d.companyIds.includes(co)))
        continue;
    if (d.departmentId && e.department_id !== d.departmentId || d.managerId && e.manager_id !== d.managerId || d.state && e.state !== d.state||d.jobTitle&&e.job_title!==d.jobTitle)
        continue;
    const p = profile(e, cipher);
    if (d.search && !Object.values(p).join(' ').toLowerCase().includes(d.search.toLowerCase()))
        continue;
    rows.push([p.number, p.nameAr, p.nameEn, p.companyId, p.jobTitle, p.state, p.hiredOn, p.phone, p.email]);
} const matrix = [['Employee number', 'Arabic name', 'English name', 'Primary company', 'Job', 'State', 'Hire date', 'Phone', 'Email'], ...rows], escape = (v: any) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]!)); let body, mime, name; if (d.format === 'csv') {
    body = '\ufeff' + matrix.map(row => row.map(L.csvCell).join(',')).join('\r\n');
    mime = 'text/csv';
    name = 'personnel.csv';
}
else {
    body = '<?xml version="1.0" encoding="UTF-8"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Personnel"><Table>' + matrix.map(row => '<Row>' + row.map(v => '<Cell><Data ss:Type="String">' + escape(v) + '</Data></Cell>').join('') + '</Row>').join('') + '</Table></Worksheet></Workbook>';
    mime = 'application/vnd.ms-excel';
    name = 'personnel.xls';
} await auditHR(c, cipher, s, { id: d.companyIds[0], company_id: d.companyIds[0] }, 'export', null, { companies: d.companyIds, count: rows.length, format: d.format }); return { base64: Buffer.from(body).toString('base64'), mime, name, count: rows.length }; })); }
