import {requireOk} from './core.js';

// Direct additions only. Inherited denials and company/bank overrides are separate sources.
// Reject downstream dependencies instead of silently cascading into unselected grants.
export function standardExceptionImpact(m:any, actorId:string, roleId:string, policy:string, selectedIds:string[],selectedDenials:{userId:string;action:string}[]=[]) {
 const ids=[...selectedIds].sort();
 requireOk(new Set(ids).size===ids.length,422,'duplicateExceptionSelection');
 requireOk(policy==='remove_selected'?ids.length+selectedDenials.length>0:ids.length+selectedDenials.length===0,422,'invalidExceptionSelection');
 const people=m.state.users.filter((u:any)=>u.roleId===roleId), peopleById=new Map(people.map((u:any)=>[u.id,u]));
 const additions=m.initialGrants.filter((g:any)=>peopleById.has(g.userId));
 const byId=new Map<string,any>(additions.map((g:any)=>[g.entry.id,g]));
 for(const id of ids){
  const g=byId.get(id);requireOk(g,422,'exceptionOutsideStandard');
  const target:any=peopleById.get(g.userId);
  requireOk(target.id!==actorId&&target.roleId!=='owner',403,'ownerProtected');
  requireOk(!m.grants.some((x:any)=>x.issuer_id===target.id&&x.user_id!==target.id),409,'reviewDownstreamGrantsFirst');
 }
 const denialIds=new Set<string>();for(const item of selectedDenials){const key=item.userId+':'+item.action;requireOk(!denialIds.has(key),422,'duplicateExceptionSelection');denialIds.add(key);const u:any=peopleById.get(item.userId);requireOk(u,422,'exceptionOutsideStandard');requireOk(u.id!==actorId&&u.roleId!=='owner',403,'ownerProtected');requireOk((m.initialDenials||[]).find((d:any)=>d.userId===u.id)?.actions.includes(item.action),422,'invalidIndividualDenial');}
 const selected=new Set(ids);
 return {individualExceptionPolicy:policy,selectedGrantIds:ids,selectedDenials:[...selectedDenials].sort((a,b)=>(a.userId+':'+a.action).localeCompare(b.userId+':'+b.action)),individualDenySupported:true,
  affectedUsers:people.map((u:any)=>{const direct=additions.filter((g:any)=>g.userId===u.id),denials=(m.initialDenials||[]).find((d:any)=>d.userId===u.id)?.actions||[],removed=denials.filter((a:string)=>denialIds.has(u.id+':'+a));return {
   id:u.id,nameAr:u.nameAr,nameEn:u.nameEn,username:u.username,revision:u.revision,
   individualAdditionCount:direct.length,individualDenyCount:(m.initialDenials||[]).find((d:any)=>d.userId===u.id)?.actions.length||0,individualDenialsRetained:removed.length===0,selectedDenyRemovalCount:removed.length,retainedDenyCount:denials.length-removed.length,directDenials:denials.map((action:string)=>({action,selectedForRemoval:denialIds.has(u.id+':'+action)})),individualDenySupported:true,
   individualGrantsRetained:!direct.some((g:any)=>selected.has(g.entry.id)),
   selectedRemovalCount:direct.filter((g:any)=>selected.has(g.entry.id)).length,
   retainedAdditionCount:direct.filter((g:any)=>!selected.has(g.entry.id)).length,
   directAdditions:direct.map((g:any)=>({id:g.entry.id,action:g.entry.action,scope:g.entry.scope,scopeNameAr:(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.nameAr||(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.arabicName||(m.state.departments||[]).find((x:any)=>x.id===g.entry.scope.id)?.name||null,scopeNameEn:(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.nameEn||(m.state.companies||[]).find((x:any)=>x.id===g.entry.scope.id)?.englishName||(m.state.departments||[]).find((x:any)=>x.id===g.entry.scope.id)?.name||null,delegable:g.entry.delegable,
    selectedForRemoval:selected.has(g.entry.id),removalRequiresDownstreamReview:m.grants.some((x:any)=>x.issuer_id===u.id&&x.user_id!==u.id)}))
  };})};
}
