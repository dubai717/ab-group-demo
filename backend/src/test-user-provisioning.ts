import {z} from 'zod';
// Trusted administrative provisioning into a NEW fictional organization only.
import {randomUUID,randomBytes} from 'node:crypto';
import {Pool} from 'pg';
import {AuthProvider,requireOk,security,transaction} from './core.js';
import {initializeOrganization} from './bootstrap.js';
import {audit,model,persistCompany} from './data.js';
import {registryKey,stateKey,registrySchema,testProjectHash} from './test-users.js';
import {readFile} from 'node:fs/promises';
export async function provisionTestUsers(admin:Pool,auth:AuthProvider,key:string,controller:{tenant:string;id:string},verify?:(registry:z.infer<typeof registrySchema>,passwords:ReadonlyMap<string,string>)=>Promise<void>){
 const cipher=security(key),lock=await admin.connect();await lock.query("select pg_advisory_lock(hashtext('ab-managed-test-users-v1'))");
 try{
  const owner=(await admin.query("select role_id,status from ab.users where tenant_id=$1 and id=$2",[controller.tenant,controller.id])).rows[0];requireOk(owner?.role_id==='owner'&&owner.status==='Active',403,'denied');
  const existing=(await admin.query('select value from ab.settings where tenant_id=$1 and key=$2',[controller.tenant,registryKey])).rows[0];if(existing)return {registry:registrySchema.parse(cipher.open(existing.value.sealed)),created:false};
  const expected=JSON.parse(await readFile(new URL('../fixtures/roles.json',import.meta.url),'utf8'));
  const actual=(await admin.query('select id,data from ab.roles order by id')).rows,permissions=(await admin.query('select role_id,permission_id from ab.role_permissions order by role_id,permission_id')).rows;
  requireOk(actual.length===expected.length&&actual.every(row=>{const e=expected.find((x:any)=>x.id===row.id);return e&&JSON.stringify(row.data.permissions)===JSON.stringify(e.permissions)&&JSON.stringify(permissions.filter(x=>x.role_id===row.id).map(x=>x.permission_id).sort())===JSON.stringify([...e.permissions].sort());}),409,'unreviewedRoleCatalog');
  const catalog=JSON.stringify({actual,permissions}),suite=randomUUID(),suffix=suite.replaceAll('-','').slice(0,6),users:any[]=[],passwords=new Map<string,string>();
  for(const role of actual){const username='test_'+role.id+'_'+suffix,email=username+'@example.test',password='Aa1!'+randomBytes(30).toString('base64url'),authId=await auth.create(email,password);requireOk(authId,502,'providerUnavailable');const signed=await auth.login(email,password);requireOk(signed.id===authId,502,'providerUnavailable');await auth.logout(signed.token);passwords.set(authId,password);users.push({id:randomUUID(),authId,username,email,role:role.id,name:'Test '+role.data.name});}
  const own=users.find(u=>u.role==='owner');requireOk(own,409,'ownerRequired');
  const org=await initializeOrganization(admin,{authId:own.authId,email:own.email,username:own.username,name:own.name,userId:own.id});
  let company='';await transaction(admin,org.tenant,org.user,async c=>{
   await c.query('update ab.users set data=data||$2::jsonb where id=$1',[own.id,JSON.stringify({managedTestSuite:suite,testProject:testProjectHash})]);
   company=await persistCompany(c,await model(c,org.user,cipher),org.tenant,{arabicName:'شركة وهمية لتجربة المستخدمين',englishName:'Test Users — fictional company',companyCode:'TEST-'+suffix,tradeLicenseNumber:'TEST-'+suite,status:'Active'});
   for(const u of users){if(u.role!=='owner')await c.query('insert into ab.users(id,tenant_id,auth_id,auth_email,username,role_id,status,manager_id,data)values($1,$2,$3,$4,$5,$6,\'Active\',$7,$8)',[u.id,org.tenant,u.authId,u.email,u.username,u.role,own.id,{nameAr:'مستخدم تجريبي — '+u.role,nameEn:u.name,fullName:u.name,email:u.email,managedTestSuite:suite,testProject:testProjectHash}]);await c.query('insert into ab.user_companies(tenant_id,user_id,company_id,active)values($1,$2,$3,true)',[org.tenant,u.id,company]);}
   await c.query('insert into ab.settings values($1,$2,$3)',[org.tenant,stateKey,{suite,disabled:false,loginVerifiedAt:new Date().toISOString(),passwordExpiresAt:Object.fromEntries(users.map(u=>[u.id,new Date(Date.now()+24*3600000).toISOString()]))}]);
   await audit(c,org.tenant,org.user,'test_suite_created','test_suite',suite);
  });
  const registry=registrySchema.parse({format:'AB-TEST-USERS-1',project:testProjectHash,suite,tenant:org.tenant,owner:own.id,company,users});
  await transaction(admin,controller.tenant,controller.id,async c=>{
   for(const tenant of new Set([controller.tenant,org.tenant]))await c.query('insert into ab.settings values($1,$2,$3)',[tenant,registryKey,{sealed:cipher.seal(registry)}]);
   await audit(c,controller.tenant,controller.id,'test_suite_created','test_suite',suite);
  });
  const after={actual:(await admin.query('select id,data from ab.roles order by id')).rows,permissions:(await admin.query('select role_id,permission_id from ab.role_permissions order by role_id,permission_id')).rows};requireOk(JSON.stringify(after)===catalog,409,'roleCatalogChanged');
  // Passwords were used only for real provider verification; never persisted or returned.
  try{await verify?.(registry,passwords);}finally{passwords.clear();}
  return {registry,created:true};
 }finally{await lock.query("select pg_advisory_unlock(hashtext('ab-managed-test-users-v1'))").catch(()=>{});lock.release();}
}
