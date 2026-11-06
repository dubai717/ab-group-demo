// Destructive SQL below is restricted to the existing disposable runner-local restore copy.
import {Pool} from 'pg';import {baseline,rebuild,verifyEmpty} from './schema.js';import {requireOk} from '../src/core.js';
export async function resetSchemaPreflight(){
 requireOk(process.env.GITHUB_ACTIONS==='true',403,'isolatedSchemaProofRequired');
 const p=new Pool({host:'127.0.0.1',port:5547,user:'postgres',database:'ab_drill',ssl:false,max:1});const c=await p.connect();try{requireOk((c as any).connectionParameters.host==='127.0.0.1'&&(await c.query('select current_database()d')).rows[0].d==='ab_drill',403,'isolatedOnly');const b=await baseline(c);await rebuild(c,b);await verifyEmpty(c,b);return {schemaVerified:true,tables:b.tables.length,migrations:b.chain.length};}finally{c.release();await p.end();}
}
