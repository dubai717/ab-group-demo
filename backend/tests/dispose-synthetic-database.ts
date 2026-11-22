import {Pool} from 'pg';
import {localTestPort} from './setup.js';
// Only the caller's freshly allocated fixture is eligible. Never FORCE a session.
export async function disposeSyntheticDatabase(adminUrl:string,database:string){
 const url=new URL(adminUrl);
 if(!['postgres:','postgresql:'].includes(url.protocol)||url.search||url.hash||url.username!=='postgres'||
    url.hostname!=='127.0.0.1'||Number(url.port)!==localTestPort||url.pathname!=='/'+database||
    !/^ab_backup_[a-f0-9]{32}$/.test(database))throw Error('Synthetic fixture cleanup target refused');
 url.pathname='/ab_test';const root=new Pool({connectionString:url.toString()});
 try{await root.query('DROP DATABASE "'+database+'"');}finally{await root.end();}
}

// The caller passes the fresh restore name only after its own CREATE DATABASE succeeded.
export async function disposeSyntheticRestoreCopy(adminUrl:string,source:string,target:string){
 const url=new URL(adminUrl);if(!['postgres:','postgresql:'].includes(url.protocol)||url.search||url.hash||url.username!=='postgres'||url.hostname!=='127.0.0.1'||Number(url.port)!==localTestPort||url.pathname!=='/'+source||!/^ab_backup_[a-f0-9]{32}$/.test(source)||!/^ab_restore_[a-f0-9]{32}$/.test(target))throw Error('Synthetic restore cleanup target refused');url.pathname='/ab_test';const root=new Pool({connectionString:url.toString()});try{await root.query('DROP DATABASE "'+target+'"');}finally{await root.end();}
}
