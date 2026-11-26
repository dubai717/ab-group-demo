import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {z} from 'zod';
import {ApiError,requireOk,sha} from './core.js';
import {financeRight} from './finance.js';
import {need,event} from './ledger-domain.js';
import {customerSpreadsheet} from './customer-spreadsheet.js';
import {importWorkbook} from './import-files.js';

const Csv=createRequire(import.meta.url)('../../customer-policy.js');
const id=z.uuid(), format=z.enum(['csv','xlsx']);
export const accountingTypes=z.enum(['invoice','receipt','voucher','deposit']);
export type AccountingType=z.infer<typeof accountingTypes>;
type NewType=Exclude<AccountingType,'invoice'>;
const permission={receipt:'collect',voucher:'voucher_create',deposit:'deposit'} as const;
const fields:Record<AccountingType,string[]>={
    invoice:['sourceKey','customerNumber','vehicleNumber','plate','itemCode','amount','currency','dueOn'],
    receipt:['sourceKey','customerNumber','invoiceReference','itemCode','amount','currency','receivedOn'],
    voucher:['sourceKey','beneficiary','customerNumber','itemCode','amount','currency','issuedOn','reason'],
    deposit:['sourceKey','bankAccountId','receiptReferences','documentVersionId','amount','currency','effectiveOn'],
};
const titles:Record<string,[string,string]>={
    sourceKey:['مرجع المستند الأصلي','Original document reference'],customerNumber:['رقم ملف العميل','Customer file number'],
    vehicleNumber:['رقم ملف المركبة','Vehicle file number'],plate:['اللوحة','Plate'],
    itemCode:['رمز البند','Item code'],amount:['المبلغ','Amount'],currency:['العملة','Currency'],
    dueOn:['تاريخ الاستحقاق','Due date'],receivedOn:['تاريخ القبض','Receipt date'],issuedOn:['تاريخ الإصدار','Issue date'],
    effectiveOn:['تاريخ الإيداع','Deposit date'],invoiceReference:['مرجع الفاتورة','Invoice number or original reference'],
    beneficiary:['المستفيد','Beneficiary'],reason:['الغرض','Reason'],bankAccountId:['معرّف الحساب البنكي','Bank account ID'],
    receiptReferences:['مراجع سندات القبض مفصولة بفاصلة منقوطة','Receipt references separated by semicolons'],
    documentVersionId:['معرّف إصدار إثبات الإيداع','Deposit evidence version ID'],
};
const optional=new Set(['vehicleNumber','plate','invoiceReference','receiptReferences']);

export const originalReference=(input:string)=>input.normalize('NFKC').trim().toLowerCase();
export const referenceKey=(company:string,type:NewType,source:string)=>'accounting-import:'+company+':'+type+':'+sha(originalReference(source));
export async function importedReference(c:any,company:string,type:NewType,source:string){
    return (await c.query('select value from ab.settings where key=$1',[referenceKey(company,type,source)])).rows[0]?.value;
}
export async function accountingImportLock(c:any,s:any){
    await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[s.tenant_id+':canonical-cash-custody']);
}
type Row={line:number; reference:string; amount:string; currency:string; error?:string; values:Record<string,string>};
type Handler=(c:any,m:any,s:any,company:string,type:NewType,values:Record<string,string>,apply:boolean)=>Promise<any>;
const publicRows=(rows:Row[])=>rows.map(({values,...row})=>row);

export function registerAccountingImports(app:any,route:any,cipher:any,handle:Handler){
    const base='/api/ledger/accounting-imports';
    app.get(base+'/template',route(async(_c:any,m:any,_s:any,req:any)=>{
        const d=z.object({companyId:id,type:accountingTypes,format}).strict().parse(req.query);
        need(m,'invoice_import',d.companyId);
        const keys=fields[d.type];
        const bytes=d.format==='csv'?Buffer.from(keys.join(',')+'\r\n'):importWorkbook(keys.map(key=>({
            key,ar:titles[key][0],en:titles[key][1],type:'text',
            required:!optional.has(key)&&!(key==='customerNumber'&&d.type==='voucher')&&!(key==='itemCode'&&d.type==='receipt'),
        })));
        return {base64:bytes.toString('base64'),filename:d.type+'-import.'+d.format,
            mime:d.format==='csv'?'text/csv;charset=utf-8':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
    }));
    app.post(base,route(async(c:any,m:any,s:any,req:any)=>{
        const d=z.object({companyId:id,type:z.enum(['receipt','voucher','deposit']),format,
            name:z.string().min(1).max(200),base64:z.string().min(4).max(7000000)}).strict().parse(req.body);
        need(m,'invoice_import',d.companyId);
        const bytes=Buffer.from(d.base64,'base64');
        requireOk(bytes.length<=5e6&&bytes.toString('base64')===d.base64,422,'invalidFile');
        const records=d.format==='csv'?Csv.csv(bytes.toString('utf8'),'sourceKey'):await customerSpreadsheet(bytes,'sourceKey');
        requireOk(records.length>0&&records.length<=1000,422,'importLimit');
        await accountingImportLock(c,s);
        const hash=sha(Buffer.concat([Buffer.from(d.type+':'),bytes]));
        const previous=(await c.query('select id,status,payload_cipher from ab.finance_invoice_imports where company_id=$1 and source_hash=$2',[d.companyId,hash])).rows[0];
        if(previous?.status==='Preview')return {id:previous.id,rows:publicRows(cipher.open(previous.payload_cipher).rows)};
        const rows:Row[]=[],seen=new Set<string>();
        const simulate=previous?.status!=='Completed'&&financeRight(m,'ledger_'+permission[d.type],d.companyId);
        if(simulate)await c.query('savepoint accounting_preview');
        for(const [index,record] of (records as Record<string,string>[]).entries()){
            const values=Object.fromEntries(fields[d.type].map(key=>[key,String(record[key]??'').trim()]));
            const row:Row={line:index+1,reference:values.sourceKey,amount:values.amount,currency:values.currency,values};
            try{
                const ref=z.string().min(1).max(120).parse(values.sourceKey);
                if(seen.has(originalReference(ref))||await importedReference(c,d.companyId,d.type,ref))row.error='duplicate';
                else{
                    if(simulate){
                        await c.query('savepoint accounting_preview_row');
                        try{await handle(c,m,s,d.companyId,d.type,values,true);}
                        catch(err){
                            await c.query('rollback to savepoint accounting_preview_row');
                            throw err;
                        }finally{await c.query('release savepoint accounting_preview_row');}
                    }else await handle(c,m,s,d.companyId,d.type,values,false);
                    seen.add(originalReference(ref));
                }
            }catch(error){row.error=rowError(error);}
            rows.push(row);
        }
        if(simulate){
            await c.query('rollback to savepoint accounting_preview');
            await c.query('release savepoint accounting_preview');
        }
        if(previous?.status==='Completed')return {id:previous.id,rows:publicRows(rows),completed:true,result:cipher.open(previous.payload_cipher).result};
        const key=randomUUID();
        const payload=cipher.seal({type:d.type,name:d.name,format:d.format,originalBase64:d.base64,rows});
        await c.query('insert into ab.finance_invoice_imports(id,tenant_id,company_id,source_hash,payload_cipher,created_by) values($1,$2,$3,$4,$5,$6)',[key,s.tenant_id,d.companyId,hash,payload,s.user_id]);
        await event(c,cipher,s,d.companyId,key,'accounting_import_preview',null,{type:d.type,rows:rows.length,sourceHash:hash});
        return {id:key,rows:publicRows(rows)};
    }));
    app.post(base+'/:id/commit',route(async(c:any,m:any,s:any,req:any)=>{
        const {companyId}=z.object({companyId:id}).strict().parse(req.body);
        need(m,'invoice_import',companyId);
        await accountingImportLock(c,s);
        const batch=(await c.query('select * from ab.finance_invoice_imports where company_id=$1 and id=$2 for update',[companyId,id.parse(req.params.id)])).rows[0];
        requireOk(batch,404,'notFound');
        const saved=cipher.open(batch.payload_cipher),type=saved.type as NewType;
        requireOk(Object.hasOwn(permission,type),404,'notFound');
        need(m,permission[type],companyId);
        if(batch.status==='Completed')return saved.result;
        const result={created:[] as any[],duplicate:0,rejected:0,rows:[] as ReturnType<typeof publicRows>};
        for(const row of saved.rows as Row[]){
            let error=row.error;
            if(!error&&await importedReference(c,companyId,type,row.reference))error='duplicate';
            if(!error){
                await c.query('savepoint accounting_import_row');
                try{
                    const value=await handle(c,m,s,companyId,type,row.values,true);
                    await c.query('insert into ab.settings(tenant_id,key,value) values($1,$2,$3)',[
                        s.tenant_id,referenceKey(companyId,type,row.reference),{ids:value.ids,batchId:batch.id},
                    ]);
                    result.created.push({...value,reference:row.reference});
                }catch(err){
                    await c.query('rollback to savepoint accounting_import_row');
                    error=rowError(err);
                }
                await c.query('release savepoint accounting_import_row');
            }
            if(error==='duplicate')result.duplicate++;
            else if(error)result.rejected++;
            result.rows.push(...publicRows([{...row,error}]));
        }
        await c.query("update ab.finance_invoice_imports set status='Completed',payload_cipher=$2 where id=$1",
            [batch.id,cipher.seal({...saved,result})]);
        await event(c,cipher,s,companyId,batch.id,'accounting_import_committed',null,{type,created:result.created.length,duplicate:result.duplicate,rejected:result.rejected});
        return result;
    }));
}
function rowError(error:unknown){
    if(error instanceof ApiError&&error.status<500)return error.code||'invalidRow';
    if(error instanceof z.ZodError)return error.issues[0]?.path.length?'invalidField:'+String(error.issues[0].path[0]):'invalidRow';
    throw error;
}
