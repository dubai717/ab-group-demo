import type {PoolClient} from 'pg';
const qi=(s:string)=>'"'+s.replaceAll('"','""')+'"';
// Preserve the original backup hash format exactly; never exclude a table/column.
export async function sourceTableFingerprint(c:PoolClient,s:string,t:string){
 if(!/^[a-z][a-z0-9_]*$/.test(s)||!/^[a-z][a-z0-9_]*$/.test(t))throw Error('SOURCE_TABLE_NAME');
 return(await c.query(`select count(*)::text n,md5(coalesce(string_agg(md5(row_to_json(x)::text),'' order by md5(row_to_json(x)::text)),'')) h from ${qi(s)}.${qi(t)} x`)).rows[0]as{n:string;h:string};
}
export function sourceDifference(before:{n:string;h:string},after:{n:string;h:string}){return before.n!==after.n||before.h!==after.h;}
