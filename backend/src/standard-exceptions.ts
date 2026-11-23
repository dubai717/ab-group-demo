import {requireOk} from './core.js';

// Direct additions only. Inherited denials and company/bank overrides are separate sources.
// Reject downstream dependencies instead of silently cascading into unselected grants.
export function standardExceptionImpact(m:any, actorId:string, roleId:string, policy:string, selectedIds:string[]) {
 const ids=[...selectedIds].sort();
 requireOk(new Set(ids).size===ids.length,422,'duplicateExceptionSelection');
 requireOk(policy==='remove_selected'?ids.length>0:ids.length===0,422,'invalidExceptionSelection');
 const people=m.state.users.filter((u:any)=>u.roleId===roleId), peopleById=new Map(people.map((u:any)=>[u.id,u]));
 const additions=m.initialGrants.filter((g:any)=>peopleById.has(g.userId));
 const byId=new Map<string,any>(additions.map((g:any)=>[g.entry.id,g]));
 for(const id of ids){
  const g=byId.get(id);requireOk(g,422,'exceptionOutsideStandard');
  const target:any=peopleById.get(g.userId);
  requireOk(target.id!==actorId&&target.roleId!=='owner',403,'ownerProtected');
  requireOk(!m.grants.some((x:any)=>x.issuer_id===target.id&&x.user_id!==target.id),409,'reviewDownstreamGrantsFirst');
 }
 const selected=new Set(ids);
 return {individualExceptionPolicy:policy,selectedGrantIds:ids,individualDenySupported:true,
  affectedUsers:people.map((u:any)=>{const direct=additions.filter((g:any)=>g.userId===u.id);return {
   id:u.id,nameAr:u.nameAr,nameEn:u.nameEn,username:u.username,revision:u.revision,
   individualAdditionCount:direct.length,individualDenyCount:(m.initialDenials||[]).find((d:any)=>d.userId===u.id)?.actions.length||0,individualDenialsRetained:true,individualDenySupported:true,
   individualGrantsRetained:!direct.some((g:any)=>selected.has(g.entry.id)),
   selectedRemovalCount:direct.filter((g:any)=>selected.has(g.entry.id)).length,
   retainedAdditionCount:direct.filter((g:any)=>!selected.has(g.entry.id)).length,
   directAdditions:direct.map((g:any)=>({id:g.entry.id,action:g.entry.action,scope:g.entry.scope,scopeNameAr:(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.nameAr||(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.arabicName||(m.state.departments||[]).find((x:any)=>x.id===g.entry.scope.id)?.name||null,scopeNameEn:(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.nameEn||(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.englishName||(m.state.departments||[]).find((x:any)=>x.id===g.entry.scope.id)?.name||null,delegable:g.entry.delegable,
    selectedForRemoval:selected.has(g.entry.id),removalRequiresDownstreamReview:m.grants.some((x:any)=>x.issuer_id===u.id&&x.user_id!==u.id)}))
  };})};
}
