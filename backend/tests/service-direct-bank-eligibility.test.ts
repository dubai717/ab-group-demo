import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { businessCentersFixture } from './business-centers-fixture.js';
import { ApiError, security } from '../src/core.js';
import { build } from '../src/app.js';
import { today } from '../src/vehicle-domain.js';
import { isolatedDirectBankEligibilityGuard } from '../src/service-direct-bank-eligibility.js';
import { isolatedVehicleExecutionEligibilityGuard } from '../src/service-execution-eligibility-prototype.js';

test('original direct bank settlement binds eligibility and registration to actual Owner evidence without generating a payment', async () => {
  const f = await businessCentersFixture();
  let app: Awaited<ReturnType<typeof build>> | undefined;
  try {
    for (const file of ['operating-centres.sql', 'company-scope-upper-bound.sql', 'company-scope-customers.sql', 'service-eligibility-source.sql']) {
      await f.admin.query(await readFile('backend/review/' + file, 'utf8'));
    }
    const origin = 'http://127.0.0.1:3100';
    const cipher = security(f.secret.key);
    const activation = new Date(Date.now() - 60000).toISOString();
    const guard = isolatedDirectBankEligibilityGuard(cipher, activation);
    let failAfterReceipt = false;
    app = await build({
      pool: f.runtime, key: f.secret.key, origin, secureCookies: false, auth: f.auth, objects: f.objects,
      beforeServiceExecution: isolatedVehicleExecutionEligibilityGuard(cipher, activation),
      confirmDirectBankEligibility: async (c, m, s, input) => {
        await guard(c, m, s, input);
        if (failAfterReceipt) throw new ApiError(503, 'syntheticAfterDirectBankEligibility');
      },
    });
    const headers: Record<string, string> = { origin, 'x-ab-request': '1' };
    const login = await app.inject({ method: 'POST', url: '/api/login',
      payload: { username: f.username, password: f.password }, headers });
    assert.equal(login.statusCode, 200);
    headers.cookie = String(login.headers['set-cookie']).split(';')[0];
    headers['x-csrf-token'] = (await app.inject({ url: '/api/bootstrap', headers })).json().csrfToken;
    const post = async (url: string, payload: any, expected = 200, key = randomUUID()) => {
      const result = await app!.inject({ method: 'POST', url, payload, headers: { ...headers, 'idempotency-key': key } });
      assert.equal(result.statusCode, expected, url + ' ' + result.body);
      return result.json();
    };
    const create = async () => {
      const r = await f.req('POST', '/api/customers/' + f.client + '/vehicle-requests', {
        companyId: f.co1, vehicleType: 'Truck', financeType: 'bank', approximateValue: '36000',
        expectedFunding: '36000', months: 48, expectedMonthly: '950', totalObligation: '45600',
        registrationMonthlyFee: '0', currency: 'AED',
      });
      const path = '/api/vehicle-requests/' + r.id;
      await f.req('POST', path + '/funding-decision', { decision: 'approve', revision: 1 });
      return { id: r.id, path };
    };
    const started = await create();
    const waiting = await create();
    const proof = await f.proof();
    const terms = {
      revision: 2, bankExecution: 'bank_direct', bankSettlementConfirmed: true,
      bankSettlementReference: 'Synthetic evidence of direct supplier payment', bankReferenceId: 'demo-bank',
      bankContractNumber: 'SYNTH-DIRECT', bankPrincipal: '36000', bankTotal: '39600', bankMonthly: '1100',
      bankMonths: 36, bankStartOn: '2027-01-01', bankFundingOn: f.date, bankFees: '0',
      documentVersionId: proof, confirm: true,
    };
    const events = async (id: string) => (await f.admin.query(
      "select kind from ab.vehicle_events where request_id=$1 and kind in('bank_contract_approved','service_direct_bank_eligibility_passed') order by kind",
      [id])).rows.map(row => row.kind);
    const key = randomUUID();
    failAfterReceipt = true;
    assert.equal((await post(started.path + '/bank-arrangement', terms, 503, key)).error, 'syntheticAfterDirectBankEligibility');
    assert.deepEqual(await events(started.id), []);
    failAfterReceipt = false;
    const saved = await post(started.path + '/bank-arrangement', terms, 200, key);

    const debt = await f.request();
    await f.fund(debt.id);
    const vehicle = await f.register(debt.id);
    await f.contract(vehicle.id, { startOn: '2026-09-01' });
    const review = '/api/customers/' + f.client + '/service-eligibility-review';
    assert.equal((await f.req('GET', review)).simulation.status, 'blocked');
    assert.equal((await post(waiting.path + '/bank-arrangement', terms, 409)).error, 'newServiceArrearsBlocked');
    assert.deepEqual(await events(waiting.id), []);
    assert.deepEqual(await post(started.path + '/bank-arrangement', terms, 200, key), saved);
    assert.deepEqual(await events(started.id), ['bank_contract_approved', 'service_direct_bank_eligibility_passed']);

    const emirate = (await f.admin.query('select id from ab.emirates order by id limit 1')).rows[0].id;
    const registration = {
      vehicleType: 'Truck', make: 'Synthetic', model: 'Fixture', year: '2026', plate: 'SYNTH-DIRECT',
      vin: randomUUID().replaceAll('-', '').slice(0, 17), emirate, registeredOn: today(), ownershipExpiresOn: '2027-12-01',
    };
    const postings = async () => (await f.admin.query('select count(*)::int n from ab.finance_operations')).rows[0].n;
    const before = await postings();
    assert.ok((await post(started.path + '/register', registration)).id);
    assert.equal(await postings(), before);
    assert.equal((await f.admin.query('select count(*)::int n from ab.vehicle_funds where request_id=$1', [started.id])).rows[0].n, 0);
    assert.equal((await f.req('GET', review)).simulation.status, 'blocked');
  } finally {
    if (app) await app.close();
    await f.close();
  }
});
