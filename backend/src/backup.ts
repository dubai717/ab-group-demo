import { security, sha } from "./core.js";
// Object bytes are already encrypted with the DATA key. The archive uses a separate BACKUP key.
export function archive(
  dump: Buffer,
  objects: Map<string, Buffer>,
  backupKey: string,
): Buffer {
  const body = {
    format: "AB-BACKUP-1",
    createdAt: new Date().toISOString(),
    database: dump.toString("base64"),
    databaseSha256: sha(dump),
    objects: [...objects].map(([key, value]) => ({
      key,
      bytes: value.toString("base64"),
      sha256: sha(value),
    })),
  };
  return Buffer.from("AB-BACKUP-1\n" + security(backupKey).seal(body));
}
export function restoreArchive(bytes: Buffer, backupKey: string) {
  const text = bytes.toString();
  if (!text.startsWith("AB-BACKUP-1\n")) throw Error("Invalid backup format");
  const body = security(backupKey).open(text.slice("AB-BACKUP-1\n".length));
  if (body.format !== "AB-BACKUP-1") throw Error("Invalid backup format");
  const database = Buffer.from(body.database, "base64");
  if (sha(database) !== body.databaseSha256)
    throw Error("Database backup integrity failed");
  const objects = new Map<string, Buffer>();
  for (const row of body.objects) {
    const b = Buffer.from(row.bytes, "base64");
    if (sha(b) !== row.sha256 || objects.has(row.key))
      throw Error("Object backup integrity failed");
    objects.set(row.key, b);
  }
  return { database, objects };
}
