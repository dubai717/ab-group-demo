// Detect a stale local test server without reading environment files or credentials.
import {readdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
export async function sourceFingerprint(){const files=['index.html','styles.css','package.json','package-lock.json','backend/tests/serve-business-centers-fixture.ts','backend/tests/business-centers-fixture.ts'];for(const [directory,pattern]of [['',/\.js$/],['backend/src/',/\.(ts|mjs)$/],['supabase/additive/',/\.sql$/]])for(const file of await readdir(new URL(directory,root)))if(pattern.test(file))files.push(directory+file);const hash=createHash('sha256');for(const path of [...new Set(files)].sort()){hash.update(path);hash.update('\0');hash.update(await readFile(new URL(path,root)));hash.update('\0');}return hash.digest('hex');}
