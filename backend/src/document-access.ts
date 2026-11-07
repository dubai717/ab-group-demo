import { requireOk } from './core.js';

// Shared with original document routes: a central index must never invent a broader grant.
export function documentRight(m: any, owner: any, write: boolean, initialEnrollment = false) {
    requireOk(!owner.employee_id && !owner.personnel_library_id,403,'personnelDocumentRouteRequired');
    if (owner.bank_account_id) {
        const row=m.state.bankAccounts.find((b:any)=>b.id===owner.bank_account_id);
        requireOk(row,404,'notFound');
        requireOk(m.bank.can(write?'manage_documents':'view_documents',row.companyId));
    } else if(owner.company_id) {
        requireOk(m.state.companies.some((co:any)=>co.id===owner.company_id),404,'notFound');
        requireOk(write?m.company.canEdit():m.company.canFiles());
    } else {
        const user=m.policy.actor(owner.user_id);requireOk(user,404,'notFound');
        requireOk(m.policy.can(m.actor.id,'attachments',user)&&(!write||m.policy.can(m.actor.id,'edit',user)||(initialEnrollment&&m.policy.can(m.actor.id,'create',user))));
    }
}
