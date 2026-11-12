import assert from 'node:assert/strict';
import {createDecipheriv,createHash} from 'node:crypto';

// Test-only: independently authenticate/decrypt the envelope with Node's crypto primitives.
// A short ASCII marker can occur by chance in Base64 ciphertext; substring absence proves nothing.
export function assertEncryptedBackupEnvelope(sealed:Buffer,key:string,dump:Buffer){
 const prefix='AB-BACKUP-1\n';
 assert.equal(sealed.subarray(0,prefix.length).toString(),prefix);
 const encoded=sealed.subarray(prefix.length).toString();
 assert.match(encoded,/^[A-Za-z0-9+/]+={0,2}$/);
 const packed=Buffer.from(encoded,'base64');
 assert.equal(packed.toString('base64'),encoded);
 assert(packed.length>28,'Envelope must include a 12-byte IV and 16-byte authentication tag');
 const decipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),packed.subarray(0,12));
 decipher.setAuthTag(packed.subarray(12,28));
 const plaintext=Buffer.concat([decipher.update(packed.subarray(28)),decipher.final()]);
 const body=JSON.parse(plaintext.toString());
 assert.equal(body.format,'AB-BACKUP-1');
 assert.equal(body.database,dump.toString('base64'));
 assert.equal(body.databaseSha256,createHash('sha256').update(dump).digest('hex'));
 return body;
}
