import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createHash,createCipheriv} from 'node:crypto';
import {archive,restoreArchive} from '../src/backup.js';
import {assertEncryptedBackupEnvelope} from './backup-envelope-assertions.js';

test('Backup envelope requires real AES-GCM authentication, exact database and encrypted private objects',()=>{
 const dump=Buffer.from('PGDMP synthetic isolated data'),object=Buffer.from('private object fixture'),key=randomBytes(32).toString('base64'),objects=new Map([['private/identity',object]]),sealed=archive(dump,objects,key);
 const body=assertEncryptedBackupEnvelope(sealed,key,dump);assert.equal(body.objects[0].key,'private/identity');assert.equal(body.objects[0].bytes,object.toString('base64'));assert.deepEqual(restoreArchive(sealed,key),{database:dump,objects});
 assert.throws(()=>assertEncryptedBackupEnvelope(sealed,randomBytes(32).toString('base64'),dump));
 // Deterministic counterexample: a valid random-IV value whose Base64 begins with PGDMP.
 // This is a test fixture IV only; production random-IV generation is unchanged.
 const markerIv=Buffer.from('PGDMPAAAAAAAAAAA','base64'),cipher=createCipheriv('aes-256-gcm',Buffer.from(key,'base64'),markerIv),ciphertext=Buffer.concat([cipher.update(JSON.stringify(body)),cipher.final()]);
 const marked=Buffer.from('AB-BACKUP-1\n'+Buffer.concat([markerIv,cipher.getAuthTag(),ciphertext]).toString('base64'));
 assert(marked.includes(Buffer.from('PGDMP')));assertEncryptedBackupEnvelope(marked,key,dump);assert.deepEqual(restoreArchive(marked,key),{database:dump,objects});
 const prefix='AB-BACKUP-1\n',packed=Buffer.from(sealed.subarray(prefix.length).toString(),'base64');
 for(const index of [0,12,28,packed.length-1]){const corrupted=Buffer.from(packed);corrupted[index]^=1;assert.throws(()=>assertEncryptedBackupEnvelope(Buffer.from(prefix+corrupted.toString('base64')),key,dump));}
 const plain={format:'AB-BACKUP-1',database:dump.toString('base64'),databaseSha256:createHash('sha256').update(dump).digest('hex'),objects:[]};
 assert.throws(()=>assertEncryptedBackupEnvelope(Buffer.from(prefix+JSON.stringify(plain)),key,dump));
 assert.throws(()=>assertEncryptedBackupEnvelope(Buffer.from(prefix+Buffer.from(JSON.stringify(plain)).toString('base64')),key,dump));
 assert.throws(()=>assertEncryptedBackupEnvelope(sealed,key,Buffer.from('different dump')));
});
