import {readFile} from 'node:fs/promises';
import {ledgerFixture} from './ledger-fixture.js';
// Only this run's newly created, random synthetic DB is removed. Existing DBs are never selected.
export async function personnelFixture(){const f=await ledgerFixture();try{await f.admin.query(await readFile('supabase/proposed/013_personnel_tasks_performance.sql','utf8'));}catch(e){await f.close();throw e;}return f;}
