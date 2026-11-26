const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

(async()=>{
    const f=JSON.parse(fs.readFileSync('work/financial-package-fixture.json'));
    const browser=await chromium.launch({executablePath:process.env.AB_BROWSER_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('dialog',dialog=>dialog.accept());
    const tab=async id=>{
        await page.locator('.ld-navigation [data-id="'+id+'"]').click();
        await page.locator('.ld-navigation [data-id="'+id+'"][aria-current=true]').waitFor();
    };
    const nativeDialog=()=>page.locator('#ld-dialog');
    const request=async(path,action)=>{
        const response=page.waitForResponse(r=>new URL(r.url()).pathname===path&&r.request().method()==='POST');
        await action();
        const result=await response;
        assert(result.ok(),path+' '+result.status()+' '+await result.text());
        return result.json();
    };
    const artifacts=process.env.AB_FINANCE_ACCEPTANCE_SCREENSHOTS;
    if(artifacts)fs.mkdirSync(artifacts,{recursive:true});
    const shot=async(location,name)=>{if(artifacts)await location.screenshot({path:artifacts+'/'+name+'.png'});};
    try{
        await page.goto('http://127.0.0.1:3646');
        await page.fill('#username',f.username);
        await page.fill('#password',f.password);
        await page.locator('#login-form [type=submit]').click();
        await page.locator('[data-page=financialManagement]').click();
        await page.locator('#ld-company').selectOption(f.companyId);
        await tab('setup');
        await page.locator('[data-fp=new-item]').click();
        const editor=page.locator('dialog[open]').last();
        await editor.locator('[name=nameAr]').fill('بند المراجعة الشهرية');
        await editor.locator('[name=nameEn]').fill('Monthly acceptance item');
        await editor.locator('[name=recurring]').check();
        await editor.locator('[name=recurringAmount]').fill('300');
        await editor.locator('[name=feeConfigured]').check();
        await editor.locator('[name=feeAmount]').fill('50');
        await editor.locator('[name=feeIncome]').selectOption(f.incomeId);
        await editor.locator('details summary').click();
        await editor.locator('[name=receivableId]').selectOption(f.receivableId);
        await editor.locator('[name=revenueId]').selectOption(f.incomeId);
        const created=await request('/api/ledger/items',()=>editor.locator('[type=submit]').click());
        await editor.waitFor({state:'detached'});
        await page.locator('[data-fp-open="'+created.id+'"]').locator('xpath=ancestor::tr').locator('td').first().click();
        await page.locator('[data-fp=item-edit]').click();
        assert.equal(await editor.locator('[name=recurringAmount]').inputValue(),'300');
        assert.equal(await editor.locator('[name=feeAmount]').inputValue(),'50');
        assert.equal(await editor.locator('[name=feeCondition]').inputValue(),'double_monthly_due');
        await editor.locator('[data-cancel]').click();
        const fixtures=await page.evaluate(async({companyId,customerId,itemId})=>{
            const customer=(await ABCentral.api('customers?limit=100')).rows.find(r=>r.id===customerId);
            const book=await ABCentral.api('ledger/workbench?companyId='+companyId);
            return {number:customer.fileNumber,code:book.finance_items.find(r=>r.id===itemId).code};
        },{companyId:f.companyId,customerId:f.customerId,itemId:created.id});
        const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai'}).format(new Date());
        const upload=async(type,header,values)=>{
            await tab('import');
            const pick=page.locator('#ld-import-type [value='+type+']');
            if(!await pick.isChecked())await pick.check();
            const form=page.locator('[data-ld-form=import-preview]');
            const details=page.locator('details').filter({has:form});
            await details.locator(':scope > summary').click();
            await form.locator('[type=file]').setInputFiles({name:'synthetic-'+type+'.csv',mimeType:'text/csv',buffer:Buffer.from(header+'\n'+values.join(','))});
            const base=type==='invoice'?'/api/ledger/invoice-imports':'/api/ledger/accounting-imports';
            const preview=await request(base,()=>form.locator('[type=submit]').click());
            assert(!preview.rows[0].error,JSON.stringify(preview.rows));
            const result=await request(base+'/'+preview.id+'/commit',()=>page.locator('[data-ld=import-commit]').click());
            assert.equal(result.created.length,1,JSON.stringify(result));
            await page.getByText(/الدفعة معتمدة|Batch completed/).waitFor();
            return result.created[0];
        };
        const invoice=await upload('invoice','sourceKey,customerNumber,vehicleNumber,plate,itemCode,amount,currency,dueOn',
            ['REVIEW-INV',fixtures.number,'','',fixtures.code,'300','AED',date]);
        const receipt=await upload('receipt','sourceKey,customerNumber,invoiceReference,itemCode,amount,currency,receivedOn',
            ['REVIEW-RV',fixtures.number,'REVIEW-INV',fixtures.code,'200','AED',date]);
        const deposit=await upload('deposit','sourceKey,bankAccountId,receiptReferences,documentVersionId,amount,currency,effectiveOn',
            ['REVIEW-DEP',f.bankId,'REVIEW-RV',f.proofId,'200','AED',date]);
        await tab('deposits');
        await page.locator('[data-ld=deposit-confirm][data-id="'+deposit.ids[0]+'"]').click();
        await nativeDialog().locator('[name=confirmedAmount]').fill('200');
        await nativeDialog().locator('[name=bankConfirmation]').fill('Synthetic verified deposit');
        await nativeDialog().locator('[name=accountAndDateVerified]').check();
        await request('/api/ledger/deposits/'+deposit.ids[0]+'/confirm',()=>nativeDialog().locator('[type=submit]').click());

        await tab('receivables');
        const receivables=page.locator('[data-receivables]');
        await receivables.getByRole('cell',{name:'100.000',exact:true}).first().waitFor();
        await shot(receivables,'receivables');
        await receivables.locator('[data-rb-row]').first().click();
        await receivables.locator('[data-rb=statement]').click();
        await receivables.getByRole('heading',{name:/كشف الحساب|Statement/}).waitFor();
        const statement=await page.evaluate(async id=>ABCentral.api('ledger/customer-statement?customerId='+id),f.customerId);
        assert.deepEqual(statement.rows.map(r=>[r.type,r.debit,r.credit]),
            [['Invoice','300.000','0.000'],['RV','0.000','200.000']]);
        assert.equal(statement.rows[1].reference,'REVIEW-RV');
        assert.equal(statement.closing[f.companyId+':AED'],'100.000');
        await shot(receivables,'customer-statement');

        const voucher=await upload('voucher','sourceKey,beneficiary,customerNumber,itemCode,amount,currency,issuedOn,reason',
            ['REVIEW-PV','Synthetic approval supplier','','expense','25','AED',date,'Synthetic diagnostics']);
        await tab('vouchers');
        await page.locator('[data-ld=prepare][data-id="'+voucher.ids[0]+'"]').click();
        await nativeDialog().locator('[name=bankAccountId]').selectOption(f.bankId);
        await nativeDialog().locator('[name=chequeNumber]').fill('REVIEW-SYNTHETIC-CHEQUE');
        await nativeDialog().locator('[name=documentVersionId]').selectOption(f.proofId);
        await request('/api/ledger/vouchers/'+voucher.ids[0]+'/prepare',()=>nativeDialog().locator('[type=submit]').click());
        const approval=page.locator('[data-ld-form=approval]');
        await approval.locator('[name=voucherId][value="'+voucher.ids[0]+'"]').check();
        await approval.locator('[name=signedEvidence]').check();
        await request('/api/ledger/vouchers/approval-preview',()=>approval.locator('button.primary-btn').click());
        await request('/api/ledger/vouchers/approval-confirm',()=>page.locator('[data-ld=approval-confirm]').click());

        await tab('documents');
        const registers=[['Invoice',invoice.id,'REVIEW-INV'],['RV',receipt.ids[0],'REVIEW-RV'],
            ['Deposit',deposit.ids[0],'REVIEW-DEP'],['PV',voucher.ids[0],'REVIEW-PV']];
        for(const [type,id,reference] of registers){
            const selector=page.locator('#fp-document-type');
            await selector.selectOption(type);
            const found=await page.evaluate(async({co,type,id})=>(await ABCentral.api('ledger/package/documents?companyId='+co+'&type='+type)).rows.find(r=>r.id===id),{co:f.companyId,type,id});
            assert(found,'Missing '+type+' from financial documents');
            const row=page.locator('[data-fp-open="'+(found.rowKey||found.id)+'"]').locator('xpath=ancestor::tr');
            await row.locator('td').first().click();
            const detail=page.locator('dialog[open]').last();
            await detail.getByText(reference,{exact:true}).waitFor();
            if(type==='PV')await shot(detail,'approved-voucher');
            await detail.locator('[data-close]').click();
            assert(reference===found.reference||reference===found.sourceReference,JSON.stringify(found));
            if(type==='PV')assert.equal(found.status,'Approved');
            if(type==='Deposit')assert.equal(found.status,'Confirmed');
            if(type==='Invoice'){assert.equal(found.outstanding,'100.000');assert.equal(found.status,'Partial');}
        }
        await shot(page.locator('#ld-body'),'financial-documents');
        assert.deepEqual(errors,[]);
        console.log('PASS integrated finance browser: monthly item and fee readback, four imports, deposit verification, 100 AED receivable and statement, approved voucher and all source documents.');
    }catch(error){
        await page.screenshot({path:'work/finance-acceptance-failure.png'});
        console.error(error);
        process.exitCode=1;
    }finally{await browser.close();}
})();
