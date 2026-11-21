// Independent synthetic DB, fake Auth/storage, loopback only. No hosted financial writes.
import { businessCentersFixture } from './business-centers-fixture.js';
import { build } from '../src/app.js';
import { writeFile } from 'node:fs/promises';
import { today } from '../src/vehicle-domain.js';
const f = await businessCentersFixture(), proof = await f.proof(), bank = await f.bank(), bill = await f.bill('500', f.items.salik);
await f.collection('50', { items: [{ itemId: f.items.salik, amount: '50' }] });
await f.req('POST', '/api/ledger/vouchers', { companyId: f.co1, itemId: f.items.expense, customerId: f.client, amount: '20', currency: 'AED', issuedOn: today(), sourceKey: 'synthetic-package-pv', reason: 'Synthetic pending payment', beneficiary: 'Synthetic beneficiary' });
await f.req('POST', '/api/ledger/deposits', { companyId: f.co1, bankAccountId: bank.id, currency: 'AED', amount: '20', effectiveOn: today(), documentVersionId: proof, reference: 'synthetic-package-deposit' });
const financeRequest=await f.request();await f.fund(financeRequest.id);const financeVehicle=await f.register(financeRequest.id);await f.contract(financeVehicle.id);
await f.app.close();
const app = await build({ pool: f.runtime, key: f.secret.key, origin: 'http://127.0.0.1:3646', secureCookies: false, auth: f.auth, objects: f.objects, scan: async () => 'clean' });
await app.listen({ host: '127.0.0.1', port: 3646 });
await writeFile('work/financial-package-fixture.json', JSON.stringify({ username: f.username, password: f.password, companyId: f.co1, financeVehicleId:financeVehicle.id, customerId: f.client, invoiceId: bill.id, itemId: f.items.salik, proofId: proof, receivableId: f.accounts.ar.id, incomeId: f.accounts.income.id }), { mode: 0o600 });
console.log('SYNTHETIC_FINANCIAL_PACKAGE_READY');
process.on('SIGTERM', async () => { await app.close(); await f.close(); process.exit(0); });
