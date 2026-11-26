// Independent synthetic DB, fake Auth/storage, loopback only. No hosted financial writes.
import { businessCentersFixture } from './business-centers-fixture.js';
import { build } from '../src/app.js';
import { readFile, writeFile } from 'node:fs/promises';
import { today } from '../src/vehicle-domain.js';
const f = await businessCentersFixture(), proof = await f.proof(), bank = await f.bank();
const acceptance=process.env.AB_FINANCE_ACCEPTANCE==='1';
const bill=acceptance?null:await f.bill('500',f.items.salik);
if(!acceptance){
    await f.collection('50', { items: [{ itemId: f.items.salik, amount: '50' }] });
    await f.req('POST', '/api/ledger/vouchers', { companyId: f.co1, itemId: f.items.expense, customerId: f.client, amount: '20', currency: 'AED', issuedOn: today(), sourceKey: 'synthetic-package-pv', reason: 'Synthetic pending payment', beneficiary: 'Synthetic beneficiary' });
    await f.req('POST', '/api/ledger/deposits', { companyId: f.co1, bankAccountId: bank.id, currency: 'AED', amount: '20', effectiveOn: today(), documentVersionId: proof, reference: 'synthetic-package-deposit' });
}
await f.admin.query(await readFile('supabase/proposed/028_accounting_item_catalogue.sql','utf8'));
const scopedItem=await f.req('POST','/api/ledger/items',{
    nameAr:'بند تجريبي للشركة',nameEn:'Synthetic scoped catalogue item',category:'general',companyIds:[f.co1],
    invoice:true,receipt:true,payment:false,methods:['manual'],receivableId:f.accounts.ar.id,revenueId:f.accounts.income.id,
});
const catalogueActors=[];
for(const permission of [null,'ledger_item_create','ledger_item_edit']){
    const actor=await f.employee();
    for(const action of ['ledger_view',...(permission?[permission]:[])]){
        await f.req('POST','/api/users/'+actor.id+'/grants',{action,scope:{type:'company',id:f.co1},delegable:false});
    }
    catalogueActors.push({username:actor.username,password:actor.password,permission});
}
await f.app.close();
const app = await build({ pool: f.runtime, key: f.secret.key, origin: 'http://127.0.0.1:3646', secureCookies: false, auth: f.auth, objects: f.objects, scan: async () => 'clean' });
await app.listen({ host: '127.0.0.1', port: 3646 });
await writeFile('work/financial-package-fixture.json', JSON.stringify({ username: f.username, password: f.password, companyId: f.co1, customerId: f.client, invoiceId: bill?.id, bankId:bank.id, catalogueActors, scopedItemId:scopedItem.id, itemId: f.items.salik, proofId: proof, receivableId: f.accounts.ar.id, incomeId: f.accounts.income.id }), { mode: 0o600 });
console.log('SYNTHETIC_FINANCIAL_PACKAGE_READY');
process.on('SIGTERM', async () => { await app.close(); await f.close(); process.exit(0); });
