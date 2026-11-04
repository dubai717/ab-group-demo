// Synthetic local test double only; never imported by server.ts.
import {fixture} from './fixture.js';
import {build} from '../src/app.js';
import {provisionTestUsers} from '../src/test-user-provisioning.js';
const f=await fixture();await provisionTestUsers(f.admin,f.auth,f.secret.key,{tenant:f.org.tenant,id:f.org.user});
const app=await build({pool:f.runtime,key:f.secret.key,origin:'http://127.0.0.1:3700',secureCookies:false,auth:f.auth,objects:f.objects,testUsersEnabled:true});
app.get('/__fixture',async()=>({username:f.username}));await app.listen({host:'127.0.0.1',port:3700});
process.on('SIGTERM',async()=>{await app.close();await f.app.close();await f.runtime.end();await f.admin.end();});
