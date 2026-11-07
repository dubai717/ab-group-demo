import {requireOk} from './core.js';
export function contractingRight(m:any,action:string,companyId:string){return m.actor.status==='Active'&&(m.actor.roleId==='owner'||m.grants.some((g:any)=>g.user_id===m.actor.id&&g.permission_id==='contracting_'+action&&!g.revoked_at&&(g.scope_type==='group'||g.scope_type==='company'&&g.company_id===companyId)));}
export async function contractingParty(c:any,m:any,key:string,companyId:string,active=true){requireOk(contractingRight(m,'view',companyId));const r=(await c.query('select id,company_id,status from ab.contracting_companies where id=$1',[key])).rows[0];requireOk(r?.company_id===companyId&&(!active||r.status==='Active'),422,'invalidContractingCompany');return r;}
// Exactly one party, never an alias or a synthetic individual customer.
export function exactFinancialParty(d:any){return !!d.customerId!==!!d.contractingCompanyId&&(!d.contractingCompanyId||!d.vehicleId);}
