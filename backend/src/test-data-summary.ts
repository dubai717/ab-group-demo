import {PoolClient} from 'pg';
import {requireOk} from './core.js';
import {DataManifest,TEST_DATA_KEY} from './test-data-manifest.js';
export async function testDataSummary(c:PoolClient,cipher:any,tenant:string,owner:string){
 const row=(await c.query('select value from ab.settings where key=$1',[TEST_DATA_KEY])).rows[0];if(!row)return {ready:false,counts:{},records:[],limitations:[]};
 const d=cipher.open(row.value.cipher) as DataManifest;requireOk(d.marker==='TEST_DATA'&&d.version===1&&d.tenant===tenant&&d.owner===owner,409,'invalidReference');
 const ids=(table:string)=>(d.tags[table]||[]).map(k=>JSON.parse(k)[0]);
 const count=async(table:string,keys:string[])=>Number((await c.query('select count(*)n from ab."'+table+'" where id=any($1::uuid[])',[keys])).rows[0].n);
 const counts={companies:await count('companies',d.companies.map(x=>x.id)),banks:await count('bank_accounts',d.banks.map(x=>x.id)),customers:await count('customers',d.customers.map(x=>x.id)),vehicles:await count('vehicles',d.vehicles.map(x=>x.id)),financings:await count('vehicle_requests',d.financings),invoices:await count('vehicle_invoices',ids('vehicle_invoices')),receipts:await count('finance_receipts',d.receipts),tasks:await count('tasks',d.tasks),alerts:await count('finance_notifications',ids('finance_notifications'))};
 return {ready:d.state==='ready',marker:d.marker,anchor:d.anchor,counts,checks:d.checks,limitations:d.limitations,records:[...d.companies.map(x=>({kind:'companies',id:x.id,name:x.name,companyId:x.id})),...d.customers.map(x=>({kind:'customers',id:x.id,name:x.name,number:x.fileNumber,companyId:x.companyId})),...d.vehicles.map(x=>({kind:'vehicles',id:x.id,name:x.plate,number:x.fileNumber,companyId:x.companyId}))]};
}
