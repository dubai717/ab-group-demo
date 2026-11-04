import { Pool } from "pg";
import { databaseOptions } from "./database.js";
import { z } from "zod";
import { initializeOrganization } from "./bootstrap.js";
if (process.env.APP_ENV !== "local" && process.env.APP_ENV !== "staging")
  throw Error("Synthetic local/staging environments only");
const data = z
  .object({
    MIGRATION_DATABASE_URL: z.string().min(1),
    BOOTSTRAP_AUTH_ID: z.uuid(),
    BOOTSTRAP_EMAIL: z.email(),
    BOOTSTRAP_USERNAME: z.string().regex(/^[A-Za-z0-9_.-]{3,64}$/),
    BOOTSTRAP_NAME: z.string().min(1),
  })
  .parse(process.env);
const p = new Pool(
  databaseOptions(data.MIGRATION_DATABASE_URL, process.env.APP_ENV === "local"),
);
try {
  const created = await initializeOrganization(p, {
    authId: data.BOOTSTRAP_AUTH_ID,
    email: data.BOOTSTRAP_EMAIL,
    username: data.BOOTSTRAP_USERNAME,
    name: data.BOOTSTRAP_NAME,
  });
  console.log("Created NEW synthetic group and owner mapping:", created);
} finally {
  await p.end();
}
