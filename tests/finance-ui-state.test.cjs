const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const tick=()=>new Promise(r=>setImmediate(r));
test('late financial responses from a logged-out actor never replace the next user scope',async()=>{
 const pending=[],C={enabled:true,actor:{id:'old'},api:path=>new Promise(resolve=>pending.push({path,resolve}))};
 const context={ABCentral:C,FinancePolicy:require('../finance-policy.js'),WorkspaceUI:{esc:v=>String(v??''),enhance:()=>{}},app:{state:{currentPage:'bankAccounts'}},getCurrentUser:()=>C.actor,getLocale:()=> 'en',render:()=>{},queueMicrotask,Intl,Date,URL,console};context.globalThis=context;
 vm.runInNewContext(fs.readFileSync('finance-workbench.js','utf8'),context);
 const ui=context.FinanceWorkbench;ui.select('movements',false);ui.render();await tick();pending.shift().resolve({available:true});await tick();const stale=pending.shift();
 ui.reset();C.actor={id:'new'};ui.select('movements',false);ui.render();await tick();pending.shift().resolve({available:true});await tick();
 const book=name=>({companies:[{id:name,englishName:name,status:'Active'}],balances:[],operations:[],cheques:[],receipts:[],chart:[],handovers:[],statements:[],expenses:[],users:[],notifications:[],permissions:{[name]:['finance_create']},configuration:[],usage:[]});
 pending.shift().resolve(book('NEW_SCOPE'));await tick();stale.resolve(book('OLD_SCOPE'));await tick();
 const html=ui.render();assert(html.includes('NEW_SCOPE'));assert(!html.includes('OLD_SCOPE'));
});
test('late group-report data is discarded after logout even while a command handler is pending',async()=>{
 const pending=[],button={dataset:{fw:'group-report'},isConnected:true},C={enabled:true,actor:{id:'old'},api:path=>new Promise(resolve=>pending.push({path,resolve}))};
 const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:s=>s==='[data-fw]'?[button]:[]};
 const context={document,crypto:require('node:crypto').webcrypto,ABCentral:C,FinancePolicy:require('../finance-policy.js'),WorkspaceUI:{esc:v=>String(v??''),enhance:()=>{}},app:{state:{currentPage:'bankAccounts'}},getCurrentUser:()=>C.actor,getLocale:()=> 'en',render:()=>{},queueMicrotask,Intl,Date,URL,console};context.globalThis=context;vm.runInNewContext(fs.readFileSync('finance-workbench.js','utf8'),context);
 const book=name=>({companies:[{id:name,englishName:name,status:'Active'}],balances:[],operations:[],cheques:[],receipts:[],chart:[],handovers:[],statements:[],expenses:[],users:[],notifications:[],permissions:{[name]:[]},configuration:[],usage:[]});
 const ui=context.FinanceWorkbench;ui.select('reports',false);ui.render();await tick();pending.shift().resolve({available:true});await tick();pending.shift().resolve(book('OLD_SCOPE'));await tick();ui.bind();const handler=button.onclick();await tick();const stale=pending.shift();assert.equal(stale.path,'finance/group-report');
 ui.reset();C.actor={id:'new'};ui.select('reports',false);ui.render();await tick();pending.shift().resolve({available:true});await tick();pending.shift().resolve(book('NEW_SCOPE'));await tick();stale.resolve({rows:[{companyId:'OLD_PRIVATE_BANK',currency:'AED',balance:'123'}],totals:{AED:'123'}});await handler;
 const html=ui.render();assert(html.includes('NEW_SCOPE'));assert(!html.includes('OLD_PRIVATE_BANK'));
});
