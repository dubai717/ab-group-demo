(function(root){'use strict';
 const text=(ar,en)=>getLocale()==='ar'?ar:en;
 async function open(type,id){if(!/^[a-z]+$/.test(type)||!/^[a-f0-9-]{36}$/i.test(id))throw Error('invalidRecordLink');const record=await CenterForms.api('record-links/'+type+'/'+id);
 if(type==='company')return ABCentral.openCompany(id);
 if(type==='customer')return CustomerUI.open(id);
 if(type==='vehicle')return VehicleUI.openNotification(id);
 if(type==='investment')return InvestorUI.open(id);
 const dialog=document.createElement('dialog');dialog.className='record-form-dialog';dialog.dataset.centerOwned='1';dialog.innerHTML=`<h2>${CenterForms.esc(text('المعاملة الأصلية','Original record'))}</h2><p>${CenterForms.esc(text('عرض للقراءة فقط','Read-only'))}</p><dl>${Object.entries(record.fields).map(([key,value])=>`<dt>${CenterForms.esc(key)}</dt><dd>${CenterForms.esc(value??'—')}</dd>`).join('')}</dl>${record.original?`<button type="button" data-original>${CenterForms.esc(text('فتح الوحدة الأصلية','Open original module'))}</button>`:''}<button type="button" data-close>${text('إغلاق','Close')}</button>`;document.body.append(dialog);dialog.querySelector('[data-close]').onclick=()=>dialog.remove();dialog.querySelector('[data-original]')?.addEventListener('click',()=>{dialog.remove();app.state.currentPage=record.original.page;render();});dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 }
 let handled='';async function openHash(){if(!ABCentral.actor||handled===location.hash)return;const match=/^#record=([a-z]+)\/([a-f0-9-]{36})$/i.exec(location.hash);if(!match)return;handled=location.hash;try{await open(match[1],match[2]);}catch(err){handled='';alert(err.message);}}
 addEventListener('hashchange',()=>void openHash());root.RecordLinks={open,openHash};
})(globalThis);
