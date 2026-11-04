// Creates a LOCAL synthetic test database only. Never links to or provisions a cloud project.
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
const env = { ...process.env };
for (const k of [
  "DOCKER_HOST",
  "DOCKER_CONTEXT",
  "DOCKER_TLS",
  "DOCKER_TLS_VERIFY",
  "DOCKER_CERT_PATH",
])
  delete env[k];
const docker = (args, options = {}) =>
  execFileSync("docker", ["--host=unix:///var/run/docker.sock", ...args], {
    env,
    stdio: "pipe",
    ...options,
  });
docker(["info", "--format", "{{.ServerVersion}}"]);
fs.mkdirSync("work", { recursive: true });
const secretPath = "work/db-test-secrets.json";
let exists = false;
try {
  docker([
    "inspect",
    "ab-postgres-foundation",
    "--format",
    "{{.State.Running}}",
  ]);
  exists = true;
} catch {}
if (exists && !fs.existsSync(secretPath))
  throw Error(
    "Refusing to touch an existing container without its local test setup file",
  );
if (!fs.existsSync(secretPath))
  fs.writeFileSync(
    secretPath,
    JSON.stringify({
      admin: randomBytes(24).toString("hex"),
      runtime: randomBytes(24).toString("hex"),
      key: randomBytes(32).toString("base64"),
    }),
    { mode: 0o600, flag: "wx" },
  );
if (!exists) {
  const secret = JSON.parse(fs.readFileSync(secretPath));
  fs.writeFileSync(
    "work/postgres-test.env",
    "POSTGRES_PASSWORD=" + secret.admin + "\nPOSTGRES_DB=ab_test\n",
    { mode: 0o600 },
  );
  const image =
    "postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b";
  docker(["pull", image]);
  docker([
    "run",
    "-d",
    "--name",
    "ab-postgres-foundation",
    "--label",
    "ab.synthetic-test=true",
    "-p",
    "127.0.0.1:5441:5432",
    "--env-file",
    "work/postgres-test.env",
    image,
  ]);
}
let ready = false;
for (let n = 0; n < 40; n++) {
  try {
    docker([
      "exec",
      "ab-postgres-foundation",
      "pg_isready",
      "-U",
      "postgres",
      "-d",
      "ab_test",
    ]);
    ready = true;
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 250));
  }
}
if (!ready)
  throw Error("Local PostgreSQL not ready; no existing data was reset");
console.log(
  "Local synthetic PostgreSQL ready at 127.0.0.1:5441. Secrets are in ignored work/ files; no cloud resources created.",
);
