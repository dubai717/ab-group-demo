// Company-local policy failures may hold one already-authorized job. Global maintenance, server and DB faults still throw.
import {ApiError} from './core.js';
const safeCodes=new Set(['accountMappingRequired','denied','financialSourceReviewRequired','invalidReference','financialActivationRequired','loginRequired','registerTooLarge','legacyRecurringCompanyReviewRequired','registrationReviewRequired']);
export function scheduledFinancialReview(error:unknown,companyId:string,code:'financialScheduledCompanyReviewRequired'|'vehicleScheduledCompanyReviewRequired'){
 if(!(error instanceof ApiError)||error.status<400||error.status>=500)throw error;
 return{companyId,code,reasonCode:safeCodes.has(error.code)?error.code:'companyPolicyReviewRequired',status:error.status};
}
export function scheduledFinancialLog(event:string,rows:any[]){return{event,count:rows.length,companies:[...new Set(rows.map(x=>x.companyId))],reviews:rows.map(x=>({companyId:x.companyId,code:x.code,reasonCode:x.reasonCode||x.code,...(x.status?{status:x.status}:{})}))};}
