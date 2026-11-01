const {test}=require('node:test');
const assert=require('node:assert/strict');
const auth=require('../auth-flows.js');
const strong='Example-New@2026';
test('password format checks cover missing fields, mismatch, strength and reuse',()=>{
 assert.equal(auth.validateChange('',strong,strong),'required');
 assert.equal(auth.validateChange('old',strong,'different'),'mismatch');
 assert.equal(auth.validateChange('old','short','short'),'weak');
 for(const value of ['ONLY-UPPER@123','only-lower@123','NoNumber-Pass!','NoSymbolPass123','Whitespace Pass@123','a'.repeat(129)])assert.equal(auth.validateChange('old',value,value),'weak');
 assert.equal(auth.validateChange(strong,strong,strong),'same');
 assert.equal(auth.validateChange('old',strong,strong),null);
});
test('valid-looking changes always fail closed without a server and never check legacy passwords',()=>{
 assert.deepEqual(auth.attemptChange('u-owner','legacy-example',strong,strong),{ok:false,code:'changeUnavailable'});
 assert.deepEqual(auth.attemptChange('u-owner','wrong-current',strong,strong),{ok:false,code:'changeUnavailable'});
});
test('no authenticated actor means no change attempt',()=>{assert.deepEqual(auth.attemptChange(null,'old',strong,strong),{ok:false,code:'denied'});});
for(const channel of ['sms','email','whatsapp'])test(`recovery via ${channel} never pretends to send a message or verify identity`,()=>{
 for(const identifier of ['owner','unknown-account','test@example.com','+971500000000'])assert.deepEqual(auth.attemptRecovery(identifier,channel),{ok:false,code:'unavailable'});
});
test('invalid recovery input and unsupported channel are rejected',()=>{
 for(const value of ['', '  ', 'x'.repeat(255),null])assert.deepEqual(auth.attemptRecovery(value,'email'),{ok:false,code:'identifierError'});
 assert.equal(auth.attemptRecovery('owner','untrusted').ok,false);
});
test('event records do not include passwords, submitted identifiers or arbitrary event payloads',()=>{
 auth.attemptChange('audit-user','Secret-Current@17','Secret-New@2026','Secret-New@2026');
 auth.attemptRecovery('private-contact@example.com','whatsapp');
 auth.record('attacker payload');
 const events=[...auth.audit('audit-user'),...auth.audit(null)];
 const data=JSON.stringify(events);
 for(const value of ['Secret-Current@17','Secret-New@2026','private-contact@example.com','attacker payload'])assert(!data.includes(value));
 assert(events.every(e=>Object.keys(e).sort().join(',')==='actorId,at,channel,type'));
});
test('audit is scoped to its account and returned as copies',()=>{
 auth.record('login_succeeded','user-one');auth.record('login_succeeded','user-two');
 const first=auth.audit('user-one');first[0].type='modified';assert.equal(auth.audit('user-one')[0].type,'login_succeeded');assert(auth.audit('user-one').every(e=>e.actorId==='user-one'));
});
test('logout clears authenticated audit events from page memory',()=>{auth.logout();assert.equal(auth.audit('user-one').length,0);});
test('escaping protects account menu and labels',()=>{assert.equal(auth.escape('<img onerror="x">'),'&lt;img onerror=&quot;x&quot;&gt;');});
