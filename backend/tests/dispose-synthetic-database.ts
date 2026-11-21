import {Pool} from 'pg';
import {localTestPort} from './setup.js';
// Only the caller's freshly allocated fixture is eligible. Never FORCE a session.
export async function disposeSyntheticDatabase(adminUrl:string,database:string){
 const url=new URL(adminUrl);
 if(url.hostname!=='127.0.0.1'||Number(url.port)!==localTestPort||url.pathname!=='/'+database||
    !/^ab_backup_[a-f0-9]{32}$/.test(database))throw Error('Synthetic fixture cleanup target refused');
 url.pathname='/ab_test';const root=new Pool({connectionString:url.toString()});
 try{await root.query('DROP DATABASE "'+database+'"');}finally{await root.end();}
}
