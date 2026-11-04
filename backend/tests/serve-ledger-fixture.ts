// Local fake Auth/store/scanner, synthetic PostgreSQL ONLY. Never a cloud provisioning tool.
import { ledgerFixture } from './ledger-fixture.js';
import { vehicleFixture } from './vehicle-fixture.js';
import { build } from '../src/app.js';
import { writeFile } from 'node:fs/promises';
const schema = process.env.AB_TEST_LEDGER_SCHEMA === 'yes', f = schema ? await ledgerFixture() : await vehicleFixture(false);
await f.app.close();
const app = await build({ pool: f.runtime, key: f.secret.key, origin: 'http://127.0.0.1:3500', secureCookies: false, auth: f.auth, objects: f.objects, scan: async () => 'clean' });
await app.listen({ host: '127.0.0.1', port: 3500 });
await writeFile('work/ledger-browser-fixture.json', JSON.stringify({ username: f.username, password: f.password, schema, companyId: f.co1,otherCompanyId:f.co2, customerId: f.client, itemId: schema ? (f as any).items.loan : null }), { mode: 0o600 });
console.log('Local synthetic ledger fixture ready; no cloud access.');
process.on('SIGTERM', async () => { await app.close(); await f.runtime.end(); await f.admin.end(); process.exit(0); });
