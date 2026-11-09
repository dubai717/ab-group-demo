// Semantic staging classifier. Never executes candidate source. Unknown syntax fails closed.
import ts from 'typescript-portable';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const printer=ts.createPrinter({removeComments:true});
const protectedName=/^(?:can|has|require|authorize|authenticate|verifyPermission|effective|isOwner|inScope|validScope|scopeContains|createService|api$|transaction$|cipher$)/;
const privileged=/permission|grant|revoke|redelegate|reset|service.?role|secret|database.?url|auth.?id|auth.?email|csrf|session|password.?hash|roleId|role_id|baseRole|payout|disburse|refund|posting|connection|supabase.?url/i;
const dangerousSql=/\b(?:delete\s+from|truncate|drop|alter|grant|revoke|disable\s+trigger|create\s+(?:role|policy)|update\s+(?:ab\.)?(?:users|roles|role_permissions|permission_grants)|insert\s+into\s+(?:ab\.)?(?:users|roles|role_permissions|permission_grants))\b/i;
function boundary(source,path){
 const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 if(file.parseDiagnostics.length)throw Error('SYNTAX');const out=[],unknown=[];
 const print=n=>printer.printNode(ts.EmitHint.Unspecified,n,file);
 const keep=(kind,n)=>out.push([kind,hash(print(n))]);
 const uncertain=n=>unknown.push([hash(print(n)),guards(n)]);
 function guards(n){const result=[];for(let c=n,p=n.parent;p;c=p,p=p.parent){if(ts.isIfStatement(p))result.push(['if',print(p.expression),c===p.thenStatement?'then':'else']);if(ts.isConditionalExpression(p))result.push(['conditional',print(p.condition),c===p.whenTrue?'true':'false']);if(ts.isBinaryExpression(p)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)&&c===p.right)result.push(['short',print(p.left)]);if(ts.isFunctionLike(p))result.push(['function',p.name?.getText(file)||'callback']);}return result;}
 function visit(n){
  if(ts.isWithStatement(n)||ts.isImportEqualsDeclaration(n)||ts.isMetaProperty(n))uncertain(n);
  if(ts.isImportDeclaration(n)||ts.isExportDeclaration(n))keep('module',n);
  if(ts.isFunctionDeclaration(n)&&n.name&&protectedName.test(n.name.text)){keep('security-function',n);return;}
  if(ts.isPropertyAccessExpression(n)&&n.expression.getText(file)==='process'&&n.name.text==='env')keep('environment',n.parent);
  if(ts.isCallExpression(n)||ts.isNewExpression(n)){
   const name=n.expression.getText(file),args=n.arguments||[];
   if(/(?:localStorage|sessionStorage|indexedDB)\./.test(name))keep('browser-storage',n);
   if(/^(?:eval|Function|require|import)$/.test(name)||/\[(?!["'])/.test(name))uncertain(n);
   if(/(?:policy\.|auth\.|cipher\.|session\.|permissions?\.|grants?\.)/.test(name)||protectedName.test(name)||/\.(?:can|has|require|grant|revoke|authorize|authenticate)\b/.test(name)){keep('security-call',n);out.push(['guards',guards(n)]);}
   if(/(?:^|\.)(?:fetch|request|api)$/.test(name)){
    const endpoint=args[0];if(!endpoint){uncertain(n);return;}
    if(!/(?:^|\.)api$/.test(name))keep('network-call',n);
    else if(ts.isIdentifier(endpoint))uncertain(n);
    if(privileged.test(print(endpoint))||/\bDELETE\b/.test(args.slice(1).map(print).join(' '))){keep('privileged-endpoint',n);out.push(['guards',guards(n)]);}
   }
   if(/\.(?:get|post|put|patch|delete|route)$/.test(name)&&/^(?:app|router)\./.test(name)){
    const route=args[0];out.push(['route',name,route?print(route):'']);if(/\.delete$/.test(name)||route&&privileged.test(print(route))){keep('privileged-route',n);return;}
   }
   if(/\.(?:query|execute|raw)$/.test(name)){
    const sql=args[0];if(!sql||!ts.isStringLiteralLike(sql))uncertain(n);
    else if(dangerousSql.test(sql.text)){keep('database-boundary',n);out.push(['guards',guards(n)]);}
   }
  }
  if(ts.isIfStatement(n)||ts.isConditionalExpression(n)){const expr=ts.isIfStatement(n)?n.expression:n.condition;if(privileged.test(print(expr))||/\b(?:roleId|role_id|owner|can[A-Z]\w*|has[A-Z]\w*)\b/.test(print(expr)))keep('access-condition',expr);}
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment&&privileged.test(print(n.left)))keep('privileged-assignment',n);
  if(ts.isVariableDeclaration(n)&&privileged.test(print(n.name)))keep('privileged-variable',n);
  if(ts.isPropertyAssignment(n)&&privileged.test(print(n.name)))keep('privileged-property',n);
  if(ts.isStringLiteralLike(n)&&/^(?:https?:|wss?:)\/\//i.test(n.text))keep('external-origin',n);
  if(ts.isTemplateExpression(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isStringLiteral(n)){const value=n.getText(file);if(/on[a-z]+\s*=|javascript:|<(?:script|iframe|object|embed)\b/i.test(value))uncertain(n);const matches=value.match(/data-[\w-]+\s*=\s*["'][^"']*(?:reset|delete|grant|revoke|permission|secret)[^"']*["']/gi);if(matches)out.push(['privileged-control',matches,guards(n)]);}
  n.forEachChild(visit);
 }
 visit(file);return {protected:out,unknown};
}
export function classifyRuntime(path,before,after){try{const a=boundary(before,path),b=boundary(after,path);if(JSON.stringify(a.unknown)!==JSON.stringify(b.unknown))return 'unknown';return JSON.stringify(a.protected)===JSON.stringify(b.protected)?'ordinary':'sensitive';}catch{return 'unknown';}}
