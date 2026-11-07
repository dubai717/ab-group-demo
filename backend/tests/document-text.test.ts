import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {businessCentersFixture} from './business-centers-fixture.js';
import {extractDocumentText,normalizeDocumentText} from '../src/document-text.js';

test('Local bounded PDF text layers are searchable only through original document access',async()=>{
 const f=await businessCentersFixture();try{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);for(const text of ['alphaunique contract text','betasecond page text'])pdf.addPage().drawText(text,{x:40,y:700,font});
  const bytes=Buffer.from(await pdf.save()),r=await f.req('POST','/api/documents',{companyId:f.co1,category:'other',title:'Neutral title',description:'Neutral metadata',date:'2026-01-01',name:'neutral.pdf',mime:'application/pdf',base64:bytes.toString('base64')});
  const indexed=(await f.admin.query('select * from ab.document_text_index where version_id=$1',[r.versionId])).rows[0];assert.equal(indexed.status,'indexed');assert.equal(indexed.text_cipher.includes('alphaunique'),false);assert.equal(indexed.search_tokens.some((t:string)=>t.includes('alphaunique')),false);
  const result=await f.req('GET','/api/document-center?q=betasecond');assert.equal(result.contentSearch,true);assert.equal(result.rows.length,1);assert.equal(result.rows[0].versionId,r.versionId);assert.equal(JSON.stringify(result).includes('betasecond page text'),false);
  const count=f.objects.rows.size;await f.req('POST','/api/document-center/document/'+r.id+'/index-text',{versionId:r.versionId});assert.equal(f.objects.rows.size,count);assert.equal((await f.admin.query('select count(*)::int n from ab.document_text_index where version_id=$1',[r.versionId])).rows[0].n,1);
  const u=await f.employee();await f.login(u.username,u.password);assert.equal((await f.req('GET','/api/document-center?q=alphaunique')).rows.length,0);await f.req('POST','/api/document-center/document/'+r.id+'/index-text',{versionId:r.versionId},403);
 }finally{await f.close();}
});
test('Text extraction failures are bounded statuses and Arabic normalization is deterministic',async()=>{
 assert.equal(normalizeDocumentText('إِمَارَة'),'امارة');
 assert.equal((await extractDocumentText(Buffer.from('not a PDF'),'image/png')).status,'unsupported');
 const result=await extractDocumentText(Buffer.from('%PDF-1.4 malformed synthetic fixture'),'application/pdf');assert.ok(['failed','timeout'].includes(result.status));assert.equal(result.text,'');
});
