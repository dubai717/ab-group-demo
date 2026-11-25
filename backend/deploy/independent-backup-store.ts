// Explicit destination seam over the ORIGINAL private encrypted backup store.
// No environment reads, scheduler, provider call on construction, bucket creation or deletion.
import{privateBackupStore}from'./private-backup-store.js';import{backupSourceHash}from'../src/backup-status-proof.js';import{sha}from'../src/core.js';
const endpoint=(value:string)=>{try{backupSourceHash(value);return new URL(value).origin;}catch{throw Error('independentBackupEndpointReviewRequired');}};
export function independentBackupStore(config:{mode:'disabled'|'sandbox';sourceEndpoint:string;destinationEndpoint:string;destinationSecret:string;sourceSecret:string},fetcher:typeof fetch){
 if(config.mode!=='sandbox'||typeof fetcher!=='function')throw Error('independentBackupNotEnabled');
 const source=endpoint(config.sourceEndpoint),destination=endpoint(config.destinationEndpoint);if(source===destination)throw Error('independentBackupSeparateProjectRequired');
 if(!config.sourceSecret?.trim()||!config.destinationSecret?.trim()||config.destinationSecret.trim()!==config.destinationSecret||config.destinationSecret===config.sourceSecret)throw Error('independentBackupCredentialReviewRequired');
 const store=privateBackupStore(destination,config.destinationSecret,fetcher);
 const verifyRetained=async(path:string,bytes:Buffer)=>{
  const restored=await store.downloadVerified(path,bytes);await store.verifyNotPublic(path);
  return{path,sha256:sha(restored),bytes:restored.length,storageLocation:'separate_project' as const,artifactBytesVerified:true,systemRestorePerformed:false};
 };
 return{sourceProjectHash:backupSourceHash(source),destinationProjectHash:backupSourceHash(destination),storageLocation:'separate_project' as const,
  // Paths and exact ciphertext must be retained by the caller across uncertain replies.
  async retainAndVerify(path:string,bytes:Buffer){
   try{await store.upload(path,bytes);}catch(e:any){if(e.message!=='BACKUP_PATH_CONFLICT')throw e;}
   return verifyRetained(path,bytes);
  },verifyRetained,verifyBucket:store.verifyBucket,
 };
}
