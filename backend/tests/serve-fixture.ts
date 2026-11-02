// Local browser tests only. No provider keys, cloud resources or public exposure.
import { writeFile } from "node:fs/promises";
import { fixture } from "./fixture.js";
const f = await fixture();
await f.app.listen({ host: "127.0.0.1", port: 3100 });
await writeFile(
  new URL("../../work/central-browser-fixture.json", import.meta.url),
  JSON.stringify({
    username: f.username,
    password: f.password,
    tenant: f.org.tenant,
  }),
  { mode: 0o600 },
);
console.log(
  "Local central fixture ready on loopback. Auth/objects are test doubles; database is PostgreSQL.",
);
process.on("SIGTERM", async () => {
  await f.app.close();
  await f.runtime.end();
  await f.admin.end();
  process.exit(0);
});
