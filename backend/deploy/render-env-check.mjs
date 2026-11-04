// Optional read-only Render Shell diagnostic once this reviewed build is present. Never prints values.
import {access} from 'node:fs/promises';
const required=['NODE_ENV','APP_ENV','SUPABASE_BUCKET','NODE_EXTRA_CA_CERTS','DATABASE_URL','DATA_ENCRYPTION_KEY','SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY'];
let ok=true;for(const name of required){const exists=!!process.env[name];console.log('CHECK: '+name+'='+(exists?'PRESENT':'MISSING'));ok&&=exists;}
ok&&=process.env.NODE_ENV==='production'&&process.env.APP_ENV==='staging'&&process.env.SUPABASE_BUCKET==='ab-private-test'&&Number(process.versions.node.split('.')[0])>=24;
try{await access(process.env.NODE_EXTRA_CA_CERTS||'');}catch{ok=false;}
if(['MIGRATION_DATABASE_URL','SCANNER_DATABASE_URL','BOOTSTRAP_AUTH_ID','BOOTSTRAP_USERNAME'].some(n=>!!process.env[n]))ok=false;
const key=process.env.DATA_ENCRYPTION_KEY||'';ok&&=Buffer.from(key,'base64').length===32&&Buffer.from(key,'base64').toString('base64')===key;
console.log('RESULT: '+(ok?'RENDER_ENV_PRESENCE_AND_SHAPE_OK':'RENDER_ENV_CHECK_FAILED')+'; VALUES_WITHHELD; READ_ONLY');process.exitCode=ok?0:1;
