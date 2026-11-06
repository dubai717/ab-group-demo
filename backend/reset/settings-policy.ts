// Declarative namespaces, not a per-table deletion list. Unknown configuration is never discarded silently.
import {requireOk} from '../src/core.js';
export function retainSetting(key:string){if(key==='companyDocumentAlertDays'||key.startsWith('system:'))return true;if(/^(reset-|TEST_DATA:|managed-test-users|manual-test-passwords|customer:|customer-prefs:|vehicle:|vehicle-prefs:|finance:|ledger:|ledger-prefs:|personnel:|personnel-)/.test(key))return false;requireOk(false,409,'unclassifiedSystemSetting');}
