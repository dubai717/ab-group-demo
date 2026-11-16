// Only explicitly created tenant security roles use granular role rights.
// Legacy built-in roles retain their exact existing behavior; work scope never grants access.
export function securityRoleRight(m:any,right:string,companyId:string){
 const actor=m.actor;if(actor?.status!=='Active'||!actor.roleId?.startsWith('security:')||!actor.companyIds?.includes(companyId))return false;
 return !!m.state.roles.find((r:any)=>r.id===actor.roleId)?.permissions?.includes(right);
}

export function securityRoleCompany(m:any,companyId:string){return !m.actor.roleId?.startsWith('security:')||!!m.actor.companyIds?.includes(companyId);}
