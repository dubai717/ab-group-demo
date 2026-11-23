// Each browser journey gets its own DB, Auth provider and rate limiter.
// Parent CI fixtures remain idle; database suites are never run in parallel.
const {spawn,execFileSync}=require('node:child_process'),fs=require('node:fs');
(async()=>{
 const kind=process.argv[2];if(!['funding','personnel'].includes(kind))throw Error('Unknown isolated review suite');
 for(const phase of kind==='funding'?['renderer','funding','service']:['personnel']){
  const funding=phase!=='personnel',provider=funding?'funding':'personnel',port=funding?3640:3641,suite=phase==='renderer'?'attachment-cancellation':phase==='service'?'service-lifecycle-v3':funding?'funding-review':'personnel-directory';
  const fd=fs.openSync('work/'+suite+'-independent-fixture.log','a'),child=spawn(process.execPath,['--import','tsx','backend/tests/serve-review-extra-fixture.ts'],{env:{...process.env,AB_TEST_REVIEW_SUITE:provider},stdio:['ignore',fd,fd]});fs.closeSync(fd);
  try{
   let ready=false;for(let n=0;n<120;n++){if(child.exitCode!==null)throw Error('Independent synthetic fixture stopped');try{const r=await fetch('http://127.0.0.1:'+port+'/api/health');ready=r.ok;await r.body?.cancel();if(ready)break;}catch{}await new Promise(r=>setTimeout(r,500));}
   if(!ready)throw Error('Independent synthetic fixture timeout');execFileSync(process.execPath,['backend/tests/'+suite+'.browser.cjs',...(phase==='renderer'?['funding-fixture']:[])],{stdio:'inherit'});
  }finally{child.kill();if(child.exitCode===null)await new Promise(r=>child.once('exit',r));}
 }
})().catch(e=>{console.error(e.message);process.exitCode=1;});
