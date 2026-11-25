import { parentPort, workerData } from 'node:worker_threads';
import MDBReader from 'mdb-reader';

const maxRows=10000;
const maxDecodedBytes=20_000_000;
const pageSize=250;

try {
 const db=new MDBReader(Buffer.from(workerData));
 const names=db.getTableNames({normalTables:true,systemTables:false,linkedTables:false});
 if(names.length>100)throw Error();
 let declaredRows=0,actualRows=0,attachmentBytes=0,textBytes=0;
 const tables=names.map(name=>{
  const table=db.getTable(name);
  if((declaredRows+=table.rowCount)>maxRows||table.columnCount>100)throw Error();
  const columns=table.getColumns().map(c=>({name:c.name,type:c.type,nullable:c.nullable}));
  const rows=[];
  for(let offset=0;;offset+=pageSize){
   const page=table.getData({rowOffset:offset,rowLimit:pageSize});
   actualRows+=page.length;
   if(actualRows>maxRows)throw Error();
   for(const source of page){
    const values:Record<string,string>=Object.create(null);
    const attachments:{column:string;name:string;base64:string}[]=[];
    const attach=(column:string,name:string,data:Buffer)=>{
     attachmentBytes+=data.length;
     if(attachmentBytes>maxDecodedBytes)throw Error();
     attachments.push({column,name,base64:data.toString('base64')});
    };
    for(const col of columns){
     const value=source[col.name];
     if(col.type==='complex'&&value){
      if(!Array.isArray(value))throw Error();
      for(const file of value){
       if(!Buffer.isBuffer(file.data))throw Error();
       attach(col.name,file.name,file.data);
      }
     }else if(Buffer.isBuffer(value)){
      attach(col.name,col.name,value);
     }else{
      values[col.name]=value==null?'':value instanceof Date?value.toISOString().slice(0,10):String(value);
     }
    }
    const bytes=Buffer.byteLength(JSON.stringify(values));
    textBytes+=bytes;
    if(bytes>100_000||textBytes>maxDecodedBytes)throw Error();
    rows.push({values,attachments});
   }
   if(page.length<pageSize)break;
  }
  return {name,columns,rows};
 });
 const hasRelations=db.getTableNames({normalTables:false,systemTables:true,linkedTables:false}).includes('MSysRelationships');
 const relations=hasRelations?db.getTable('MSysRelationships').getData({rowLimit:501}).map(r=>({
  fromTable:r.szObject,fromColumn:r.szColumn,toTable:r.szReferencedObject,toColumn:r.szReferencedColumn,
 })):[];
 if(relations.length>500)throw Error();
 parentPort!.postMessage({tables,relations});
}catch{
 parentPort!.postMessage({error:'unsupportedOrInvalidAccess'});
}
