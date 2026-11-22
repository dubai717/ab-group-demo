// Read-only evidence review. This reports gaps; it is not a deployment gate or financial approval.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export function reviewFinancialChecklist({checklist,markdown,remaining,exists=()=>true}){
 const errors=[],counts={},expected=[7,10,9,7,11,13,18,9,11].flatMap((n,i)=>Array.from({length:n},(_,j)=>`${i+1}.${j+1}`)),rows=checklist.requirements||[],ids=rows.map(r=>r.id);
 if(ids.length!==95||new Set(ids).size!==95||expected.some(id=>!ids.includes(id)))errors.push('requirementsMustMatchOriginal95');
 const states=['مكتمل ومنشور','مكتمل وغير منشور','منفذ جزئياً','لم يُنفذ'];
 const anchors=new Map([...markdown.matchAll(/<a id="(e\d+)"><\/a>([^\n]*)/g)].map(m=>[m[1].toUpperCase(),m[2]]));
 for(const r of rows){
  if(!states.includes(r.status))errors.push(`invalidStatus:${r.id}`);counts[r.status]=(counts[r.status]||0)+1;
  if(!Array.isArray(r.evidence)||!r.evidence.length)errors.push(`evidenceMissing:${r.id}`);
  for(const ref of r.evidence||[]){const text=anchors.get(ref);if(!text){errors.push(`anchorMissing:${r.id}:${ref}`);continue;}
   for(const link of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){const target=link[1];if(!/^(?:https?:|#)/.test(target)&&!exists(target))errors.push(`sourceMissing:${r.id}:${ref}:${target}`);}
  }
 }
 const partial=rows.filter(r=>r.status==='منفذ جزئياً'),decisions=remaining.requirements||[],decisionIds=decisions.map(r=>r.id);
 if(new Set(decisionIds).size!==decisionIds.length||decisionIds.length!==partial.length||partial.some(r=>!decisionIds.includes(r.id))||decisionIds.some(id=>!partial.some(r=>r.id===id)))errors.push('remainingMustMatchEveryPartialRequirement');
 const kinds=['owner_policy','operational_evidence','external_resource','integration_dependency','mixed'];
 for(const r of decisions){
  if(r.complete!==false||!kinds.includes(r.blockerKind)||!r.safeWorkCompleted?.trim()||!r.remainingEngineeringOrAcceptance?.trim())errors.push(`remainingNotExplained:${r.id}`);
  if(['owner_policy','mixed'].includes(r.blockerKind)&&!r.ownerDecision?.trim())errors.push(`ownerDecisionMissing:${r.id}`);
  if(['external_resource','operational_evidence'].includes(r.blockerKind)&&!r.externalEvidence?.trim())errors.push(`externalEvidenceMissing:${r.id}`);
  const original=rows.find(x=>x.id===r.id);if(!r.evidence?.length||r.evidence.some(ref=>!original?.evidence?.includes(ref)))errors.push(`remainingEvidenceMismatch:${r.id}`);
 }
 return{valid:errors.length===0,requirements:rows.length,counts,partialRequirements:partial.map(r=>r.id),evidenceAnchors:anchors.size,all95Complete:false,financialApproval:false,deploymentApproval:false,errors};
}
export function readFinancialReview(root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..')){
 const dir=path.join(root,'docs/finance'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
 return reviewFinancialChecklist({checklist:read('MASTER-CHECKLIST-20261121.json'),remaining:read('REMAINING-DECISIONS-20261123.json'),markdown:fs.readFileSync(path.join(dir,'MASTER-CHECKLIST-20261121.md'),'utf8'),exists:target=>{const p=path.resolve(dir,target.split('#')[0]);return !path.relative(root,p).startsWith('..')&&fs.existsSync(p)&&fs.statSync(p).isFile();}});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){const result=readFinancialReview();console.log(JSON.stringify(result,null,2));if(!result.valid)process.exitCode=1;}
