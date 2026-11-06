const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
test('frontend package has no dangling script references or retired interfaces; private Reset implementation remains',()=>{
 const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const match of html.matchAll(/<script[^>]+src="([^"]+)"/g))assert(fs.existsSync(path.join(root,match[1])),match[1]);
 for(const file of ['test-users-ui.js','reset-test-database-ui.js']){assert(!html.includes(file));assert(!fs.existsSync(path.join(root,file)));}
 for(const file of ['backend/reset/admin-worker.ts','backend/reset/schema.ts','backend/src/reset-control.ts','backend/src/test-users.ts','backend/src/test-workspace.ts'])assert(fs.existsSync(path.join(root,file)),file);
});
