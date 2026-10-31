const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const V2 = 'ab_group_demo_state_v2', V3 = 'ab_group_demo_state_v3';
function boot(values = {}, failWrites = false) {
  const entries = new Map(Object.entries(values));
  const writes = [];
  const context = vm.createContext({
    localStorage: {
      getItem: key => entries.get(key) ?? null,
      setItem: (key, value) => {
        if (failWrites) throw new Error('QuotaExceededError');
        entries.set(key, value); writes.push(key);
      }
    },
    window: { addEventListener() {} }, console: { warn() {} }
  });
  vm.runInContext(source + '\nglobalThis.loaded = app.state; globalThis.persist = saveState;', context);
  return { entries, writes, state: JSON.parse(JSON.stringify(context.loaded)), persist: context.persist };
}
const seed = boot().state;
function fixture(label) {
  const state = JSON.parse(JSON.stringify(seed));
  state.users[0].fullName = label;
  state.companies = [{id:'old-company',name:label,city:'Riyadh',custom:{keep:true}}];
  state.tasks.push({id:'custom-task',title:label});
  state.custom = { keep: ['original'] };
  delete state.companyFilters;
  return JSON.stringify(state);
}
test('v2 is migrated at startup without changing original records or the v2 string', () => {
  const raw = fixture('v2'); const result = boot({[V2]:raw});
  assert.equal(result.entries.get(V2), raw);
  assert.deepEqual(result.writes, [V3]);
  const migrated = JSON.parse(result.entries.get(V3));
  const original = JSON.parse(raw);
  assert.deepEqual(migrated.users, original.users);
  assert.deepEqual(migrated.tasks, original.tasks);
  assert.deepEqual(migrated.custom, original.custom);
  for (const [key,value] of Object.entries(original.companies[0])) assert.deepEqual(migrated.companies[0][key],value);
  assert.equal(migrated.companies[0].englishName,'v2');
  const again = boot({[V2]:raw,[V3]:result.entries.get(V3)});
  assert.deepEqual(again.writes, []);
  result.persist(); assert.equal(result.entries.get(V2),raw);
});
test('existing v3 wins over v2 and is not rewritten on startup', () => {
  const v2=fixture('older'),v3=fixture('newer');const result=boot({[V2]:v2,[V3]:v3});
  assert.equal(result.state.users[0].fullName,'newer');
  assert.equal(result.entries.get(V3),v3);assert.equal(result.entries.get(V2),v2);assert.deepEqual(result.writes,[]);
});
test('v3 alone loads and saves all custom fields', () => {
  const result=boot({[V3]:fixture('v3')});result.persist();
  assert.deepEqual(JSON.parse(result.entries.get(V3)).custom,{keep:['original']});
});
test('new browser starts normally and saves only v3', () => {
  const result=boot();assert.equal(result.entries.size,0);assert.equal(result.state.users.length,10);
  result.persist();assert(result.entries.has(V3));assert(!result.entries.has(V2));
});
test('failed migration write keeps v2 usable and untouched', () => {
  const raw=fixture('quota');const result=boot({[V2]:raw},true);
  assert.equal(result.state.users[0].fullName,'quota');result.persist();assert.equal(result.entries.get(V2),raw);assert(!result.entries.has(V3));
});
for(const bad of ['broken','null','{}','']) test(`unreadable v3 ${JSON.stringify(bad)} is never overwritten`, () => {
  const v2=fixture('legacy');const result=boot({[V3]:bad,[V2]:v2});result.persist();
  assert.equal(result.entries.get(V3),bad);assert.equal(result.entries.get(V2),v2);assert.deepEqual(result.writes,[]);
});
test('unreadable v2 is retained without creating v3', () => {
  const result=boot({[V2]:'broken'});result.persist();assert.equal(result.entries.get(V2),'broken');assert(!result.entries.has(V3));
});
