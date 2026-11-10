import { startReportSchedules } from './report-jobs.js';
import {remoteControl,markerPath} from '../reset/remote-control.js';
import {actionsGateway,installMaintenance} from '../reset/gateway.js';
import {configureMaintenance} from './core.js';
import {resetEnvironment} from './reset-control.js';
import {testUsersEnvironment} from './test-users.js';
import {releaseInfo} from '../deploy/release-info.js';
import {startPersonnelJobs} from './personnel-jobs.js';
import {startFinancialJobs} from './financial-jobs.js';
import {startVehicleBilling} from './vehicle-jobs.js';
import { Pool } from "pg";
import { databaseOptions } from "./database.js";
import { build } from "./app.js";
import { supabase, supabaseKeys } from "./core.js";
const required = [
  "DATABASE_URL",
  "DATA_ENCRYPTION_KEY",
  "SUPABASE_URL",
  "PUBLIC_ORIGIN",
] as const;
for (const key of required)
  if (!process.env[key]) throw Error(key + " required");
if (process.env.APP_ENV !== "staging" && process.env.APP_ENV !== "local")
  throw Error(
    "This phase allows synthetic local/staging only; production activation requires a separate review.",
  );
const origin = process.env.PUBLIC_ORIGIN!;
const local = process.env.APP_ENV === "local";
if (!local && !origin.startsWith("https://")) throw Error("HTTPS required");
if (local && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))
  throw Error("Local cookie mode is loopback-only");
const keys = supabaseKeys();
const pool = new Pool({
  ...databaseOptions(process.env.DATABASE_URL!, local),
  max: 10,
});
// Suppress raw pool connection objects in unattended staging logs.
pool.on("error", () => {
  console.log("STOP: database connection lost; details withheld");
  process.exitCode = 1;
});
const role = (
  await pool.query(
    "select current_user name,rolsuper,rolbypassrls,rolcreaterole,exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='ab' and c.relowner=r.oid) owns_tables from pg_roles r where rolname=current_user",
  )
).rows[0];
if (
  role.name !== "ab_runtime" ||
  role.rolsuper ||
  role.rolbypassrls ||
  role.rolcreaterole ||
  role.owns_tables
)
  throw Error("Web process cannot use owner/superuser/bypass-RLS credentials");
const { auth, objects } = supabase(
  process.env.SUPABASE_URL!,
  keys.publishable,
  keys.secret,
  process.env.SUPABASE_BUCKET || "ab-private-test",
);
const resetEnabled=resetEnvironment(process.env);
const resetStore=resetEnabled?remoteControl(process.env.SUPABASE_URL!,keys.secret,process.env.DATA_ENCRYPTION_KEY!):undefined;
const resetWorker=resetStore&&process.env.RESET_WORKER_GITHUB_TOKEN?actionsGateway(pool,process.env.DATA_ENCRYPTION_KEY!,process.env.RESET_WORKER_GITHUB_TOKEN,resetStore):undefined;
const app = await build({
  pool,
  key: process.env.DATA_ENCRYPTION_KEY!,
  origin,
  secureCookies: !local,
  demoBankingMode:local||process.env.APP_ENV==='staging',
  auth,
  objects,
  testUsersEnabled:testUsersEnvironment(process.env),
  resetEnabled,
  resetWorker,
  resetStatus:resetStore?async(id:string)=>{const m=await resetStore.get(markerPath);if(m?.id===id)return {status:m.status,active:m.active};const result=await resetStore.get('ab-group-reset-control/requests/'+id+'/result.enc');return result||{status:'queued',active:false};}:undefined,
});
if(resetStore)configureMaintenance(installMaintenance(app,resetStore));
app.get('/api/reset-capability',async()=>({enabled:resetEnabled,workerConfigured:!!resetWorker,maintenanceFencing:!!resetStore}));
app.get('/api/release',async()=>releaseInfo(process.env));
await app.listen({
  host: local ? "127.0.0.1" : "0.0.0.0",
  port: Number(process.env.PORT || 3100),
});
const stopBilling=startVehicleBilling(pool,process.env.DATA_ENCRYPTION_KEY!,process.env.VEHICLE_BILLING_ENABLED==='true');
const stopFinancial=startFinancialJobs(pool,process.env.DATA_ENCRYPTION_KEY!,process.env.FINANCIAL_JOBS_ENABLED==='true');
const stopReports=startReportSchedules(pool,process.env.DATA_ENCRYPTION_KEY!);
const stop = async () => {
  await stopReports();
  stopPersonnelJobs();
  await stopFinancial();
  await stopBilling();
  await app.close();
  await pool.end();
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);

const stopPersonnelJobs=startPersonnelJobs(pool,process.env.DATA_ENCRYPTION_KEY!);

