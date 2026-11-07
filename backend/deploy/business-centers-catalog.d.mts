export type BusinessMigration={name:string;path:string;sha256:string;tables:string[];sql:string};
export function businessCatalog(root?:string):BusinessMigration[];
export function validateBusinessLedger(rows:any[],base:any[],plan?:BusinessMigration[]):BusinessMigration[];
export function verifyBusinessCandidate():BusinessMigration[];
