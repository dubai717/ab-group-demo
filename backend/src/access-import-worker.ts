import {parentPort,workerData} from 'node:worker_threads';
import MDBReader from 'mdb-reader';
try {
 const db=new MDBReader(Buffer.from(workerData)),names=db.getTableNames({normalTables:true,systemTables:false,linkedTables:false});if(names.length>100)throw Error();
 let count=0,expanded=0;
 const tables=names.map(name=>{const t=db.getTable(name);if((count+=t.rowCount)>10000||t.columnCount>100)throw Error();const columns=t.getColumns().map(c=>({name:c.name,type:c.type,nullable:c.nullable}));
 const rows=t.getData({rowLimit:10001}).map((source:any)=>{const row:any={},attachments:any[]=[];for(const col of columns){const v=source[col.name];if(col.type==='complex'&&v){if(!Array.isArray(v))throw Error();for(const a of v){if(!Buffer.isBuffer(a.data))throw Error();expanded+=a.data.length;attachments.push({column:col.name,name:a.name,base64:a.data.toString('base64')});}}else if(Buffer.isBuffer(v)){// Raw OLE is accepted later only if its bytes are a verified image or PDF. Never execute an OLE server.
 expanded+=v.length;attachments.push({column:col.name,name:col.name,base64:v.toString('base64')});}else row[col.name]=v==null?'':v instanceof Date?v.toISOString().slice(0,10):String(v);}
 if(expanded>20e6||JSON.stringify(row).length>100000)throw Error();return{values:row,attachments};});return{name,columns,rows};});
 let relations:any[]=[];if(db.getTableNames({normalTables:false,systemTables:true,linkedTables:false}).includes('MSysRelationships'))relations=db.getTable('MSysRelationships').getData({rowLimit:501}).map((r:any)=>({fromTable:r.szObject,fromColumn:r.szColumn,toTable:r.szReferencedObject,toColumn:r.szReferencedColumn}));
 if(relations.length>500)throw Error();parentPort!.postMessage({tables,relations});
}catch{parentPort!.postMessage({error:'unsupportedOrInvalidAccess'});}
