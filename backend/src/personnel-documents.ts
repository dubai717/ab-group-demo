import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { requireOk, sha } from './core.js';
import { employee, hrRight, need, auditHR } from './personnel-domain.js';
import { today } from './vehicle-domain.js';
export function registerPersonnelDocuments(app: any, route: any, cipher: any, options: any) {
    const id = z.uuid(), text = z.string().trim().min(1).max(200), upload = z.object({ kind: z.string().min(1).max(60), name: text, title: text, mime: z.enum(['application/pdf', 'image/png', 'image/jpeg']), base64: z.string().min(4).max(13981016), expiresOn: z.iso.date().nullish(), parentVersionId: id.optional(), responsibleId: id.optional(), companyResponsible: z.boolean().default(false) }).strict();
    async function owner(c: any, m: any, req: any, write = false) { const eid = req.params.employeeId, lid = req.params.libraryId; if (eid) {
        const e = await employee(c, m, id.parse(eid));
        requireOk(hrRight(m, write ? 'document_update' : 'documents', e.company_id) || e.user_id === m.actor.id, 403, 'denied');
        return { e, companyId: e.company_id, employeeId: e.id, libraryId: null };
    } const l = (await c.query('select * from ab.hr_library where id=$1', [id.parse(lid)])).rows[0]; requireOk(l, 404, 'notFound'); need(m, write ? 'library_manage' : 'library_download', l.company_id); const d = cipher.open(l.payload_cipher); requireOk(write || m.actor.roleId === 'owner' || !d.readerIds?.length || d.readerIds.includes(m.actor.id), 403, 'denied'); return { e: { id: l.id, company_id: l.company_id }, companyId: l.company_id, employeeId: null, libraryId: l.id }; }
    async function put(c: any, m: any, s: any, req: any) {
        const own = await owner(c, m, req, true), d = upload.parse(req.body), bytes = Buffer.from(d.base64, 'base64');
        requireOk(d.kind!=='photo'||['image/png','image/jpeg'].includes(d.mime),422,'photoRequiresImage');
        requireOk(bytes.length > 0 && bytes.length <= 10485760, 422, 'invalidFile');
        requireOk(d.mime === 'application/pdf' ? bytes.subarray(0, 5).toString() === '%PDF-' : d.mime === 'image/png' ? bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' : bytes[0] === 255 && bytes[1] === 216, 422, 'invalidFile');
        if (d.responsibleId)
            requireOk((await c.query('select 1 from ab.hr_employees where id=$1 and company_id=$2', [d.responsibleId, own.companyId])).rowCount, 422, 'invalidResponsible');
        requireOk(!d.companyResponsible || d.responsibleId, 422, 'responsibleRequired');
        if(own.libraryId&&!d.parentVersionId){const latest=(await c.query('select version_id from ab.hr_library_versions where library_id=$1 order by version desc limit 1',[own.libraryId])).rows[0];if(latest)d.parentVersionId=latest.version_id;}let parent: any;
        if (d.parentVersionId) {
            parent = (await c.query('select v.*,d.employee_id,d.personnel_library_id from ab.document_versions v join ab.documents d on d.id=v.document_id where v.id=$1', [d.parentVersionId])).rows[0];
            requireOk(parent && parent.employee_id === own.employeeId && parent.personnel_library_id === own.libraryId, 422, 'invalidParent');
            if (own.employeeId)
                requireOk((await c.query('select 1 from ab.hr_document_records where version_id=$1 and kind=$2', [parent.id, d.kind])).rowCount, 422, 'invalidParentKind');
        }
        const documentId = parent?.document_id || randomUUID(), vid = randomUUID(), version = parent ? Number((await c.query('select max(version)+1 n from ab.document_versions where document_id=$1', [documentId])).rows[0].n) : 1, storage = s.tenant_id + '/' + documentId + '/' + vid, scan = options.scan ? await options.scan(bytes, d.mime) : 'pending';
        requireOk(['clean', 'pending'].includes(scan), 422, 'fileRejected');
        if (!parent)
            await c.query('insert into ab.documents(id,tenant_id,employee_id,personnel_library_id,category,title,description,document_date,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)', [documentId, s.tenant_id, own.employeeId, own.libraryId, 'other', 'Restricted personnel document', '', today(), s.user_id]);
        await options.objects.put(storage, Buffer.from(cipher.seal({ bytes: bytes.toString('base64') })));
        await c.query('insert into ab.document_versions(id,tenant_id,document_id,version,storage_key,original_name,mime,size,sha256,scan_status,created_by,title,description,document_date,category,parent_version_id)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [vid, s.tenant_id, documentId, version, storage, 'restricted-document', d.mime, bytes.length, sha(bytes), scan, s.user_id, 'Restricted personnel document', '', today(), 'other', parent?.id || null]);
        const { base64, ...meta } = d;
        if (own.employeeId)
            await c.query('insert into ab.hr_document_records(id,tenant_id,employee_id,version_id,kind,expires_on,responsible_id,company_responsible,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [randomUUID(), s.tenant_id, own.employeeId, vid, d.kind, d.expiresOn || null, d.responsibleId || null, d.companyResponsible, cipher.seal(meta), s.user_id]);
        else
            await c.query('insert into ab.hr_library_versions(id,tenant_id,library_id,version_id,version,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), s.tenant_id, own.libraryId, vid, version, cipher.seal(meta), s.user_id]);
        await auditHR(c, cipher, s, own.e, 'document_added', null, { versionId: vid, version, kind: d.kind, scanStatus: scan });
        return { id: vid, versionId: vid, documentId, version, scanStatus: scan, saved: true };
    }
    async function get(c: any, m: any, s: any, req: any) { const own = await owner(c, m, req), v = (await c.query('select v.*,d.employee_id,d.personnel_library_id from ab.document_versions v join ab.documents d on d.id=v.document_id where v.id=$1', [id.parse(req.params.versionId)])).rows[0]; requireOk(v && v.employee_id === own.employeeId && v.personnel_library_id === own.libraryId, 404, 'notFound'); requireOk(v.scan_status === 'clean', 409, 'filePending'); const meta = (await c.query(own.employeeId ? 'select payload_cipher from ab.hr_document_records where version_id=$1' : 'select payload_cipher from ab.hr_library_versions where version_id=$1', [v.id])).rows[0]; requireOk(meta, 404, 'notFound'); await auditHR(c, cipher, s, own.e, 'document_read', null, { versionId: v.id }); return { base64: cipher.open((await options.objects.get(v.storage_key)).toString()).bytes, mime: v.mime, name: cipher.open(meta.payload_cipher).name }; }
    app.post('/api/personnel/employees/:employeeId/documents', route(put));
    app.get('/api/personnel/employees/:employeeId/documents/:versionId', route(get));
    app.post('/api/personnel/employees/:employeeId/documents/:versionId/review', route(async (c: any, m: any, s: any, req: any) => { const e = await employee(c, m, id.parse(req.params.employeeId), 'document_review'), d = z.object({ approve: z.boolean(), reason: text }).strict().parse(req.body), r = (await c.query('select r.*,v.scan_status from ab.hr_document_records r join ab.document_versions v on v.id=r.version_id where r.employee_id=$1 and r.version_id=$2', [e.id, id.parse(req.params.versionId)])).rows[0]; requireOk(r, 404, 'notFound'); requireOk(r.state === 'Submitted', 409, 'alreadyReviewed'); requireOk(!d.approve || r.scan_status === 'clean', 409, 'filePending'); requireOk(r.created_by !== s.user_id || m.actor.roleId === 'owner', 403, 'independentReviewRequired'); await c.query('update ab.hr_document_records set state=$2,reviewed_by=$3,reviewed_at=now()where id=$1', [r.id, d.approve ? 'Approved' : 'Rejected', s.user_id]); await auditHR(c, cipher, s, e, 'document_review', { state: r.state }, { versionId: r.version_id, ...d }); return { saved: true }; }));
    app.post('/api/personnel/library', route(async (c: any, m: any, s: any, req: any) => { const d = z.object({ companyId: id, category: text, title: text, description: z.string().max(2000).default(''), readerIds: z.array(id).default([]) }).strict().parse(req.body); need(m, 'library_manage', d.companyId); for (const uid of d.readerIds)
        requireOk(m.state.users.some((u: any) => u.id === uid && (u.roleId === 'owner' || u.companyIds?.includes(d.companyId))), 422, 'invalidReader'); const key = randomUUID(); await c.query('insert into ab.hr_library(id,tenant_id,company_id,category,title,payload_cipher,created_by)values($1,$2,$3,$4,$5,$6,$7)', [key, s.tenant_id, d.companyId, d.category, d.title, cipher.seal(d), s.user_id]); await auditHR(c, cipher, s, { id: key, company_id: d.companyId }, 'library_created', null, d); return { id: key, saved: true }; }));
    app.get('/api/personnel/library', route(async (c: any, m: any) => { const rows = (await c.query('select * from ab.hr_library order by created_at desc')).rows, out = []; for (const r of rows) {
        if (!hrRight(m, 'library_view', r.company_id))
            continue;
        const d = cipher.open(r.payload_cipher);
        if (m.actor.roleId !== 'owner' && d.readerIds?.length && !d.readerIds.includes(m.actor.id))
            continue;
        out.push({ ...d, id: r.id, versions: (await c.query('select l.*,v.scan_status from ab.hr_library_versions l join ab.document_versions v on v.id=l.version_id where library_id=$1 order by version desc', [r.id])).rows.map((v: any) => ({ ...v, payload: cipher.open(v.payload_cipher), payload_cipher: undefined })) });
    } return { rows: out, acknowledgementsRequired: false }; }));
    app.post('/api/personnel/library/:libraryId/documents', route(put));
    app.get('/api/personnel/library/:libraryId/documents/:versionId', route(get));
}
