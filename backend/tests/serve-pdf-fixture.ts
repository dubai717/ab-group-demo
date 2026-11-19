// Independent synthetic PDF fixture: no hosted data, credentials, or rate-limit exemptions.
import { fixture } from './fixture.js';
let f: Awaited<ReturnType<typeof fixture>> | undefined;
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  if (f) { await f.app.close(); await f.runtime.end(); await f.admin.end(); }
  process.exit(0);
}
process.on('SIGTERM', () => { void close(); });
process.on('disconnect', () => { void close(); });
try {
  f = await fixture();
  await f.app.listen({host:'127.0.0.1',port:0});
  const address = f.app.server.address();
  if (!address || typeof address === 'string') throw Error('loopbackUnavailable');
  process.send?.({port:address.port});
} catch {
  process.send?.({error:'syntheticFixtureUnavailable'});
  await close();
}
