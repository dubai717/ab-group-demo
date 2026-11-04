// The existing company getter hides notFound as generic HTTP 422/invalid.
// Accept only an error-only denial, never a successful or data-bearing response.
export function deniedCompanyResponse(status:number,body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1)return false;
 const error=(body as {error?:unknown}).error;
 return ([403,404].includes(status)&&['denied','notFound','invalid'].includes(String(error)))||(status===422&&error==='invalid');
}
