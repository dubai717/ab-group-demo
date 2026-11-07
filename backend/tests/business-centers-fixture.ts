import {readFile} from 'node:fs/promises';
import {personnelFixture} from './personnel-fixture.js';
export async function businessCentersFixture(){const f=await personnelFixture();try{for(const file of ['014_followup_and_eos.sql','015_document_center.sql','016_marketing.sql','017_investors.sql','018_reports.sql','019_communications.sql','020_document_text.sql','021_marketing_operations.sql'])await f.admin.query(await readFile('supabase/additive/'+file,'utf8'));return f;}catch(e){await f.close();throw e;}}
