import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { supabase, supabaseKeys } from "../src/core.js";
for (const [name, publicKey, secretKey] of [
  ["legacy", "anon-test-key", "admin-test-key"],
  ["modern", "sb_publishable_synthetic-only", "sb_secret_synthetic-only"],
])
  test(`Supabase ${name} REST contract: API keys separate from user tokens; encrypted objects never overwrite`, async () => {
    const provider = Fastify(),
      seen: any[] = [];
    provider.addContentTypeParser(
      "application/octet-stream",
      { parseAs: "buffer" },
      (_, b, done) => done(null, b),
    );
    provider.addHook("onRequest", async (req) => {
      seen.push({
        url: req.url,
        apiKey: req.headers.apikey,
        authorization: req.headers.authorization,
        upsert: req.headers["x-upsert"],
      });
    });
    provider.post("/auth/v1/token", async (req: any) => {
      assert.equal(req.body.email, "synthetic@example.test");
      assert.equal(req.body.password, "Synthetic-Password@2026");
      return {
        access_token: "test-only-access-token",
        expires_in: 3600,
        user: { id: "11111111-1111-4111-8111-111111111111" },
      };
    });
    provider.get("/auth/v1/user", async () => ({
      id: "11111111-1111-4111-8111-111111111111",
    }));
    provider.post("/auth/v1/admin/users", async () => ({
      id: "22222222-2222-4222-8222-222222222222",
    }));
    provider.post("/auth/v1/logout", async () => ({}));
    provider.post("/storage/v1/object/test-bucket/a/b", async () => ({}));
    provider.get("/storage/v1/object/test-bucket/a/b", async (_, reply) =>
      reply
        .type("application/octet-stream")
        .send(Buffer.from("encrypted-object")),
    );
    await provider.listen({ host: "127.0.0.1", port: 0 });
    try {
      const address = provider.server.address() as any;
      const { auth, objects } = supabase(
        "http://127.0.0.1:" + address.port,
        publicKey,
        secretKey,
        "test-bucket",
      );
      const result = await auth.login(
        "synthetic@example.test",
        "Synthetic-Password@2026",
      );
      assert.equal(await auth.verify(result.token), result.id);
      await auth.create("new@example.test", "Synthetic-Password@2026");
      await objects.put("a/b", Buffer.from("encrypted-object"));
      assert.equal((await objects.get("a/b")).toString(), "encrypted-object");
      await auth.logout(result.token);
      assert.equal(
        seen.find((r) => r.url === "/auth/v1/user").authorization,
        "Bearer test-only-access-token",
      );
      assert.equal(
        seen.find((r) => r.url === "/auth/v1/admin/users").apiKey,
        secretKey,
      );
      assert.equal(
        seen.find((r) => r.url.startsWith("/auth/v1/token")).apiKey,
        publicKey,
      );
      assert.equal(
        seen.find((r) => r.url.startsWith("/auth/v1/token")).authorization,
        name === "modern" ? undefined : "Bearer " + publicKey,
      );
      for (const r of seen.filter(
        (r) => r.url.startsWith("/storage") || r.url === "/auth/v1/admin/users",
      )) {
        assert.equal(r.apiKey, secretKey);
        assert.equal(
          r.authorization,
          name === "modern" ? undefined : "Bearer " + secretKey,
        );
      }
      assert.equal(
        seen.find((r) => r.url === "/auth/v1/logout").authorization,
        "Bearer test-only-access-token",
      );
      const count = seen.length;
      await assert.rejects(() => auth.verify("sb_secret_not-a-user-token"));
      await assert.rejects(() =>
        auth.logout("sb_publishable_not-a-user-token"),
      );
      assert.equal(seen.length, count);
      assert.equal(
        seen.find((r) => r.url.startsWith("/storage") && r.upsert).upsert,
        "false",
      );
    } finally {
      await provider.close();
    }
  });

test("Supabase key aliases reject wrong privilege placement and conflicting configuration", () => {
  assert.deepEqual(
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_test",
    }),
    { publishable: "sb_publishable_test", secret: "sb_secret_test" },
  );
  assert.deepEqual(
    supabaseKeys({
      SUPABASE_ANON_KEY: "legacy-anon",
      SUPABASE_SERVICE_ROLE_KEY: "legacy-service",
    }),
    { publishable: "legacy-anon", secret: "legacy-service" },
  );
  assert.throws(() =>
    supabaseKeys({ SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong" }),
  );
  assert.throws(() =>
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_publishable_wrong",
    }),
  );
  assert.throws(() =>
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_one",
      SUPABASE_ANON_KEY: "different",
    }),
  );
  assert.throws(() =>
    supabaseKeys({
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_one",
      SUPABASE_SERVICE_ROLE_KEY: "different",
    }),
  );
  assert.throws(() =>
    supabase("http://127.0.0.1:1", "sb_secret_wrong", "sb_secret_test", "test"),
  );
});

for(const modern of [false,true])test(`Auth enrollment ${modern?'modern':'legacy'}: trusted recovery metadata, pagination, provider rejection and unknown identity protection`,async()=>{
 const provider=Fastify(),context={id:'33333333-3333-4333-8333-333333333333',tenant:'44444444-4444-4444-8444-444444444444'},id='55555555-5555-4555-8555-555555555555';let mode='create',seen:any[]=[];
 provider.addHook('onRequest',async req=>{seen.push({method:req.method,url:req.url,headers:req.headers});});
 provider.post('/auth/v1/admin/users',async(req:any,reply)=>{assert.deepEqual(req.body.app_metadata,{ab_enrollment_id:context.id,ab_enrollment_tenant:context.tenant});assert.equal(req.body.email_confirm,true);if(mode==='invalid')return reply.code(422).send({code:'email_address_invalid',msg:'Do not expose provider details'});if(mode==='duplicate')return reply.code(422).send({code:'email_exists'});return{id};});
 provider.get('/auth/v1/admin/users',async(req:any)=>{if(mode==='untracked')return{users:[{id,email:'new@example.test',user_metadata:{ab_enrollment_id:context.id,ab_enrollment_tenant:context.tenant}}]};if(req.query.page==='1')return{users:Array.from({length:100},(_,i)=>({id:String(i),email:'other'+i+'@example.test'}))};return{users:[{id,email:'NEW@example.test',email_confirmed_at:'2026-01-01',app_metadata:{ab_enrollment_id:context.id,ab_enrollment_tenant:context.tenant}}]};});
 await provider.listen({host:'127.0.0.1',port:0});try{const address=provider.server.address()as any,admin=modern?'sb_secret_synthetic-only':'admin-synthetic-only',{auth}=supabase('http://127.0.0.1:'+address.port,modern?'sb_publishable_synthetic-only':'public-synthetic-only',admin,'test');assert.equal(await auth.create('new@example.test','Synthetic-Password@2026',context),id);mode='duplicate';assert.equal(await auth.create('new@example.test','Synthetic-Password@2026',context),id);assert(seen.some(x=>x.url.includes('page=2')));mode='untracked';await assert.rejects(()=>auth.recoverEnrollment!('new@example.test',context),(e:any)=>e.code==='authIdentityNeedsReview');mode='invalid';await assert.rejects(()=>auth.create('new@example.test','Synthetic-Password@2026',context),(e:any)=>e.code==='authRejected'&&e.enrollmentRejected===true&&e.fieldErrors.email==='invalidEmail'&&!e.message.includes('provider details'));for(const request of seen){assert.equal(request.headers.apikey,admin);assert.equal(request.headers.authorization,modern?undefined:'Bearer '+admin);assert(['GET','POST'].includes(request.method));}}finally{await provider.close();}
});

test('optional encrypted object recovery treats only explicit404 as absent and bounds reads without weakening definite write refusal',async()=>{
 const provider=Fastify(),seen:any[]=[];provider.addContentTypeParser('application/octet-stream',{parseAs:'buffer'},(_req,b,done)=>done(null,b));provider.addHook('onRequest',async req=>{seen.push({url:req.url,method:req.method,upsert:req.headers['x-upsert']});});provider.get('/storage/v1/object/test-bucket/:key',async(req:any,reply)=>{if(req.params.key==='missing')return reply.code(404).send({error:'synthetic missing'});if(req.params.key==='refused')return reply.code(403).send({error:'synthetic denied'});return reply.type('application/octet-stream').send(Buffer.from('synthetic-encrypted-bytes'));});provider.post('/storage/v1/object/test-bucket/:key',async(req,reply)=>reply.code(403).send({error:'synthetic definite refusal'}));await provider.listen({host:'127.0.0.1',port:0});
 try{const {objects}=supabase('http://127.0.0.1:'+(provider.server.address()as any).port,'sb_publishable_synthetic','sb_secret_synthetic','test-bucket');assert.equal(await objects.getIfPresent!('missing'),null);assert.equal((await objects.getIfPresent!('present'))!.toString(),'synthetic-encrypted-bytes');await assert.rejects(objects.getIfPresent!('refused'),(e:any)=>e.status===502);const originalFetch=globalThis.fetch;let cancelled=false;globalThis.fetch=async(input,init)=>String(input).endsWith('/large')?new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));},cancel(){cancelled=true;}}),{headers:{'content-length':String(30*1024*1024)}}):originalFetch(input,init);try{await assert.rejects(objects.getIfPresent!('large'),(e:any)=>e.status===502);assert(cancelled);}finally{globalThis.fetch=originalFetch;}await assert.rejects(objects.put('refused',Buffer.from('synthetic')),(e:any)=>e.providerStatus===403);assert(seen.filter(r=>r.method==='POST').every(r=>r.upsert==='false'));assert(!seen.some(r=>['PATCH','DELETE','PUT'].includes(r.method)));}finally{await provider.close();}
});
