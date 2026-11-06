// Trusted-controller classifier. Candidate source is parsed as data, never imported or evaluated.
import ts from 'typescript-portable';
import {parseFragment,parse as parseHtml} from 'parse5';
import {parse as parseCss,walk as walkCss} from 'css-tree';
import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
const uiFiles=new Set(['app.js','company-documents.js','bank-accounts.js','user-management.js','customers.js','vehicles.js','finance-workbench.js','ledger-ui.js','personnel-ui.js','workspace-ui.js','register-tools.js','attachment-viewer.js']);
const critical=/^(\.github\/|backend\/(deploy|actions|reset|review)\/|supabase\/|backend\/src\/|.*(?:^|\/)(?:AGENTS|CODEOWNERS)\b)|(?:^|\/)[^/]*(?:policy|auth|credential|permission|reset)[^/]*\.(?:js|ts|mjs)$|^(?:central-client\.js|server\.js|package(?:-lock)?\.json|Dockerfile[^/]*|\.dockerignore|\.npmrc)$/;
const security=/owner|role|permission|grant|auth|password|secret|token|reset|delete|remove|withdraw|activat|deactivat|approv|can[A-Z]|rights|scope|حذف|تصفير|صلاح|تفعيل|تعطيل|كلمة مرور|موافقة/i;
const forbidden=/^(?:constructor|__proto__|prototype|eval|Function|Reflect|Proxy|fetch|XMLHttpRequest|WebSocket|navigator|location|window|document|globalThis|process|require|module|exports|localStorage|sessionStorage|indexedDB|importScripts)$/;
const plain=s=>typeof s==='string'&&!/[<>\\]|(?:https?:|javascript:|data:|\/\/)/i.test(s);
function htmlShape(markup,document=false){
 const root=document?parseHtml(markup):parseFragment(markup);const nodes=[];
 function visit(n){if(n.nodeName==='#text'&&['script','style'].includes(n.parentNode?.tagName))return n.value;if(n.nodeName==='#text')return (n.value.match(/__AB_HOLE_\d+__/g)||[]);if(n.nodeName==='#comment')return [];
 const attrs=(n.attrs||[]).filter(a=>!['class','title','aria-label','placeholder'].includes(a.name)).map(a=>[a.name,a.value]).sort();
 if((n.attrs||[]).some(a=>/^on/i.test(a.name)||a.name==='srcdoc'))throw Error('ACTIVE_HTML');
 if(!document&&['script','style','iframe','object','embed','base'].includes(n.tagName))throw Error('ACTIVE_HTML');
 return [n.tagName||n.nodeName,attrs,...(n.childNodes||[]).map(visit)];}
 for(const n of root.childNodes)nodes.push(visit(n));return nodes;
}
function translation(node){if(!ts.isStringLiteralLike(node)||!plain(node.text)||security.test(node.text))return false;const p=node.parent;
 if(ts.isCallExpression(p)&&p.arguments.length===2&&['t','text'].includes(p.expression.getText())&&p.arguments.every(n=>ts.isStringLiteralLike(n)&&plain(n.text)&&!security.test(n.text)))return true;
 if(ts.isPropertyAssignment(p)&&p.initializer===node&&!security.test(p.name.getText())){let a=p;while(a&&!ts.isSourceFile(a)){if(ts.isVariableDeclaration(a)&&/^(words|messages|translations|labels)$/.test(a.name.getText()))return true;a=a.parent;}}
 return false;
}
function fingerprint(node,mask=false){
 if(mask&&ts.isFunctionDeclaration(node)&&node.name&&/^(render\w*|editor|table|head|input|generalFields|creationFields|toolbar|placeholder|search)$/.test(node.name.text))return ['UI_FUNCTION',node.name.text,node.parameters.map(p=>p.getText()),!!node.asteriskToken,(node.modifiers||[]).map(m=>m.kind)];
 if(ts.isTemplateExpression(node)){let i=0,markup=node.head.text;for(const span of node.templateSpans)markup+='__AB_HOLE_'+(i++)+'__'+span.literal.text;return ['template',/<[a-z][\s>]/i.test(markup)||/<[a-z][a-z0-9-]*\b/i.test(markup)?htmlShape(markup):[node.head.text,...node.templateSpans.map(s=>s.literal.text)],node.templateSpans.map(s=>fingerprint(s.expression,mask))];}
 if(ts.isNoSubstitutionTemplateLiteral(node)&&/[<>]/.test(node.text))return ['html',htmlShape(node.text)];
 if(ts.isStringLiteralLike(node))return ['string',translation(node)?'VISIBLE_LABEL':node.text];
 if(ts.isIdentifier(node))return ['id',node.text];if(ts.isNumericLiteral(node))return ['number',node.text];
 const children=[];node.forEachChild(c=>{children.push(fingerprint(c,mask));});return [node.kind,...children];
}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function functions(root){const result=new Map();function visit(n,path=''){if(ts.isFunctionDeclaration(n)&&n.name){const key=path+'/'+n.name.text;if(result.has(key))throw Error('AMBIGUOUS_SYMBOL');result.set(key,n);path=key;}n.forEachChild(c=>visit(c,path));}visit(root);return result;}
function guards(node){const out=[];let child=node;for(let p=node.parent;p&&!ts.isFunctionDeclaration(p)&&!ts.isFunctionExpression(p)&&!ts.isArrowFunction(p);child=p,p=p.parent){if(ts.isIfStatement(p))out.push(['if',fingerprint(p.expression),child===p.thenStatement?'then':child===p.elseStatement?'else':'condition']);if(ts.isConditionalExpression(p))out.push(['conditional',fingerprint(p.condition),child===p.whenTrue?'true':child===p.whenFalse?'false':'condition']);if(ts.isBinaryExpression(p)&&[ts.SyntaxKind.AmpersandAmpersandToken,ts.SyntaxKind.BarBarToken,ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind)&&child===p.right)out.push(['short-circuit',p.operatorToken.kind,fingerprint(p.left)]);}return out;}
function criticalExpressions(root){const out=[];function visit(n){if(ts.isIdentifier(n)&&security.test(n.text)){let a=n;while(a.parent&&!ts.isStatement(a.parent)&&!ts.isSourceFile(a.parent)&&!ts.isBlock(a.parent))a=a.parent;out.push([fingerprint(a),guards(n)]);}n.forEachChild(visit);}visit(root);return out;}
const pureCalls=new Set(['String','Number','Boolean','BigInt','parseInt','parseFloat','isNaN','isFinite','esc','escape','localeText','t','text','normalize','value','compare','condition','searchable','search','numeric','Object.keys','Object.values','Object.entries','Array.isArray','Math.min','Math.max','Math.round','Math.floor','Math.ceil','Math.abs','Math.sign']);
const pureMethods=new Set(['map','filter','some','every','find','findIndex','includes','startsWith','endsWith','slice','join','split','trim','toLowerCase','toUpperCase','toLocaleLowerCase','localeCompare','normalize','replace','replaceAll','sort']);
function safePresentation(root,old){const trusted=new Set();function collect(n){trusted.add(JSON.stringify(fingerprint(n)));n.forEachChild(collect);}collect(old);
 function safe(n){if(trusted.has(JSON.stringify(fingerprint(n))))return true;
 if(ts.isIdentifier(n)&&forbidden.test(n.text))return false;
 if(ts.isPropertyAccessExpression(n)&&forbidden.test(n.name.text))return false;
 if(ts.isElementAccessExpression(n))return false;
 if(ts.isCallExpression(n)){const name=n.expression.getText();if(!pureCalls.has(name)&&!(ts.isPropertyAccessExpression(n.expression)&&pureMethods.has(n.expression.name.text)))return false;}
 if(ts.isBinaryExpression(n)&&n.operatorToken.kind>=ts.SyntaxKind.FirstAssignment&&n.operatorToken.kind<=ts.SyntaxKind.LastAssignment)return false;
 if(ts.isAwaitExpression(n)||ts.isNewExpression(n)||ts.isDeleteExpression(n)||ts.isThrowStatement(n)||ts.isTryStatement(n)||ts.isImportDeclaration(n)||ts.isExportDeclaration(n)||ts.isWithStatement(n)||ts.isWhileStatement(n)||ts.isDoStatement(n)||ts.isForStatement(n)||ts.isForInStatement(n)||ts.isForOfStatement(n))return false;
 if((ts.isPrefixUnaryExpression(n)||ts.isPostfixUnaryExpression(n))&&[ts.SyntaxKind.PlusPlusToken,ts.SyntaxKind.MinusMinusToken].includes(n.operator))return false;
 let okay=true;n.forEachChild(c=>{if(!safe(c))okay=false;});return okay;}
 return safe(root);
}
function controls(root){const out=[];function visit(n){if(ts.isTemplateExpression(n)||ts.isNoSubstitutionTemplateLiteral(n)){let text=ts.isTemplateExpression(n)?n.head.text:n.text;if(ts.isTemplateExpression(n))for(let i=0;i<n.templateSpans.length;i++)text+='__AB_HOLE_'+i+'__'+n.templateSpans[i].literal.text;
 const tree=parseFragment(text);function inspect(x){if((x.attrs||[]).some(a=>a.name==='style'))out.push(['inline-style',x.tagName,(x.attrs||[]).filter(a=>a.name==='style').map(a=>a.value),guards(n)]);if(['button','input','select','textarea','form','a','iframe','script','object','link','meta','base','img','video','audio','source'].includes(x.tagName))out.push([guards(n),x.tagName,(x.attrs||[]).filter(a=>!['class','title','aria-label','placeholder'].includes(a.name)).map(a=>[a.name,a.value]).sort()]);for(const c of x.childNodes||[])inspect(c);}inspect(tree);}
 n.forEachChild(visit);}visit(root);return out;}
export function classifyJs(path,before,after){try{const kind=path.endsWith('.ts')?ts.ScriptKind.TS:ts.ScriptKind.JS,a=ts.createSourceFile(path,before,ts.ScriptTarget.Latest,true,kind),b=ts.createSourceFile(path,after,ts.ScriptTarget.Latest,true,kind);if(a.parseDiagnostics.length||b.parseDiagnostics.length)return 'unknown';
 if(same(fingerprint(a),fingerprint(b)))return 'ordinary';
 if(!same(fingerprint(a,true),fingerprint(b,true)))return 'sensitive';
 const old=functions(a),next=functions(b);if(!same([...old.keys()],[...next.keys()]))return 'unknown';
 for(const [name,n]of next){const prior=old.get(name);if(same(fingerprint(prior),fingerprint(n)))continue;if(!same(criticalExpressions(prior),criticalExpressions(n))||!same(controls(prior),controls(n)))return 'sensitive';if(!safePresentation(n.body,prior.body))return 'unknown';}
 return 'ordinary';
 }catch{return 'unknown';}}
export function safeCss(text){try{let valid=true;const ast=parseCss(text,{positions:false,parseCustomProperty:true,onParseError(){valid=false;}});walkCss(ast,n=>{if(n.type==='Raw'||n.type==='Atrule'&&n.name.toLowerCase()==='import'||n.type==='Declaration'&&/^(behavior|-moz-binding)$/i.test(n.property)||n.type==='Function'&&/^expression$/i.test(n.name))valid=false;if(n.type==='Url'&&!/^(?:#[\w-]+|\/?assets\/[A-Za-z0-9_./-]+\.(?:png|jpg|jpeg|svg|webp|woff2?)(?:#[\w-]+)?)$/.test(n.value))valid=false;});return valid;}catch{return false;}}
export function credentialRisk(path,text){if(/(?:^|\/)\.env(?:\.|$)|\.(?:key|pem|pfx|p12)$|(?:^|\/)(?:id_rsa|credentials)$/i.test(path))return true;return /sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)||/postgres(?:ql)?:\/\/[^\s:'"`]+:[^\s@'"`$]+@(?!127\.0\.0\.1|localhost|[^\s/]+\.test\b)/i.test(text);}
export function classifyChange(c){const {path,before='',after='',status='M',mode='100644'}=c;if(!path||path.startsWith('/')||path.split('/').includes('..')||/[\0\r\n]/.test(path))return {path,risk:'blocked',reason:'INVALID_PATH'};if(mode!=='100644'&&mode!=='100755')return {path,risk:'blocked',reason:'LINK_OR_SUBMODULE'};if(credentialRisk(path,after))return {path,risk:'blocked',reason:'CREDENTIAL_MATERIAL'};if(Buffer.byteLength(before)+Buffer.byteLength(after)>2500000)return {path,risk:'unknown',reason:'REVIEW_SIZE_LIMIT'};
 if(critical.test(path))return {path,risk:'sensitive',reason:'SECURITY_DATA_OR_DELIVERY_CONTROL'};
 if(/^(?:docs\/|README\.md$)/.test(path)||/^(?:tests\/.*\.test\.cjs|backend\/tests\/.*\.test\.ts)$/.test(path))return {path,risk:'ordinary',reason:'NON_RUNTIME_DOCUMENTATION_OR_TEST'};
 if(status==='D'||status==='A')return {path,risk:'unknown',reason:'RUNTIME_ADD_OR_REMOVE_REVIEW'};
 if(path==='styles.css')return {path,risk:safeCss(after)?'ordinary':'unknown',reason:'CSS_VALIDATION'};
 if(path==='index.html'){try{return {path,risk:same(htmlShape(before,true),htmlShape(after,true))?'ordinary':'unknown',reason:'HTML_CONTROL_CONTRACT'};}catch{return {path,risk:'unknown',reason:'ACTIVE_OR_UNPARSED_HTML'};}}
 if(uiFiles.has(path))return {path,risk:classifyJs(path,before,after),reason:'PARSED_PRESENTATION_AND_CONTROL_CONTRACT'};
 return {path,risk:'unknown',reason:'UNRECOGNIZED_CHANGE'};}
export function classifyChanges(changes){const files=changes.map(classifyChange),risk=files.some(f=>f.risk==='blocked')?'blocked':files.some(f=>f.risk==='unknown')?'unknown':files.some(f=>f.risk==='sensitive')?'sensitive':'ordinary';return {format:'AB-CHANGE-RISK-2',risk,requiresOwner:risk==='unknown'||risk==='sensitive',files};}
export function contentHash(text){return digest(text);}
