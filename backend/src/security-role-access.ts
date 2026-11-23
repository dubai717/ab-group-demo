// Only explicitly created tenant security roles use granular role rights.
// Legacy built-in roles retain their exact existing behavior; work scope never grants access.
export function securityRoleRight(m:any,right:string,companyId:string){
 const actor=m.actor;if(m.policy?.isDenied?.(actor?.id,right))return false;if(actor?.status!=='Active'||!actor.roleId?.startsWith('security:')||!actor.companyIds?.includes(companyId))return false;
 const role=m.state.roles.find((r:any)=>r.id===actor.roleId);return role?.securityManaged===true&&!!role.permissions?.includes(right);
}

export function securityRoleCompany(m:any,companyId:string){return m.state.roles.find((r:any)=>r.id===m.actor.roleId)?.securityManaged!==true||!!m.actor.companyIds?.includes(companyId);}
