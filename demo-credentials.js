/* Same-browser demo accounts only. This is NOT a trusted authentication service. */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DemoCredentials = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const KEY = 'ab_group_demo_accounts_v1';
  const ITERATIONS = 600000;
  // Never serialize identity numbers, nationality, files, passwords, or grants.
  const fields = ['id', 'username', 'fullName', 'nameAr', 'nameEn', 'email', 'phone',
    'roleId', 'status', 'managerId', 'companyId', 'departmentId', 'companyIds', 'departmentIds', 'jobTitle', 'hireDate'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  const bytes = value => Uint8Array.from(value.match(/../g), n => parseInt(n, 16));
  const profile = value => Object.fromEntries(fields.filter(k => value[k] !== undefined).map(k => [k, clone(value[k])]));
  function passwordError(password, confirmation) {
    if (typeof password !== 'string' || password !== confirmation) return 'mismatch';
    if (password.length < 12 || password.length > 128 || /\s/.test(password) ||
      !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9\s]/.test(password)) return 'weak';
    return null;
  }
  function createStore({ storage, cryptoProvider = globalThis.crypto, legacyUsers = () => [], roleIds = () => [] }) {
    function read() {
      const raw = storage.getItem(KEY);
      if (raw === null) return { version: 1, accounts: [] };
      let data;
      try { data = JSON.parse(raw); } catch { throw new Error('credentialStorageInvalid'); }
      const ids = new Set(), names = new Set();
      if (!data || data.version !== 1 || !Array.isArray(data.accounts)) throw new Error('credentialStorageInvalid');
      for (const row of data.accounts) {
        const p = row?.profile, v = row?.verifier;
        if (!p || !/^demo-[a-zA-Z0-9-]+$/.test(p.id) || !/^[A-Za-z0-9_.-]{3,64}$/.test(p.username) ||
          !['Active', 'Pending', 'Disabled'].includes(p.status) || p.roleId === 'owner' || !roleIds().includes(p.roleId) ||
          typeof p.fullName !== 'string' || !p.fullName || ids.has(p.id) || names.has(p.username.toLowerCase()) ||
          !v || v.algorithm !== 'PBKDF2-SHA256' || v.iterations !== ITERATIONS || !/^[a-f0-9]{32}$/.test(v.salt) || !/^[a-f0-9]{64}$/.test(v.hash) ||
          legacyUsers().some(u => u.id === p.id || u.username.toLowerCase() === p.username.toLowerCase())) throw new Error('credentialStorageInvalid');
        ids.add(p.id); names.add(p.username.toLowerCase());
      }
      return data;
    }
    async function derive(password, salt) {
      if (!cryptoProvider?.subtle || !cryptoProvider.getRandomValues) throw new Error('cryptoUnavailable');
      const key = await cryptoProvider.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
      return hex(new Uint8Array(await cryptoProvider.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations: ITERATIONS }, key, 256)));
    }
    function write(data) {
      const before = storage.getItem(KEY), serialized = JSON.stringify(data);
      try {
        storage.setItem(KEY, serialized);
        if (storage.getItem(KEY) !== serialized) throw new Error('readback');
      } catch {
        // Do not overwrite a different value written by another tab while recovering.
        try { if (storage.getItem(KEY) === serialized) { if (before === null) storage.removeItem(KEY); else storage.setItem(KEY, before); } } catch {}
        throw new Error('storageFailed');
      }
    }
    return {
      directory() { return read().accounts.map(row => profile(row.profile)); },
      async prepare(password, confirmation) {
        const error = passwordError(password, confirmation);
        if (error) throw new Error(error);
        if (!cryptoProvider?.getRandomValues) throw new Error('cryptoUnavailable');
        const salt = hex(cryptoProvider.getRandomValues(new Uint8Array(16)));
        return { algorithm: 'PBKDF2-SHA256', iterations: ITERATIONS, salt, hash: await derive(password, salt) };
      },
      saveProfile(candidate, verifier) {
        // A normal session edit does not need or rewrite the credential store.
        const data = read(), index = data.accounts.findIndex(row => row.profile.id === candidate.id);
        if (index < 0 && !verifier) return false;
        if (legacyUsers().some(u => u.id === candidate.id || u.username.toLowerCase() === candidate.username.toLowerCase()) ||
          data.accounts.some(row => row.profile.id !== candidate.id && row.profile.username.toLowerCase() === candidate.username.toLowerCase())) throw new Error('duplicate');
        if (candidate.roleId === 'owner' || !roleIds().includes(candidate.roleId)) throw new Error('denied');
        if (!/^demo-[a-zA-Z0-9-]+$/.test(candidate.id) || !/^[A-Za-z0-9_.-]{3,64}$/.test(candidate.username) || !['Active','Pending','Disabled'].includes(candidate.status) || typeof candidate.fullName !== 'string' || !candidate.fullName) throw new Error('invalid');
        // Password setup is allowed only for a new local demo account. No reset path.
        if (index >= 0 && verifier) throw new Error('denied');
        const sourceVerifier = index >= 0 ? data.accounts[index].verifier : verifier;
        const saved = { profile: profile(candidate), verifier: sourceVerifier && Object.fromEntries(['algorithm','iterations','salt','hash'].map(k => [k, sourceVerifier[k]])) };
        if (!saved.verifier || saved.verifier.algorithm !== 'PBKDF2-SHA256' || saved.verifier.iterations !== ITERATIONS ||
          !/^[a-f0-9]{32}$/.test(saved.verifier.salt) || !/^[a-f0-9]{64}$/.test(saved.verifier.hash)) throw new Error('invalid');
        if (index < 0) data.accounts.push(saved); else data.accounts[index] = saved;
        write(data);
        return true;
      },
      async authenticate(username, password) {
        if (typeof password !== 'string' || password.length > 128) return null;
        const row = read().accounts.find(r => r.profile.username.toLowerCase() === String(username).trim().toLowerCase());
        if (!row || row.profile.status !== 'Active') return null;
        const hash = await derive(password, row.verifier.salt);
        let diff = 0;
        for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ row.verifier.hash.charCodeAt(i);
        return diff === 0 ? profile(row.profile) : null;
      }
    };
  }
  let store;
  function getStore() {
    return store ||= createStore({ storage: localStorage, legacyUsers: () => app.state.users, roleIds: () => app.state.roles.map(r => r.id) });
  }
  return { KEY, ITERATIONS, fields, passwordError, createStore,
    directory() { if(globalThis.ABCentral?.enabled)return [];try { return getStore().directory(); } catch { return []; } },
    prepare: (password, confirmation) => getStore().prepare(password, confirmation),
    saveProfile: (candidate, verifier) => getStore().saveProfile(candidate, verifier),
    authenticate: (username, password) => getStore().authenticate(username, password)
  };
});
