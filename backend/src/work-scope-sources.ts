// Read-only projection of original company geography. Areas are not business centres.
export function workScopeSources(companies:any[],emirates:any[],areas:any[],assignedCompanyIds:string[]){
 const groups=new Map(emirates.map(e=>[e.id,{id:e.id,nameAr:e.ar,nameEn:e.en,companyIds:[] as string[]}])),unresolved:any[]=[];
 for(const company of companies){
  const byId=company.emirateId?emirates.find(e=>e.id===company.emirateId):undefined,byLegacy=company.emirate?emirates.find(e=>e.legacy===company.emirate):undefined;
  let reason=company.emirateId&&!byId?'unknownEmirate':company.emirate&&!byLegacy?'unknownLegacyEmirate':byId&&byLegacy&&byId.id!==byLegacy.id?'conflictingEmirate':null;
  const emirate=byId||byLegacy,area=company.areaId?areas.find(a=>a.id===company.areaId):undefined;
  if(!reason&&!emirate)reason='missingEmirate';if(!reason&&company.areaId&&(!area||area.emirateId!==emirate.id))reason='invalidAreaRelationship';
  if(reason){unresolved.push({companyId:company.id,reason});continue;}
  groups.get(emirate.id)!.companyIds.push(company.id);
 }
 return{readOnly:true,areaIsNotCenter:true,centerMappingsAvailable:false,assignedCompanyIds:[...new Set(assignedCompanyIds)],emirates:[...groups.values()].map(e=>({...e,companyIds:[...new Set(e.companyIds)].sort()})),unresolved:unresolved.sort((a,b)=>a.companyId.localeCompare(b.companyId)),authorityChanged:false};
}
