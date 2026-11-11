// Exact owner-reviewed 026 function replacement only. All other functions retain strict preservation.
import type {PoolClient} from 'pg';
import {sha} from '../src/core.js';
const oldHash='1bdc3799b3dcd3e9fc60f1fcacfadba3989042346cdf89a9fdb753bf51f3cee8';
const newHash='b0034e5826235081eb1d060b48b6340f2d546dd95e9229a3c813894ee1942f59';
export async function reviewedInvestorPreservation(c:PoolClient,before:any,pending:string[]){
 if(!pending.includes('026'))return before;
 const after=(await c.query("select p.oid::text id,pg_get_functiondef(p.oid) def,p.proacl::text acl,p.prosecdef sec,p.proowner::text owner from pg_proc p where p.oid='ab.investor_identity_guard()'::regprocedure")).rows[0];
 if(!after||sha(after.def)!==newHash)throw Error('INVESTOR_REVIEWED_GUARD_MISMATCH');
 const prior=before.functions.find((f:any)=>f.id===after.id);
 if(prior){
  if(sha(prior.def)!==oldHash||JSON.stringify({...after,def:prior.def})!==JSON.stringify(prior))throw Error('INVESTOR_PRIOR_GUARD_OR_PRIVILEGES_CHANGED');
 }else if(!pending.includes('017'))throw Error('INVESTOR_PRIOR_GUARD_REQUIRED');
 return {...before,functions:before.functions.filter((f:any)=>f.id!==after.id)};
}
