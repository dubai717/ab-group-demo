// Fresh encrypted archive + full isolated restore. Source SQL is READ ONLY; uploads are create-only.
import {main} from '../deploy/backup-restore-drill.js';
await main();
