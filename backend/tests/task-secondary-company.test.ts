import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { businessCentersFixture } from './business-centers-fixture.js';
import { today } from '../src/vehicle-domain.js';

test('original task grants use dated secondary-company assignments and keep primary company and HR profiles private', async () => {
  const f = await businessCentersFixture();
  try {
    const worker = await f.employee();
    const employee = async (label: string, userId?: string) => f.req('POST', '/api/personnel/employees', {
      companyId: f.co1, userId, nameAr: label, nameEn: label, jobTitle: 'Testing', hiredOn: '2024-01-01',
    });
    const own = await employee('Synthetic task worker', worker.id);
    const current = await employee('Synthetic currently assigned peer');
    const expired = await employee('Synthetic formerly assigned peer');
    const future = await employee('Synthetic future assigned peer');
    const assign = (id: string, effectiveOn: string, untilOn?: string) =>
      f.req('POST', '/api/personnel/employees/' + id + '/assignments', {
        companyId: f.co2, jobTitle: 'Secondary company testing', effectiveOn, untilOn,
      });
    const date = today();
    const futureDate = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10);
    const pastDate = new Date(Date.parse(date) - 86400000).toISOString().slice(0, 10);
    await assign(own.id, date);
    await assign(current.id, date, date);
    await assign(expired.id, '2024-01-01', pastDate);
    await assign(future.id, futureDate);

    for (const file of ['security-roles.sql', 'individual-denials.sql', 'task-review-permission.sql']) {
      await f.admin.query(await readFile('backend/review/' + file, 'utf8'));
    }
    let directory = await f.req('GET', '/api/security-roles');
    const standard = {
      revision: 0, version: directory.version, permissions: [],
      nameAr: 'معيار شركة ثانية خالٍ', nameEn: 'Synthetic empty secondary company standard',
    };
    const proposed = await f.req('POST', '/api/security-roles/plan', standard);
    await f.req('POST', '/api/security-roles/apply', {
      ...standard, id: proposed.after.id, planHash: proposed.planHash, confirm: true,
    });
    directory = await f.req('GET', '/api/security-roles');
    const membership = {
      userId: worker.id, roleId: proposed.after.id, version: directory.version,
      revision: directory.rows.flatMap((row: any) => row.members).find((row: any) => row.id === worker.id).revision,
    };
    const plan = await f.req('POST', '/api/security-roles/assignment-plan', membership);
    await f.req('POST', '/api/security-roles/assignment-apply', {
      ...membership, planHash: plan.planHash, confirm: true,
    });
    for (const action of ['view_tasks', 'create_task', 'assign_task']) {
      await f.req('POST', '/api/users/' + worker.id + '/grants', {
        action, scope: { type: 'company', id: f.co2 }, delegable: false,
      });
    }

    const task = (companyId: string, employeeId: string) => ({
      companyId, employeeId, title: 'Synthetic company-scoped task', expectedResult: 'Original task only', dueOn: date,
    });
    const primary = await f.req('POST', '/api/personnel/tasks', task(f.co1, own.id));
    await f.login(worker.username, worker.password);
    const options = await f.req('GET', '/api/personnel/tasks/options');
    assert.deepEqual(options.taskCompanies.map((company: any) => company.id), [f.co2]);
    assert.deepEqual(options.taskEmployees.map((person: any) => person.id).sort(), [own.id, current.id].sort());
    for (const person of options.taskEmployees) {
      assert.deepEqual(Object.keys(person).sort(), ['companyIds', 'id', 'nameAr', 'nameEn']);
      assert.deepEqual(person.companyIds, [f.co2]);
    }
    await f.req('GET', '/api/personnel/employees/' + current.id, undefined, 403);
    await f.req('GET', '/api/personnel/tasks/' + primary.id + '/history', undefined, 403);
    await f.req('POST', '/api/personnel/tasks', task(f.co1, own.id), 403);
    for (const unavailable of [expired, future]) {
      const result = await f.req('POST', '/api/personnel/tasks', task(f.co2, unavailable.id), 422);
      assert.equal(result.error, 'invalidAssignment');
    }
    const secondary = await f.req('POST', '/api/personnel/tasks', task(f.co2, current.id));
    assert.deepEqual((await f.req('GET', '/api/personnel/tasks')).rows.map((row: any) => row.id), [secondary.id]);
    await f.req('GET', '/api/personnel/tasks/' + secondary.id + '/history');
    await f.req('GET', '/api/ledger/receivables', undefined, 403);
  } finally {
    await f.close();
  }
});
