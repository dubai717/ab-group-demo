import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deniedCompanyResponse} from '../deploy/staging-smoke-response.js';
test('existing generic company denial is recognized without accepting successful or data-bearing responses',()=>{
 for(const [status,body]of [[422,{error:'invalid'}],[403,{error:'denied'}],[404,{error:'notFound'}]]as const)assert(deniedCompanyResponse(status,body));
 for(const [status,body]of [[200,{error:'invalid'}],[200,{id:'foreign'}],[422,{error:'invalid',id:'foreign'}],[500,{error:'invalid'}],[422,null],[422,{error:'unavailable'}]]as const)assert(!deniedCompanyResponse(status,body));
});
