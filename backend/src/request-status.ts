// Presentation of immutable historical states; no rewrites or inferred approvals.
export function requestStatus(type:string,state:string,approval?:string){
 const operational=type==='vehicle'?({Rejected:'New',Requested:'New',Approved:'InProgress',NotRequired:'InProgress',Completed:'Completed',Closed:'Closed',Cancelled:'Cancelled'}as any)[state]||'New':({Open:'New',Submitted:'New',InProgress:'InProgress',Waiting:'Waiting',Completed:'Completed',Closed:'Closed',Cancelled:'Cancelled'}as any)[state]||'New';
 return {operationalState:approval==='Returned'?'Waiting':operational,approvalState:approval||(type==='vehicle'?({Requested:'Pending',Approved:'Approved',Rejected:'Rejected',NotRequired:'NotRequired'}as any)[state]||'NotRequired':'NotRequired')};
}
