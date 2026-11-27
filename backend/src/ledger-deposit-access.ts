import {financeRight} from './finance.js';

export function canReadLedgerDeposit(model:any, deposit:{company_id:string;holder_id:string}){
 const company=deposit.company_id;
 return financeRight(model,'ledger_view',company)&&(
  deposit.holder_id===model.actor.id||
  financeRight(model,'ledger_audit',company)||
  financeRight(model,'ledger_deposit_verify',company)
 );
}
