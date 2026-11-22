import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { migrate } from "../src/migrate.js";
export const localTestPort=Number(process.env.AB_LOCAL_DB_PORT||'5441');
export const localTestContainer=process.env.AB_LOCAL_DB_CONTAINER||'ab-postgres-foundation';
if(!Number.isInteger(localTestPort)||localTestPort<1024||localTestPort>65535||!/^ab-[a-z0-9-]+$/.test(localTestContainer))throw Error('Invalid isolated DB target');
// Keep only databases created by this exact test process in its disposal registry.
// No permanent/source database, remote server, FORCE disconnect or old unknown fixture is eligible.
const ownedSyntheticDatabases=new Map<string,string>();let disposalRegistered=false;
function registerProcessFixture(database:string,adminUrl:string){
 if(!/^ab_backup_[a-f0-9]{32}$/.test(database))return;ownedSyntheticDatabases.set(database,adminUrl);
 if(disposalRegistered)return;disposalRegistered=true;process.once('beforeExit',async()=>{
  for(const [name,uri]of ownedSyntheticDatabases){ownedSyntheticDatabases.delete(name);const url=new URL(uri);if(url.hostname!=='127.0.0.1'||Number(url.port)!==localTestPort||url.username!=='postgres'||url.pathname!=='/'+name||url.search||url.hash)continue;url.pathname='/ab_test';const root=new Pool({connectionString:url.toString()});try{await root.query('DROP DATABASE IF EXISTS "'+name+'"');}catch(err:any){console.error(JSON.stringify({event:'synthetic_fixture_cleanup_deferred',code:err.code||'unknown'}));}finally{await root.end();}}
 });
}
export async function setupDatabase(database = "ab_test") {
  const port=localTestPort;
  const secret = JSON.parse(
    await readFile(
      new URL("../../work/db-test-secrets.json", import.meta.url),
      "utf8",
    ),
  );
  if (!/^ab_(test|backup_[a-f0-9]+)$/.test(database))
    throw Error("Test database name refused");
  if (database !== "ab_test") {
    const root = new Pool({
      connectionString: `postgres://postgres:${secret.admin}@127.0.0.1:${port}/ab_test`,
    });
    await root.query("CREATE DATABASE " + database);
    await root.end();
  }
  const adminUrl = `postgres://postgres:${secret.admin}@127.0.0.1:${port}/${database}`;
  if(database!=="ab_test")registerProcessFixture(database,adminUrl);
  const admin = new Pool({ connectionString: adminUrl });
  await migrate(admin);
  await admin.query("ALTER ROLE ab_runtime PASSWORD '" + secret.runtime + "'");
  const runtime = new Pool({
    connectionString: `postgres://ab_runtime:${secret.runtime}@127.0.0.1:${port}/${database}`,
  });
  return { secret, admin, runtime, adminUrl, sourceDatabase: database };
}
