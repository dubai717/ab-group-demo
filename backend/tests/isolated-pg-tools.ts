// Test-only adapter. Never accepts a hosted server or a non-owned source database.
import {execFileSync} from 'node:child_process';
import {join,isAbsolute} from 'node:path';
export function isolatedPgTools(adminUrl:string,source:string,container:string){
 const url=new URL(adminUrl);if(url.hostname!=='127.0.0.1'||url.pathname!=='/'+source||!/^ab_backup_[a-f0-9]{32}$/.test(source))throw Error('OWNED_LOCAL_SYNTHETIC_DATABASE_REQUIRED');
 const native=process.env.AB_TEST_PG_BIN;if(native&&!isAbsolute(native))throw Error('ABSOLUTE_TEST_PG_BIN_REQUIRED');
 const env={...process.env};for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','PGSERVICE','PGSERVICEFILE','PGOPTIONS','PGHOST','PGPORT','PGDATABASE','PGUSER','PGPASSWORD'])delete env[key];
 const docker=(args:string[],input?:Buffer)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,stdio:['pipe','pipe','pipe'],input,maxBuffer:64*1024*1024});
 const run=(tool:string,database:string,args:string[],input?:Buffer)=>execFileSync(join(native!,tool),['-h','127.0.0.1','-p',url.port,'-U',decodeURIComponent(url.username),'-d',database,...args],{env:{...env,PGPASSWORD:decodeURIComponent(url.password)},stdio:['pipe','pipe','pipe'],input,maxBuffer:64*1024*1024});
 return{
  dump:()=>native?run('pg_dump',source,['-Fc','--no-owner']):docker(['exec',container,'pg_dump','-U','postgres','-d',source,'-Fc','--no-owner']),
  restore:(target:string,input:Buffer)=>{if(!/^ab_restore_[a-f0-9]{32}$/.test(target)||target===source)throw Error('NEW_OWNED_RESTORE_TARGET_REQUIRED');return native?run('pg_restore',target,['--no-owner','--exit-on-error'],input):docker(['exec','-i',container,'pg_restore','-U','postgres','-d',target,'--no-owner','--exit-on-error'],input);}
 };
}
