const http = require('http');
const fs = require('fs');
const path = require('path');

const hostname = '0.0.0.0';
const port = process.env.PORT || 3000;
const rootDir = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

// Only application assets are public. In particular, never expose backend/.env,
// migration SQL, test fixtures, source-control metadata or installed packages.
const PUBLIC_FILES = new Set(['index.html','app.js','styles.css','runtime-config.js','central-client.js','register-tools.js','attachment-viewer.js',
  'area-reference.js','company-documents.js','bank-accounts.js','demo-credentials.js',
  'user-management.js','finance-policy.js','finance-workbench.js','ledger-policy.js','ledger-ui.js','workspace-ui.js','auth-flows.js','data/uae-areas.js','assets/Untitled.png','assets/logo.svg']);
const server = http.createServer((req, res) => {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405);res.end();return; }
  let requested;
  try { requested=decodeURIComponent(new URL(req.url,'http://localhost').pathname); }
  catch { res.writeHead(400);res.end();return; }
  const relative=requested==='/'?'index.html':requested.slice(1);
  const pdfFiles={'assets/pdfjs/pdf.mjs':'pdf.min.mjs','assets/pdfjs/pdf.worker.mjs':'pdf.worker.min.mjs','assets/pdfjs/pdf.renderer.mjs':'pdf.renderer.min.mjs'};
  if(pdfFiles[relative]){fs.readFile(path.join(rootDir,'node_modules/pdfjs-dist/build',pdfFiles[relative]),(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':'application/javascript','X-Content-Type-Options':'nosniff'});res.end(err?'Not found':bytes);});return;}
  if(/^assets\/pdfjs\/(cmaps|standard_fonts)\/[a-zA-Z0-9_.-]+\.(bcmap|pfb|ttf)$/.test(relative)){fs.readFile(path.join(rootDir,'node_modules/pdfjs-dist',relative.split('/').slice(2).join('/')),(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':'application/octet-stream'});res.end(err?'Not found':bytes);});return;}
  if (!PUBLIC_FILES.has(relative)) { res.writeHead(404);res.end('Not found');return; }
  fs.readFile(path.join(rootDir,relative),(err,content)=>{
    if(err){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':MIME_TYPES[path.extname(relative).toLowerCase()]||'application/octet-stream','X-Content-Type-Options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:content);
  });
});

server.listen(port, hostname, () => {
  console.log(`AB Group Demo running at http://${hostname}:${port}`);
});
