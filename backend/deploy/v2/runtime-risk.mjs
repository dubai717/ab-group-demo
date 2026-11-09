// Semantic staging classifier. Never executes candidate source. Unknown syntax fails closed.
import ts from 'typescript-portable';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const printer=ts.createPrinter({removeComments:true});
const protectedName=/^(?:can|has|require|authorize|authenticate|verifyPermission|effective|isOwner|inScope|validScope|scopeContains|createService|api$|transaction$|cipher$)/;
const destructiveCall=/(?:reset|delete(?:User|Data|Records|Company|Customer|Vehicle)|truncate|drop(?:Database|Table)|destroy|erase|purge|cleanupData|remove(?:User|Data|Records)|sendBeacon|WebSocket|XMLHttpRequest|EventSource|importScripts)/i;
const privileged=/permission|grant|revoke|redelegate|reset|service.?role|secret|database.?url|auth.?id|auth.?email|csrf|session|password.?hash|roleId|role_id|baseRole|payout|disburse|refund|posting|connection|supabase.?url/i;
const dangerousSql=/\b(?:delete\s+from|truncate|drop|alter|grant|revoke|disable\s+trigger|create\s+(?:role|policy)|update\s+(?:ab\.)?(?:users|roles|role_permissions|permission_grants)|insert\s+into\s+(?:ab\.)?(?:users|roles|role_permissions|permission_grants))\b/i;
function boundary(source,path){
 const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true,path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS);
 if(file.parseDiagnostics.length)throw Error('SYNTAX');const out=[],unknown=[],protectedHelpers=new Set();
 const print=n=>printer.printNode(ts.EmitHint.Unspecified,n,file);
 const keep=(kind,n)=>{out.push([kind,hash(print(n))]);if(['database-boundary','security-call','destructive-or-egress-call','privileged-endpoint'].includes(kind)){for(let p=n.parent;p;p=p.parent)if(ts.isFunctionLike(p)){const name=p.name?.getText(file)||(ts.isVariableDeclaration(p.parent)?p.parent.name.getText(file):'');if(name)protectedHelpers.add(name);break;}}};
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
   if(destructiveCall.test(name)){keep('destructive-or-egress-call',n);out.push(['guards',guards(n)]);}
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
  if(ts.isIfStatement(n)||ts.isConditionalExpression(n)){const expr=ts.isIfStatement(n)?n.expression:n.condition;if(privileged.test(print(expr))||/\b(?:roleId|role_id|owner|can[A-Z]\w*|has[A-Z]\w*)\b|\.(?:can|has)\s*\(/.test(print(expr))){keep('access-condition',expr);if(ts.isIfStatement(n))keep('access-guard-statement',n);}}
  if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment&&privileged.test(print(n.left)))keep('privileged-assignment',n);
  if(ts.isVariableDeclaration(n)&&privileged.test(print(n.name)))keep('privileged-variable',n);
  if(ts.isPropertyAssignment(n)&&privileged.test(print(n.name)))keep('privileged-property',n);
  if(ts.isStringLiteralLike(n)&&/^(?:https?:|wss?:)\/\//i.test(n.text))keep('external-origin',n);
  if(ts.isTemplateExpression(n)||ts.isNoSubstitutionTemplateLiteral(n)||ts.isStringLiteral(n)){const value=n.getText(file);if(/on[a-z]+\s*=|javascript:|<(?:script|iframe|object|embed)\b/i.test(value))uncertain(n);const matches=value.match(/data-[\w-]+\s*=\s*["'][^"']*(?:reset|delete|grant|revoke|permission|secret)[^"']*["']/gi);if(matches)out.push(['privileged-control',matches,guards(n)]);const resources=value.match(/(?:src|href|action)\s*=\s*["'][^"']*["']/gi);if(resources)out.push(['resource-targets',resources]);}
  n.forEachChild(visit);
 }
 visit(file);function calls(n){if((ts.isIdentifier(n)||ts.isStringLiteralLike(n))&&protectedHelpers.has(ts.isIdentifier(n)?n.text:n.text)&&!(ts.isFunctionLike(n.parent)&&n.parent.name===n)){out.push(['privileged-helper-reference',hash(print(n.parent)),guards(n)]);}n.forEachChild(calls);}calls(file);return {protected:out,unknown};
}
export function classifyRuntime(path,before,after){try{const a=boundary(before,path),b=boundary(after,path);if(JSON.stringify(a.unknown)!==JSON.stringify(b.unknown))return 'unknown';return JSON.stringify(a.protected)===JSON.stringify(b.protected)?'ordinary':'sensitive';}catch{return 'unknown';}}
