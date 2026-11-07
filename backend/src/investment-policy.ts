// Integer thousandths throughout; allocation methods and shares are explicit signed-contract inputs.
export function splitInvestorCollections(d:{funded:bigint;scheduledInstallments:bigint;collectedInstallments:bigint;method?:string;yieldBps?:number}){
 if(d.funded<0n||d.scheduledInstallments<0n||d.collectedInstallments<0n)throw Error('invalidInvestorAmount');
 if(!['principal_first','pro_rata'].includes(d.method||'')||!Number.isInteger(d.yieldBps)||d.yieldBps!<0||d.yieldBps!>10000)return {available:false,principal:0n,returns:0n};
 const principal=d.method==='principal_first'?min(d.funded,d.collectedInstallments):d.scheduledInstallments>0n?min(d.funded,d.collectedInstallments*d.funded/d.scheduledInstallments):0n;
 const excess=d.collectedInstallments>principal?d.collectedInstallments-principal:0n;
 return {available:true,principal,returns:excess*BigInt(d.yieldBps!)/10000n};
}
const min=(a:bigint,b:bigint)=>a<b?a:b;
