// A failed reset keeps ordinary delivery blocked until recovery is verified.
import {remoteControl,markerPath} from './remote-control.js';
try{const e=process.env;const store=remoteControl(e.SUPABASE_URL||'',e.SUPABASE_SECRET_KEY||'',e.DATA_ENCRYPTION_KEY||'');const m=await store.get(markerPath);if(m?.active)throw Error('resetMaintenanceActive');console.log('CHECK: RESET_MAINTENANCE_IDLE=PASS');}catch{console.log('RESULT: DELIVERY_STOP_RESET_CONTROL_UNAVAILABLE_OR_ACTIVE');process.exitCode=1;}
