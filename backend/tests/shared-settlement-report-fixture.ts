// Only synthetic loopback sources. The original native bank engine owns every posting.
export async function sharedSettlementReportSources(f:any){
 const approve=(id:string,reference:string)=>f.req('POST','/api/finance/operations/'+id+'/approve',{revision:1,bankConfirmation:reference});
 const first=await f.req('POST',f.path+'/payment',f.body({amount:'10.001',reference:'SYN-REPORT-SETTLED-OUT'}));await approve(first.operationId,'SYN-REPORT-SETTLED-OUT');const receipt=await f.req('POST',f.path+'/'+first.id+'/receipt',f.receipt({amount:'10.001',reference:'SYN-REPORT-SETTLED-IN'}));await approve(receipt.operationId,'SYN-REPORT-SETTLED-IN');
 const rejected=await f.req('POST',f.path+'/payment',f.body({amount:'5',reference:'SYN-REPORT-REJECTED'}));await f.req('POST','/api/finance/operations/'+rejected.operationId+'/reject',{reason:'Synthetic rejected unposted evidence'});
 const transit=await f.req('POST',f.path+'/payment',f.body({amount:'20',reference:'SYN-REPORT-TRANSIT'}));await approve(transit.operationId,'SYN-REPORT-TRANSIT');
 const draft=await f.req('POST',f.path+'/payment',f.body({amount:'10',reference:'SYN-REPORT-DRAFT'}));return{first:first.id,rejected:rejected.id,transit:transit.id,draft:draft.id};
}
