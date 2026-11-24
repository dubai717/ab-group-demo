// New opt-in batch writers must never treat an unavailable original work guard as permission.
// Uses the current actor/tenant transaction. No role changes, identity substitution or repair.
import{requireOk}from'./core.js';
export async function requireImportWorkAccess(c:any){
 const definition=(await c.query("select pg_catalog.to_regprocedure('ab.hr_actor_allowed()')ok")).rows[0];
 requireOk(!!definition?.ok,503,'importWorkAccessUnavailable');
 requireOk((await c.query('select ab.hr_actor_allowed()ok')).rows[0]?.ok===true,403,'denied');
}
