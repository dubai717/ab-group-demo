import {readFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {ledgerFixture} from './ledger-fixture.js';
// Only this run's newly created, random synthetic DB is removed. Existing DBs are never selected.
export async function personnelFixture(){const f=await ledgerFixture();try{await f.admin.query(await readFile('supabase/proposed/013_personnel_tasks_performance.sql','utf8'));}catch(e){await f.close();throw e;}return {...f,close:async()=>{await f.close();if(!/^ab_backup_[a-f0-9]{32}$/.test(f.sourceDatabase))throw Error('Refuse cleanup');const url=new URL(f.adminUrl);url.pathname='/ab_test';const root=new Pool({connectionString:url.toString()});try{await root.query('DROP DATABASE "'+f.sourceDatabase+'"');}finally{await root.end();}}};}
