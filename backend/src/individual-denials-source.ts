// A narrowing override for the original policy, stored as encrypted versioned
// metadata in the existing settings table. No role/grant or accounting copy.
import{z}from'zod';import{requireOk}from'./core.js';
export const individualDenialKey=(userId:string)=>'user-denials-v1:'+userId;
export const individualDenialSchema=z.object({version:z.literal(1),tenantId:z.uuid(),userId:z.uuid(),revision:z.number().int().positive(),actions:z.array(z.string().regex(/^[a-z][a-z0-9_]{0,99}$/)).max(1000),updatedBy:z.uuid(),updatedAt:z.iso.datetime()}).strict();
export function decodeIndividualDenials(rows:any[],cipher:any,users:any[]){return rows.map(row=>{
 const parsed=individualDenialSchema.safeParse(cipher.open(row.value?.cipher));requireOk(parsed.success,409,'permissionDenialSourceReviewRequired');const d=parsed.data!;
 requireOk(d.tenantId===row.tenant_id&&row.key===individualDenialKey(d.userId)&&new Set(d.actions).size===d.actions.length&&users.some(u=>u.id===d.userId&&u.roleId!=='owner'),409,'permissionDenialSourceReviewRequired');return d;
}).sort((a,b)=>a.userId.localeCompare(b.userId));}
export async function individualDenialWriteReady(c:any){if(!(await c.query("select to_regprocedure('ab.individual_denials_guard_ready()') ok")).rows[0].ok)return false;return(await c.query('select ab.individual_denials_guard_ready() ok')).rows[0].ok===true;}
